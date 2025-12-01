/**
 * Rate Limiter
 * API rate limiting with sliding window algorithm
 * Supports memory store (default) and Redis
 * 
 * @example
 * // In API route
 * import { rateLimit, rateLimiters } from '@/lib/security/rate-limiter';
 * 
 * export async function POST(req: Request) {
 *   const limited = await rateLimiters.api.check(getClientIP(req));
 *   if (limited) {
 *     return new Response('Too many requests', { status: 429 });
 *   }
 *   // ... handle request
 * }
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  window: number;
  /** Unique identifier for the limiter */
  identifier: string;
  /** Error message when rate limited */
  message?: string;
  /** Custom key generator */
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests */
  remaining: number;
  /** Unix timestamp when the limit resets */
  reset: number;
  /** Total limit */
  limit: number;
  /** Retry after (seconds) - only set if not allowed */
  retryAfter?: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, entry: RateLimitEntry, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================================================
// Memory Store (Default)
// ============================================================================

class MemoryStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.resetAt) {
      this.store.delete(key);
      return null;
    }
    
    return entry;
  }

  async set(key: string, entry: RateLimitEntry, _ttl: number): Promise<void> {
    this.store.set(key, entry);
  }

  async increment(key: string, ttl: number): Promise<number> {
    const now = Date.now();
    const existing = await this.get(key);
    
    if (existing) {
      existing.count++;
      this.store.set(key, existing);
      return existing.count;
    }
    
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + ttl * 1000,
    };
    this.store.set(key, entry);
    return 1;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// ============================================================================
// Redis Store (Optional)
// ============================================================================

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

class RedisStore implements RateLimitStore {
  constructor(private client: RedisClient, private prefix = 'rl:') {}

  async get(key: string): Promise<RateLimitEntry | null> {
    const data = await this.client.get(this.prefix + key);
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(key: string, entry: RateLimitEntry, ttl: number): Promise<void> {
    await this.client.set(
      this.prefix + key,
      JSON.stringify(entry),
      { EX: ttl }
    );
  }

  async increment(key: string, ttl: number): Promise<number> {
    const fullKey = this.prefix + key;
    const count = await this.client.incr(fullKey);
    
    // Set expiry on first increment
    if (count === 1) {
      await this.client.expire(fullKey, ttl);
    }
    
    return count;
  }
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private store: RateLimitStore;
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig, store?: RateLimitStore) {
    this.config = {
      message: 'Too many requests, please try again later',
      keyGenerator: (id: string) => `${config.identifier}:${id}`,
      ...config,
    };
    this.store = store ?? new MemoryStore();
  }

  /**
   * Check if a request should be rate limited
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const key = this.config.keyGenerator(identifier);
    const now = Date.now();
    
    // Get or create entry
    const existing = await this.store.get(key);
    
    if (existing) {
      // Within existing window
      const remaining = Math.max(0, this.config.limit - existing.count);
      const reset = Math.ceil(existing.resetAt / 1000);
      
      if (existing.count >= this.config.limit) {
        return {
          allowed: false,
          remaining: 0,
          reset,
          limit: this.config.limit,
          retryAfter: Math.ceil((existing.resetAt - now) / 1000),
        };
      }
      
      // Increment counter
      await this.store.increment(key, this.config.window);
      
      return {
        allowed: true,
        remaining: remaining - 1,
        reset,
        limit: this.config.limit,
      };
    }
    
    // New window
    const resetAt = now + this.config.window * 1000;
    await this.store.set(key, { count: 1, resetAt }, this.config.window);
    
    return {
      allowed: true,
      remaining: this.config.limit - 1,
      reset: Math.ceil(resetAt / 1000),
      limit: this.config.limit,
    };
  }

  /**
   * Get rate limit headers for response
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
    };
    
    if (result.retryAfter) {
      headers['Retry-After'] = String(result.retryAfter);
    }
    
    return headers;
  }

  /**
   * Get error message
   */
  get message(): string {
    return this.config.message;
  }
}

// ============================================================================
// Sliding Window Rate Limiter
// ============================================================================

interface SlidingWindowEntry {
  timestamps: number[];
}

class SlidingWindowMemoryStore {
  private store = new Map<string, SlidingWindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): SlidingWindowEntry | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, entry: SlidingWindowEntry): void {
    this.store.set(key, entry);
  }

  private cleanup(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago
    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export class SlidingWindowRateLimiter {
  private store = new SlidingWindowMemoryStore();

  constructor(private config: RateLimitConfig) {}

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.identifier}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.window * 1000;
    
    // Get existing entry
    let entry = this.store.get(key);
    
    if (!entry) {
      entry = { timestamps: [] };
    }
    
    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);
    
    // Check if at limit
    if (entry.timestamps.length >= this.config.limit) {
      const oldestInWindow = entry.timestamps[0] ?? now;
      const resetAt = oldestInWindow + this.config.window * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        reset: Math.ceil(resetAt / 1000),
        limit: this.config.limit,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }
    
    // Add current timestamp
    entry.timestamps.push(now);
    this.store.set(key, entry);
    
    return {
      allowed: true,
      remaining: this.config.limit - entry.timestamps.length,
      reset: Math.ceil((now + this.config.window * 1000) / 1000),
      limit: this.config.limit,
    };
  }
}

// ============================================================================
// Pre-configured Rate Limiters
// ============================================================================

export const rateLimiters = {
  /** General API rate limit: 100 requests per minute */
  api: new RateLimiter({
    identifier: 'api',
    limit: 100,
    window: 60,
    message: 'API rate limit exceeded. Please try again in a minute.',
  }),
  
  /** Auth rate limit: 5 attempts per 15 minutes */
  auth: new RateLimiter({
    identifier: 'auth',
    limit: 5,
    window: 900,
    message: 'Too many authentication attempts. Please try again later.',
  }),
  
  /** Upload rate limit: 10 uploads per hour */
  upload: new RateLimiter({
    identifier: 'upload',
    limit: 10,
    window: 3600,
    message: 'Upload limit exceeded. Please try again later.',
  }),
  
  /** AI/LLM rate limit: 20 requests per minute */
  ai: new RateLimiter({
    identifier: 'ai',
    limit: 20,
    window: 60,
    message: 'AI request limit exceeded. Please slow down.',
  }),
  
  /** Search rate limit: 30 searches per minute */
  search: new RateLimiter({
    identifier: 'search',
    limit: 30,
    window: 60,
    message: 'Search rate limit exceeded.',
  }),
  
  /** Webhook rate limit: 1000 per minute */
  webhook: new RateLimiter({
    identifier: 'webhook',
    limit: 1000,
    window: 60,
  }),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get client IP from request
 */
export function getClientIP(req: Request): string {
  // Check common headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Cloudflare
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }
  
  return 'unknown';
}

/**
 * Create rate limit response
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message?: string
): Response {
  const limiter = new RateLimiter({ identifier: '', limit: 0, window: 0 });
  const headers = limiter.getHeaders(result);
  
  return new Response(
    JSON.stringify({
      error: 'RATE_LIMITED',
      message: message ?? 'Too many requests',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(
  limiter: RateLimiter,
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    const ip = getClientIP(req);
    const result = await limiter.check(ip);
    
    if (!result.allowed) {
      return rateLimitResponse(result, limiter.message);
    }
    
    const response = await handler(req);
    
    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    const rateLimitHeaders = new RateLimiter({ 
      identifier: '', 
      limit: 0, 
      window: 0 
    }).getHeaders(result);
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// ============================================================================
// Exports
// ============================================================================

export { MemoryStore, RedisStore };
export type { RedisClient };
