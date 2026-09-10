import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractCount,
  mockContractAggregate,
  mockContractGroupBy,
  mockContractFindMany,
} = vi.hoisted(() => ({
  mockContractCount: vi.fn(),
  mockContractAggregate: vi.fn(),
  mockContractGroupBy: vi.fn(),
  mockContractFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      aggregate: mockContractAggregate,
      groupBy: mockContractGroupBy,
      findMany: mockContractFindMany,
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

function createAuthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/dashboard/metrics', {
    method: 'GET',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
    },
  });
}

describe('GET /api/dashboard/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractCount.mockResolvedValue(0);
    mockContractAggregate.mockResolvedValue({ _sum: { totalValue: 0 } });
    mockContractGroupBy.mockResolvedValue([]);
    mockContractFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/dashboard/metrics', { method: 'GET' }));
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('counts total contracts with portfolio filters and sums totalValue', async () => {
    mockContractCount.mockResolvedValue(10);
    mockContractAggregate.mockResolvedValue({ _sum: { totalValue: 250000 } });
    mockContractGroupBy
      .mockResolvedValueOnce([{ category: 'SaaS', _count: { id: 4 } }])
      .mockResolvedValueOnce([{ status: 'ACTIVE', _count: { id: 7 } }]);

    const response = await GET(createAuthenticatedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.totalContracts).toBe(10);
    expect(data.data.totalValue).toBe(250000);

    const totalWhere = mockContractCount.mock.calls[0][0].where;
    expect(totalWhere.tenantId).toBe('test-tenant');
    expect(totalWhere.isDeleted).toBe(false);
    expect(totalWhere.status.in).toEqual(expect.arrayContaining(['ACTIVE', 'COMPLETED']));

    const valueWhere = mockContractAggregate.mock.calls[0][0].where;
    expect(valueWhere.tenantId).toBe('test-tenant');
    expect(valueWhere.isDeleted).toBe(false);
    expect(valueWhere.status.in).toEqual(expect.arrayContaining(['ACTIVE', 'COMPLETED']));

    for (const call of mockContractCount.mock.calls) {
      expect(call[0].where.tenantId).toBe('test-tenant');
      expect(call[0].where.isDeleted).toBe(false);
    }
  });

  it('clamps MoM contract trend when last month had fewer than 5 contracts', async () => {
    mockContractCount
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(8)    // active
      .mockResolvedValueOnce(1)    // processing
      .mockResolvedValueOnce(1)    // pending
      .mockResolvedValueOnce(0)    // completedToday
      .mockResolvedValueOnce(2)    // expiring
      .mockResolvedValueOnce(1)    // atRisk
      .mockResolvedValueOnce(1)    // last month
      .mockResolvedValueOnce(1001); // this month
    mockContractAggregate
      .mockResolvedValueOnce({ _sum: { totalValue: 50000 } })
      .mockResolvedValueOnce({ _sum: { totalValue: 10 } })
      .mockResolvedValueOnce({ _sum: { totalValue: 1000000 } });

    const response = await GET(createAuthenticatedRequest());
    const data = await response.json();

    expect(data.data.trends.contracts.change).toBe(100);
    expect(data.data.trends.value.change).toBe(100);
  });
});
