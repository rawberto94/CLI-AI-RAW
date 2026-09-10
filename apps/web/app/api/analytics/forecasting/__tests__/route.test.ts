import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockContractGroupBy } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockContractGroupBy: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
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
import { PORTFOLIO_STATUSES } from '@/lib/contracts/server/portfolio';

function createAuthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/analytics/forecasting', {
    method: 'GET',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
    },
  });
}

describe('GET /api/analytics/forecasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindMany.mockResolvedValue([]);
    mockContractGroupBy.mockResolvedValue([]);
  });

  it('scopes portfolio value and forecasts to ACTIVE|COMPLETED tenant contracts', async () => {
    const response = await GET(createAuthenticatedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.metadata.contractCount).toBe(0);
    expect(data.data.metadata.portfolioValue).toBe(0);

    expect(mockContractFindMany.mock.calls.length).toBeGreaterThan(0);
    for (const call of mockContractFindMany.mock.calls) {
      const where = call[0].where;
      expect(where.tenantId).toBe('test-tenant');
      expect(where.isDeleted).toBe(false);
      expect(where.status).toEqual({ in: PORTFOLIO_STATUSES });
    }
  });
});
