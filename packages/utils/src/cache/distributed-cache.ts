/**
 * Distributed Redis Cache
 * 
 * Provides a distributed caching layer using Redis that works across
 * multiple worker instances. Replaces in-memory caches with Redis-backed storage.
 */

import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'distributed-cache' });

export interface CacheConfig {
  redisUrl?: string;
  keyPrefix?: string;
  defaultTTL?: number; // seconds
  maxRetries?: number;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  hits: number;
}

class DistributedCache {
  private static instance: DistributedCache;
  private redis: Redis | null = null;
  private config: CacheConfig;
  private isConnected = false;

  private constructor(config: CacheConfig = {}) {
    this.config = {
      redisUrl: config.redisUrl || process.env.REDIS_URL || 
        `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
      keyPrefix: config.keyPrefix || 'cache:',
      defaultTTL: config.defaultTTL || 3600, // 1 hour default
      maxRetries: config.maxRetries || 3,
    };
  }

  public static getInstance(config?: CacheConfig): DistributedCache {
    if (!DistributedCache.instance) {
      DistributedCache.instance = new DistributedCache(config);
    }
    return DistributedCache.instance;
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.redis) {
      return;
    }

    try {
      this.redis = new Redis(this.config.redisUrl!, {
        maxRetriesPerRequest: this.config.maxRetries,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        lazyConnect: true,
      });

      await this.redis.connect();
      await this.redis.ping();
      this.isConnected = true;
      logger.info('Distributed cache connected to Redis');
    } catch (error) {
      logger.error({ error }, 'Failed to connect distributed cache to Redis');
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Get a cached value
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redis) {
      await this.connect().catch(() => null);
      if (!this.redis) return null;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      const cached = await this.redis.get(fullKey);
      
      if (!cached) {
        return null;
      }

      const entry = JSON.parse(cached) as CacheEntry<T>;
      
      // Check if expired (Redis TTL should handle this, but double-check)
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      // Update hit counter asynchronously
      entry.hits++;
      this.redis.set(fullKey, JSON.stringify(entry), 'KEEPTTL').catch(() => {});

      return entry.data;
    } catch (error) {
      logger.warn({ error, key }, 'Cache get failed');
      return null;
    }
  }

  /**
   * Set a cached value
   */
  public async set<T>(key: string, data: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected || !this.redis) {
      await this.connect().catch(() => null);
      if (!this.redis) return false;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      const ttl = ttlSeconds || this.config.defaultTTL!;
      
      const entry: CacheEntry<T> = {
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (ttl * 1000),
        hits: 0,
      };

      await this.redis.setex(fullKey, ttl, JSON.stringify(entry));
      return true;
    } catch (error) {
      logger.warn({ error, key }, 'Cache set failed');
      return false;
    }
  }

  /**
   * Get or set a cached value (cache-aside pattern)
   */
  public async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Cache it (don't await to avoid blocking)
    this.set(key, data, ttlSeconds).catch(() => {});

    return data;
  }

  /**
   * Delete a cached value
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const fullKey = this.config.keyPrefix + key;
      await this.redis.del(fullKey);
      return true;
    } catch (error) {
      logger.warn({ error, key }, 'Cache delete failed');
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  public async deletePattern(pattern: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      const fullPattern = this.config.keyPrefix + pattern;
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) return 0;
      
      const deleted = await this.redis.del(...keys);
      return deleted;
    } catch (error) {
      logger.warn({ error, pattern }, 'Cache delete pattern failed');
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const fullKey = this.config.keyPrefix + key;
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
  }> {
    if (!this.redis || !this.isConnected) {
      return { connected: false, keyCount: 0, memoryUsage: '0' };
    }

    try {
      const keys = await this.redis.keys(this.config.keyPrefix + '*');
      const info = await this.redis.info('memory');
      const memMatch = info.match(/used_memory_human:(\S+)/);
      
      return {
        connected: true,
        keyCount: keys.length,
        memoryUsage: memMatch && memMatch[1] ? memMatch[1] : 'unknown',
      };
    } catch (error) {
      return { connected: false, keyCount: 0, memoryUsage: '0' };
    }
  }

  /**
   * Clear all cache entries (with prefix)
   */
  public async clear(): Promise<number> {
    return this.deletePattern('*');
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      logger.info('Distributed cache disconnected');
    }
  }
}

export const distributedCache = DistributedCache.getInstance();

// Specialized caches with different prefixes and TTLs

/**
 * OCR result cache - stores extracted text from documents
 */
export const ocrCache = {
  async get(fileHash: string): Promise<{ text: string; timestamp: number } | null> {
    return distributedCache.get(`ocr:${fileHash}`);
  },
  
  async set(fileHash: string, text: string): Promise<boolean> {
    return distributedCache.set(
      `ocr:${fileHash}`,
      { text, timestamp: Date.now() },
      86400 // 24 hours
    );
  },

  async delete(fileHash: string): Promise<boolean> {
    return distributedCache.delete(`ocr:${fileHash}`);
  },
};

/**
 * Artifact cache - stores generated artifacts
 */
export const artifactCache = {
  async get(contractId: string, artifactType: string): Promise<any | null> {
    return distributedCache.get(`artifact:${contractId}:${artifactType}`);
  },
  
  async set(contractId: string, artifactType: string, data: any): Promise<boolean> {
    return distributedCache.set(
      `artifact:${contractId}:${artifactType}`,
      { data, timestamp: Date.now() },
      3600 // 1 hour
    );
  },

  async invalidate(contractId: string): Promise<number> {
    return distributedCache.deletePattern(`artifact:${contractId}:*`);
  },
};

/**
 * Contract metadata cache
 */
export const contractCache = {
  async get(contractId: string): Promise<any | null> {
    return distributedCache.get(`contract:${contractId}`);
  },
  
  async set(contractId: string, data: any): Promise<boolean> {
    return distributedCache.set(`contract:${contractId}`, data, 300); // 5 minutes
  },

  async invalidate(contractId: string): Promise<boolean> {
    return distributedCache.delete(`contract:${contractId}`);
  },

  async invalidateTenant(tenantId: string): Promise<number> {
    return distributedCache.deletePattern(`contract:*:${tenantId}`);
  },
};

/**
 * Rate limit cache for API endpoints
 */
export const rateLimitCache = {
  async increment(key: string, windowSeconds: number = 60): Promise<number> {
    const cache = DistributedCache.getInstance();
    await cache.connect();
    
    // Use Redis INCR for atomic counter
    const fullKey = `ratelimit:${key}`;
    
    // @ts-ignore - accessing internal redis
    const redis = (cache as any).redis as Redis;
    if (!redis) return 0;
    
    const count = await redis.incr(fullKey);
    if (count === 1) {
      await redis.expire(fullKey, windowSeconds);
    }
    
    return count;
  },

  async getCount(key: string): Promise<number> {
    const cached = await distributedCache.get<{ count: number }>(`ratelimit:${key}`);
    return cached?.count || 0;
  },

  async reset(key: string): Promise<boolean> {
    return distributedCache.delete(`ratelimit:${key}`);
  },
};
