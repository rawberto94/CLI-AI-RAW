import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRateComparisonFindMany } = vi.hoisted(() => ({
  mockRateComparisonFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateComparison: {
      findMany: mockRateComparisonFindMany,
      create: vi.fn(),
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  rateCardBenchmarkingService: {},
}));

import { GET } from '../route';

function createRequest(role?: string, userId = 'user-1'): NextRequest {
  return new NextRequest('http://localhost:3000/api/rate-cards/comparisons', {
    method: 'GET',
    headers: role
      ? {
          'x-user-id': userId,
          'x-tenant-id': 'tenant-1',
          'x-user-role': role,
        }
      : undefined,
  });
}

describe('GET /api/rate-cards/comparisons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateComparisonFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(undefined));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('limits non-admin users to owned or shared comparisons', async () => {
    const response = await GET(createRequest('member', 'member-1'));

    expect(response.status).toBe(200);
    expect(mockRateComparisonFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        OR: [
          { createdBy: 'member-1' },
          { isShared: true },
        ],
      },
    }));
  });

  it('allows tenant admins to list all tenant comparisons', async () => {
    const response = await GET(createRequest('admin', 'admin-1'));

    expect(response.status).toBe(200);
    expect(mockRateComparisonFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
  });
});