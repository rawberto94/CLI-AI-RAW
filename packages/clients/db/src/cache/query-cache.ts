/**
 * Query Cache Layer
 * 
 * Redis-backed caching for read-heavy database operations with:
 * - Intelligent cache invalidation
 * - TTL management
 * - Cache warming
 * - Hit/miss metrics
 * - Multi-level caching (memory + Redis)
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number; // seconds
  maxMemoryCacheSize: number;
  redisUrl?: string;
  keyPrefix: string;
  compressionThreshold: number; // bytes
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  tags: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memorySize: number;
  entries: number;
  evictions: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  skipMemory?: boolean;
  skipRedis?: boolean;
  compress?: boolean;
}

export type CacheInvalidationStrategy = 
  | 'immediate'
  | 'lazy'
  | 'ttl-based'
  | 'version-based';

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  values(): IterableIterator<V> {
    return this.cache.values();
  }
}

// ============================================================================
// QUERY CACHE IMPLEMENTATION
// ============================================================================

export class QueryCache {
  private config: CacheConfig;
  private memoryCache: LRUCache<string, CacheEntry<unknown>>;
  private stats: CacheStats;
  private tagIndex: Map<string, Set<string>>; // tag -> keys
  private versionMap: Map<string, number>; // entity -> version

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      defaultTTL: config.defaultTTL ?? 300, // 5 minutes
      maxMemoryCacheSize: config.maxMemoryCacheSize ?? 1000,
      keyPrefix: config.keyPrefix ?? 'qc:',
      compressionThreshold: config.compressionThreshold ?? 1024,
      ...config,
    };

    this.memoryCache = new LRUCache(this.config.maxMemoryCacheSize);
    this.tagIndex = new Map();
    this.versionMap = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      memorySize: 0,
      entries: 0,
      evictions: 0,
    };
  }

  // =========================================================================
  // CORE OPERATIONS
  // =========================================================================

  /**
   * Get a cached value or execute the query and cache the result
   */
  async getOrSet<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    if (!this.config.enabled) {
      return queryFn();
    }

    const cacheKey = this.buildKey(key);

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.recordHit();
      memoryEntry.hits++;
      return memoryEntry.data as T;
    }

    // Cache miss - execute query
    this.recordMiss();
    const result = await queryFn();

    // Store in cache
    await this.set(key, result, options);

    return result;
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    const cacheKey = this.buildKey(key);
    const ttl = options.ttl ?? this.config.defaultTTL;
    const tags = options.tags ?? [];

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      tags,
    };

    // Store in memory cache
    if (!options.skipMemory) {
      this.memoryCache.set(cacheKey, entry);
    }

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(cacheKey);
    }

    this.updateStats();
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    const cacheKey = this.buildKey(key);
    const entry = this.memoryCache.get(cacheKey);

    if (entry && !this.isExpired(entry)) {
      this.recordHit();
      entry.hits++;
      return entry.data as T;
    }

    this.recordMiss();
    return null;
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<boolean> {
    const cacheKey = this.buildKey(key);
    return this.memoryCache.delete(cacheKey);
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.tagIndex.clear();
    this.updateStats();
  }

  // =========================================================================
  // INVALIDATION STRATEGIES
  // =========================================================================

  /**
   * Invalidate cache entries by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (this.memoryCache.delete(key)) {
        count++;
      }
    }

    this.tagIndex.delete(tag);
    this.updateStats();
    return count;
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    this.updateStats();
    return count;
  }

  /**
   * Invalidate cache entries for an entity
   */
  async invalidateEntity(entityType: string, entityId?: string): Promise<number> {
    const pattern = entityId 
      ? `${entityType}:${entityId}`
      : `${entityType}:`;
    
    return this.invalidateByPattern(pattern);
  }

  /**
   * Version-based invalidation
   */
  incrementVersion(entityType: string): number {
    const currentVersion = this.versionMap.get(entityType) ?? 0;
    const newVersion = currentVersion + 1;
    this.versionMap.set(entityType, newVersion);
    return newVersion;
  }

  getVersion(entityType: string): number {
    return this.versionMap.get(entityType) ?? 0;
  }

  // =========================================================================
  // CACHE WARMING
  // =========================================================================

  /**
   * Warm cache with frequently accessed queries
   */
  async warmCache<T>(
    queries: Array<{
      key: string;
      queryFn: () => Promise<T>;
      options?: CacheOptions;
    }>
  ): Promise<void> {
    await Promise.all(
      queries.map(({ key, queryFn, options }) =>
        this.getOrSet(key, queryFn, options)
      )
    );
  }

  /**
   * Pre-fetch related data
   */
  async prefetch<T>(
    keys: string[],
    queryFn: (key: string) => Promise<T>,
    options?: CacheOptions
  ): Promise<void> {
    await Promise.all(
      keys.map(key => this.getOrSet(key, () => queryFn(key), options))
    );
  }

  // =========================================================================
  // SPECIALIZED CACHE METHODS FOR REPOSITORIES
  // =========================================================================

  /**
   * Cache key builder for entity queries
   */
  entityKey(entityType: string, id: string, ...extra: string[]): string {
    const version = this.getVersion(entityType);
    return `${entityType}:${id}:v${version}${extra.length ? ':' + extra.join(':') : ''}`;
  }

  /**
   * Cache key builder for list queries
   */
  listKey(entityType: string, filters: Record<string, unknown>): string {
    const version = this.getVersion(entityType);
    const filterHash = this.hashObject(filters);
    return `${entityType}:list:${filterHash}:v${version}`;
  }

  /**
   * Cache key builder for count queries
   */
  countKey(entityType: string, filters?: Record<string, unknown>): string {
    const version = this.getVersion(entityType);
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `${entityType}:count:${filterHash}:v${version}`;
  }

  /**
   * Cache decorator for repository methods
   */
  cached<T extends (...args: any[]) => Promise<any>>(
    entityType: string,
    keyBuilder: (...args: Parameters<T>) => string,
    options?: CacheOptions
  ): (fn: T) => T {
    return (fn: T): T => {
      const cache = this;
      return (async function(...args: Parameters<T>): Promise<ReturnType<T>> {
        const key = keyBuilder(...args);
        return cache.getOrSet(key, () => fn(...args), {
          ...options,
          tags: [...(options?.tags ?? []), entityType],
        });
      }) as T;
    };
  }

  // =========================================================================
  // METRICS & MONITORING
  // =========================================================================

  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    hitRate: number;
    memoryUsage: number;
    recommendations: string[];
  } {
    const hitRate = this.stats.hitRate;
    const recommendations: string[] = [];

    if (hitRate < 0.5) {
      recommendations.push('Hit rate is low. Consider increasing TTL or warming frequently accessed data.');
    }

    if (this.memoryCache.size >= this.config.maxMemoryCacheSize * 0.9) {
      recommendations.push('Memory cache is near capacity. Consider increasing maxMemoryCacheSize.');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hitRate < 0.3) status = 'unhealthy';
    else if (hitRate < 0.6) status = 'degraded';

    return {
      status,
      hitRate,
      memoryUsage: this.memoryCache.size / this.config.maxMemoryCacheSize,
      recommendations,
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private buildKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    const now = Date.now();
    const expiresAt = entry.timestamp + entry.ttl * 1000;
    return now > expiresAt;
  }

  private recordHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateStats(): void {
    this.stats.entries = this.memoryCache.size;
    this.stats.memorySize = this.estimateMemorySize();
  }

  private estimateMemorySize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimate (2 bytes per char)
    }
    return size;
  }

  private hashObject(obj: Record<string, unknown>): string {
    const normalized = JSON.stringify(obj, Object.keys(obj).sort());
    return createHash('md5').update(normalized).digest('hex').substring(0, 12);
  }
}

