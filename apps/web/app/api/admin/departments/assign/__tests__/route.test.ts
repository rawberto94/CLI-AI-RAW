import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindFirst, mockHasPermission } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockHasPermission: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: {},
  getAuditContext: vi.fn(() => ({})),
}));

import { GET } from '../route';

function createRequest(role: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/departments/assign?userId=user-2', {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
    },
  });
}

describe('Admin Department Assignment API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(false);
  });

  it('returns 403 for requests without users:manage permission before loading user assignments', async () => {
    const response = await GET(createRequest('admin'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'users:manage');
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});