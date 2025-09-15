/**
 * Enhanced Rate Limiting System
 * Provides adaptive rate limiting with different tiers and protection against abuse
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors';

interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
  message?: string;
  skipIf?: (request: FastifyRequest) => boolean;
}

interface RateLimitStore {
  [key: string]: {
    requests: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key] && this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  private generateKey(request: FastifyRequest, identifier?: string): string {
    const ip = request.ip || 'unknown';
    const tenantId = request.headers['x-tenant-id'] || 'global';
    const userAgent = request.headers['user-agent'] || 'unknown';
    
    // Create a unique key based on IP, tenant, and optional identifier
    return `${ip}:${tenantId}:${identifier || 'default'}:${userAgent.slice(0, 50)}`;
  }

  public createLimiter(rules: RateLimitRule) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip rate limiting if condition is met
      if (rules.skipIf && rules.skipIf(request)) {
        return;
      }

      const key = this.generateKey(request);
      const now = Date.now();
      
      if (!this.store[key]) {
        this.store[key] = {
          requests: 1,
          resetTime: now + rules.windowMs
        };
        return;
      }

      const entry = this.store[key];
      
      // Reset window if expired
      if (entry.resetTime <= now) {
        entry.requests = 1;
        entry.resetTime = now + rules.windowMs;
        return;
      }

      // Check if limit exceeded
      if (entry.requests >= rules.maxRequests) {
        const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);
        
        reply.headers({
          'X-RateLimit-Limit': rules.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
          'Retry-After': resetInSeconds.toString()
        });

        throw new AppError(
          429,
          rules.message || `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
          true,
          {
            limit: rules.maxRequests,
            window: rules.windowMs,
            resetTime: entry.resetTime,
            retryAfter: resetInSeconds
          }
        );
      }

      // Increment request count
      entry.requests++;
      
      // Add rate limit headers
      reply.headers({
        'X-RateLimit-Limit': rules.maxRequests.toString(),
        'X-RateLimit-Remaining': (rules.maxRequests - entry.requests).toString(),
        'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
      });
    };
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Predefined rate limiting rules
export const rateLimitRules = {
  // Strict limits for authentication endpoints
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  
  // Moderate limits for API endpoints
  api: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'API rate limit exceeded. Please try again later.'
  },
  
  // Higher limits for file uploads
  upload: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'File upload limit exceeded. Please try again in 1 hour.'
  },
  
  // Very strict limits for search/AI operations
  aiOperations: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'AI operation limit exceeded. Please try again in 1 hour.',
    skipIf: (request: FastifyRequest) => {
      // Skip rate limiting for admin users
      return request.headers['x-admin'] === 'true';
    }
  },
  
  // Global fallback rate limit
  global: {
    maxRequests: 1000,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Global rate limit exceeded. Please try again later.'
  }
};

// Create singleton instance
export const rateLimiter = new RateLimiter();

// Export pre-configured limiters
export const authLimiter = rateLimiter.createLimiter(rateLimitRules.auth);
export const apiLimiter = rateLimiter.createLimiter(rateLimitRules.api);
export const uploadLimiter = rateLimiter.createLimiter(rateLimitRules.upload);
export const aiLimiter = rateLimiter.createLimiter(rateLimitRules.aiOperations);
export const globalLimiter = rateLimiter.createLimiter(rateLimitRules.global);