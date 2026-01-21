/**
 * AI Rate Limiting Service
 * 
 * Provides rate limiting for AI endpoints using:
 * - Redis for distributed rate limiting (if available)
 * - In-memory fallback for single-instance deployments
 * 
 * Features:
 * - Per-user rate limits
 * - Per-tenant rate limits
 * - Sliding window algorithm
 * - Token-based limits
 * - Cost-based limits
 */

import Redis from 'ioredis';

// Types
export interface RateLimitConfig {
  windowMs: number;          // Time window in milliseconds
  maxRequests: number;       // Max requests per window
  maxTokens?: number;        // Max tokens per window (optional)
  maxCost?: number;          // Max cost per window in dollars (optional)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  reason?: string;
}

export interface RateLimitUsage {
  requests: number;
  tokens: number;
  cost: number;
  windowStart: number;
}

// Default limits by tier
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,
    maxTokens: 10000,
    maxCost: 0.10,
  },
  starter: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    maxTokens: 50000,
    maxCost: 1.00,
  },
  professional: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    maxTokens: 200000,
    maxCost: 5.00,
  },
  enterprise: {
    windowMs: 60 * 1000,
    maxRequests: 500,
    maxTokens: 1000000,
    maxCost: 50.00,
  },
};

// In-memory store (fallback when Redis unavailable)
const memoryStore = new Map<string, RateLimitUsage>();

