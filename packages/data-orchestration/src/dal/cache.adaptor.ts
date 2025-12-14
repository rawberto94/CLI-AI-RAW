import { createClient, RedisClientType } from "redis";
import { createLogger } from "../utils/logger";

const logger = createLogger("cache-adaptor");

export class CacheAdaptor {
  private client: RedisClientType;
  private static instance: CacheAdaptor;
  private connected: boolean = false;

  private constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl }) as RedisClientType;
    this.client.on("error", (err) => logger.error({ err }, "Redis error"));
    this.client.on("connect", () => logger.info("Redis connected"));
    this.client.on("disconnect", () => logger.info("Redis disconnected"));
  }

  static getInstance(redisUrl?: string): CacheAdaptor {
    if (!CacheAdaptor.instance) {
      const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
      CacheAdaptor.instance = new CacheAdaptor(url);
    }
    return CacheAdaptor.instance;
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.connected) await this.connect();
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error({ error, key }, "Cache get error");
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (!this.connected) await this.connect();
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
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
      if (!this.connected) await this.connect();
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
      if (!this.connected) await this.connect();
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info({ pattern, count: keys.length }, "Cache invalidated");
      }
    } catch (error) {
      logger.error({ error, pattern }, "Cache invalidate error");
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected) await this.connect();
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error({ error }, "Cache health check failed");
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  // Get raw client for advanced operations
  getClient(): RedisClientType {
    return this.client;
  }
}

export const cacheAdaptor = CacheAdaptor.getInstance();
