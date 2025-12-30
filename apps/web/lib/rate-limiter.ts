/**
 * Redis-Based Rate Limiter
 * 
 * Production-ready rate limiting using Redis for distributed systems.
 * Supports multiple algorithms: sliding window, token bucket, fixed window.
 */

import IORedis from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

type RedisClient = InstanceType<typeof IORedis>;

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Rate limiting algorithm */
  algorithm?: 'sliding-window' | 'fixed-window' | 'token-bucket';
  /** Prefix for Redis keys */
  prefix?: string;
  /** Custom key generator function */
  keyGenerator?: (req: NextRequest) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: NextRequest) => boolean;
  /** Custom error message */
  errorMessage?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Seconds until the limit resets */
  resetIn: number;
  /** Retry-After header value */
  retryAfter?: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private redis: RedisClient | null = null;
  private config: Required<Omit<RateLimitConfig, 'skip' | 'keyGenerator'>> & Pick<RateLimitConfig, 'skip' | 'keyGenerator'>;

  constructor(config: RateLimitConfig) {
    this.config = {
      limit: config.limit,
      window: config.window,
      algorithm: config.algorithm || 'sliding-window',
      prefix: config.prefix || 'ratelimit',
      errorMessage: config.errorMessage || 'Too many requests. Please try again later.',
      keyGenerator: config.keyGenerator,
      skip: config.skip,
    };
  }

  /**
   * Initialize Redis connection
   */
  private async getRedis(): Promise<RedisClient> {
    if (!this.redis) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      await this.redis.connect();
    }
    return this.redis;
  }

  /**
   * Generate rate limit key from request
   */
  private getKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return `${this.config.prefix}:${this.config.keyGenerator(req)}`;
    }

    // Default: use IP address
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') ||
               'unknown';
    
    return `${this.config.prefix}:${ip}`;
  }

  /**
   * Sliding window rate limiting algorithm
   * More accurate but slightly more expensive
   */
  private async slidingWindow(key: string): Promise<RateLimitResult> {
    const redis = await this.getRedis();
    const now = Date.now();
    const windowMs = this.config.window * 1000;
    const windowStart = now - windowMs;

    // Use a sorted set with timestamps as scores
    const multi = redis.multi();
    
    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);
    
    // Add current request
    multi.zadd(key, now, `${now}-${Math.random()}`);
    
    // Count requests in window
    multi.zcard(key);
    
    // Set expiry
    multi.expire(key, this.config.window + 1);

    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const count = results[2]?.[1] as number || 0;
    const allowed = count <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - count);
    const resetIn = Math.ceil(this.config.window);

    return {
      allowed,
      remaining,
      limit: this.config.limit,
      resetIn,
      retryAfter: allowed ? undefined : resetIn,
    };
  }

  /**
   * Fixed window rate limiting algorithm
   * Simpler and faster, but can have edge case bursts
   */
  private async fixedWindow(key: string): Promise<RateLimitResult> {
    const redis = await this.getRedis();
    const windowKey = `${key}:${Math.floor(Date.now() / (this.config.window * 1000))}`;

    const multi = redis.multi();
    multi.incr(windowKey);
    multi.expire(windowKey, this.config.window + 1);
    multi.ttl(windowKey);

    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const count = results[0]?.[1] as number || 0;
    const ttl = results[2]?.[1] as number || this.config.window;
    
    const allowed = count <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - count);
    const resetIn = Math.max(1, ttl);

    return {
      allowed,
      remaining,
      limit: this.config.limit,
      resetIn,
      retryAfter: allowed ? undefined : resetIn,
    };
  }

  /**
   * Token bucket algorithm
   * Best for smooth rate limiting with burst handling
   */
  private async tokenBucket(key: string): Promise<RateLimitResult> {
    const redis = await this.getRedis();
    const now = Date.now();
    const refillRate = this.config.limit / this.config.window; // tokens per second
    
    const bucketKey = `${key}:bucket`;
    const lastRefillKey = `${key}:lastRefill`;

    // Get current state
    const [tokensStr, lastRefillStr] = await redis.mget(bucketKey, lastRefillKey);
    
    let tokens = tokensStr ? parseFloat(tokensStr) : this.config.limit;
    const lastRefill = lastRefillStr ? parseInt(lastRefillStr, 10) : now;
    
    // Calculate tokens to add based on time passed
    const timePassed = (now - lastRefill) / 1000;
    tokens = Math.min(this.config.limit, tokens + timePassed * refillRate);
    
    const allowed = tokens >= 1;
    
    if (allowed) {
      tokens -= 1;
    }
    
    // Save state
    await redis.multi()
      .set(bucketKey, tokens.toString(), 'EX', this.config.window * 2)
      .set(lastRefillKey, now.toString(), 'EX', this.config.window * 2)
      .exec();

    const remaining = Math.floor(tokens);
    const resetIn = Math.ceil((this.config.limit - tokens) / refillRate);

    return {
      allowed,
      remaining,
      limit: this.config.limit,
      resetIn,
      retryAfter: allowed ? undefined : Math.ceil(1 / refillRate),
    };
  }

  /**
   * Check rate limit for a request
   */
  async check(req: NextRequest): Promise<RateLimitResult> {
    // Skip if configured
    if (this.config.skip?.(req)) {
      return {
        allowed: true,
        remaining: this.config.limit,
        limit: this.config.limit,
        resetIn: this.config.window,
      };
    }

    const key = this.getKey(req);

    try {
      switch (this.config.algorithm) {
        case 'fixed-window':
          return await this.fixedWindow(key);
        case 'token-bucket':
          return await this.tokenBucket(key);
        case 'sliding-window':
        default:
          return await this.slidingWindow(key);
      }
    } catch (error) {
      // On Redis error, fail open (allow request) but log
      console.error('Rate limiter error:', error);
      return {
        allowed: true,
        remaining: this.config.limit,
        limit: this.config.limit,
        resetIn: this.config.window,
      };
    }
  }

  /**
   * Get rate limit headers
   */
  getHeaders(result: RateLimitResult): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': (Date.now() + result.resetIn * 1000).toString(),
    };

    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString();
    }

    return headers;
  }

  /**
   * Create rate limited response
   */
  createLimitedResponse(result: RateLimitResult): NextResponse {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: this.config.errorMessage,
          retryAfter: result.retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...this.getHeaders(result),
        },
      }
    );
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// ============================================================================
// Preset Rate Limiters
// ============================================================================

