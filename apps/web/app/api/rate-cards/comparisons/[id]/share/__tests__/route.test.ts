import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRateComparisonFindFirst,
  mockRateComparisonUpdate,
  mockUserFindMany,
  mockNotificationCreateMany,
} = vi.hoisted(() => ({
  mockRateComparisonFindFirst: vi.fn(),
  mockRateComparisonUpdate: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockNotificationCreateMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateComparison: {
      findFirst: mockRateComparisonFindFirst,
      update: mockRateComparisonUpdate,
    },
    user: {
      findMany: mockUserFindMany,
    },
    notification: {
      createMany: mockNotificationCreateMany,
    },
  },
}));

import { POST } from '../route';

function createRequest(role: string, userId: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/rate-cards/comparisons/cmp-1/share', {
    method: 'POST',
    headers: {
      'x-user-id': userId,
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'cmp-1' }),
};

describe('POST /api/rate-cards/comparisons/[id]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when a non-owner member tries to share', async () => {
    mockRateComparisonFindFirst.mockResolvedValue({ id: 'cmp-1', createdBy: 'other-user' });

    const response = await POST(createRequest('member', 'member-1', { isShared: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockRateComparisonUpdate).not.toHaveBeenCalled();
  });

  it('allows the creator to share a comparison', async () => {
    mockRateComparisonFindFirst.mockResolvedValue({ id: 'cmp-1', createdBy: 'member-1' });
    mockRateComparisonUpdate.mockResolvedValue({ id: 'cmp-1', isShared: true });

    const response = await POST(createRequest('member', 'member-1', { isShared: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRateComparisonUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cmp-1' },
      data: { isShared: true },
    }));
  });
});