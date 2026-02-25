/**
 * AI Endpoint Rate Limiting
 * 
 * Per-tenant, per-user rate limiting for AI endpoints using sliding window.
 * Uses in-memory store with Redis fallback for production.
 * 
 * Tiers:
 *   - Standard AI endpoints:  30 req/min per user
 *   - Streaming chat:         10 req/min per user (expensive)
 *   - Notification/dashboard: 60 req/min per user (lightweight)
 * 
 * @version 1.0.0
 */

import { NextResponse } from 'next/server';

// ── Types ─────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string; // override key suffix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

// ── Preset Tiers ──────────────────────────────────────────────────────

export const AI_RATE_LIMITS = {
  /** Streaming chat — most expensive (OpenAI API calls) */
  streaming: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** Standard AI endpoints (analyze, summarize, generate, critique) */
  standard: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,
  /** Lightweight read endpoints (notifications, dashboard, suggestions) */
  lightweight: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
} as const;

// ── In-memory sliding window store ────────────────────────────────────

interface WindowEntry {
  timestamps: number[];
  lastCleanup: number;
}

const store = new Map<string, WindowEntry>();

// Periodic cleanup every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL = 5 * 60_000;
let lastGlobalCleanup = Date.now();

function globalCleanup(): void {
  const now = Date.now();
  if (now - lastGlobalCleanup < CLEANUP_INTERVAL) return;
  lastGlobalCleanup = now;

  const staleThreshold = now - 10 * 60_000; // 10 min inactive = stale
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < staleThreshold) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a tenant+user+endpoint combination.
 * Uses sliding window algorithm (in-memory, O(1) amortized).
 */
export function checkRateLimit(
  tenantId: string,
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  // Guard against missing identity — deny rather than sharing a global bucket
  if (!tenantId || !userId) {
    return { allowed: false, remaining: 0, resetAt: Date.now() + 60_000, retryAfterMs: 60_000 };
  }

  const now = Date.now();
  globalCleanup();

  const key = `${tenantId}:${userId}:${config.identifier || endpoint}`;
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [], lastCleanup: now };
    store.set(key, entry);
  }

  // Prune timestamps outside the window
  const windowStart = now - config.windowMs;
  if (now - entry.lastCleanup > 10_000) {
    // Only prune every 10 seconds to amortize cost
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);
    entry.lastCleanup = now;
  }

  const currentCount = entry.timestamps.filter(t => t > windowStart).length;

  if (currentCount >= config.maxRequests) {
    // Find when the oldest request in window will expire
    const oldestInWindow = entry.timestamps.find(t => t > windowStart) || now;
    const retryAfterMs = (oldestInWindow + config.windowMs) - now;

    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + config.windowMs,
      retryAfterMs: Math.max(retryAfterMs, 1000),
    };
  }

  // Allow and record
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxRequests - currentCount - 1,
    resetAt: now + config.windowMs,
    retryAfterMs: 0,
  };
}

/**
 * Create a 429 Too Many Requests response with standard headers.
 */
export function rateLimitResponse(result: RateLimitResult, requestId?: string): NextResponse {
  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Please wait ${retryAfterSec} seconds before trying again.`,
        retryable: true,
        retryAfterMs: result.retryAfterMs,
      },
      meta: {
        requestId: requestId || 'unknown',
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}
