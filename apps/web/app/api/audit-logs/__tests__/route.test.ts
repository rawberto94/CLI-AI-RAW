import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockHasPermission, mockQueryRaw } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

import { GET } from '../route';

function createRequest(role: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/audit-logs', {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
    },
  });
}

describe('Audit Logs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(false);
  });

  it('returns 403 for requests without audit:view permission before querying audit logs', async () => {
    const response = await GET(createRequest('member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'audit:view');
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});