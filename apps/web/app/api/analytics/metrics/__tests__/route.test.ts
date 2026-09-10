import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractCount,
  mockContractAggregate,
  mockContractGroupBy,
  mockArtifactCount,
} = vi.hoisted(() => ({
  mockContractCount: vi.fn(),
  mockContractAggregate: vi.fn(),
  mockContractGroupBy: vi.fn(),
  mockArtifactCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      aggregate: mockContractAggregate,
      groupBy: mockContractGroupBy,
    },
    artifact: {
      count: mockArtifactCount,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  analyticsService: {},
}));

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from '../route';

function createAuthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
  });
}

describe('GET /api/analytics/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractCount.mockResolvedValue(0);
    mockContractAggregate.mockResolvedValue({ _sum: { totalValue: 0 } });
    mockContractGroupBy.mockResolvedValue([]);
    mockArtifactCount.mockResolvedValue(0);
  });

  it('returns 401 without auth headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/metrics', { method: 'GET' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('scopes every contract query to the tenant portfolio', async () => {
    mockContractCount.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
    mockContractGroupBy
      .mockResolvedValueOnce([{ currency: 'CHF', _sum: { totalValue: 50000 } }])
      .mockResolvedValueOnce([{ supplierName: 'Acme' }]);
    mockArtifactCount.mockResolvedValue(7);

    const response = await GET(createAuthenticatedRequest('http://localhost:3000/api/analytics/metrics'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.totalContracts).toBe(12);
    expect(data.data.totalValue).toBe(50000);
    expect(data.data.potentialSavings).toBe(Math.round(50000 * 0.15));
    expect(data.data.activeSuppliers).toBe(1);
    expect(data.data.upcomingRenewals).toBe(3);
    expect(data.data.artifactsProcessed).toBe(7);

    const contractWheres = [
      ...mockContractCount.mock.calls.map((call) => call[0]?.where),
      ...mockContractGroupBy.mock.calls.map((call) => call[0]?.where),
    ];

    for (const where of contractWheres) {
      expect(where.tenantId).toBe('test-tenant');
      expect(where.isDeleted).toBe(false);
      expect(where.status.in).toEqual(expect.arrayContaining(['ACTIVE', 'COMPLETED']));
      expect(where.status.in).not.toEqual(expect.arrayContaining(['FAILED', 'DRAFT', 'PROCESSING']));
    }

    expect(mockArtifactCount).toHaveBeenCalledWith({ where: { tenantId: 'test-tenant' } });
  });
});
