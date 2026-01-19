/**
 * Rate Limiting Middleware for Contract Sources API
 * 
 * Implements sliding window rate limiting with configurable limits per tenant.
 * Uses Redis for distributed rate limiting across multiple instances.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import Redis from "ioredis";

// Rate limit configurations by endpoint type
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest, tenantId: string) => string;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // General API endpoints
  default: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,
  },
  // Sync trigger endpoints (more restrictive)
  sync: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // File download endpoints
  download: {
    windowMs: 60 * 1000,
    maxRequests: 50,
  },
  // Metrics/dashboard endpoints (less restrictive)
  metrics: {
    windowMs: 60 * 1000,
    maxRequests: 200,
  },
  // OAuth endpoints
  oauth: {
    windowMs: 60 * 1000,
    maxRequests: 20,
  },
  // Webhook endpoints (allow higher volume)
  webhook: {
    windowMs: 60 * 1000,
    maxRequests: 500,
  },
};

// Redis client singleton
let redis: InstanceType<typeof Redis> | null = null;

function getRedis(): InstanceType<typeof Redis> | null {
  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL);
    } catch (error) {
      console.error("[RateLimit] Failed to connect to Redis:", error);
    }
  }
  return redis;
}

// In-memory fallback for when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Check rate limit for a given key
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisClient = getRedis();
  const now = Date.now();
  const windowStart = now - config.windowMs;

  if (redisClient) {
    try {
      // Use Redis sorted set for sliding window
      const multi = redisClient.multi();
      
      // Remove old entries
      multi.zremrangebyscore(key, 0, windowStart);
      
      // Count current entries
      multi.zcard(key);
      
      // Add current request
      multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
      
      // Set expiry
      multi.pexpire(key, config.windowMs);
      
      const results = await multi.exec();
      const currentCount = (results?.[1]?.[1] as number) || 0;
      
      return {
        allowed: currentCount < config.maxRequests,
        remaining: Math.max(0, config.maxRequests - currentCount - 1),
        resetAt: now + config.windowMs,
        limit: config.maxRequests,
      };
    } catch (error) {
      console.error("[RateLimit] Redis error, falling back to memory:", error);
    }
  }

  // Memory fallback
  const entry = memoryStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      limit: config.maxRequests,
    };
  }

  entry.count++;
  
  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Create rate limit middleware
 */
export function createRateLimiter(configType: keyof typeof DEFAULT_CONFIGS = "default") {
  const config = DEFAULT_CONFIGS[configType] || DEFAULT_CONFIGS.default;

  return async function rateLimitMiddleware(
    req: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      const session = await getServerSession();
      const tenantId = session?.user?.tenantId || "anonymous";
      const userId = session?.user?.id || "anonymous";

      // Generate rate limit key
      const key = config.keyGenerator
        ? config.keyGenerator(req, tenantId)
        : `ratelimit:${configType}:${tenantId}:${userId}`;

      const result = await checkRateLimit(key, config);

      // Add rate limit headers to response
      const addHeaders = (res: NextResponse) => {
        res.headers.set("X-RateLimit-Limit", result.limit.toString());
        res.headers.set("X-RateLimit-Remaining", result.remaining.toString());
        res.headers.set("X-RateLimit-Reset", result.resetAt.toString());
        return res;
      };

      if (!result.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded",
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        );
        
        response.headers.set(
          "Retry-After",
          Math.ceil((result.resetAt - Date.now()) / 1000).toString()
        );
        
        return addHeaders(response);
      }

      const response = await handler();
      return addHeaders(response);
    } catch (error) {
      console.error("[RateLimit] Middleware error:", error);
      // On error, allow the request through
      return handler();
    }
  };
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  configType: keyof typeof DEFAULT_CONFIGS = "default"
) {
  const rateLimiter = createRateLimiter(configType);
  
  return async function (req: NextRequest): Promise<NextResponse> {
    return rateLimiter(req, () => handler(req));
  };
}

/**
 * Rate limit by IP address (for unauthenticated endpoints)
 */
export function withIpRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  configType: keyof typeof DEFAULT_CONFIGS = "default"
) {
  const config = {
    ...DEFAULT_CONFIGS[configType],
    keyGenerator: (req: NextRequest) => {
      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0] || "unknown";
      return `ratelimit:ip:${configType}:${ip}`;
    },
  };

  return async function (req: NextRequest): Promise<NextResponse> {
    const rateLimiter = createRateLimiter(configType);
    return rateLimiter(req, () => handler(req));
  };
}

/**
 * Cleanup expired entries from memory store (for non-Redis deployments)
 */
export function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

// Periodic cleanup of memory store
if (typeof setInterval !== "undefined") {
  setInterval(cleanupMemoryStore, 60 * 1000);
}

export default {
  createRateLimiter,
  withRateLimit,
  withIpRateLimit,
  DEFAULT_CONFIGS,
};