class AIRateLimitService {
  private redis: Redis | null = null;
  private useRedis = false;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          lazyConnect: true,
        });

        await this.redis.connect();
        this.useRedis = true;
        console.warn('AI Rate Limiter: Using Redis');
      } catch (error) {
        console.warn('AI Rate Limiter: Redis unavailable, using memory store', error);
        this.redis = null;
        this.useRedis = false;
      }
    } else {
      console.warn('AI Rate Limiter: No REDIS_URL, using memory store');
    }
  }

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit(
    identifier: string,
    tier: string = 'free',
    additionalTokens: number = 0,
    additionalCost: number = 0
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[tier] || RATE_LIMITS.free;
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    // Get current usage
    const usage = await this.getUsage(key, config.windowMs);

    // Check request limit
    if (usage.requests >= config.maxRequests) {
      const resetAt = usage.windowStart + config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
        reason: `Request limit exceeded. Max ${config.maxRequests} requests per minute.`,
      };
    }

    // Check token limit
    if (config.maxTokens && (usage.tokens + additionalTokens) > config.maxTokens) {
      const resetAt = usage.windowStart + config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
        reason: `Token limit exceeded. Max ${config.maxTokens.toLocaleString()} tokens per minute.`,
      };
    }

    // Check cost limit
    if (config.maxCost && (usage.cost + additionalCost) > config.maxCost) {
      const resetAt = usage.windowStart + config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
        reason: `Cost limit exceeded. Max $${config.maxCost.toFixed(2)} per minute.`,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - usage.requests - 1,
      resetAt: usage.windowStart + config.windowMs,
    };
  }

  /**
   * Record usage after a successful request
   */
  async recordUsage(
    identifier: string,
    tokens: number,
    cost: number,
    tier: string = 'free'
  ): Promise<void> {
    const config = RATE_LIMITS[tier] || RATE_LIMITS.free;
    const key = `ratelimit:${identifier}`;

    if (this.useRedis && this.redis) {
      await this.recordUsageRedis(key, tokens, cost, config.windowMs);
    } else {
      this.recordUsageMemory(key, tokens, cost, config.windowMs);
    }
  }

  /**
   * Get current usage for an identifier
   */
  private async getUsage(key: string, windowMs: number): Promise<RateLimitUsage> {
    if (this.useRedis && this.redis) {
      return this.getUsageRedis(key, windowMs);
    }
    return this.getUsageMemory(key, windowMs);
  }

  /**
   * Redis implementation: Get usage
   */
  private async getUsageRedis(key: string, windowMs: number): Promise<RateLimitUsage> {
    if (!this.redis) {
      return this.getUsageMemory(key, windowMs);
    }

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${key}:${windowStart}`;

    try {
      const data = await this.redis.hgetall(windowKey);
      
      return {
        requests: parseInt(data.requests || '0', 10),
        tokens: parseInt(data.tokens || '0', 10),
        cost: parseFloat(data.cost || '0'),
        windowStart,
      };
    } catch (error) {
      console.error('Redis getUsage error:', error);
      return this.getUsageMemory(key, windowMs);
    }
  }

  /**
   * Redis implementation: Record usage
   */
  private async recordUsageRedis(
    key: string,
    tokens: number,
    cost: number,
    windowMs: number
  ): Promise<void> {
    if (!this.redis) {
      this.recordUsageMemory(key, tokens, cost, windowMs);
      return;
    }

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${key}:${windowStart}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.hincrby(windowKey, 'requests', 1);
      pipeline.hincrby(windowKey, 'tokens', tokens);
      pipeline.hincrbyfloat(windowKey, 'cost', cost);
      pipeline.pexpire(windowKey, windowMs * 2); // Keep for 2 windows
      await pipeline.exec();
    } catch (error) {
      console.error('Redis recordUsage error:', error);
      this.recordUsageMemory(key, tokens, cost, windowMs);
    }
  }

  /**
   * Memory implementation: Get usage
   */
  private getUsageMemory(key: string, windowMs: number): RateLimitUsage {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${key}:${windowStart}`;

    const usage = memoryStore.get(windowKey);
    
    if (usage && usage.windowStart === windowStart) {
      return usage;
    }

    // Clean up old entries
    this.cleanupMemoryStore(windowMs);

    return {
      requests: 0,
      tokens: 0,
      cost: 0,
      windowStart,
    };
  }

  /**
   * Memory implementation: Record usage
   */
  private recordUsageMemory(
    key: string,
    tokens: number,
    cost: number,
    windowMs: number
  ): void {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowKey = `${key}:${windowStart}`;

    const existing = memoryStore.get(windowKey) || {
      requests: 0,
      tokens: 0,
      cost: 0,
      windowStart,
    };

    memoryStore.set(windowKey, {
      requests: existing.requests + 1,
      tokens: existing.tokens + tokens,
      cost: existing.cost + cost,
      windowStart,
    });
  }

  /**
   * Clean up old memory entries
   */
  private cleanupMemoryStore(windowMs: number): void {
    const now = Date.now();
    const cutoff = now - windowMs * 2;

    for (const [key, value] of memoryStore.entries()) {
      if (value.windowStart < cutoff) {
        memoryStore.delete(key);
      }
    }
  }

  /**
   * Get rate limit headers for response
   */
  getRateLimitHeaders(result: RateLimitResult, tier: string = 'free'): Record<string, string> {
    const config = RATE_LIMITS[tier] || RATE_LIMITS.free;

    return {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
      ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
    };
  }

  /**
   * Get usage stats for an identifier
   */
  async getUsageStats(identifier: string, tier: string = 'free'): Promise<{
    current: RateLimitUsage;
    limits: RateLimitConfig;
    percentUsed: {
      requests: number;
      tokens: number;
      cost: number;
    };
  }> {
    const config = RATE_LIMITS[tier] || RATE_LIMITS.free;
    const key = `ratelimit:${identifier}`;
    const usage = await this.getUsage(key, config.windowMs);

    return {
      current: usage,
      limits: config,
      percentUsed: {
        requests: (usage.requests / config.maxRequests) * 100,
        tokens: config.maxTokens ? (usage.tokens / config.maxTokens) * 100 : 0,
        cost: config.maxCost ? (usage.cost / config.maxCost) * 100 : 0,
      },
    };
  }
}

export const aiRateLimit = new AIRateLimitService();
