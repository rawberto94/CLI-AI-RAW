import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractCount, mockContractAggregate, mockContractGroupBy } = vi.hoisted(() => ({
  mockContractCount: vi.fn(),
  mockContractAggregate: vi.fn(),
  mockContractGroupBy: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      aggregate: mockContractAggregate,
      groupBy: mockContractGroupBy,
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

function createAuthenticatedRequest(
  url: string,
  options?: { searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method: 'GET',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
  });
}

function createUnauthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/analytics/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns
    mockContractCount.mockResolvedValue(0);
    mockContractAggregate.mockResolvedValue({ _sum: { totalValue: 0 }, _avg: { totalValue: 0 } });
    mockContractGroupBy.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns dashboard metrics', async () => {
    mockContractCount
      .mockResolvedValueOnce(10)   // totalContracts
      .mockResolvedValueOnce(5)    // previousTotalContracts
      .mockResolvedValueOnce(8)    // activeContracts
      .mockResolvedValueOnce(4)    // previousActiveContracts
      .mockResolvedValueOnce(2)    // pendingApprovals
      .mockResolvedValueOnce(1);   // expiringContracts
    mockContractAggregate
      .mockResolvedValueOnce({ _sum: { totalValue: 1000000 }, _avg: { totalValue: 100000 } })
      .mockResolvedValueOnce({ _sum: { totalValue: 800000 } });
    mockContractGroupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { id: 5 } },
      { status: 'ACTIVE', _count: { id: 3 } },
    ]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.metrics).toBeDefined();
    expect(data.data.metrics.totalContracts).toBe(10);
    expect(data.data.metrics.activeContracts).toBe(8);
    expect(data.data.metrics.pendingApprovals).toBe(2);
    expect(data.data.metrics.trends).toBeDefined();
    expect(data.data.timeframe).toBe('30d');
    expect(data.data.period).toBeDefined();
  });

  it('accepts timeframe parameter', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/analytics/dashboard', {
      searchParams: { timeframe: '7d' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.timeframe).toBe('7d');
  });

  it('returns zero metrics when no contracts', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.metrics.totalContracts).toBe(0);
    expect(data.data.metrics.activeContracts).toBe(0);
  });

  it('includes meta in response', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(data.meta).toBeDefined();
    expect(data.meta.requestId).toBeDefined();
    expect(data.meta.timestamp).toBeDefined();
  });
});
