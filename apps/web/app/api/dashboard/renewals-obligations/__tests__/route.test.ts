import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindMany,
  mockContractAggregate,
  mockObligationFindMany,
  mockObligationCount,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockContractAggregate: vi.fn(),
  mockObligationFindMany: vi.fn(),
  mockObligationCount: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
      aggregate: mockContractAggregate,
    },
    obligation: {
      findMany: mockObligationFindMany,
      count: mockObligationCount,
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
}));

import { GET } from '../route';
import { PORTFOLIO_STATUSES } from '@/lib/contracts/server/portfolio';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * MS_PER_DAY);
}

function authRequest() {
  return new NextRequest('http://localhost:3000/api/dashboard/renewals-obligations', {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

describe('GET /api/dashboard/renewals-obligations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockContractFindMany.mockResolvedValue([]);
    mockContractAggregate.mockResolvedValue({ _sum: { totalValue: 0 } });
    mockObligationFindMany.mockResolvedValue([]);
    mockObligationCount.mockResolvedValue(0);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/dashboard/renewals-obligations'));
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('queries portfolio contracts with expirationOrEndDateFilter', async () => {
    await GET(authRequest());

    const where = mockContractFindMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('tenant-1');
    expect(where.isDeleted).toBe(false);
    expect(where.status).toEqual({ in: PORTFOLIO_STATUSES });
    expect(where.OR).toEqual([
      { expirationDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
      { AND: [{ expirationDate: null }, { endDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) }] },
    ]);
  });

  it('counts urgent as 0..30 days remaining and expired separately', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'expired',
        contractTitle: 'Expired MSA',
        fileName: 'expired.pdf',
        supplierName: 'Acme',
        clientName: null,
        endDate: null,
        expirationDate: daysFromNow(-4),
        totalValue: 1000,
        currency: 'CHF',
        contractType: 'MSA',
        status: 'ACTIVE',
        paymentTerms: null,
        paymentFrequency: null,
      },
      {
        id: 'today',
        contractTitle: 'Due today',
        fileName: 'today.pdf',
        supplierName: 'Acme',
        clientName: null,
        endDate: null,
        expirationDate: daysFromNow(0),
        totalValue: 2000,
        currency: 'CHF',
        contractType: 'MSA',
        status: 'ACTIVE',
        paymentTerms: null,
        paymentFrequency: null,
      },
      {
        id: 'month',
        contractTitle: 'Due in 20d',
        fileName: 'month.pdf',
        supplierName: 'Acme',
        clientName: null,
        endDate: null,
        expirationDate: daysFromNow(20),
        totalValue: 3000,
        currency: 'CHF',
        contractType: 'MSA',
        status: 'COMPLETED',
        paymentTerms: null,
        paymentFrequency: null,
      },
      {
        id: 'later',
        contractTitle: 'Due in 60d',
        fileName: 'later.pdf',
        supplierName: 'Acme',
        clientName: null,
        endDate: null,
        expirationDate: daysFromNow(60),
        totalValue: 4000,
        currency: 'CHF',
        contractType: 'MSA',
        status: 'ACTIVE',
        paymentTerms: null,
        paymentFrequency: null,
      },
    ]);

    const response = await GET(authRequest());
    const data = await response.json();
    const byId = Object.fromEntries(data.data.renewals.map((r: { id: string }) => [r.id, r]));

    expect(byId.expired.urgency).toBe('expired');
    expect(byId.today.urgency).not.toBe('expired');
    expect(data.data.metrics.renewals.expired).toBe(1);
    expect(data.data.metrics.renewals.expiring30d).toBe(2);
    expect(data.data.metrics.renewals.totalExpiring90d).toBe(3);
  });
});
