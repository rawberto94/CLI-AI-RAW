import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractCount,
  mockContractGroupBy,
  mockContractAggregate,
} = vi.hoisted(() => ({
  mockContractCount: vi.fn(),
  mockContractGroupBy: vi.fn(),
  mockContractAggregate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      groupBy: mockContractGroupBy,
      aggregate: mockContractAggregate,
    },
  },
}));

import { GET } from '../route';

function createRequest(withAuth = true) {
  return new NextRequest('http://localhost:3000/api/contracts/summary', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractCount
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockContractGroupBy.mockResolvedValue([
      { status: 'ACTIVE', _count: { status: 2 } },
      { status: 'COMPLETED', _count: { status: 4 } },
      { status: 'DRAFT', _count: { status: 3 } },
      { status: 'PENDING', _count: { status: 1 } },
      { status: 'ARCHIVED', _count: { status: 1 } },
      { status: 'EXPIRED', _count: { status: 1 } },
    ]);
    mockContractAggregate.mockResolvedValue({
      _sum: {
        totalValue: 125000,
      },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns summary counts using enum-backed status buckets and tenant-scoped filters', async () => {
    const response = await GET(createRequest(true));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalContracts).toBe(12);
    expect(data.data.activeContracts).toBe(6);
    expect(data.data.draftContracts).toBe(4);
    expect(data.data.completedContracts).toBe(4);
    expect(data.data.archivedContracts).toBe(2);
    expect(mockContractCount).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-1', isDeleted: false },
    });
    expect(mockContractGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', isDeleted: false },
      }),
    );
  });
});