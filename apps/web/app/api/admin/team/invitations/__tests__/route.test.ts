import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockInvitationFindMany,
  mockUserFindFirst,
  mockInvitationFindFirst,
  mockInvitationCreate,
  mockAuditLogCreate,
  mockTenantFindUnique,
  mockSendEmail,
  mockTeamInvitationTemplate,
} = vi.hoisted(() => ({
  mockInvitationFindMany: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockTenantFindUnique: vi.fn(),
  mockSendEmail: vi.fn(),
  mockTeamInvitationTemplate: vi.fn(),
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
      findUnique: mockTenantFindUnique,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/email/templates', () => ({
  emailTemplates: {
    teamInvitation: mockTeamInvitationTemplate,
  },
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindFirst.mockResolvedValue(null);
    mockInvitationFindFirst.mockResolvedValue(null);
    mockInvitationCreate.mockImplementation(async ({ data }) => ({
      id: 'invite-1',
      ...data,
      status: 'PENDING',
      acceptedAt: null,
      createdAt: new Date('2026-04-28T12:00:00.000Z'),
    }));
    mockTenantFindUnique.mockResolvedValue({ name: 'Client Org' });
    mockTeamInvitationTemplate.mockImplementation(({ inviteUrl }) => ({
      subject: 'Invite',
      html: `<p>${inviteUrl}</p>`,
    }));
    mockSendEmail.mockResolvedValue(undefined);
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

  it('creates a token-based signup invite link', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.contigo.ch');

    const response = await POST(createRequest('http://localhost:3000/api/admin/team/invitations', 'POST', 'admin', {
      email: 'new@example.com',
      role: 'viewer',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.inviteLink).toMatch(/^https:\/\/app\.contigo\.ch\/auth\/signup\?invite=[a-f0-9]{64}$/);
    expect(data.data.invitation).toMatchObject({
      id: 'invite-1',
      email: 'new@example.com',
      role: 'viewer',
      status: 'PENDING',
    });
    expect(data.data.invitation.token).toMatch(/^[a-f0-9]{64}$/);
    expect(mockInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          email: 'new@example.com',
          role: 'viewer',
          token: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(mockTeamInvitationTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantName: 'Client Org',
        inviteUrl: data.data.inviteLink,
      }),
    );
  });
});