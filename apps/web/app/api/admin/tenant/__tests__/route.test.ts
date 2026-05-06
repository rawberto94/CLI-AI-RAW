import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindFirst,
  mockUpdate,
  mockAuditLogCreate,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: {},
}));

import { PATCH } from '../route';

function createRequest(role: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/tenant', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
    },
    body: JSON.stringify({ name: 'Renamed Tenant' }),
  });
}

describe('Admin Tenant API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin tenant rename requests before mutating tenant data', async () => {
    const response = await PATCH(createRequest('member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});