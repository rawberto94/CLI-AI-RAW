/**
 * Distributed Redis Cache for Workers (P4: Worker Scalability)
 * 
 * Replaces in-memory cache with Redis for:
 * - OCR results caching
 * - Document fingerprinting
 * - AI response caching
 * - Rate limiting data
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'worker-cache' });

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  keyPrefix?: string;
  defaultTTL?: number;
}

export interface CachedOCRResult {
  text: string;
  pages: number;
  confidence: number;
  cachedAt: number;
  source: string;
}

export interface CachedAIResponse {
  response: unknown;
  model: string;
  tokens: number;
  cachedAt: number;
}

/**
 * Distributed Worker Cache using Redis
 */
export class WorkerCache {
  private redis: Redis;
  private keyPrefix: string;
  private defaultTTL: number;

  constructor(config: CacheConfig) {
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.keyPrefix = config.keyPrefix || 'worker:cache:';
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour default

    this.redis.on('error', (err) => {
      logger.error({ error: err }, 'Worker cache Redis error');
    });

    this.redis.on('connect', () => {
      logger.info('Worker cache connected to Redis');
    });
  }

  /**
   * Generate a hash key for content
   */
  private generateHash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Build a namespaced cache key
   */
  private buildKey(namespace: string, key: string): string {
    return `${this.keyPrefix}${namespace}:${key}`;
  }

  // ==========================================
  // OCR Result Caching
  // ==========================================

  /**
   * Get cached OCR result by document hash
   */
  async getOCRResult(documentHash: string): Promise<CachedOCRResult | null> {
    try {
      const key = this.buildKey('ocr', documentHash);
      const cached = await this.redis.get(key);
      
      if (cached) {
        logger.debug({ documentHash }, 'OCR cache hit');
        return JSON.parse(cached);
      }
      
      logger.debug({ documentHash }, 'OCR cache miss');
      return null;
    } catch (error) {
      logger.error({ error, documentHash }, 'Failed to get OCR cache');
      return null;
    }
  }

  /**
   * Cache OCR result
   */
  async setOCRResult(
    documentHash: string,
    result: Omit<CachedOCRResult, 'cachedAt'>,
    ttl?: number
  ): Promise<void> {
    try {
      const key = this.buildKey('ocr', documentHash);
      const cached: CachedOCRResult = {
        ...result,
        cachedAt: Date.now(),
      };
      
      await this.redis.setex(
        key,
        ttl || this.defaultTTL * 24, // OCR results cached for 24 hours by default
        JSON.stringify(cached)
      );
      
      logger.debug({ documentHash }, 'OCR result cached');
    } catch (error) {
      logger.error({ error, documentHash }, 'Failed to cache OCR result');
    }
  }

  /**
   * Get OCR result by document content
   */
  async getOCRResultByContent(content: Buffer): Promise<CachedOCRResult | null> {
    const hash = this.generateHash(content);
    return this.getOCRResult(hash);
  }

  /**
   * Cache OCR result by document content
   */
  async setOCRResultByContent(
    content: Buffer,
    result: Omit<CachedOCRResult, 'cachedAt'>,
    ttl?: number
  ): Promise<string> {
    const hash = this.generateHash(content);
    await this.setOCRResult(hash, result, ttl);
    return hash;
  }

  // ==========================================
  // AI Response Caching
  // ==========================================

  /**
   * Get cached AI response
   */
  async getAIResponse(promptHash: string): Promise<CachedAIResponse | null> {
    try {
      const key = this.buildKey('ai', promptHash);
      const cached = await this.redis.get(key);
      
      if (cached) {
        logger.debug({ promptHash }, 'AI response cache hit');
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error({ error, promptHash }, 'Failed to get AI cache');
      return null;
    }
  }

  /**
   * Cache AI response
   */
  async setAIResponse(
    promptHash: string,
    result: Omit<CachedAIResponse, 'cachedAt'>,
    ttl?: number
  ): Promise<void> {
    try {
      const key = this.buildKey('ai', promptHash);
      const cached: CachedAIResponse = {
        ...result,
        cachedAt: Date.now(),
      };
      
      await this.redis.setex(
        key,
        ttl || this.defaultTTL,
        JSON.stringify(cached)
      );
      
      logger.debug({ promptHash }, 'AI response cached');
    } catch (error) {
      logger.error({ error, promptHash }, 'Failed to cache AI response');
    }
  }

  /**
   * Get AI response by prompt content
   */
  async getAIResponseByPrompt(prompt: string, model: string): Promise<CachedAIResponse | null> {
    const hash = this.generateHash(`${model}:${prompt}`);
    return this.getAIResponse(hash);
  }

  /**
   * Cache AI response by prompt content
   */
  async setAIResponseByPrompt(
    prompt: string,
    model: string,
    result: Omit<CachedAIResponse, 'cachedAt'>,
    ttl?: number
  ): Promise<void> {
    const hash = this.generateHash(`${model}:${prompt}`);
    await this.setAIResponse(hash, result, ttl);
  }

  // ==========================================
  // Generic Caching
  // ==========================================

  /**
   * Get a cached value
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(namespace, key);
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error({ error, namespace, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set a cached value
   */
  async set<T>(
    namespace: string,
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    try {
      const cacheKey = this.buildKey(namespace, key);
      await this.redis.setex(
        cacheKey,
        ttl || this.defaultTTL,
        JSON.stringify(value)
      );
    } catch (error) {
      logger.error({ error, namespace, key }, 'Cache set error');
    }
  }

  /**
   * Delete a cached value
   */
  async delete(namespace: string, key: string): Promise<void> {
    try {
      const cacheKey = this.buildKey(namespace, key);
      await this.redis.del(cacheKey);
    } catch (error) {
      logger.error({ error, namespace, key }, 'Cache delete error');
    }
  }

  /**
   * Clear all cached values in a namespace
   */
  async clearNamespace(namespace: string): Promise<number> {
    try {
      const pattern = this.buildKey(namespace, '*');
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      logger.info({ namespace, count: keys.length }, 'Cache namespace cleared');
      return keys.length;
    } catch (error) {
      logger.error({ error, namespace }, 'Cache clear namespace error');
      return 0;
    }
  }

  // ==========================================
  // Stats & Monitoring
  // ==========================================

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    ocrEntries: number;
    aiEntries: number;
    totalMemory: string;
  }> {
    try {
      const ocrKeys = await this.redis.keys(this.buildKey('ocr', '*'));
      const aiKeys = await this.redis.keys(this.buildKey('ai', '*'));
      const info = await this.redis.info('memory');
      
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const totalMemory = memoryMatch ? memoryMatch[1] : 'unknown';

      return {
        ocrEntries: ocrKeys.length,
        aiEntries: aiKeys.length,
        totalMemory,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get cache stats');
      return {
        ocrEntries: 0,
        aiEntries: 0,
        totalMemory: 'unknown',
      };
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('Worker cache connection closed');
  }
}

// Singleton instance
let workerCache: WorkerCache | null = null;

export function getWorkerCache(config?: CacheConfig): WorkerCache {
  if (!workerCache && config) {
    workerCache = new WorkerCache(config);
  }

  if (!workerCache) {
    // Default config from environment
    workerCache = new WorkerCache({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  return workerCache;
}

export default WorkerCache;