/**
 * Standard API rate limiter: 100 requests per minute
 */
export const standardLimiter = new RateLimiter({
  limit: 100,
  window: 60,
  algorithm: 'sliding-window',
  prefix: 'api:standard',
});

/**
 * Strict rate limiter for sensitive endpoints: 10 requests per minute
 */
export const strictLimiter = new RateLimiter({
  limit: 10,
  window: 60,
  algorithm: 'sliding-window',
  prefix: 'api:strict',
});

/**
 * Auth rate limiter: 5 login attempts per 15 minutes
 */
export const authLimiter = new RateLimiter({
  limit: 5,
  window: 900,
  algorithm: 'fixed-window',
  prefix: 'api:auth',
  errorMessage: 'Too many login attempts. Please try again in 15 minutes.',
});

/**
 * Upload rate limiter: 20 uploads per hour
 */
export const uploadLimiter = new RateLimiter({
  limit: 20,
  window: 3600,
  algorithm: 'sliding-window',
  prefix: 'api:upload',
  errorMessage: 'Upload limit reached. Please try again later.',
});

/**
 * AI/ML endpoint rate limiter: 30 requests per minute
 */
export const aiLimiter = new RateLimiter({
  limit: 30,
  window: 60,
  algorithm: 'token-bucket',
  prefix: 'api:ai',
  errorMessage: 'AI processing limit reached. Please wait a moment.',
});

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create rate limiting middleware for API routes
 */
export function withRateLimit(
  config: RateLimitConfig | RateLimiter
) {
  const limiter = config instanceof RateLimiter ? config : new RateLimiter(config);

  return async function rateLimitMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>
  ) {
    return async function (req: NextRequest): Promise<NextResponse> {
      const result = await limiter.check(req);

      if (!result.allowed) {
        return limiter.createLimitedResponse(result);
      }

      const response = await handler(req);

      // Add rate limit headers to successful responses
      const headers = limiter.getHeaders(result);
      Object.entries(headers).forEach(([key, value]) => {
        if (value) response.headers.set(key, value);
      });

      return response;
    };
  };
}

// ============================================================================
// In-Memory Fallback (for development without Redis)
// ============================================================================

const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter for development
 * NOT suitable for production or multi-instance deployments
 */
export function memoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetIn: windowSeconds,
    };
  }

  entry.count++;
  
  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: limit - entry.count,
    limit,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// ============================================================================
// Export
// ============================================================================

export default RateLimiter;
