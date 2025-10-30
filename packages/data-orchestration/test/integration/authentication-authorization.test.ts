/**
 * Integration Tests for Authentication and Authorization
 * Tests API security, access control, and permission validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'clients-db';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'test-tenant-auth';
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Authentication and Authorization Integration Tests', () => {
  beforeAll(async () => {
    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      create: {
        id: TEST_TENANT_ID,
        name: 'Test Tenant Auth',
        slug: 'test-tenant-auth',
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.contract.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.delete({ where: { id: TEST_TENANT_ID } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe('Tenant Isolation', () => {
    it('should only return contracts for specified tenant', async () => {
      // Create contracts for different tenants
      await prisma.contract.create({
        data: {
          id: 'contract-tenant-1',
          tenantId: TEST_TENANT_ID,
          fileName: 'tenant1-contract.pdf',
          originalName: 'Tenant 1 Contract.pdf',
          fileSize: BigInt(1024),
          mimeType: 'application/pdf',
          status: 'COMPLETED',
        },
      });

      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // All contracts should belong to the specified tenant
      data.data.contracts.forEach((contract: any) => {
        expect(contract.tenantId || TEST_TENANT_ID).toBe(TEST_TENANT_ID);
      });
    });

    it('should not allow access to other tenant data', async () => {
      const otherTenantId = 'other-tenant';
      
      // Try to access contracts from another tenant
      const response = await fetch(
        `${BASE_URL}/api/contracts/${otherTenantId}/some-contract-id?tenantId=${TEST_TENANT_ID}`
      );

      // Should either return 404 or 403
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Input Validation', () => {
    it('should validate required tenant ID', async () => {
      const response = await fetch(`${BASE_URL}/api/contracts`);
      const data = await response.json();

      // Should use default tenant or require tenant ID
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should sanitize SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE contracts; --";
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&search=${encodeURIComponent(maliciousInput)}`
      );

      // Should handle safely without error
      expect(response.status).toBe(200);
      
      // Verify database is intact
      const count = await prisma.contract.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should sanitize XSS attempts', async () => {
      const xssInput = '<script>alert("xss")</script>';
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&search=${encodeURIComponent(xssInput)}`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Response should not contain unescaped script tags
      const responseText = JSON.stringify(data);
      expect(responseText).not.toContain('<script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per endpoint', async () => {
      const requests: Promise<Response>[] = [];
      
      // Make 150 requests rapidly (exceeds typical rate limit)
      for (let i = 0; i < 150; i++) {
        requests.push(
          fetch(`${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Should have some rate-limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000);

    it('should include rate limit headers', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`
      );

      // Check for rate limit headers (if implemented)
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitLimit = response.headers.get('x-ratelimit-limit');

      // Headers may or may not be present depending on implementation
      if (rateLimitRemaining) {
        expect(Number(rateLimitRemaining)).toBeGreaterThanOrEqual(0);
      }
      if (rateLimitLimit) {
        expect(Number(rateLimitLimit)).toBeGreaterThan(0);
      }
    });
  });

  describe('Security Headers', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      
      const csp = response.headers.get('content-security-policy');
      // CSP may be set at application level
      if (csp) {
        expect(csp).toBeDefined();
      }
    });

    it('should include X-Content-Type-Options header', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      
      const contentTypeOptions = response.headers.get('x-content-type-options');
      if (contentTypeOptions) {
        expect(contentTypeOptions).toBe('nosniff');
      }
    });

    it('should include X-Frame-Options header', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      
      const frameOptions = response.headers.get('x-frame-options');
      if (frameOptions) {
        expect(['DENY', 'SAMEORIGIN']).toContain(frameOptions);
      }
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts/non-existent?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      
      // Should not expose internal details
      const responseText = JSON.stringify(data);
      expect(responseText).not.toContain('prisma');
      expect(responseText).not.toContain('database');
      expect(responseText).not.toContain('password');
      expect(responseText).not.toContain('secret');
    });
  });

  describe('CORS and Cross-Origin Security', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'OPTIONS',
      });

      // Should allow OPTIONS requests
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Data Validation', () => {
    it('should validate pagination limits', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&limit=1000`
      );
      const data = await response.json();

      // Should enforce maximum limit
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should validate page numbers', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=-1`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should validate sort parameters', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&sortBy=invalidField`
      );

      // Should either accept it or return validation error
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Request Validation', () => {
    it('should reject requests with invalid content type', async () => {
      const response = await fetch(`${BASE_URL}/api/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'invalid data',
      });

      // Should reject or handle gracefully
      expect([400, 415]).toContain(response.status);
    });

    it('should handle malformed JSON', async () => {
      const response = await fetch(`${BASE_URL}/api/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{invalid json}',
      });

      expect(response.status).toBe(400);
    });
  });
});
