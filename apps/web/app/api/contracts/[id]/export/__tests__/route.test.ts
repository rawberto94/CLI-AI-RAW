import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    contract: { findFirst: vi.fn() },
  },
  mockContractService: {},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ contractService: mocks.mockContractService }));

import { GET } from '../route';

function req(url = 'http://localhost:3000/api/contracts/c1/export', hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', ...hdrs };
  return new NextRequest(url, { method: 'GET', headers: h } as any);
}

const mockContract = {
  id: 'c1',
  contractTitle: 'Test Contract',
  fileName: 'test.pdf',
  status: 'ACTIVE',
  contractType: 'NDA',
  clientName: 'Acme',
  supplierName: 'Vendor',
  totalValue: 50000,
  currency: 'USD',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2025-01-01'),
  expirationDate: null,
  uploadedAt: new Date('2024-01-01'),
  jurisdiction: 'US',
  category: 'Legal',
  description: 'Test',
  tenantId: 'tenant-1',
  artifacts: [],
  clauses: [],
};

describe('Contract Export API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Authentication', () => {
    it('should return 401 without auth headers', async () => {
      const r = new NextRequest('http://localhost:3000/api/contracts/c1/export', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
      const res = await GET(r, { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent contract', async () => {
      mocks.mockPrisma.contract.findFirst.mockResolvedValue(null);
      const res = await GET(req(), { params: Promise.resolve({ id: 'c1' }) });
      const d = await res.json();
      expect(res.status).toBe(404);
      expect(d.error.code).toBe('NOT_FOUND');
    });

    it('should handle database errors', async () => {
      mocks.mockPrisma.contract.findFirst.mockRejectedValue(new Error('db error'));
      const res = await GET(req(), { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(500);
    });
  });

  describe('Database Queries', () => {
    it('should call findFirst with correct contract ID and tenant', async () => {
      mocks.mockPrisma.contract.findFirst.mockResolvedValue(mockContract);
      await GET(req(), { params: Promise.resolve({ id: 'c1' }) });
      expect(mocks.mockPrisma.contract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'c1', tenantId: 'tenant-1' }) })
      );
    });

    it('should include artifacts by default', async () => {
      mocks.mockPrisma.contract.findFirst.mockResolvedValue(mockContract);
      await GET(req(), { params: Promise.resolve({ id: 'c1' }) });
      expect(mocks.mockPrisma.contract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ artifacts: true, clauses: true }) })
      );
    });

    it('should exclude artifacts when requested', async () => {
      mocks.mockPrisma.contract.findFirst.mockResolvedValue(mockContract);
      await GET(req('http://localhost:3000/api/contracts/c1/export?includeArtifacts=false'), { params: Promise.resolve({ id: 'c1' }) });
      expect(mocks.mockPrisma.contract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ artifacts: false }) })
      );
    });
  });
});
