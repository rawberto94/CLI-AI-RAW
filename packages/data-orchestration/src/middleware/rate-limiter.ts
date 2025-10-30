import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * In-memory rate limiter
 * For production, use Redis or similar distributed cache
 */
class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is within rate limit
   */
  check(key: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.store[key];

    // No entry or expired entry
    if (!entry || now >= entry.resetTime) {
      this.store[key] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    // Increment count
    entry.count++;

    // Check if over limit
    if (entry.count > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (now >= this.store[key].resetTime) {
        delete this.store[key];
      }
    });
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store = {};
  }

  /**
   * Destroy rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Extract identifier (IP address or tenant ID)
    const identifier = getIdentifier(request);

    // Check rate limit
    const result = rateLimiter.check(identifier, config);

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    // If not allowed, return 429
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      headers.set('Retry-After', retryAfter.toString());

      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message:
            config.message ||
            `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`,
          retryAfter,
        },
        { status: 429, headers }
      );
    }

    // Return null to continue processing
    return null;
  };
}

/**
 * Get identifier from request
 */
function getIdentifier(request: NextRequest): string {
  // Try to get tenant ID from query params or headers
  const tenantId =
    request.nextUrl.searchParams.get('tenantId') ||
    request.headers.get('X-Tenant-ID');

  if (tenantId) {
    return `tenant:${tenantId}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

  return `ip:${ip}`;
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Standard API rate limit: 100 requests per minute
  standard: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    message: 'Standard API rate limit exceeded. Maximum 100 requests per minute.',
  },

  // Strict rate limit for expensive operations: 10 requests per minute
  strict: {
    windowMs: 60000, // 1 minute
    maxRequests: 10,
    message: 'Rate limit exceeded for expensive operations. Maximum 10 requests per minute.',
  },

  // Generous rate limit for read operations: 200 requests per minute
  generous: {
    windowMs: 60000, // 1 minute
    maxRequests: 200,
    message: 'Rate limit exceeded. Maximum 200 requests per minute.',
  },

  // Hourly rate limit: 1000 requests per hour
  hourly: {
    windowMs: 3600000, // 1 hour
    maxRequests: 1000,
    message: 'Hourly rate limit exceeded. Maximum 1000 requests per hour.',
  },

  // Daily rate limit: 10000 requests per day
  daily: {
    windowMs: 86400000, // 24 hours
    maxRequests: 10000,
    message: 'Daily rate limit exceeded. Maximum 10000 requests per day.',
  },
};

/**
 * Apply rate limiting to API route
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RateLimitConfigs.standard
): Promise<NextResponse | null> {
  const limiter = createRateLimiter(config);
  return await limiter(request);
}

export { rateLimiter };
