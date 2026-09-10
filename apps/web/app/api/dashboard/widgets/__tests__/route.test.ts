import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractCount, mockContractFindMany, mockMetadataFindMany } = vi.hoisted(() => ({
  mockContractCount: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockMetadataFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      findMany: mockContractFindMany,
    },
    contractMetadata: {
      findMany: mockMetadataFindMany,
    },
  },
}));

import { GET } from '../route';

function createAuthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/dashboard/widgets', {
    method: 'GET',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
    },
  });
}

describe('GET /api/dashboard/widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractCount.mockResolvedValue(0);
    mockContractFindMany.mockResolvedValue([]);
    mockMetadataFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/dashboard/widgets', { method: 'GET' }));
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('counts intelligence and governance totals with the portfolio definition', async () => {
    mockContractCount.mockImplementation(async (args: { where?: { status?: unknown } }) => {
      if (args?.where?.status === 'PENDING') return 4;
      return 15;
    });
    mockContractFindMany.mockResolvedValue([]);

    const response = await GET(createAuthenticatedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.intelligence.totalContracts).toBe(15);
    expect(data.data.governance.totalContracts).toBe(15);
    expect(data.data.governance.pendingReviews).toBe(4);

    const portfolioCounts = mockContractCount.mock.calls.filter(
      (call) => Array.isArray(call[0]?.where?.status?.in),
    );
    expect(portfolioCounts.length).toBeGreaterThanOrEqual(2);
    for (const call of portfolioCounts) {
      expect(call[0].where.tenantId).toBe('test-tenant');
      expect(call[0].where.isDeleted).toBe(false);
      expect(call[0].where.status.in).toEqual(expect.arrayContaining(['ACTIVE', 'COMPLETED']));
    }

    const renewalsWhere = mockContractFindMany.mock.calls
      .map((call) => call[0]?.where)
      .find((where) => Array.isArray(where?.status?.in));
    expect(renewalsWhere?.tenantId).toBe('test-tenant');
    expect(renewalsWhere?.isDeleted).toBe(false);
    expect(renewalsWhere?.status.in).toEqual(expect.arrayContaining(['ACTIVE', 'COMPLETED']));
  });
});
