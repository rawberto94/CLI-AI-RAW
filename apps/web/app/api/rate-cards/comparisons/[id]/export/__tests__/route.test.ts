import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRateComparisonFindFirst } = vi.hoisted(() => ({
  mockRateComparisonFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateComparison: {
      findFirst: mockRateComparisonFindFirst,
    },
  },
}));

import { GET } from '../route';

function createRequest(role: string, userId = 'user-1', format = 'json'): NextRequest {
  return new NextRequest(`http://localhost:3000/api/rate-cards/comparisons/cmp-1/export?format=${format}`, {
    method: 'GET',
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

describe('/api/rate-cards/comparisons/[id]/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits non-admin exports to owned or shared comparisons', async () => {
    mockRateComparisonFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('member', 'member-1'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
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

  it('allows non-admin export of a shared comparison', async () => {
    mockRateComparisonFindFirst.mockResolvedValue({
      id: 'cmp-1',
      isShared: true,
      comparisonRates: [],
      targetRate: null,
    });

    const response = await GET(createRequest('member', 'member-1'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.comparison.id).toBe('cmp-1');
  });

  it('allows admins to export private tenant comparisons', async () => {
    mockRateComparisonFindFirst.mockResolvedValue({
      id: 'cmp-1',
      isShared: false,
      comparisonRates: [],
      targetRate: null,
    });

    const response = await GET(createRequest('admin', 'admin-1'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRateComparisonFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'cmp-1',
        tenantId: 'tenant-1',
      },
    }));
  });
});