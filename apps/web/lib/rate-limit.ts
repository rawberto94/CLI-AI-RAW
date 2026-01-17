/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// =====================
// Configuration
// =====================

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Redis key prefix
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 100,      // 100 requests per minute
  keyPrefix: 'ratelimit:',
};

// Endpoint-specific rate limits
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // AI endpoints - expensive operations
  '/api/ai/': {
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'ratelimit:ai:',
  },
  '/api/chat/': {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'ratelimit:chat:',
  },
  
  // Authentication endpoints - prevent brute force
  '/api/auth/': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyPrefix: 'ratelimit:auth:',
  },
  
  // Webhook endpoints - allow higher limits
  '/api/webhooks/': {
    windowMs: 60 * 1000,
    maxRequests: 500,
    keyPrefix: 'ratelimit:webhook:',
  },
  
  // Integration sync - resource intensive
  '/api/integrations/sync': {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
    keyPrefix: 'ratelimit:sync:',
  },
  
  // Contract upload - allow higher limits for bulk
  '/api/contracts/upload': {
    windowMs: 60 * 1000,
    maxRequests: 50, // Increased for bulk uploads
    keyPrefix: 'ratelimit:upload:',
  },
  
  // Search endpoints
  '/api/search/': {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'ratelimit:search:',
  },
  
  // Default for all other endpoints
  default: defaultConfig,
};

// =====================
// Redis Client
// =====================

let redis: InstanceType<typeof Redis> | null = null;

function getRedisClient(): InstanceType<typeof Redis> | null {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    redis.on('error', (_err: Error) => {
      // Redis error handling
    });
    
    return redis;
  } catch {
    return null;
  }
}

// =====================
// In-Memory Store (Fallback)
// =====================

const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

// =====================
// Rate Limiter
// =====================

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + config.windowMs;
  const fullKey = `${config.keyPrefix}${key}`;
  
  const redisClient = getRedisClient();
  
  if (redisClient) {
    // Redis-based rate limiting
    try {
      const multi = redisClient.multi();
      multi.incr(fullKey);
      multi.pttl(fullKey);
      
      const results = await multi.exec();
      const count = (results?.[0]?.[1] as number) || 0;
      const ttl = (results?.[1]?.[1] as number) || -1;
      
      // Set expiry if this is the first request in the window
      if (count === 1 || ttl === -1) {
        await redisClient.pexpire(fullKey, config.windowMs);
      }
      
      const remaining = Math.max(0, config.maxRequests - count);
      const actualResetAt = ttl > 0 ? now + ttl : resetAt;
      
      if (count > config.maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetAt: actualResetAt,
          retryAfter: Math.ceil(ttl / 1000),
        };
      }
      
      return {
        success: true,
        remaining,
        resetAt: actualResetAt,
      };
    } catch {
      // Redis error, falling back to memory
    }
  }
  
  // In-memory fallback
  const stored = memoryStore.get(fullKey);
  
  if (!stored || stored.resetAt < now) {
    // New window
    memoryStore.set(fullKey, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }
  
  stored.count++;
  const remaining = Math.max(0, config.maxRequests - stored.count);
  
  if (stored.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: stored.resetAt,
      retryAfter: Math.ceil((stored.resetAt - now) / 1000),
    };
  }
  
  return {
    success: true,
    remaining,
    resetAt: stored.resetAt,
  };
}

// =====================
// Get Rate Limit Config for Path
// =====================

function getConfigForPath(path: string): RateLimitConfig {
  for (const [pattern, config] of Object.entries(rateLimitConfigs)) {
    if (pattern !== 'default' && path.startsWith(pattern)) {
      return config;
    }
  }
  return rateLimitConfigs.default!;
}

// =====================
// Middleware
// =====================

export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  
  // Skip rate limiting for static assets
  if (path.startsWith('/_next') || path.startsWith('/static')) {
    return null;
  }
  
  // Get client identifier
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown';
  const userId = request.headers.get('x-user-id'); // Set by auth middleware
  const tenantId = request.headers.get('x-tenant-id');
  
  // Use user ID if authenticated, otherwise IP
  const identifier = userId || `ip:${ip}`;
  const key = `${identifier}:${tenantId || 'default'}:${path}`;
  
  const config = getConfigForPath(path);
  const result = await checkRateLimit(key, config);
  
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          'Retry-After': String(result.retryAfter),
        },
      }
    );
  }
  
  // Continue with request, add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(config.maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  
  return null; // Let the request continue
}

// =====================
// Rate Limit Decorator for API Routes
// =====================

type ApiHandler = (request: NextRequest, ...args: unknown[]) => Promise<Response>;

export function withRateLimit(config?: Partial<RateLimitConfig>) {
  const finalConfig = { ...defaultConfig, ...config };
  
  return function decorator<T extends ApiHandler>(
    handler: T
  ): T {
    return (async (request: NextRequest, ...args: unknown[]) => {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded?.split(',')[0] ?? 'unknown';
      const userId = request.headers.get('x-user-id');
      const identifier = userId || `ip:${ip}`;
      
      const result = await checkRateLimit(identifier, finalConfig);
      
      if (!result.success) {
        return NextResponse.json(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter,
          },
          { status: 429 }
        );
      }
      
      return handler(request, ...args);
    }) as T;
  };
}
