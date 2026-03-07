/**
 * Unit Tests for Integrations API
 * Tests /api/integrations endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET, POST, DELETE } from '@/app/api/integrations/route';
import { prisma } from '@/lib/prisma';

// Get mocked prisma
const mockPrisma = vi.mocked(prisma);

describe('Integrations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/integrations', () => {
    it('should return all integrations for a tenant', async () => {
      const mockIntegrations = [
        {
          id: 'int-1',
          tenantId: 'tenant_demo_001',
          type: 'SAP',
          name: 'SAP Ariba Connection',
          status: 'CONNECTED',
          config: { baseUrl: 'https://ariba.example.com' },
          lastSyncAt: new Date('2024-01-15T10:30:00Z'),
          recordsProcessed: 150,
          syncLogs: [],
        },
      ];

      mockPrisma.integration.findMany.mockResolvedValue(mockIntegrations);

      const request = new NextRequest('http://localhost/api/integrations', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.integrations).toHaveLength(1);
      expect(data.data.stats.connected).toBe(1);
    });

    it('should filter by type', async () => {
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/integrations?type=SAP', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      await GET(request);

      expect(mockPrisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SAP',
          }),
        })
      );
    });

    it('should get single integration by ID', async () => {
      const mockIntegration = {
        id: 'int-1',
        tenantId: 'tenant_demo_001',
        type: 'SAP',
        name: 'SAP Integration',
        status: 'CONNECTED',
        syncLogs: [],
      };

      mockPrisma.integration.findFirst.mockResolvedValue(mockIntegration);

      const request = new NextRequest('http://localhost/api/integrations?id=int-1', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe('int-1');
    });

    it('should handle database errors', async () => {
      mockPrisma.integration.findMany.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/integrations', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/integrations', () => {
    it('should create a new integration', async () => {
      const createdIntegration = {
        id: 'int-new',
        tenantId: 'tenant_demo_001',
        name: 'Salesforce Integration',
        type: 'OTHER',
        status: 'DISCONNECTED',
      };

      mockPrisma.integration.create.mockResolvedValue(createdIntegration);

      const request = new NextRequest('http://localhost/api/integrations', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'tenant_demo_001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          name: 'Salesforce Integration',
          type: 'OTHER',
          provider: 'Salesforce',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe('int-new');
    });

    it('should connect an integration', async () => {
      const updatedIntegration = {
        id: 'int-1',
        status: 'CONNECTED',
      };

      mockPrisma.integration.update.mockResolvedValue(updatedIntegration);

      const request = new NextRequest('http://localhost/api/integrations', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'tenant_demo_001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'connect',
          integrationId: 'int-1',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('connected');
    });

    it('should return error for invalid action', async () => {
      const request = new NextRequest('http://localhost/api/integrations', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'tenant_demo_001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invalid_action',
        }),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/integrations', () => {
    it('should delete an integration', async () => {
      mockPrisma.integration.delete.mockResolvedValue({
        id: 'int-1',
        tenantId: 'tenant_demo_001',
      });

      const request = new NextRequest('http://localhost/api/integrations?id=int-1', {
        method: 'DELETE',
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await DELETE(request);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should require integration ID for deletion', async () => {
      const request = new NextRequest('http://localhost/api/integrations', {
        method: 'DELETE',
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });
  });
});
