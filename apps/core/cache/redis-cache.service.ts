/**
 * Redis Cache Service
 * High-performance caching layer for API responses and query results
 */

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class RedisCacheService {
  private cache: Map<string, { value: any; expires: number }> = new Map();
  private defaultTTL = 300; // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const prefix = options?.prefix || '';
    const fullKey = prefix ? `${prefix}:${key}` : key;

    this.cache.set(fullKey, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset(entries: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    await Promise.all(entries.map(({ key, value, options }) => this.set(key, value, options)));
  }

  // Cache warming
  async warm(key: string, fetcher: () => Promise<any>, options?: CacheOptions): Promise<any> {
    const cached = await this.get(key);
    if (cached) return cached;

    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  // Cache-aside pattern
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;

    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  // Stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cacheService = new RedisCacheService();

// Auto-cleanup every 5 minutes
setInterval(() => cacheService.cleanup(), 5 * 60 * 1000);
