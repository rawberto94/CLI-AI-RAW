/**
 * Redis Caching Layer for Scalability
 * 
 * Provides a high-performance caching layer for:
 * - API response caching
 * - Session data
 * - Frequently accessed data
 * - Rate limiting data
 */

import Redis from 'ioredis';

type RedisClient = InstanceType<typeof Redis>;

// Singleton Redis client
let redisClient: RedisClient | null = null;

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

const DEFAULT_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'cache:';

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): RedisClient {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 
      `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });

    redisClient.on('error', () => {
      // Redis connection error - silently handled
    });

    redisClient.on('connect', () => {
      // Redis connected
    });
  }
  
  return redisClient;
}

/**
 * Build cache key with prefix and tenant isolation
 */
export function buildCacheKey(key: string, tenantId?: string, prefix?: string): string {
  const parts = [prefix || CACHE_PREFIX];
  if (tenantId) {
    parts.push(`tenant:${tenantId}`);
  }
  parts.push(key);
  return parts.join(':');
}

/**
 * Get value from cache
 */
export async function cacheGet<T>(
  key: string, 
  options?: { tenantId?: string; prefix?: string }
): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const cacheKey = buildCacheKey(key, options?.tenantId, options?.prefix);
    const cached = await redis.get(cacheKey);
    
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  options?: CacheOptions & { tenantId?: string }
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const cacheKey = buildCacheKey(key, options?.tenantId, options?.prefix);
    const ttl = options?.ttl || DEFAULT_TTL;
    
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      ttl,
    };
    
    await redis.setex(cacheKey, ttl, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(
  key: string,
  options?: { tenantId?: string; prefix?: string }
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const cacheKey = buildCacheKey(key, options?.tenantId, options?.prefix);
    await redis.del(cacheKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all cache entries matching a pattern
 */
export async function cacheDeletePattern(
  pattern: string,
  options?: { tenantId?: string; prefix?: string }
): Promise<number> {
  try {
    const redis = getRedisClient();
    const cachePattern = buildCacheKey(pattern, options?.tenantId, options?.prefix);
    
    let cursor = '0';
    let deletedCount = 0;
    
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', cachePattern, 'COUNT', 100);
      cursor = newCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');
    
    return deletedCount;
  } catch {
    return 0;
  }
}

/**
 * Get or set cache with callback
 * Implements cache-aside pattern
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions & { tenantId?: string }
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch fresh data
  const data = await fetchFn();
  
  // Store in cache (don't await to avoid blocking)
  cacheSet(key, data, options).catch(() => {});
  
  return data;
}

/**
 * Per-tenant rate limiting using Redis
 */
export async function checkTenantRateLimit(
  tenantId: string,
  endpoint: string,
  options?: { maxRequests?: number; windowSeconds?: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClient();
  const maxRequests = options?.maxRequests || 1000;
  const windowSeconds = options?.windowSeconds || 60;
  
  const key = `ratelimit:tenant:${tenantId}:${endpoint}`;
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  try {
    // Use Redis sorted set for sliding window rate limiting
    const pipeline = redis.pipeline();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    
    // Set expiry on the key
    pipeline.expire(key, windowSeconds);
    
    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;
    
    const allowed = currentCount < maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetAt = now + (windowSeconds * 1000);
    
    return { allowed, remaining, resetAt };
  } catch {
    // Fail open - allow request if Redis is down
    return { allowed: true, remaining: maxRequests, resetAt: now + (windowSeconds * 1000) };
  }
}

/**
 * Cache warming utility for frequently accessed data
 */
export async function warmCache<T>(
  entries: Array<{ key: string; fetchFn: () => Promise<T>; options?: CacheOptions & { tenantId?: string } }>
): Promise<void> {
  await Promise.allSettled(
    entries.map(async ({ key, fetchFn, options }) => {
      const data = await fetchFn();
      await cacheSet(key, data, options);
    })
  );
}

/**
 * Cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  keys: number;
  memory: string;
}> {
  try {
    const redis = getRedisClient();
    const info = await redis.info('memory');
    const keyCount = await redis.dbsize();
    
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memoryMatch && memoryMatch[1] ? memoryMatch[1] : 'unknown';
    
    return {
      connected: true,
      keys: keyCount,
      memory,
    };
  } catch {
    return {
      connected: false,
      keys: 0,
      memory: 'unknown',
    };
  }
}

/**
 * Cleanup Redis connection
 */
export async function closeCacheConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export default {
  get: cacheGet,
  set: cacheSet,
  delete: cacheDelete,
  deletePattern: cacheDeletePattern,
  getOrSet: cacheGetOrSet,
  checkTenantRateLimit,
  warmCache,
  getStats: getCacheStats,
  close: closeCacheConnection,
};
