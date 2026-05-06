import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
  },
}));

import { GET } from '../route';

function createRequest(withAuth = true, query = '?q=service') {
  return new NextRequest(`http://localhost:3000/api/contracts/tags/suggest${query}`, {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/tags/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindMany.mockResolvedValue([
      { tags: ['service-agreement', 'service-vendor'] },
      { tags: ['service-agreement', 'supplier-risk'] },
    ]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId for tag suggestions', async () => {
    const response = await GET(createRequest(true));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
    expect(data.data.query).toBe('service');
    expect(data.data.suggestions).toContain('service-agreement');
  });

  it('returns empty suggestions for too-short queries', async () => {
    const response = await GET(createRequest(true, '?q=s'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.suggestions).toEqual([]);
    expect(mockContractFindMany).not.toHaveBeenCalled();
  });
});