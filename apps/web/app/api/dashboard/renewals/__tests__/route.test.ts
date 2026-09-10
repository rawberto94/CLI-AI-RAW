import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockContractCount, mockGetCached, mockSetCached } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockContractCount: vi.fn(),
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
      count: mockContractCount,
    },
  },
}));

vi.mock('@/lib/cache', () => ({
  getCached: mockGetCached,
  setCached: mockSetCached,
}));

vi.mock('data-orchestration/services', () => ({
  analyticsService: {},
}));

import { GET } from '../route';
import { PORTFOLIO_STATUSES } from '@/lib/contracts/server/portfolio';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * MS_PER_DAY);
}

function authRequest(url = 'http://localhost:3000/api/dashboard/renewals') {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

describe('GET /api/dashboard/renewals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null);
    mockSetCached.mockResolvedValue(undefined);
    mockContractCount.mockResolvedValue(0);
    mockContractFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/dashboard/renewals'));
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

  it('treats 0..30 days as urgent and expired as its own bucket', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'expired',
        contractTitle: 'Old',
        originalName: 'old.pdf',
        fileName: 'old.pdf',
        supplierName: 'Acme',
        totalValue: 10,
        startDate: null,
        effectiveDate: null,
        endDate: null,
        expirationDate: daysFromNow(-3),
        contractType: 'NDA',
        category: null,
        artifacts: [],
      },
      {
        id: 'today',
        contractTitle: 'Today',
        originalName: 'today.pdf',
        fileName: 'today.pdf',
        supplierName: 'Acme',
        totalValue: 10,
        startDate: null,
        effectiveDate: null,
        endDate: null,
        expirationDate: daysFromNow(0),
        contractType: 'NDA',
        category: null,
        artifacts: [],
      },
      {
        id: 'soon',
        contractTitle: 'Soon',
        originalName: 'soon.pdf',
        fileName: 'soon.pdf',
        supplierName: 'Acme',
        totalValue: 10,
        startDate: null,
        effectiveDate: null,
        endDate: null,
        expirationDate: daysFromNow(15),
        contractType: 'NDA',
        category: null,
        artifacts: [],
      },
    ]);

    const response = await GET(authRequest());
    const data = await response.json();
    const byId = Object.fromEntries(data.data.renewals.map((r: { id: string }) => [r.id, r]));

    expect(byId.expired.priority).toBe('expired');
    expect(byId.today.priority).toBe('urgent');
    expect(byId.soon.priority).toBe('urgent');
    expect(data.data.stats.expired).toBe(1);
    expect(data.data.stats.urgent).toBe(2);
  });

  it('drops contracts with no real expiration or end date', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'undated',
        contractTitle: 'No dates',
        originalName: 'none.pdf',
        fileName: 'none.pdf',
        supplierName: null,
        totalValue: null,
        startDate: null,
        effectiveDate: null,
        endDate: null,
        expirationDate: null,
        contractType: null,
        category: null,
        artifacts: [],
      },
    ]);

    const response = await GET(authRequest());
    const data = await response.json();
    expect(data.data.renewals).toEqual([]);
  });
});
