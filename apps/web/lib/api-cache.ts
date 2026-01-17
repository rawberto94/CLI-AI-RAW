/**
 * API Response Caching Utilities
 * 
 * Provides caching helpers for Next.js API routes
 * to improve performance and reduce database load.
 */

import Redis from 'ioredis';
import { NextResponse } from 'next/server';

type RedisClient = InstanceType<typeof Redis>;

// Lazy-loaded Redis client
let redis: RedisClient | null = null;

function getRedis(): RedisClient {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export interface CacheConfig {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache key prefix */
  prefix?: string;
  /** Include tenant ID in cache key */
  tenantScoped?: boolean;
  /** Tags for cache invalidation */
  tags?: string[];
}

const DEFAULT_TTL = 60; // 1 minute default

/**
 * Build a cache key for an API response
 */
export function buildApiCacheKey(
  endpoint: string,
  params?: Record<string, unknown>,
  options?: { tenantId?: string; prefix?: string }
): string {
  const parts = ['api-cache'];
  
  if (options?.prefix) {
    parts.push(options.prefix);
  }
  
  if (options?.tenantId) {
    parts.push(`t:${options.tenantId}`);
  }
  
  parts.push(endpoint);
  
  if (params && Object.keys(params).length > 0) {
    // Sort keys for consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    parts.push(sortedParams);
  }
  
  return parts.join(':');
}

/**
 * Get cached API response
 */
export async function getCachedResponse<T>(
  cacheKey: string
): Promise<T | null> {
  try {
    const cached = await getRedis().get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache get failed, return null to fetch fresh data
  }
  return null;
}

/**
 * Set cached API response
 */
export async function setCachedResponse<T>(
  cacheKey: string,
  data: T,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    await getRedis().setex(cacheKey, ttl, JSON.stringify(data));
  } catch {
    // Cache set failed, continue without caching
  }
}

/**
 * Invalidate cache entries by pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    const r = getRedis();
    let cursor = '0';
    let deletedCount = 0;
    
    do {
      const [newCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      
      if (keys.length > 0) {
        await r.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');
    
    return deletedCount;
  } catch {
    return 0;
  }
}

/**
 * Invalidate all cache for a tenant
 */
export async function invalidateTenantCache(tenantId: string): Promise<number> {
  return invalidateCache(`api-cache:*:t:${tenantId}:*`);
}

/**
 * Invalidate cache for a specific endpoint
 */
export async function invalidateEndpointCache(
  endpoint: string,
  tenantId?: string
): Promise<number> {
  const pattern = tenantId 
    ? `api-cache:*:t:${tenantId}:${endpoint}*`
    : `api-cache:*:${endpoint}*`;
  return invalidateCache(pattern);
}

/**
 * Higher-order function to wrap an API handler with caching
 */
export function withCache<T>(
  handler: () => Promise<T>,
  cacheKey: string,
  options?: CacheConfig
): () => Promise<T> {
  return async () => {
    // Try to get from cache first
    const cached = await getCachedResponse<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    // Execute handler and cache result
    const result = await handler();
    await setCachedResponse(cacheKey, result, options?.ttl || DEFAULT_TTL);
    
    return result;
  };
}

/**
 * Create a cached NextResponse with appropriate headers
 */
export function cachedJsonResponse<T>(
  data: T,
  options?: {
    ttl?: number;
    status?: number;
    private?: boolean;
  }
): NextResponse {
  const ttl = options?.ttl || DEFAULT_TTL;
  const cacheControl = options?.private
    ? `private, max-age=${ttl}`
    : `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`;
  
  return NextResponse.json(data, {
    status: options?.status || 200,
    headers: {
      'Cache-Control': cacheControl,
      'X-Cache-TTL': String(ttl),
    },
  });
}

/**
 * Cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  keys: number;
  memory: string;
  hitRate?: number;
}> {
  try {
    const r = getRedis();
    const info = await r.info('memory');
    const keyCount = await r.dbsize();
    
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memoryMatch ? memoryMatch[1] : 'unknown';
    
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
 * Decorator for caching API route handlers
 * Usage:
 * ```ts
 * export const GET = cacheableHandler(
 *   async (request) => {
 *     const data = await fetchData();
 *     return NextResponse.json(data);
 *   },
 *   { ttl: 300, tenantScoped: true }
 * );
 * ```
 */
export function cacheableHandler<T extends Request>(
  handler: (request: T) => Promise<NextResponse>,
  options?: CacheConfig
) {
  return async (request: T): Promise<NextResponse> => {
    const url = new URL(request.url);
    const tenantId = options?.tenantScoped 
      ? request.headers.get('x-tenant-id') || undefined
      : undefined;
    
    // Build cache key from URL and tenant
    const params = Object.fromEntries(url.searchParams);
    const cacheKey = buildApiCacheKey(url.pathname, params, {
      tenantId,
      prefix: options?.prefix,
    });
    
    // Only cache GET requests
    if (request.method === 'GET') {
      const cached = await getCachedResponse<unknown>(cacheKey);
      if (cached !== null) {
        return cachedJsonResponse(cached, { 
          ttl: options?.ttl,
          private: options?.tenantScoped,
        });
      }
    }
    
    // Execute handler
    const response = await handler(request);
    
    // Cache successful GET responses
    if (request.method === 'GET' && response.ok) {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      await setCachedResponse(cacheKey, data, options?.ttl || DEFAULT_TTL);
    }
    
    return response;
  };
}

const apiCache = {
  get: getCachedResponse,
  set: setCachedResponse,
  invalidate: invalidateCache,
  invalidateTenant: invalidateTenantCache,
  invalidateEndpoint: invalidateEndpointCache,
  withCache,
  cachedJsonResponse,
  cacheableHandler,
  getStats: getCacheStats,
};
export default apiCache;
