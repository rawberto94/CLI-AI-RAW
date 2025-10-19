/**
 * Smart Cache Service
 * 
 * Implements intelligent caching with:
 * - Selective invalidation (not pattern-based)
 * - Multi-level cache hierarchy
 * - Cache warming for common queries
 * - Query result caching with dependency tracking
 */

import { cacheAdaptor } from '../dal/cache.adaptor';
import pino from 'pino';

const logger = pino({ name: 'smart-cache-service' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

interface CacheEntry<T> {
  data: T;
  dependencies: string[]; // Related cache keys
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

// =========================================================================
// SMART CACHE SERVICE
// =========================================================================

export class SmartCacheService {
  private static instance: SmartCacheService;
  
  // In-memory L1 cache (fast, small)
  private l1Cache = new Map<string, CacheEntry<any>>();
  private readonly L1_MAX_SIZE = 1000;
  private readonly L1_TTL = 100; // 100ms
  
  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
  };

  private constructor() {
    logger.info('Smart Cache Service initialized');
    this.startCleanupInterval();
  }

  static getInstance(): SmartCacheService {
    if (!SmartCacheService.instance) {
      SmartCacheService.instance = new SmartCacheService();
    }
    return SmartCacheService.instance;
  }

  // =========================================================================
  // MULTI-LEVEL CACHE GET/SET
  // =========================================================================

  /**
   * Get value from cache (L1 -> L2 -> miss)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first (in-memory)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && Date.now() - l1Entry.createdAt < this.L1_TTL) {
      l1Entry.accessCount++;
      l1Entry.lastAccessed = Date.now();
      this.stats.hits++;
      this.stats.l1Hits++;
      logger.debug({ key, level: 'L1' }, 'Cache hit');
      return l1Entry.data as T;
    }

    // Try L2 cache (Redis)
    const l2Value = await cacheAdaptor.get<T>(key);
    if (l2Value !== null) {
      // Promote to L1 cache
      this.setL1(key, l2Value, []);
      this.stats.hits++;
      this.stats.l2Hits++;
      logger.debug({ key, level: 'L2' }, 'Cache hit');
      return l2Value;
    }

    // Cache miss
    this.stats.misses++;
    logger.debug({ key }, 'Cache miss');
    return null;
  }

  /**
   * Set value in both cache levels
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number,
    dependencies: string[] = []
  ): Promise<void> {
    // Set in L2 (Redis) with full TTL
    await cacheAdaptor.set(key, value, ttl);

    // Set in L1 (memory) with short TTL
    this.setL1(key, value, dependencies);

    logger.debug({ key, dependencies: dependencies.length }, 'Cache set');
  }

  /**
   * Set value in L1 cache only
   */
  private setL1<T>(key: string, value: T, dependencies: string[]): void {
    // Evict if cache is full
    if (this.l1Cache.size >= this.L1_MAX_SIZE) {
      this.evictL1();
    }

    this.l1Cache.set(key, {
      data: value,
      dependencies,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Evict least recently used entry from L1
   */
  private evictL1(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      logger.debug({ key: oldestKey }, 'L1 cache eviction');
    }
  }

  // =========================================================================
  // SELECTIVE INVALIDATION
  // =========================================================================

  /**
   * Invalidate specific cache keys (not pattern-based)
   */
  async invalidate(keys: string[]): Promise<void> {
    logger.info({ keys: keys.length }, 'Invalidating cache keys');

    // Remove from L1
    for (const key of keys) {
      this.l1Cache.delete(key);
    }

    // Remove from L2
    await Promise.all(keys.map(key => cacheAdaptor.delete(key)));

    // Also invalidate dependent keys
    const dependentKeys = this.findDependentKeys(keys);
    if (dependentKeys.length > 0) {
      logger.debug({ dependentKeys: dependentKeys.length }, 'Invalidating dependent keys');
      await this.invalidate(dependentKeys);
    }
  }

  /**
   * Find keys that depend on the given keys
   */
  private findDependentKeys(keys: string[]): string[] {
    const dependentKeys = new Set<string>();

    for (const [cacheKey, entry] of this.l1Cache.entries()) {
      for (const key of keys) {
        if (entry.dependencies.includes(key)) {
          dependentKeys.add(cacheKey);
        }
      }
    }

    return Array.from(dependentKeys);
  }

  /**
   * Invalidate cache for contract changes
   */
  async invalidateContract(tenantId: string, contractId: string, changes: any): Promise<void> {
    const keysToInvalidate: string[] = [
      // Direct contract cache
      `contract:${tenantId}:${contractId}`,
      
      // Artifact cache
      `artifacts:${contractId}`,
    ];

    // Selectively invalidate query caches based on what changed
    if (changes.status) {
      keysToInvalidate.push(
        `contracts:${tenantId}:status:${changes.status}`,
        `contracts:${tenantId}:list:status:${changes.status}`
      );
    }

    if (changes.contractType) {
      keysToInvalidate.push(
        `contracts:${tenantId}:type:${changes.contractType}`,
        `contracts:${tenantId}:list:type:${changes.contractType}`
      );
    }

    if (changes.clientId || changes.clientName) {
      keysToInvalidate.push(
        `contracts:${tenantId}:client:${changes.clientId || changes.clientName}`,
        `contracts:${tenantId}:list:client:${changes.clientId || changes.clientName}`
      );
    }

    if (changes.supplierId || changes.supplierName) {
      keysToInvalidate.push(
        `contracts:${tenantId}:supplier:${changes.supplierId || changes.supplierName}`,
        `contracts:${tenantId}:list:supplier:${changes.supplierId || changes.supplierName}`
      );
    }

    // Invalidate recent lists (always affected)
    keysToInvalidate.push(
      `contracts:${tenantId}:list:recent`,
      `contracts:${tenantId}:list:all`
    );

    await this.invalidate(keysToInvalidate);
  }

  // =========================================================================
  // CACHE WARMING
  // =========================================================================

  /**
   * Warm cache with common queries
   */
  async warmCache(tenantId: string, warmingFn: (query: any) => Promise<any>): Promise<void> {
    logger.info({ tenantId }, 'Warming cache');

    const commonQueries = [
      // Recent contracts
      {
        key: `contracts:${tenantId}:list:recent`,
        query: { tenantId, sortBy: 'createdAt', sortOrder: 'desc', limit: 20 },
      },
      
      // Completed contracts
      {
        key: `contracts:${tenantId}:list:status:COMPLETED`,
        query: { tenantId, status: 'COMPLETED', limit: 20 },
      },
      
      // Processing contracts
      {
        key: `contracts:${tenantId}:list:status:PROCESSING`,
        query: { tenantId, status: 'PROCESSING', limit: 20 },
      },
      
      // All contracts (first page)
      {
        key: `contracts:${tenantId}:list:all`,
        query: { tenantId, limit: 20, page: 1 },
      },
    ];

    // Warm cache in parallel
    await Promise.all(
      commonQueries.map(async ({ key, query }) => {
        try {
          const result = await warmingFn(query);
          await this.set(key, result, 300, []); // 5 minute TTL
          logger.debug({ key }, 'Cache warmed');
        } catch (error) {
          logger.warn({ error, key }, 'Failed to warm cache');
        }
      })
    );

    logger.info({ tenantId, queries: commonQueries.length }, 'Cache warming complete');
  }

  // =========================================================================
  // QUERY RESULT CACHING
  // =========================================================================

  /**
   * Generate deterministic cache key for query
   */
  generateQueryKey(tenantId: string, query: any): string {
    // Sort keys for deterministic key generation
    const sortedQuery = Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key];
        return acc;
      }, {} as any);

    const queryHash = JSON.stringify(sortedQuery);
    return `contracts:${tenantId}:query:${this.hashString(queryHash)}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache query result with dependencies
   */
  async cacheQueryResult<T>(
    tenantId: string,
    query: any,
    result: T,
    ttl: number = 300
  ): Promise<void> {
    const key = this.generateQueryKey(tenantId, query);
    
    // Track dependencies based on query parameters
    const dependencies: string[] = [];
    
    if (query.status) {
      dependencies.push(`contracts:${tenantId}:status:${query.status}`);
    }
    
    if (query.contractType) {
      dependencies.push(`contracts:${tenantId}:type:${query.contractType}`);
    }
    
    if (query.clientId || query.clientName) {
      dependencies.push(`contracts:${tenantId}:client:${query.clientId || query.clientName}`);
    }

    await this.set(key, result, ttl, dependencies);
  }

  // =========================================================================
  // STATISTICS AND MONITORING
  // =========================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalKeys: this.l1Cache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate L1 cache memory usage
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.l1Cache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry.data).length * 2;
    }
    return size;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    this.l1Cache.clear();
    // Note: Redis clear would need to be implemented in cacheAdaptor
    logger.info('All caches cleared');
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  /**
   * Start cleanup interval for expired L1 entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.l1Cache.entries()) {
        if (now - entry.createdAt > this.L1_TTL) {
          this.l1Cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug({ cleaned }, 'L1 cache cleanup');
      }
    }, 1000); // Run every second
  }
}

export const smartCacheService = SmartCacheService.getInstance();
