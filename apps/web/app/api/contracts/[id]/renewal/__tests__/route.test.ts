import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindFirst, mockArtifactFindFirst } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockArtifactFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    artifact: {
      findFirst: mockArtifactFindFirst,
    },
  },
}));

import { GET } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(withAuth = true) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/renewal', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/[id]/renewal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      contractTitle: 'Master Agreement',
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    mockArtifactFindFirst.mockResolvedValue(null);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId for renewal lookup', async () => {
    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockArtifactFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { contractId: 'contract-1', tenantId: 'tenant-1', type: 'RENEWAL' },
    }));
    expect(data.data.hasRenewalArtifact).toBe(false);
  });
});