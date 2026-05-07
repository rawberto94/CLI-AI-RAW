/**
 * Per-API-token rate limiting for `/api/v1/*`.
 *
 * Fixed-window counter: `ratelimit:v1:<tokenId>:<windowStart>` → INCR.
 * The counter expires automatically after `windowSeconds`, so memory
 * usage is bounded.
 *
 * Defaults to 600 req/min/token. Override per-deployment via env:
 *   - `API_V1_RATE_LIMIT` (requests per window, default 600)
 *   - `API_V1_RATE_WINDOW_SECONDS` (default 60)
 *
 * Falls back to a process-local Map when Redis is unavailable so
 * single-instance deployments still get protection.
 */

import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import type { ApiTokenAuth } from './auth';

const LIMIT = Number(process.env.API_V1_RATE_LIMIT || 600);
const WINDOW = Number(process.env.API_V1_RATE_WINDOW_SECONDS || 60);

let redis: Redis | null = null;
let redisDisabled = false;

function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisDisabled = true;
    return null;
  }
  try {
    redis = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => {
      console.warn('[apiV1RateLimit] redis error: ' + err.message);
    });
    return redis;
  } catch (err) {
    console.warn(
      '[apiV1RateLimit] redis init failed: ' + (err as Error).message,
    );
    redisDisabled = true;
    return null;
  }
}

// Process-local fallback
const localCounters = new Map<string, { count: number; resetAt: number }>();

function localIncr(key: string, windowSeconds: number): { count: number; resetAt: number } {
  const now = Date.now();
  const existing = localCounters.get(key);
  if (existing && existing.resetAt > now) {
    existing.count++;
    return existing;
  }
  const fresh = { count: 1, resetAt: now + windowSeconds * 1000 };
  localCounters.set(key, fresh);
  // Lazy GC: drop expired entries occasionally.
  if (localCounters.size > 5000) {
    for (const [k, v] of localCounters) {
      if (v.resetAt <= now) localCounters.delete(k);
    }
  }
  return fresh;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export async function checkApiV1RateLimit(auth: ApiTokenAuth): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW) * WINDOW;
  const key = `ratelimit:v1:${auth.tokenId}:${windowStart}`;
  const r = getRedis();

  let count: number;
  let resetSeconds: number;

  if (r) {
    try {
      count = await r.incr(key);
      if (count === 1) {
        await r.expire(key, WINDOW);
      }
      const ttl = await r.ttl(key);
      resetSeconds = ttl > 0 ? ttl : WINDOW;
    } catch (err) {
      console.warn(
        '[apiV1RateLimit] redis op failed, falling back to local: ' +
          (err as Error).message,
      );
      const local = localIncr(key, WINDOW);
      count = local.count;
      resetSeconds = Math.max(1, Math.ceil((local.resetAt - Date.now()) / 1000));
    }
  } else {
    const local = localIncr(key, WINDOW);
    count = local.count;
    resetSeconds = Math.max(1, Math.ceil((local.resetAt - Date.now()) / 1000));
  }

  return {
    ok: count <= LIMIT,
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - count),
    resetSeconds,
  };
}

/**
 * Convenience: check + return a 429 response if exceeded, or null to
 * proceed. Adds standard `X-RateLimit-*` headers either way (caller
 * should merge them onto the success response — see `withRateLimitHeaders`).
 */
export async function enforceApiV1RateLimit(
  auth: ApiTokenAuth,
): Promise<{ exceeded: NextResponse | null; result: RateLimitResult }> {
  const result = await checkApiV1RateLimit(auth);
  if (result.ok) return { exceeded: null, result };
  const response = NextResponse.json(
    {
      error: 'Rate limit exceeded',
      limit: result.limit,
      retryAfterSeconds: result.resetSeconds,
    },
    { status: 429 },
  );
  response.headers.set('Retry-After', String(result.resetSeconds));
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', '0');
  response.headers.set('X-RateLimit-Reset', String(result.resetSeconds));
  return { exceeded: response, result };
}

/** Adds rate-limit headers to a NextResponse. */
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetSeconds));
  return response;
}
