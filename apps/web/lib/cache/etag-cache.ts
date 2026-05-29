/**
 * ETag-based server-side cache for API responses.
 *
 * Generates deterministic ETags from response payloads and honours the
 * standard `If-None-Match` request header so clients that already hold a
 * fresh copy receive a `304 Not Modified` instead of the full body.
 *
 * The cache is process-scoped (in-memory Map) with configurable per-key
 * TTLs and an automatic cleanup interval.
 */

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheEntry<T = unknown> {
  data: T;
  etag: string;
  timestamp: number;
  ttl: number;
}

export interface ETagCacheOptions {
  /** Default TTL in milliseconds (default: 5 minutes). */
  defaultTTL?: number;
  /** Interval in milliseconds for automatic cleanup of expired entries (0 = disabled). */
  cleanupInterval?: number;
  /** Maximum number of entries before the oldest are evicted. */
  maxEntries?: number;
}

export interface ETagHitResult<T = unknown> {
  data: T;
  etag: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ETagCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL: number;
  private readonly maxEntries: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ETagCacheOptions = {}) {
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 min
    this.maxEntries = options.maxEntries ?? 2000;

    const interval = options.cleanupInterval ?? 5 * 60 * 1000;
    if (interval > 0 && typeof globalThis !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);
      // Allow the process to exit without waiting for the timer.
      if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        (this.cleanupTimer as NodeJS.Timeout).unref();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Generate a strong ETag from arbitrary data using SHA-256.
   */
  generateETag(data: unknown): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = createHash('sha256').update(str).digest('hex').slice(0, 16);
    return `"${hash}"`;
  }

  /**
   * Retrieve a cached entry if it has not expired.
   * Returns `null` when the key is missing or stale.
   */
  get<T = unknown>(key: string): ETagHitResult<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return { data: entry.data, etag: entry.etag };
  }

  /**
   * Store data in the cache. Returns the generated ETag.
   */
  set<T = unknown>(key: string, data: T, ttl?: number): string {
    // Evict oldest entries when the cache is full.
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest(Math.max(1, Math.floor(this.maxEntries * 0.1)));
    }

    const etag = this.generateETag(data);
    this.cache.set(key, {
      data,
      etag,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
    return etag;
  }

  /**
   * Invalidate a single key or all keys matching a prefix.
   */
  invalidate(keyOrPrefix: string, prefix = false): number {
    if (!prefix) {
      return this.cache.delete(keyOrPrefix) ? 1 : 0;
    }

    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Check whether a client-supplied `If-None-Match` header matches a cached
   * entry. Returns `true` when the client already has the freshest data and
   * the server can respond with 304.
   */
  matches(key: string, ifNoneMatch: string | null): boolean {
    if (!ifNoneMatch) return false;
    const entry = this.get(key);
    if (!entry) return false;

    // Clients may send comma-separated ETags or `*`.
    if (ifNoneMatch === '*') return true;
    return ifNoneMatch.split(',').some((t) => t.trim() === entry.etag);
  }

  /**
   * Remove all expired entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Remove all entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current number of entries.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Stop the automatic cleanup timer (useful in tests / shutdown).
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private evictOldest(count: number): void {
    const entries = [...this.cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, count);

    for (const [key] of entries) {
      this.cache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instances – one per cache domain
// ---------------------------------------------------------------------------

/**
 * Redis-backed ETag cache for multi-instance deployments.
 * Provides the same interface as ETagCache but with async methods
 * and Redis backing for cross-instance consistency.
 */
export class RedisETagCache {
  private fallback = new ETagCache();
  private redisPrefix: string;
  private defaultTTL: number;

  constructor(options: ETagCacheOptions & { redisPrefix?: string } = {}) {
    this.redisPrefix = options.redisPrefix || 'etag:';
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000;
  }

  generateETag(data: unknown): string {
    return this.fallback.generateETag(data);
  }

  async get<T = unknown>(key: string): Promise<ETagHitResult<T> | null> {
    try {
      const { redis } = await import('@/lib/redis');
      const raw = await redis.get(`${this.redisPrefix}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw as string);
        if (parsed && Date.now() - parsed.timestamp < parsed.ttl) {
          return { data: parsed.data as T, etag: parsed.etag };
        }
      }
    } catch {
      // Fall through to in-memory
    }
    return this.fallback.get<T>(key);
  }

  async set<T = unknown>(key: string, data: T, ttl?: number): Promise<string> {
    const etag = this.fallback.generateETag(data);
    const resolvedTtl = ttl ?? this.defaultTTL;
    try {
      const { redis } = await import('@/lib/redis');
      await redis.setex(
        `${this.redisPrefix}${key}`,
        Math.ceil(resolvedTtl / 1000),
        JSON.stringify({ data, etag, timestamp: Date.now(), ttl: resolvedTtl })
      );
    } catch {
      // Fall through to in-memory
    }
    return this.fallback.set(key, data, ttl);
  }

  async invalidate(keyOrPrefix: string, prefix = false): Promise<number> {
    try {
      const { redis } = await import('@/lib/redis');
      if (!prefix) {
        await redis.del(`${this.redisPrefix}${keyOrPrefix}`);
      } else {
        const keys = await redis.keys(`${this.redisPrefix}${keyOrPrefix}*`);
        for (const k of keys) {
          await redis.del(k);
        }
      }
    } catch {
      // Fall through
    }
    return this.fallback.invalidate(keyOrPrefix, prefix);
  }

  matches(key: string, ifNoneMatch: string | null): boolean {
    return this.fallback.matches(key, ifNoneMatch);
  }

  cleanup(): void {
    this.fallback.cleanup();
  }

  clear(): void {
    this.fallback.clear();
  }

  get size(): number {
    return this.fallback.size;
  }

  dispose(): void {
    this.fallback.dispose();
  }
}

/** General-purpose API response cache (default 5 min TTL). */
export const apiCache = new ETagCache();

/** Contract-specific cache with shorter TTL for more dynamic data. */
export const contractCache = new ETagCache({ defaultTTL: 3 * 60 * 1000 });

/** Artifact cache with longer TTL since artifacts change infrequently. */
export const artifactCache = new ETagCache({ defaultTTL: 10 * 60 * 1000 });

/** Multi-instance-safe Redis-backed contract cache (use in production with >1 instance). */
export const contractCacheDistributed = new RedisETagCache({
  defaultTTL: 3 * 60 * 1000,
  redisPrefix: 'etag:contract:',
});

// ---------------------------------------------------------------------------
// Helper – build standard cache headers for a Response
// ---------------------------------------------------------------------------

/**
 * Returns HTTP cache-related headers for an ETagged response.
 */
export function etagHeaders(
  etag: string,
  options: { maxAge?: number; private?: boolean } = {},
): Record<string, string> {
  const maxAge = options.maxAge ?? 300;
  const scope = options.private !== false ? 'private' : 'public';
  return {
    ETag: etag,
    'Cache-Control': `${scope}, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
  };
}
