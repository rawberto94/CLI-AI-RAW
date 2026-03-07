/**
 * API Response Caching Utilities
 * 
 * Provides helpers for setting appropriate Cache-Control headers
 * on API responses for better performance and CDN caching.
 */

import { NextResponse } from 'next/server';

/**
 * Cache duration presets (in seconds)
 */
export const CacheDuration = {
  /** No caching - for user-specific or sensitive data */
  NONE: 0,
  /** Short cache - for frequently changing data (1 minute) */
  SHORT: 60,
  /** Medium cache - for moderately changing data (5 minutes) */
  MEDIUM: 5 * 60,
  /** Long cache - for slowly changing data (1 hour) */
  LONG: 60 * 60,
  /** Extended cache - for rarely changing data (24 hours) */
  EXTENDED: 24 * 60 * 60,
  /** Immutable - for content that never changes (1 year) */
  IMMUTABLE: 365 * 24 * 60 * 60,
} as const;

/**
 * Stale-while-revalidate presets (in seconds)
 */
export const StaleWhileRevalidate = {
  SHORT: 60,
  MEDIUM: 5 * 60,
  LONG: 60 * 60,
} as const;

interface CacheOptions {
  /** Max age in seconds */
  maxAge: number;
  /** Stale-while-revalidate duration in seconds */
  staleWhileRevalidate?: number;
  /** Allow public (CDN) caching */
  public?: boolean;
  /** Must revalidate before using stale content */
  mustRevalidate?: boolean;
  /** Content is immutable (never changes) */
  immutable?: boolean;
  /** Vary header values */
  vary?: string[];
  /** ETag value for conditional requests */
  etag?: string;
}

/**
 * Build Cache-Control header value
 */
export function buildCacheControl(options: CacheOptions): string {
  const directives: string[] = [];
  
  if (options.maxAge === 0) {
    return 'no-store, no-cache, must-revalidate';
  }
  
  // Privacy directive
  directives.push(options.public ? 'public' : 'private');
  
  // Max age
  directives.push(`max-age=${options.maxAge}`);
  
  // Stale-while-revalidate
  if (options.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  
  // Must revalidate
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }
  
  // Immutable
  if (options.immutable) {
    directives.push('immutable');
  }
  
  return directives.join(', ');
}

/**
 * Add caching headers to a NextResponse
 */
export function withCacheHeaders<T>(
  response: NextResponse<T>,
  options: CacheOptions
): NextResponse<T> {
  response.headers.set('Cache-Control', buildCacheControl(options));
  
  if (options.vary?.length) {
    response.headers.set('Vary', options.vary.join(', '));
  }
  
  if (options.etag) {
    response.headers.set('ETag', `"${options.etag}"`);
  }
  
  return response;
}

/**
 * Create a cached JSON response
 */
export function cachedJsonResponse<T>(
  data: T,
  options: CacheOptions & { status?: number }
): NextResponse<T> {
  const response = NextResponse.json(data, { status: options.status ?? 200 });
  return withCacheHeaders(response, options);
}

// ============================================================================
// Preset Response Helpers
// ============================================================================

/**
 * Response for user-specific data (no caching)
 */
export function privateResponse<T>(data: T, status = 200): NextResponse<T> {
  return cachedJsonResponse(data, {
    maxAge: CacheDuration.NONE,
    status,
  });
}

/**
 * Response for public list data (short cache, CDN enabled)
 */
export function publicListResponse<T>(
  data: T,
  options?: { status?: number; etag?: string }
): NextResponse<T> {
  return cachedJsonResponse(data, {
    maxAge: CacheDuration.SHORT,
    staleWhileRevalidate: StaleWhileRevalidate.SHORT,
    public: true,
    vary: ['Authorization', 'Accept-Encoding'],
    status: options?.status,
    etag: options?.etag,
  });
}

/**
 * Response for static reference data (long cache)
 */
export function staticDataResponse<T>(
  data: T,
  options?: { status?: number; etag?: string }
): NextResponse<T> {
  return cachedJsonResponse(data, {
    maxAge: CacheDuration.LONG,
    staleWhileRevalidate: StaleWhileRevalidate.LONG,
    public: true,
    vary: ['Accept-Encoding'],
    status: options?.status,
    etag: options?.etag,
  });
}

/**
 * Response for immutable content (never changes)
 */
export function immutableResponse<T>(
  data: T,
  etag: string,
  status = 200
): NextResponse<T> {
  return cachedJsonResponse(data, {
    maxAge: CacheDuration.IMMUTABLE,
    public: true,
    immutable: true,
    etag,
    status,
  });
}

/**
 * Response for tenant-specific data (private, medium cache)
 */
export function tenantDataResponse<T>(
  data: T,
  options?: { status?: number; etag?: string }
): NextResponse<T> {
  return cachedJsonResponse(data, {
    maxAge: CacheDuration.MEDIUM,
    staleWhileRevalidate: StaleWhileRevalidate.MEDIUM,
    public: false, // Private - tenant specific
    vary: ['Authorization', 'X-Tenant-ID', 'Accept-Encoding'],
    status: options?.status,
    etag: options?.etag,
  });
}

// ============================================================================
// ETag Generation
// ============================================================================

import crypto from 'crypto';

/**
 * Generate ETag from data
 */
export function generateETag(data: unknown): string {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return hash.substring(0, 16);
}

/**
 * Check if ETag matches (for conditional requests)
 */
export function checkETagMatch(
  request: Request,
  etag: string
): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (!ifNoneMatch) return false;
  
  // Handle multiple ETags
  const tags = ifNoneMatch.split(',').map(t => t.trim().replace(/"/g, ''));
  return tags.includes(etag) || tags.includes('*');
}

/**
 * Return 304 Not Modified if ETag matches
 */
export function conditionalResponse<T>(
  request: Request,
  data: T,
  cacheOptions: CacheOptions
): NextResponse<T> | NextResponse<null> {
  const etag = generateETag(data);
  
  if (checkETagMatch(request, etag)) {
    const notModified = new NextResponse(null, { status: 304 });
    notModified.headers.set('ETag', `"${etag}"`);
    notModified.headers.set('Cache-Control', buildCacheControl(cacheOptions));
    return notModified as NextResponse<null>;
  }
  
  return cachedJsonResponse(data, { ...cacheOptions, etag });
}

// ============================================================================
// Cache Invalidation Helpers
// ============================================================================

/**
 * Generate cache keys for invalidation
 */
export const CacheKeys = {
  contract: (id: string) => `contract:${id}`,
  contractsList: (tenantId: string) => `contracts:list:${tenantId}`,
  user: (id: string) => `user:${id}`,
  tenant: (id: string) => `tenant:${id}`,
  taxonomy: (tenantId: string) => `taxonomy:${tenantId}`,
  rateCards: (tenantId: string) => `rate-cards:${tenantId}`,
  dashboard: (tenantId: string) => `dashboard:${tenantId}`,
} as const;

/**
 * Surrogate key header for CDN invalidation
 */
export function addSurrogateKeys(
  response: NextResponse,
  keys: string[]
): NextResponse {
  response.headers.set('Surrogate-Key', keys.join(' '));
  return response;
}
