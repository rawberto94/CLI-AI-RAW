import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractAggregate,
  mockContractCount,
  mockContractFindMany,
  mockContractGroupBy,
} = vi.hoisted(() => ({
  mockContractAggregate: vi.fn(),
  mockContractCount: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockContractGroupBy: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      aggregate: mockContractAggregate,
      count: mockContractCount,
      findMany: mockContractFindMany,
      groupBy: mockContractGroupBy,
    },
  },
}));

import { GET } from '../route';

function createRequest(withAuth = true, search = '') {
  return new NextRequest(`http://localhost:3000/api/contracts/organize${search}`, {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/organize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('groups contracts by status with tenant-scoped queries', async () => {
    mockContractGroupBy.mockResolvedValue([
      {
        status: 'ACTIVE',
        _count: { id: 1 },
        _sum: { totalValue: 50000 },
      },
    ]);
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        contractTitle: 'Master Services Agreement',
        originalName: 'msa.pdf',
        fileName: 'msa.pdf',
        status: 'ACTIVE',
        totalValue: 50000,
        expirationDate: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]);

    const response = await GET(createRequest(true, '?groupBy=status&includeContracts=true'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', isDeleted: false },
    }));
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', isDeleted: false, status: 'ACTIVE' },
    }));
    expect(data.data.data.groupBy).toBe('status');
    expect(data.data.data.groups[0].label).toBe('active');
    expect(data.data.data.groups[0].contracts[0].title).toBe('Master Services Agreement');
    expect(data.data.data.summary.totalContracts).toBe(1);
  });

  it('groups contracts by value range with tenant-scoped aggregates', async () => {
    mockContractCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockContractAggregate
      .mockResolvedValueOnce({ _sum: { totalValue: 5000 } })
      .mockResolvedValue({ _sum: { totalValue: null } });

    const response = await GET(createRequest(true, '?groupBy=valueRange'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCount).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        isDeleted: false,
        totalValue: { gte: 0, lt: 10000 },
      },
    });
    expect(data.data.data.groupBy).toBe('valueRange');
    expect(data.data.data.groups[0].key).toBe('under-10k');
    expect(data.data.data.groups[0].count).toBe(1);
    expect(data.data.data.summary.totalContracts).toBe(1);
  });
});