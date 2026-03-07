/**
 * Query Result Caching Service
 * Implements intelligent caching for database query results
 * Requirements: 4.4
 */

import { monitoringService } from './monitoring.service';

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  hits: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
  tags?: string[]; // Tags for cache invalidation
}

class QueryCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxCacheSize = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Get cached query result
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      monitoringService.incrementCounter('query.cache.miss', { key });
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    const age = now - entry.timestamp.getTime();

    if (age > entry.ttl) {
      this.cache.delete(key);
      monitoringService.incrementCounter('query.cache.expired', { key });
      return null;
    }

    // Update hit count
    entry.hits++;
    monitoringService.incrementCounter('query.cache.hit', { key });

    return entry.data as T;
  }

  /**
   * Set cached query result
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTTL;
    const tags = options.tags || [];

    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
      hits: 0,
    };

    this.cache.set(key, entry);

    // Index by tags
    tags.forEach((tag) => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });

    monitoringService.incrementCounter('query.cache.set', { key });
    monitoringService.setGauge('query.cache.size', this.cache.size);
  }

  /**
   * Execute query with caching
   */
  async cached<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute query
    const startTime = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      // Cache the result
      this.set(key, result, options);

      monitoringService.recordTiming('query.cache.execute', duration, { key });

      return result;
    } catch (error) {
      monitoringService.incrementCounter('query.cache.error', { key });
      throw error;
    }
  }

  /**
   * Invalidate cache by key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    monitoringService.incrementCounter('query.cache.invalidate', { key });
  }

  /**
   * Invalidate cache by tag
   */
  invalidateByTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (!keys) return;

    keys.forEach((key) => {
      this.cache.delete(key);
    });

    this.tagIndex.delete(tag);
    monitoringService.incrementCounter('query.cache.invalidateByTag', { tag });
  }

  /**
   * Invalidate cache by pattern
   */
  invalidateByPattern(pattern: RegExp): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
    });

    monitoringService.incrementCounter('query.cache.invalidateByPattern', {
      count: keysToDelete.length.toString(),
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
    monitoringService.incrementCounter('query.cache.clear');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    entries: Array<{
      key: string;
      age: number;
      hits: number;
      size: number;
    }>;
  } {
    const entries: Array<{
      key: string;
      age: number;
      hits: number;
      size: number;
    }> = [];

    const now = Date.now();
    let totalHits = 0;
    let totalMisses = 0;

    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp.getTime();
      const size = JSON.stringify(entry.data).length;

      entries.push({
        key,
        age,
        hits: entry.hits,
        size,
      });

      totalHits += entry.hits;
    });

    // Get miss count from monitoring service
    const missCounter = monitoringService.getCounter('query.cache.miss');
    totalMisses = missCounter || 0;

    const hitRate = totalHits / (totalHits + totalMisses || 1);

    return {
      size: this.cache.size,
      hitRate,
      entries: entries.sort((a, b) => b.hits - a.hits),
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    let lowestHits = Infinity;

    this.cache.forEach((entry, key) => {
      const timestamp = entry.timestamp.getTime();
      const hits = entry.hits;

      // Prioritize evicting entries with low hits and old age
      const score = hits / (Date.now() - timestamp);

      if (score < lowestHits) {
        lowestHits = score;
        oldestKey = key;
        oldestTime = timestamp;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
      monitoringService.incrementCounter('query.cache.evict', { key: oldestKey });
    }
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp.getTime();
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
    });

    if (keysToDelete.length > 0) {
      monitoringService.incrementCounter('query.cache.cleanup', {
        count: keysToDelete.length.toString(),
      });
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const queryCacheService = new QueryCacheService();

/**
 * Generate cache key from query parameters
 */
export function generateCacheKey(
  model: string,
  action: string,
  params: any
): string {
  const paramsStr = JSON.stringify(params, Object.keys(params).sort());
  return `${model}:${action}:${paramsStr}`;
}

/**
 * Decorator for caching query results
 */
export function Cached(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = options.key || `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      return queryCacheService.cached(
        key,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}
