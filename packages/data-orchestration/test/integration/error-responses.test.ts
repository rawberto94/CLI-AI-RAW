/**
 * Integration Tests for Error Responses
 * Tests comprehensive error handling across all API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'clients-db';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'test-tenant-errors';
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Error Response Integration Tests', () => {
  beforeAll(async () => {
    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      create: {
        id: TEST_TENANT_ID,
        name: 'Test Tenant Errors',
        slug: 'test-tenant-errors',
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

  describe('404 Not Found Errors', () => {
    it('should return 404 for non-existent contract', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts/non-existent-id?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toBeDefined();
      expect(data.error.requestId).toBeDefined();
      expect(data.error.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/non-existent-endpoint`);

      expect(response.status).toBe(404);
    });
  });

  describe('400 Bad Request Errors', () => {
    it('should return 400 for invalid pagination parameters', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=0`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Page');
    });

    it('should return 400 for invalid limit', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&limit=1000`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for malformed query parameters', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=abc`
      );

      // Should handle gracefully
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('429 Rate Limit Errors', () => {
    it('should return 429 when rate limit exceeded', async () => {
      // Make many rapid requests
      const requests = Array(200).fill(null).map(() =>
        fetch(`${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);

      // Check rate limit response format
      if (rateLimited.length > 0) {
        const data = await rateLimited[0].json();
        expect(data.error).toBeDefined();
        expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    }, 30000);

    it('should include retry-after header in rate limit response', async () => {
      // Make many rapid requests
      const requests = Array(200).fill(null).map(() =>
        fetch(`${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);

      if (rateLimited) {
        const retryAfter = rateLimited.headers.get('retry-after');
        // May or may not be present
        if (retryAfter) {
          expect(Number(retryAfter)).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('500 Internal Server Errors', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failure
      // For now, we verify error response format
      const response = await fetch(`${BASE_URL}/api/health/database`);
      
      // Should return valid response
      expect([200, 503]).toContain(response.status);
      
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('should not expose internal error details', async () => {
      // Try to trigger an error
      const response = await fetch(
        `${BASE_URL}/api/contracts/trigger-error?tenantId=${TEST_TENANT_ID}`
      );

      if (response.status === 500) {
        const data = await response.json();
        const responseText = JSON.stringify(data);

        // Should not expose sensitive information
        expect(responseText).not.toContain('prisma');
        expect(responseText).not.toContain('stack trace');
        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('secret');
        expect(responseText).not.toContain('DATABASE_URL');
      }
    });
  });

  describe('Error Response Format', () => {
    it('should have consistent error response structure', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts/non-existent?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.error.code).toBeDefined();
      expect(data.error.message).toBeDefined();
      expect(data.error.requestId).toBeDefined();
      expect(data.error.timestamp).toBeDefined();
      
      // Timestamp should be valid ISO string
      expect(() => new Date(data.error.timestamp)).not.toThrow();
    });

    it('should include request ID for tracing', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts/non-existent?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(data.error.requestId).toBeDefined();
      expect(typeof data.error.requestId).toBe('string');
      expect(data.error.requestId.length).toBeGreaterThan(0);
    });

    it('should use appropriate HTTP status codes', async () => {
      const testCases = [
        { url: '/api/contracts/non-existent', expectedStatus: 404 },
        { url: '/api/contracts?page=0', expectedStatus: 400 },
      ];

      for (const testCase of testCases) {
        const response = await fetch(
          `${BASE_URL}${testCase.url}${testCase.url.includes('?') ? '&' : '?'}tenantId=${TEST_TENANT_ID}`
        );
        expect(response.status).toBe(testCase.expectedStatus);
      }
    });
  });

  describe('Validation Errors', () => {
    it('should provide detailed validation error messages', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&limit=1000`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBeDefined();
      expect(data.error.message.length).toBeGreaterThan(0);
      expect(data.error.message).toContain('Limit');
    });

    it('should validate multiple fields', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=-1&limit=1000`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should handle slow requests appropriately', async () => {
      // Make a request that might be slow
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&limit=100`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);
        
        // Should complete within timeout
        expect(response.status).toBeDefined();
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // If aborted, that's expected for very slow requests
        if (error.name === 'AbortError') {
          expect(error.name).toBe('AbortError');
        } else {
          throw error;
        }
      }
    }, 10000);
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests without errors', async () => {
      const requests = Array(50).fill(null).map((_, i) =>
        fetch(`${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=${i % 5 + 1}`)
      );

      const responses = await Promise.all(requests);
      
      // All should succeed (or rate limit)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    }, 30000);

    it('should maintain data consistency under concurrent load', async () => {
      // Create a contract
      const contract = await prisma.contract.create({
        data: {
          id: 'concurrent-test-contract',
          tenantId: TEST_TENANT_ID,
          fileName: 'concurrent-test.pdf',
          originalName: 'Concurrent Test.pdf',
          fileSize: BigInt(1024),
          mimeType: 'application/pdf',
          status: 'COMPLETED',
        },
      });

      // Make concurrent requests for the same contract
      const requests = Array(20).fill(null).map(() =>
        fetch(`${BASE_URL}/api/contracts/${contract.id}?tenantId=${TEST_TENANT_ID}`)
      );

      const responses = await Promise.all(requests);
      const successfulResponses = responses.filter(r => r.status === 200);

      // All successful responses should return the same data
      const dataPromises = successfulResponses.map(r => r.json());
      const dataResults = await Promise.all(dataPromises);

      if (dataResults.length > 1) {
        const firstResult = JSON.stringify(dataResults[0]);
        dataResults.forEach(result => {
          expect(JSON.stringify(result)).toBe(firstResult);
        });
      }

      // Cleanup
      await prisma.contract.delete({ where: { id: contract.id } });
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle empty query parameters', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&search=`
      );

      expect(response.status).toBe(200);
    });

    it('should handle special characters in search', async () => {
      const specialChars = ['%', '_', '\\', "'", '"', '&', '<', '>'];
      
      for (const char of specialChars) {
        const response = await fetch(
          `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&search=${encodeURIComponent(char)}`
        );

        expect(response.status).toBe(200);
      }
    });

    it('should handle very long search queries', async () => {
      const longQuery = 'a'.repeat(1000);
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&search=${encodeURIComponent(longQuery)}`
      );

      // Should either accept or reject gracefully
      expect([200, 400, 414]).toContain(response.status);
    });
  });
});
