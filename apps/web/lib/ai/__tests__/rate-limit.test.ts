/**
 * Unit Tests for AI Rate Limiting
 * Tests /lib/ai/rate-limit.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, AI_RATE_LIMITS, type RateLimitConfig } from '@/lib/ai/rate-limit';

describe('AI Rate Limiting', () => {
  const tenantId = 'test-tenant';
  const userId = 'test-user';
  const endpoint = '/test';

  // Use unique endpoint per test to avoid state leakage
  let testEndpoint: string;
  beforeEach(() => {
    testEndpoint = `/test/${Date.now()}-${Math.random()}`;
  });

  describe('checkRateLimit', () => {
    it('allows requests within the limit', () => {
      const config: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 };
      const result = checkRateLimit(tenantId, userId, testEndpoint, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('blocks requests exceeding the limit', () => {
      const config: RateLimitConfig = { maxRequests: 3, windowMs: 60_000 };
      const ep = `${testEndpoint}-block`;

      // Use up all 3 slots
      checkRateLimit(tenantId, userId, ep, config);
      checkRateLimit(tenantId, userId, ep, config);
      checkRateLimit(tenantId, userId, ep, config);

      // 4th should be blocked
      const result = checkRateLimit(tenantId, userId, ep, config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('isolates rate limits by user', () => {
      const config: RateLimitConfig = { maxRequests: 2, windowMs: 60_000 };
      const ep = `${testEndpoint}-user`;

      // User A uses up limit
      checkRateLimit(tenantId, 'userA', ep, config);
      checkRateLimit(tenantId, 'userA', ep, config);
      const blockedA = checkRateLimit(tenantId, 'userA', ep, config);
      expect(blockedA.allowed).toBe(false);

      // User B should still be allowed
      const allowedB = checkRateLimit(tenantId, 'userB', ep, config);
      expect(allowedB.allowed).toBe(true);
    });

    it('isolates rate limits by tenant', () => {
      const config: RateLimitConfig = { maxRequests: 2, windowMs: 60_000 };
      const ep = `${testEndpoint}-tenant`;

      // Tenant A uses up limit
      checkRateLimit('tenantA', userId, ep, config);
      checkRateLimit('tenantA', userId, ep, config);
      const blockedA = checkRateLimit('tenantA', userId, ep, config);
      expect(blockedA.allowed).toBe(false);

      // Tenant B should still be allowed
      const allowedB = checkRateLimit('tenantB', userId, ep, config);
      expect(allowedB.allowed).toBe(true);
    });

    it('returns correct remaining count', () => {
      const config: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 };
      const ep = `${testEndpoint}-remaining`;

      expect(checkRateLimit(tenantId, userId, ep, config).remaining).toBe(4);
      expect(checkRateLimit(tenantId, userId, ep, config).remaining).toBe(3);
      expect(checkRateLimit(tenantId, userId, ep, config).remaining).toBe(2);
    });
  });

  describe('AI_RATE_LIMITS presets', () => {
    it('has streaming tier (10 req/min)', () => {
      expect(AI_RATE_LIMITS.streaming.maxRequests).toBe(10);
      expect(AI_RATE_LIMITS.streaming.windowMs).toBe(60_000);
    });

    it('has standard tier (30 req/min)', () => {
      expect(AI_RATE_LIMITS.standard.maxRequests).toBe(30);
    });

    it('has lightweight tier (60 req/min)', () => {
      expect(AI_RATE_LIMITS.lightweight.maxRequests).toBe(60);
    });
  });
});
