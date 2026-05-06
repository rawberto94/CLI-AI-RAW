import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
  deleteOne: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  getAuditContext: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userSession: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
      findFirst: mocks.findFirst,
      delete: mocks.deleteOne,
    },
  },
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mocks.auditLog,
  getAuditContext: mocks.getAuditContext,
  AuditAction: { SESSION_REVOKED: 'SESSION_REVOKED' },
}));

import { GET, DELETE } from '../route';

function createRequest(method: 'GET' | 'DELETE', url = 'http://localhost/api/auth/sessions', body?: object) {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-session-id': 'current-session-id',
    },
    body: body ? JSON.stringify(body) : undefined,
  } as RequestInit);
}

describe('Auth sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the current session using userSessionId from auth context', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 's1',
        token: 'current-session-id',
        sessionToken: 'ses_other',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        location: null,
        lastActive: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      },
      {
        id: 's2',
        token: 'other-session-id',
        sessionToken: 'ses_else',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.2',
        location: null,
        lastActive: new Date('2026-01-02T00:00:00Z'),
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      },
    ]);

    const response = await GET(createRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.sessions[0].isCurrent).toBe(true);
    expect(data.data.sessions[1].isCurrent).toBe(false);
  });

  it('preserves the current session on revokeAll', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 2 });

    const response = await DELETE(createRequest('DELETE', 'http://localhost/api/auth/sessions', { revokeAll: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        NOT: [{ token: 'current-session-id' }],
      },
    });
    expect(data.data.revokedCount).toBe(2);
  });

  it('rejects revoking the current session directly', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      token: 'current-session-id',
      sessionToken: 'ses_other',
    });

    const response = await DELETE(createRequest('DELETE', 'http://localhost/api/auth/sessions', { sessionId: 's1' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('Cannot revoke current session');
  });
});