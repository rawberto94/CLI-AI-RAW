import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockInvitationFindFirst } = vi.hoisted(() => ({
  mockInvitationFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamInvitation: {
      findFirst: mockInvitationFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

import { GET } from '../route';

function createRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost/api/auth/verify-invite?token=${encodeURIComponent(token)}`
    : 'http://localhost/api/auth/verify-invite';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/auth/verify-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when token is missing', async () => {
    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns valid=false for an invalid token', async () => {
    mockInvitationFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('bad-token'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.valid).toBe(false);
  });

  it('returns invite context without leaking tenantId', async () => {
    mockInvitationFindFirst.mockResolvedValue({
      email: 'invitee@example.com',
      tenantId: 'tenant-secret-id',
      role: 'member',
      tenant: { id: 'tenant-secret-id', name: 'Acme Corp' },
    });

    const response = await GET(createRequest('valid-token'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      valid: true,
      email: 'invitee@example.com',
      tenantName: 'Acme Corp',
      role: 'member',
    });
    expect(data.data.tenantId).toBeUndefined();
  });
});