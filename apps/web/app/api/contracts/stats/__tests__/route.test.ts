import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetCached,
  mockSetCached,
  mockContractCount,
  mockContractGroupBy,
  mockContractAggregate,
  mockContractFindMany,
} = vi.hoisted(() => ({
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
  mockContractCount: vi.fn(),
  mockContractGroupBy: vi.fn(),
  mockContractAggregate: vi.fn(),
  mockContractFindMany: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  getCached: mockGetCached,
  setCached: mockSetCached,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      groupBy: mockContractGroupBy,
      aggregate: mockContractAggregate,
      findMany: mockContractFindMany,
    },
  },
}));

import { GET } from '../route';

function createRequest(withAuth = true) {
  return new NextRequest('http://localhost:3000/api/contracts/stats', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetCached.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns cached stats with an X-Cache HIT header', async () => {
    mockGetCached.mockResolvedValue({
      overview: { total: 10, byStatus: {}, processed: 2, pending: 3, failed: 1 },
      financial: {
        totalValue: 1000,
        averageValue: 100,
        currency: {},
        valueRanges: { under10k: 10, from10kTo50k: 0, from50kTo100k: 0, from100kTo500k: 0, over500k: 0 },
      },
      timeline: { expiringThisMonth: 1, expiringNext30Days: 2, expiringNext90Days: 3, expired: 0, noExpirationDate: 1, recentlyUploaded: 4 },
      categories: { byType: {}, byCategory: {} },
      parties: { topClients: [], topSuppliers: [], uniqueClients: 0, uniqueSuppliers: 0 },
      dataQuality: { withClientName: 1, withSupplierName: 1, withValue: 1, withDates: 1, withDescription: 1, averageCompleteness: 100 },
    });

    const response = await GET(createRequest(true));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.cached).toBe(true);
    expect(mockContractCount).not.toHaveBeenCalled();
  });

  it('computes and caches stats on a cache miss', async () => {
    mockGetCached.mockResolvedValue(null);
    mockContractCount
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);
    mockContractGroupBy
      .mockResolvedValueOnce([
        { status: 'COMPLETED', _count: { id: 4 } },
        { status: 'PROCESSING', _count: { id: 2 } },
      ])
      .mockResolvedValueOnce([{ contractType: 'NDA', _count: { id: 3 } }])
      .mockResolvedValueOnce([{ category: 'Legal', _count: { id: 2 } }])
      .mockResolvedValueOnce([{ clientName: 'Acme', _count: { id: 2 }, _sum: { totalValue: 500 } }])
      .mockResolvedValueOnce([{ supplierName: 'Vendor', _count: { id: 1 }, _sum: { totalValue: 250 } }]);
    mockContractFindMany
      .mockResolvedValueOnce([{ clientName: 'Acme' }, { clientName: 'Contoso' }])
      .mockResolvedValueOnce([{ supplierName: 'Vendor' }]);
    mockContractAggregate.mockResolvedValue({
      _sum: { totalValue: 1000 },
      _avg: { totalValue: 100 },
      _count: { id: 4 },
    });

    const response = await GET(createRequest(true));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.cached).toBe(false);
    expect(mockSetCached).toHaveBeenCalled();
  });
});