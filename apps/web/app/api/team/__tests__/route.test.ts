import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockUserFindFirst,
  mockInvitationFindFirst,
  mockInvitationCreate,
  mockTenantFindUnique,
  mockSendEmail,
  mockTeamInvitationTemplate,
} = vi.hoisted(() => ({
  mockUserFindFirst: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockTenantFindUnique: vi.fn(),
  mockSendEmail: vi.fn(),
  mockTeamInvitationTemplate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mockUserFindFirst,
    },
    teamInvitation: {
      findFirst: mockInvitationFindFirst,
      create: mockInvitationCreate,
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

mockTeamInvitationTemplate.mockImplementation(({ inviteUrl }) => ({
      subject: 'Invite',
      html: `<p>${inviteUrl}</p>`,
}));

import { POST } from '../route';

describe('/api/team', () => {
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
      createdAt: new Date('2026-04-28T12:00:00.000Z'),
    }));
    mockTenantFindUnique.mockResolvedValue({ name: 'Client Org' });
    mockSendEmail.mockResolvedValue(undefined);
    mockTeamInvitationTemplate.mockImplementation(({ inviteUrl }) => ({
      subject: 'Invite',
      html: `<p>${inviteUrl}</p>`,
    }));
  });

  it('ignores a body tenantId and uses the authenticated tenant instead', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.contigo.ch');

    const response = await POST(
      new NextRequest('http://localhost:3000/api/team', {
        method: 'POST',
        headers: {
          'x-user-id': 'admin-1',
          'x-tenant-id': 'tenant-auth',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invitee@example.com',
          role: 'member',
          tenantId: 'tenant-forged',
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.member).toMatchObject({
      id: 'invite-1',
      email: 'invitee@example.com',
      role: 'member',
      status: 'invited',
    });
    expect(data.data.inviteLink).toMatch(/^https:\/\/app\.contigo\.ch\/auth\/signup\?invite=[a-f0-9]{64}$/);
    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: {
        email: 'invitee@example.com',
        tenantId: 'tenant-auth',
      },
    });
    expect(mockInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'invitee@example.com',
          tenantId: 'tenant-auth',
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