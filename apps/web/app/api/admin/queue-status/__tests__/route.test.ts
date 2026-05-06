import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGroupBy, mockFindMany } = vi.hoisted(() => ({
  mockGroupBy: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    processingJob: {
      groupBy: mockGroupBy,
      findMany: mockFindMany,
    },
  },
}));

import { GET } from '../route';

function createRequest(role: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/queue-status', {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
    },
  });
}

describe('Admin Queue Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin queue status requests', async () => {
    const response = await GET(createRequest('member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockGroupBy).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});