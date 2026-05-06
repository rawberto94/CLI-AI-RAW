import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindFirst, mockContractFindMany } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      findMany: mockContractFindMany,
    },
  },
}));

import { GET } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(withAuth = true, query = '') {
  return new NextRequest(`http://localhost:3000/api/contracts/contract-1/related${query}`, {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/[id]/related', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      clientId: null,
      clientName: null,
      supplierId: null,
      supplierName: null,
      contractCategoryId: null,
      parentContractId: null,
      contractType: null,
    });
    mockContractFindMany.mockResolvedValue([
      {
        id: 'child-1',
        fileName: 'child.pdf',
        contractTitle: 'Child Agreement',
        status: 'ACTIVE',
        contractType: 'MSA',
        clientName: 'Acme',
        totalValue: 2500,
        currency: 'USD',
        expirationDate: new Date('2027-04-29T00:00:00.000Z'),
        relationshipType: 'renewal',
      },
    ]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId for related contract lookup', async () => {
    const response = await GET(createRequest(true, '?limit=10'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1', isDeleted: false },
    }));
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', parentContractId: 'contract-1' }),
    }));
    expect(data.data.contracts).toEqual([
      expect.objectContaining({
        id: 'child-1',
        filename: 'Child Agreement',
        relationshipType: 'renewal',
      }),
    ]);
  });
});