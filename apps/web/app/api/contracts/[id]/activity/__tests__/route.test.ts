import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractFindFirst,
  mockContractActivityFindMany,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractActivityFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

import { GET } from '../route';

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/activity', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('GET /api/contracts/[id]/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: {
        findFirst: mockContractFindFirst,
      },
      contractActivity: {
        findMany: mockContractActivityFindMany,
      },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractActivityFindMany).not.toHaveBeenCalled();
  });

  it('returns activity for a tenant-owned contract', async () => {
    const timestamp = new Date('2026-04-28T12:00:00.000Z');
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractActivityFindMany.mockResolvedValue([
      {
        id: 'activity-1',
        type: 'comment',
        userId: 'user-2',
        action: 'User added a comment',
        details: 'Please review clause 4.2',
        timestamp,
        metadata: { commentId: 'comment-1' },
      },
    ]);

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.activities).toHaveLength(1);
    expect(mockContractActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        contractId: 'contract-1',
        tenantId: 'tenant-1',
      },
    }));
  });
});