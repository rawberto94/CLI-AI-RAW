/**
 * Rate Limiting Middleware for Next.js API Routes
 * 
 * Provides rate limiting with configurable limits per endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
// TEMPORARILY DISABLED: Import issue with workspace packages
// import { withRateLimit, RateLimitConfigs } from 'data-orchestration/src/middleware/rate-limiter';

// Simple in-memory rate limiter for now
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const store: Record<string, { count: number; resetTime: number }> = {};

function simpleRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = store[key];

  if (!entry || now >= entry.resetTime) {
    store[key] = { count: 1, resetTime: now + config.windowMs };
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

function getIdentifier(request: NextRequest): string {
  const tenantId = request.nextUrl.searchParams.get('tenantId') || request.headers.get('X-Tenant-ID');
  if (tenantId) return `tenant:${tenantId}`;
  
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

export const RateLimitConfigs = {
  standard: { windowMs: 60000, maxRequests: 100 },
  strict: { windowMs: 60000, maxRequests: 10 },
  generous: { windowMs: 60000, maxRequests: 200 },
  hourly: { windowMs: 3600000, maxRequests: 1000 },
  daily: { windowMs: 86400000, maxRequests: 10000 },
};

export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RateLimitConfigs.standard
): Promise<NextResponse | null> {
  const identifier = getIdentifier(request);
  const result = simpleRateLimit(identifier, config);

  const headers = new Headers();
  headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    headers.set('Retry-After', retryAfter.toString());
    return NextResponse.json(
      { error: 'Too Many Requests', message: config.message || 'Rate limit exceeded', retryAfter },
      { status: 429, headers }
    );
  }

  return null;
}

// =========================================================================
// RATE LIMIT CONFIGURATIONS
// =========================================================================

/**
 * Rate limit configurations for different endpoint types
 */
export const EndpointRateLimits = {
  // Authentication endpoints - strict limits
  auth: {
    windowMs: 60000, // 1 minute
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  },

  // Contract endpoints - standard limits
  contracts: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: 'Rate limit exceeded for contract operations.',
  },

  // Rate card endpoints - generous limits for frequent access
  rateCards: {
    windowMs: 60000, // 1 minute
    maxRequests: 200,
    message: 'Rate limit exceeded for rate card operations.',
  },

  // Search endpoints - moderate limits
  search: {
    windowMs: 60000, // 1 minute
    maxRequests: 50,
    message: 'Too many search requests. Please slow down.',
  },

  // Analytics endpoints - moderate limits
  analytics: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    message: 'Rate limit exceeded for analytics operations.',
  },

  // File upload endpoints
  upload: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    message: 'Too many file uploads. Please wait before uploading more files.',
  },

  // Export endpoints - strict limits
  export: {
    windowMs: 60000, // 1 minute
    maxRequests: 10,
    message: 'Too many export requests. Please wait before requesting more exports.',
  },

  // AI/ML endpoints - very strict limits
  ai: {
    windowMs: 60000, // 1 minute
    maxRequests: 20,
    message: 'Rate limit exceeded for AI operations.',
  },

  // Webhook endpoints - moderate limits
  webhooks: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: 'Rate limit exceeded for webhook operations.',
  },

  // Health check endpoints - very generous
  health: {
    windowMs: 60000, // 1 minute
    maxRequests: 1000,
    message: 'Rate limit exceeded for health checks.',
  },

  // Public endpoints - moderate limits
  public: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: 'Rate limit exceeded. Please try again later.',
  },

  // Admin endpoints - generous limits
  admin: {
    windowMs: 60000, // 1 minute
    maxRequests: 200,
    message: 'Rate limit exceeded for admin operations.',
  },
} as const;

// =========================================================================
// RATE LIMITING MIDDLEWARE
// =========================================================================

/**
 * Apply rate limiting to an API route
 */
export async function applyRateLimit(
  request: NextRequest,
  config = RateLimitConfigs.standard
): Promise<NextResponse | null> {
  return await withRateLimit(request, config);
}

/**
 * Rate limit middleware factory
 */
export function createRateLimitMiddleware(
  config = RateLimitConfigs.standard
) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    return await applyRateLimit(request, config);
  };
}

