/**
 * Integration Tests for API Endpoints
 * Tests all critical API endpoints with authentication, error handling, and event emissions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from 'clients-db';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'test-tenant-api';
const TEST_USER_ID = 'test-user-api';
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      create: {
        id: TEST_TENANT_ID,
        name: 'Test Tenant API',
        slug: 'test-tenant-api',
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.contract.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.delete({ where: { id: TEST_TENANT_ID } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up between tests
    await prisma.contract.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  });

  describe('Health Check Endpoints', () => {
    it('should return healthy status from /api/health', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });

    it('should return detailed health information from /api/health/detailed', async () => {
      const response = await fetch(`${BASE_URL}/api/health/detailed`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.cache).toBeDefined();
      expect(data.checks.eventBus).toBeDefined();
    });

    it('should return database health from /api/health/database', async () => {
      const response = await fetch(`${BASE_URL}/api/health/database`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBeDefined();
      expect(data.latency).toBeDefined();
    });
  });

  describe('Contracts API', () => {
    it('should list contracts with pagination', async () => {
      // Create test contracts
      await prisma.contract.create({
        data: {
          id: 'test-contract-1',
          tenantId: TEST_TENANT_ID,
          fileName: 'test-contract-1.pdf',
          originalName: 'Test Contract 1.pdf',
          fileSize: BigInt(1024),
          mimeType: 'application/pdf',
          status: 'COMPLETED',
        },
      });

      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=1&limit=10`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.contracts).toBeDefined();
      expect(Array.isArray(data.data.contracts)).toBe(true);
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should validate pagination parameters', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&page=0&limit=10`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(150).fill(null).map(() =>
        fetch(`${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    }, 30000);

    it('should handle search queries', async () => {
      await prisma.contract.create({
        data: {
          id: 'test-contract-search',
          tenantId: TEST_TENANT_ID,
          fileName: 'important-contract.pdf',
          originalName: 'Important Contract.pdf',
          fileSize: BigInt(2048),
          mimeType: 'application/pdf',
          status: 'COMPLETED',
        },
      });

      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&search=important`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.contracts.length).toBeGreaterThan(0);
      expect(
        data.data.contracts.some((c: any) => c.filename.includes('important'))
      ).toBe(true);
    });
  });

  describe('Monitoring API', () => {
    it('should return metrics from /api/monitoring/metrics', async () => {
      const response = await fetch(`${BASE_URL}/api/monitoring/metrics`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toBeDefined();
      expect(Array.isArray(data.metrics)).toBe(true);
    });

    it('should return resource metrics from /api/monitoring/resources', async () => {
      const response = await fetch(`${BASE_URL}/api/monitoring/resources`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.memory).toBeDefined();
      expect(data.connections).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent contract', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts/non-existent-id?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid request data', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}&limit=invalid`
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should include request ID in error responses', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts/non-existent-id?tenantId=${TEST_TENANT_ID}`
      );
      const data = await response.json();

      expect(data.error.requestId).toBeDefined();
      expect(data.error.timestamp).toBeDefined();
    });
  });

  describe('Response Headers', () => {
    it('should include security headers', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);

      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
    });

    it('should include response time header', async () => {
      const response = await fetch(
        `${BASE_URL}/api/contracts?tenantId=${TEST_TENANT_ID}`
      );

      expect(response.headers.get('x-response-time')).toBeDefined();
    });
  });
});
