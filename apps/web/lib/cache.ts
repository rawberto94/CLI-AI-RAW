/**
 * Redis Cache Utility
 * Provides caching layer for expensive API operations
 * Falls back gracefully when Redis is not available
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client (using Upstash for serverless compatibility)
// Set these in your .env file:
// REDIS_URL=your_redis_url
// REDIS_TOKEN=your_redis_token

let redis: Redis | null = null;

try {
  if (process.env.REDIS_URL && process.env.REDIS_TOKEN) {
    redis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });
  } else {
    console.warn('Redis credentials not found. Caching disabled.');
  }
} catch (error) {
  console.warn('Redis initialization failed. Running without cache:', error);
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
      console.log(`Cache HIT: ${key}`);
      return value;
    }
    console.log(`Cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('Cache GET error:', error);
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
    console.log(`Cache SET: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error('Cache SET error:', error);
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
    console.log(`Cache DELETE: ${key}`);
  } catch (error) {
    console.error('Cache DELETE error:', error);
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
      await redis.del(...keys);
      console.log(`Cache DELETE pattern: ${pattern} (${keys.length} keys)`);
    }
  } catch (error) {
    console.error('Cache DELETE pattern error:', error);
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

export default {
  getCached,
  setCached,
  deleteCached,
  deleteCachedByPattern,
  withCache,
  CacheKeys,
  invalidateCache,
};
