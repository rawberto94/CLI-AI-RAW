import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRateComparisonFindFirst,
  mockRateComparisonDelete,
  mockRateComparisonUpdate,
} = vi.hoisted(() => ({
  mockRateComparisonFindFirst: vi.fn(),
  mockRateComparisonDelete: vi.fn(),
  mockRateComparisonUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateComparison: {
      findFirst: mockRateComparisonFindFirst,
      delete: mockRateComparisonDelete,
      update: mockRateComparisonUpdate,
    },
  },
}));

import { GET, DELETE } from '../route';

function createRequest(method: 'GET' | 'DELETE', role: string, userId = 'user-1'): NextRequest {
  return new NextRequest('http://localhost:3000/api/rate-cards/comparisons/cmp-1', {
    method,
    headers: {
      'x-user-id': userId,
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
    },
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'cmp-1' }),
};

describe('/api/rate-cards/comparisons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits non-admin detail reads to owned or shared comparisons', async () => {
    mockRateComparisonFindFirst.mockResolvedValue({ id: 'cmp-1' });

    const response = await GET(createRequest('GET', 'member', 'member-1'), routeContext);

    expect(response.status).toBe(200);
    expect(mockRateComparisonFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'cmp-1',
        tenantId: 'tenant-1',
        OR: [
          { createdBy: 'member-1' },
          { isShared: true },
        ],
      },
    }));
  });

  it('returns 403 when a non-owner tries to delete a comparison', async () => {
    mockRateComparisonFindFirst.mockResolvedValue({ id: 'cmp-1', createdBy: 'other-user' });

    const response = await DELETE(createRequest('DELETE', 'member', 'member-1'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockRateComparisonDelete).not.toHaveBeenCalled();
  });
});