/**
 * Unit Tests for Contract Export API
 * Tests /api/contracts/[id]/export endpoint
 * 
 * Note: These tests focus on error handling since mocking
 * NextResponse for binary responses is complex in vitest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findUnique: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '@/app/api/contracts/[id]/export/route';
import { prisma } from '@/lib/prisma';

// Get mocked prisma
const mockPrisma = vi.mocked(prisma);

describe('Contract Export API', () => {
  const mockContract = {
    id: 'contract-123',
    contractTitle: 'Master Services Agreement',
    tenantId: 'tenant_demo_001',
    status: 'ACTIVE',
    contractType: 'SERVICE_AGREEMENT',
    clientName: 'Client Corp',
    supplierName: 'Acme Corporation',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    totalValue: 500000,
    currency: 'USD',
    description: 'Comprehensive IT services agreement',
    uploadedAt: new Date('2023-12-01'),
    artifacts: [
      {
        id: 'artifact-1',
        type: 'summary',
        data: 'Contract summary text',
      },
    ],
    clauses: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent contract', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/contracts/non-existent/export?format=json',
        { headers: { 'x-tenant-id': 'tenant_demo_001' } }
      );
      
      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should handle invalid format', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);

      const request = new NextRequest(
        'http://localhost/api/contracts/contract-123/export?format=invalid',
        { headers: { 'x-tenant-id': 'tenant_demo_001' } }
      );
      
      const response = await GET(request, { params: Promise.resolve({ id: 'contract-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid format');
    });

    it('should handle database errors', async () => {
      mockPrisma.contract.findUnique.mockRejectedValue(new Error('Connection failed'));

      const request = new NextRequest(
        'http://localhost/api/contracts/contract-123/export?format=json',
        { headers: { 'x-tenant-id': 'tenant_demo_001' } }
      );
      
      const response = await GET(request, { params: Promise.resolve({ id: 'contract-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('Database Queries', () => {
    it('should call findUnique with correct contract ID', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);

      const request = new NextRequest(
        'http://localhost/api/contracts/contract-123/export?format=json',
        { headers: { 'x-tenant-id': 'tenant_demo_001' } }
      );
      
      await GET(request, { params: Promise.resolve({ id: 'contract-123' }) });

      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-123' },
        })
      );
    });

    it('should include artifacts by default', async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(mockContract);

      const request = new NextRequest(
        'http://localhost/api/contracts/contract-123/export?format=json',
        { headers: { 'x-tenant-id': 'tenant_demo_001' } }
      );
      
      await GET(request, { params: Promise.resolve({ id: 'contract-123' }) });

      expect(mockPrisma.contract.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            artifacts: true,
          }),
        })
      );
    });
  });
});