/**
 * Get rate limit config based on endpoint path
 */
export function getRateLimitConfig(path: string) {
  // Authentication
  if (path.includes('/auth/') || path.includes('/login') || path.includes('/register')) {
    return EndpointRateLimits.auth;
  }

  // Contracts
  if (path.includes('/api/contracts')) {
    return EndpointRateLimits.contracts;
  }

  // Rate cards
  if (path.includes('/api/rate-cards')) {
    return EndpointRateLimits.rateCards;
  }

  // Search
  if (path.includes('/api/search')) {
    return EndpointRateLimits.search;
  }

  // Analytics
  if (path.includes('/api/analytics')) {
    return EndpointRateLimits.analytics;
  }

  // Upload
  if (path.includes('/upload') || path.includes('/api/files')) {
    return EndpointRateLimits.upload;
  }

  // Export
  if (path.includes('/export')) {
    return EndpointRateLimits.export;
  }

  // AI
  if (path.includes('/api/ai/') || path.includes('/api/chat')) {
    return EndpointRateLimits.ai;
  }

  // Webhooks
  if (path.includes('/api/webhooks')) {
    return EndpointRateLimits.webhooks;
  }

  // Health
  if (path.includes('/api/health')) {
    return EndpointRateLimits.health;
  }

  // Admin
  if (path.includes('/api/admin')) {
    return EndpointRateLimits.admin;
  }

  // Default to public
  return EndpointRateLimits.public;
}

/**
 * Auto rate limit middleware - automatically selects config based on path
 */
export async function autoRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  const config = getRateLimitConfig(request.nextUrl.pathname);
  return await applyRateLimit(request, config);
}

// =========================================================================
// RATE LIMIT RESPONSE HELPERS
// =========================================================================

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(
  message: string,
  retryAfter: number,
  limit: number,
  remaining: number,
  resetTime: string
): NextResponse {
  return NextResponse.json(
    {
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      retryAfter,
      rateLimit: {
        limit,
        remaining,
        reset: resetTime,
      },
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime,
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetTime: string
): NextResponse {
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetTime);
  return response;
}

// =========================================================================
// RATE LIMIT BYPASS
// =========================================================================

/**
 * Check if request should bypass rate limiting
 */
export function shouldBypassRateLimit(request: NextRequest): boolean {
  // Bypass for internal requests
  const internalToken = request.headers.get('X-Internal-Token');
  if (internalToken === process.env.INTERNAL_API_TOKEN) {
    return true;
  }

  // Bypass for admin users (if auth header present)
  const adminToken = request.headers.get('X-Admin-Token');
  if (adminToken === process.env.ADMIN_API_TOKEN) {
    return true;
  }

  return false;
}

/**
 * Rate limit middleware with bypass support
 */
export async function rateLimitWithBypass(
  request: NextRequest,
  config = RateLimitConfigs.standard
): Promise<NextResponse | null> {
  // Check if should bypass
  if (shouldBypassRateLimit(request)) {
    return null; // Continue without rate limiting
  }

  return await applyRateLimit(request, config);
}

// =========================================================================
// USAGE EXAMPLES
// =========================================================================

/**
 * Example: Apply rate limiting to a specific API route
 * 
 * ```typescript
 * import { applyRateLimit, EndpointRateLimits } from '@/lib/middleware/rate-limit.middleware';
 * 
 * export async function POST(request: NextRequest) {
 *   // Apply rate limiting
 *   const rateLimitResponse = await applyRateLimit(request, EndpointRateLimits.contracts);
 *   if (rateLimitResponse) {
 *     return rateLimitResponse;
 *   }
 * 
 *   // Continue with normal processing
 *   // ...
 * }
 * ```
 * 
 * Example: Use auto rate limiting
 * 
 * ```typescript
 * import { autoRateLimit } from '@/lib/middleware/rate-limit.middleware';
 * 
 * export async function GET(request: NextRequest) {
 *   // Automatically apply rate limiting based on path
 *   const rateLimitResponse = await autoRateLimit(request);
 *   if (rateLimitResponse) {
 *     return rateLimitResponse;
 *   }
 * 
 *   // Continue with normal processing
 *   // ...
 * }
 * ```
 */
