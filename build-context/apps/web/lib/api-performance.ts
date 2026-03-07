/**
 * API Performance Utilities
 * Provides reusable patterns for:
 * - Response caching headers
 * - Stale-while-revalidate patterns
 * - Cache key generation
 * - Performance timing
 */

import { NextResponse } from 'next/server';

/**
 * Cache presets for different data freshness requirements
 */
export const CachePresets = {
  /** Static assets - 1 year cache */
  immutable: 'public, max-age=31536000, immutable',
  
  /** Reference data - 1 day, SWR */
  static: 'public, max-age=86400, stale-while-revalidate=3600',
  
  /** Dashboard stats - 1 minute, SWR for 5 minutes */
  stats: 'private, max-age=60, stale-while-revalidate=300',
  
  /** Lists/tables - 30 seconds, SWR for 2 minutes */
  dynamic: 'private, max-age=30, stale-while-revalidate=120',
  
  /** Real-time data - no cache */
  realtime: 'no-store, no-cache, must-revalidate',
  
  /** User-specific - private, short cache */
  private: 'private, max-age=10, stale-while-revalidate=60',
} as const;

/**
 * TTL values in seconds (for Redis caching)
 */
export const CacheTTL = {
  /** 5 minutes - default */
  default: 300,
  
  /** 1 minute - stats/analytics */
  short: 60,
  
  /** 10 minutes - list views */
  medium: 600,
  
  /** 1 hour - reference data */
  long: 3600,
  
  /** 24 hours - static lookups */
  day: 86400,
} as const;

/**
 * Generates cache key with tenant isolation
 */
export function makeCacheKey(
  resource: string,
  tenantId: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const base = `${resource}:${tenantId}`;
  
  if (!params || Object.keys(params).length === 0) {
    return base;
  }
  
  // Sort params for consistent keys
  const sortedParams = Object.keys(params)
    .filter(k => params[k] !== undefined)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join(':');
    
  return `${base}:${sortedParams}`;
}

/**
 * Performance timing helper
 */
export function createTimer() {
  const start = performance.now();
  
  return {
    /** Get elapsed time in ms */
    elapsed: () => Math.round(performance.now() - start),
    
    /** Get elapsed as formatted string */
    format: () => `${Math.round(performance.now() - start)}ms`,
  };
}

/**
 * Add standard performance headers to response
 */
export function withPerformanceHeaders(
  response: NextResponse,
  options: {
    cacheControl?: keyof typeof CachePresets | string;
    timing?: number;
    hit?: boolean;
  } = {}
): NextResponse {
  const { cacheControl = 'private', timing, hit } = options;
  
  // Set Cache-Control
  const cacheValue = CachePresets[cacheControl as keyof typeof CachePresets] || cacheControl;
  response.headers.set('Cache-Control', cacheValue);
  
  // Add timing header
  if (timing !== undefined) {
    response.headers.set('X-Response-Time', `${timing}ms`);
    response.headers.set('Server-Timing', `total;dur=${timing}`);
  }
  
  // Add cache hit indicator
  if (hit !== undefined) {
    response.headers.set('X-Cache', hit ? 'HIT' : 'MISS');
  }
  
  return response;
}

/**
 * Batch multiple async operations efficiently
 * Automatically handles partial failures
 */
export async function batchAsync<T>(
  operations: Array<() => Promise<T>>,
  options: {
    /** Maximum concurrent operations */
    concurrency?: number;
    /** Continue on individual failures */
    continueOnError?: boolean;
  } = {}
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const { concurrency = 10, continueOnError = true } = options;
  
  const results: Array<{ success: boolean; result?: T; error?: Error }> = [];
  
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(op => op()));
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push({ success: true, result: result.value });
      } else {
        if (!continueOnError) throw result.reason;
        results.push({ success: false, error: result.reason });
      }
    }
  }
  
  return results;
}

/**
 * Debounced fetch - prevents duplicate requests for same key
 */
const pendingRequests = new Map<string, Promise<any>>();

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if request is already in-flight
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending;
  }
  
  // Start new request
  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Memoization decorator for expensive computations
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxSize?: number;
    ttl?: number;
  } = {}
): T {
  const { maxSize = 100, ttl = 60000 } = options;
  const cache = new Map<string, { value: ReturnType<T>; expiry: number }>();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    const result = fn(...args);
    
    // Evict oldest if at capacity
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    
    cache.set(key, { value: result, expiry: Date.now() + ttl });
    return result;
  }) as T;
}

export default {
  CachePresets,
  CacheTTL,
  makeCacheKey,
  createTimer,
  withPerformanceHeaders,
  batchAsync,
  deduplicatedFetch,
  memoize,
};
