/**
 * Redis Cache Utility
 * Provides caching layer for expensive API operations
 * Supports both Upstash Redis (REST) and standard Redis (ioredis/TCP)
 * Falls back gracefully when Redis is not available
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

const isDev = process.env.NODE_ENV !== 'production';

// Unified Redis interface — works with Upstash REST or standard TCP Redis
interface CacheRedis {
  get<T>(key: string): Promise<T | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

let redis: CacheRedis | null = null;

function createUpstashClient(): CacheRedis | null {
  if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) return null;
  const client = new UpstashRedis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
  });
  return {
    get: async <T>(key: string) => client.get<T>(key),
    setex: async (key, seconds, value) => { await client.setex(key, seconds, value); return 'OK'; },
    del: async (key) => { await client.del(key); return 1; },
    keys: async (pattern) => client.keys(pattern),
  };
}

function createIORedisClient(): CacheRedis | null {
  if (!process.env.REDIS_HOST) return null;
  try {
    const client = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      showFriendlyErrorStack: isDev,
    });
    return {
      get: async <T>(key: string) => {
        const val = await client.get(key);
        if (val === null) return null;
        try { return JSON.parse(val) as T; } catch { return val as unknown as T; }
      },
      setex: async (key, seconds, value) => client.setex(key, seconds, value),
      del: async (key) => client.del(key),
      keys: async (pattern) => client.keys(pattern) as Promise<string[]>,
    };
  } catch {
    return null;
  }
}

// Try Upstash first (REST, serverless-friendly), then fall back to standard Redis
try {
  redis = createUpstashClient() || createIORedisClient();
} catch {
  // Redis initialization failed, running without cache
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 5 minutes)
  tags?: string[]; // Tags for cache invalidation
}

/**
 * Get value from cache
 * @param key Cache key
 * @returns Cached value or null
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    if (value) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set value in cache
 * @param key Cache key
 * @param value Value to cache
 * @param options Caching options
 */
export async function setCached<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  if (!redis) return;

  const { ttl = 300 } = options; // Default 5 minutes

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch {
    // Cache SET error - ignore
  }
}

/**
 * Delete value from cache
 * @param key Cache key or pattern
 */
export async function deleteCached(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(key);
  } catch {
    // Cache DELETE error - ignore
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param pattern Pattern to match (e.g., "contracts:*")
 */
export async function deleteCachedByPattern(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      for (const k of keys) {
        await redis.del(k);
      }
    }
  } catch {
    // Cache DELETE pattern error - ignore
  }
}

/**
 * Wrapper function for caching API responses
 * Automatically handles cache get/set with fallback to function execution
 * 
 * @param key Cache key
 * @param fn Function to execute if cache miss
 * @param options Caching options
 * @returns Result from cache or function execution
 * 
 * @example
 * const contracts = await withCache(
 *   'contracts:list:all',
 *   async () => await fetchContractsFromDB(),
 *   { ttl: 600 } // 10 minutes
 * );
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function on cache miss
  const result = await fn();

  // Store in cache (fire and forget)
  setCached(key, result, options).catch(() => {
    // Ignore cache errors
  });

  return result;
}

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  // Contracts
  contractsList: (filters?: Record<string, any>) => 
    `contracts:list:${filters ? JSON.stringify(filters) : 'all'}`,
  contractDetail: (id: string) => `contracts:detail:${id}`,
  contractStats: () => 'contracts:stats',

  // Rate Cards
  rateCardsList: (filters?: Record<string, any>) =>
    `ratecards:list:${filters ? JSON.stringify(filters) : 'all'}`,
  rateCardBenchmark: (filters?: Record<string, any>) =>
    `ratecards:benchmark:${filters ? JSON.stringify(filters) : 'all'}`,
  rateCardOpportunities: () => 'ratecards:opportunities',

  // Analytics
  analyticsDashboard: (dateRange?: string) =>
    `analytics:dashboard:${dateRange || 'default'}`,
  analyticsCharts: (type: string, dateRange?: string) =>
    `analytics:charts:${type}:${dateRange || 'default'}`,

  // Search
  searchResults: (query: string, filters?: Record<string, any>) =>
    `search:${query}:${filters ? JSON.stringify(filters) : 'all'}`,
};

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  // Invalidate all contracts cache
  contracts: async () => {
    await deleteCachedByPattern('contracts:*');
  },

  // Invalidate all rate cards cache
  rateCards: async () => {
    await deleteCachedByPattern('ratecards:*');
  },

  // Invalidate all analytics cache
  analytics: async () => {
    await deleteCachedByPattern('analytics:*');
  },

  // Invalidate specific contract
  contract: async (id: string) => {
    await deleteCached(CacheKeys.contractDetail(id));
    await deleteCachedByPattern('contracts:list:*');
    await deleteCachedByPattern('contracts:stats');
  },

  // Invalidate all cache
  all: async () => {
    await deleteCachedByPattern('*');
  },
};

const cacheUtils = {
  getCached,
  setCached,
  deleteCached,
  deleteCachedByPattern,
  withCache,
  CacheKeys,
  invalidateCache,
};
export default cacheUtils;
