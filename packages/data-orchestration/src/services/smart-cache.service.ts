/**
 * Smart Cache Service
 * Provides intelligent caching with TTL and invalidation strategies
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SmartCacheService {
  private static instance: SmartCacheService;
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number = 300000; // 5 minutes

  private constructor() {
    this.cache = new Map();
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  public static getInstance(): SmartCacheService {
    if (!SmartCacheService.instance) {
      SmartCacheService.instance = new SmartCacheService();
    }
    return SmartCacheService.instance;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Invalidate contract cache
   */
  async invalidateContract(contractId: string): Promise<void> {
    await this.deletePattern(`contract:${contractId}:*`);
  }

  /**
   * Generate query key
   */
  generateQueryKey(prefix: string, params: any): string {
    const paramsStr = JSON.stringify(params);
    return `${prefix}:${paramsStr}`;
  }

  /**
   * Cache query result
   */
  async cacheQueryResult(key: string, result: any, ttl?: number): Promise<void> {
    await this.set(key, result, ttl);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

export const smartCacheService = SmartCacheService.getInstance();
