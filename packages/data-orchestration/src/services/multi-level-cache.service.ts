import Redis from 'ioredis';

// In-memory cache (L1)
class MemoryCache {
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  private maxSize: number = 1000;

  set(key: string, value: any, ttlSeconds: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Redis cache (L2)
class RedisCache {
  private client: typeof Redis.prototype | null = null;
  private connected: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Initialize Redis client
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.connected = true;
        console.log('✅ Redis cache connected');
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis cache error:', err);
        this.connected = false;
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.connected || !this.client) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async clear(pattern?: string): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      if (pattern) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } else {
        await this.client.flushdb();
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Multi-level cache service
export class MultiLevelCacheService {
  private l1Cache: MemoryCache;
  private l2Cache: RedisCache;
  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    misses: 0,
    sets: 0,
  };

  constructor() {
    this.l1Cache = new MemoryCache();
    this.l2Cache = new RedisCache();
  }

  /**
   * Get value from cache (checks L1 then L2)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first
    const l1Value = this.l1Cache.get(key);
    if (l1Value !== null) {
      this.stats.l1Hits++;
      return l1Value as T;
    }

    // Try L2 cache (Redis)
    const l2Value = await this.l2Cache.get(key);
    if (l2Value !== null) {
      this.stats.l2Hits++;
      // Promote to L1 cache
      this.l1Cache.set(key, l2Value, 300); // 5 min in L1
      return l2Value as T;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in both cache levels
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    this.stats.sets++;

    // Set in L1 cache (shorter TTL)
    const l1Ttl = Math.min(ttlSeconds, 300); // Max 5 min in L1
    this.l1Cache.set(key, value, l1Ttl);

    // Set in L2 cache (full TTL)
    await this.l2Cache.set(key, value, ttlSeconds);
  }

  /**
   * Delete from both cache levels
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.l2Cache.delete(key);
  }

  /**
   * Clear cache (optionally by pattern)
   */
  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      // For L1, we need to iterate and match
      // For simplicity, just clear all L1 if pattern is provided
      this.l1Cache.clear();
      await this.l2Cache.clear(pattern);
    } else {
      this.l1Cache.clear();
      await this.l2Cache.clear();
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(entries: Array<{ key: string; value: any; ttl: number }>): Promise<void> {
    await Promise.all(entries.map((entry) => this.set(entry.key, entry.value, entry.ttl)));
    console.log(`✅ Cache warmed with ${entries.length} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? ((this.stats.l1Hits + this.stats.l2Hits) / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      totalRequests,
      hitRate: hitRate.toFixed(2) + '%',
      l1Size: this.l1Cache.size(),
      l2Connected: this.l2Cache.isConnected(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0,
    };
  }
}

// Singleton instance
export const multiLevelCache = new MultiLevelCacheService();

// Cache key builders
export const CacheKeys = {
  benchmark: (tenantId: string, criteria: string) => `benchmark:${tenantId}:${criteria}`,
  rateCard: (id: string) => `ratecard:${id}`,
  forecast: (rateCardId: string) => `forecast:${rateCardId}`,
  cluster: (tenantId: string) => `cluster:${tenantId}`,
  supplierScore: (supplierId: string) => `supplier:${supplierId}`,
  marketIntelligence: (tenantId: string, filters: string) => `market:${tenantId}:${filters}`,
  opportunities: (tenantId: string) => `opportunities:${tenantId}`,
};

// Cache TTLs (in seconds)
export const CacheTTL = {
  benchmark: 3600, // 1 hour
  rateCard: 1800, // 30 minutes
  forecast: 86400, // 24 hours
  cluster: 3600, // 1 hour
  supplierScore: 3600, // 1 hour
  marketIntelligence: 1800, // 30 minutes
  opportunities: 1800, // 30 minutes
};
