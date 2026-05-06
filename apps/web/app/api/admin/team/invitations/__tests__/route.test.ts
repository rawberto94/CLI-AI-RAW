import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockInvitationFindMany,
  mockUserFindFirst,
  mockInvitationFindFirst,
  mockInvitationCreate,
  mockAuditLogCreate,
} = vi.hoisted(() => ({
  mockInvitationFindMany: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamInvitation: {
      findMany: mockInvitationFindMany,
      findFirst: mockInvitationFindFirst,
      create: mockInvitationCreate,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

import { GET, POST } from '../route';

function createRequest(url: string, method: 'GET' | 'POST', role: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Admin Team Invitations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin invitation listing', async () => {
    const request = createRequest('http://localhost:3000/api/admin/team/invitations', 'GET', 'member');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockInvitationFindMany).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin invitation creation', async () => {
    const request = createRequest('http://localhost:3000/api/admin/team/invitations', 'POST', 'member', {
      email: 'new@example.com',
      role: 'member',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockInvitationCreate).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});