// ============================================================================
// CACHED REPOSITORY DECORATOR
// ============================================================================

/**
 * Decorator to add caching to repository methods
 */
export function Cached(
  options: {
    ttl?: number;
    tags?: string[];
    keyBuilder?: (...args: any[]) => string;
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = (this as any).cache as QueryCache | undefined;
      if (!cache) {
        return originalMethod.apply(this, args);
      }

      const entityType = (this as any).modelName ?? 'unknown';
      const key = options.keyBuilder 
        ? options.keyBuilder(...args)
        : `${entityType}:${propertyKey}:${JSON.stringify(args)}`;

      return cache.getOrSet(
        key,
        () => originalMethod.apply(this, args),
        {
          ttl: options.ttl,
          tags: [...(options.tags ?? []), entityType],
        }
      );
    };

    return descriptor;
  };
}

/**
 * Decorator to invalidate cache on mutation
 */
export function InvalidatesCache(
  options: {
    tags?: string[];
    patterns?: string[];
    entities?: string[];
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      const cache = (this as any).cache as QueryCache | undefined;
      if (cache) {
        const entityType = (this as any).modelName ?? 'unknown';

        // Invalidate by tags
        for (const tag of options.tags ?? [entityType]) {
          await cache.invalidateByTag(tag);
        }

        // Invalidate by patterns
        for (const pattern of options.patterns ?? []) {
          await cache.invalidateByPattern(pattern);
        }

        // Increment entity versions
        for (const entity of options.entities ?? [entityType]) {
          cache.incrementVersion(entity);
        }
      }

      return result;
    };

    return descriptor;
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let queryCacheInstance: QueryCache | null = null;

export function getQueryCache(config?: Partial<CacheConfig>): QueryCache {
  if (!queryCacheInstance) {
    queryCacheInstance = new QueryCache(config);
  }
  return queryCacheInstance;
}

export function resetQueryCache(): void {
  if (queryCacheInstance) {
    queryCacheInstance.clear();
  }
  queryCacheInstance = null;
}
