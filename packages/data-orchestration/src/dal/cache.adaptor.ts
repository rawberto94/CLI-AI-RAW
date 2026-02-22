import Redis from "ioredis";
import { createLogger } from "../utils/logger";

const logger = createLogger("cache-adaptor");

// Check if we're in build mode (no actual Redis connection needed)
const IS_BUILD_MODE = process.env.NODE_ENV === 'production' && !process.env.REDIS_URL;

// Null cache adaptor for build time - all operations are no-ops
class NullCacheAdaptor {
  async get<T>(): Promise<T | null> { return null; }
  async set(): Promise<void> {}
  async del(): Promise<void> {}
  async exists(): Promise<boolean> { return false; }
  async ttl(): Promise<number> { return -1; }
  async keys(): Promise<string[]> { return []; }
  async scan(): Promise<{ cursor: string; keys: string[] }> { return { cursor: '0', keys: [] }; }
  async healthCheck(): Promise<boolean> { return false; }
  async disconnect(): Promise<void> {}
  getClient(): unknown { return null; }
}

export class CacheAdaptor {
  private client: InstanceType<typeof Redis>;
  private static instance: CacheAdaptor | NullCacheAdaptor;

  private constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 5000);
      },
      lazyConnect: false,
    });
    this.client.on("error", (err) => logger.error({ err }, "Redis error"));
    this.client.on("connect", () => logger.info("Redis connected"));
    this.client.on("close", () => logger.info("Redis disconnected"));
  }

  static getInstance(redisUrl?: string): CacheAdaptor | NullCacheAdaptor {
    if (!CacheAdaptor.instance) {
      const url = redisUrl || process.env.REDIS_URL;
      if (!url) {
        // During build time, return a null cache adaptor
        logger.warn('REDIS_URL not configured, using null cache adaptor');
        CacheAdaptor.instance = new NullCacheAdaptor();
        return CacheAdaptor.instance;
      }
      CacheAdaptor.instance = new CacheAdaptor(url);
    }
    return CacheAdaptor.instance;
  }

  // Check if Redis is available (for build-time checks)
  static isConfigured(): boolean {
    return Boolean(process.env.REDIS_URL);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error({ error, key }, "Cache get error");
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.set(key, serialized, "EX", ttl);
      } else {
        await this.client.set(key, serialized);
      }
      logger.debug({ key, ttl }, "Cache set");
    } catch (error) {
      logger.error({ error, key }, "Cache set error");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      logger.debug({ key }, "Cache delete");
    } catch (error) {
      logger.error({ error, key }, "Cache delete error");
    }
  }

  // Alias for delete
  async del(key: string): Promise<void> {
    return this.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info({ pattern, count: keys.length }, "Cache invalidated");
      }
    } catch (error) {
      logger.error({ error, pattern }, "Cache invalidate error");
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error({ error }, "Cache health check failed");
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  // Get raw client for advanced operations
  getClient(): InstanceType<typeof Redis> {
    return this.client;
  }
}

// Lazy getter for cache adaptor - only instantiate when actually used
export function getCacheAdaptor(): CacheAdaptor | NullCacheAdaptor {
  return CacheAdaptor.getInstance();
}

// For backward compatibility - uses lazy initialization via proxy
let _lazyInstance: CacheAdaptor | NullCacheAdaptor | null = null;
export const cacheAdaptor = new Proxy({} as CacheAdaptor, {
  get(_, prop) {
    if (!_lazyInstance) {
      _lazyInstance = CacheAdaptor.getInstance();
    }
    return (_lazyInstance as Record<string, unknown>)[prop as string];
  }
});
