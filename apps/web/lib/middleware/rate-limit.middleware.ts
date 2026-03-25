/**
 * Rate Limit Middleware — In-memory sliding window
 */

import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Predefined rate limit configurations for different endpoint types
 */
export const EndpointRateLimits = {
  public: { windowMs: 60_000, max: 100, message: 'Too many requests' } as RateLimitConfig,
  contracts: { windowMs: 60_000, max: 60, message: 'Too many contract requests' } as RateLimitConfig,
  admin: { windowMs: 60_000, max: 30, message: 'Too many admin requests' } as RateLimitConfig,
  upload: { windowMs: 60_000, max: 20, message: 'Too many upload requests' } as RateLimitConfig,
  ai: { windowMs: 60_000, max: 30, message: 'Too many AI requests' } as RateLimitConfig,
  search: { windowMs: 60_000, max: 50, message: 'Too many search requests' } as RateLimitConfig,
} as const;

// In-memory store: key → array of request timestamps
const store = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const maxWindow = 60_000;
  for (const [key, timestamps] of store) {
    const filtered = timestamps.filter((t) => now - t < maxWindow);
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

/**
 * Apply rate limiting to a request.
 * Returns a NextResponse if rate limited, or null if allowed.
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  cleanupStore();

  const key = getClientKey(request);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let timestamps = store.get(key) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= config.max) {
    const retryAfter = Math.ceil((timestamps[0]! + config.windowMs - now) / 1000);
    return new NextResponse(
      JSON.stringify({
        error: config.message || 'Too many requests',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((timestamps[0]! + config.windowMs) / 1000)),
        },
      }
    );
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return null;
}
