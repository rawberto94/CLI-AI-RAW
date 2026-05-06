import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockExecuteRaw, mockQueryRaw } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
    $executeRaw: mockExecuteRaw,
    $queryRaw: mockQueryRaw,
  },
}));

import { GET, POST } from '../route';

function authRequest(method: 'GET' | 'POST' = 'POST') {
  return new NextRequest('http://localhost:3000/api/contracts/sync-expirations', {
    method,
    headers: {
      'x-tenant-id': 'tenant-auth',
      'x-user-id': 'user-auth',
    },
  });
}

describe('/api/contracts/sync-expirations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindMany.mockResolvedValue([]);
    mockExecuteRaw.mockResolvedValue(undefined);
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/contracts/sync-expirations', { method: 'POST' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('syncs only tenant-scoped contracts on POST', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        tenantId: 'tenant-auth',
        contractTitle: 'Master Agreement',
        supplierName: 'Vendor',
        clientName: 'Acme',
        contractType: 'MSA',
        expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        endDate: null,
        totalValue: 150000,
        uploadedBy: null,
      },
    ]);

    const response = await POST(authRequest('POST'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-auth', isDeleted: false }),
    }));
    expect(JSON.stringify(mockExecuteRaw.mock.calls[0])).toContain('tenant-auth');
    expect(JSON.stringify(mockExecuteRaw.mock.calls[0])).toContain('user-auth');
  });

  it('returns tenant-scoped summary stats on GET', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        total: BigInt(3),
        expired: BigInt(1),
        critical: BigInt(1),
        high: BigInt(1),
        medium: BigInt(0),
        low: BigInt(1),
        upcoming_renewals: BigInt(2),
        value_at_risk: 250000,
      },
    ]);

    const response = await GET(authRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.summary).toEqual({
      total: 3,
      expired: 1,
      critical: 1,
      high: 1,
      upcomingRenewals: 2,
      valueAtRisk: 250000,
    });
    expect(JSON.stringify(mockQueryRaw.mock.calls[0])).toContain('tenant-auth');
  });
});