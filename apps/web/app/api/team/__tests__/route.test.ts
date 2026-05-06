import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockUserFindFirst,
  mockUserCreate,
  mockBcryptHash,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
  mockBcryptHash: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mockUserFindFirst,
      create: mockUserCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

vi.mock('bcryptjs', () => ({
  hash: mockBcryptHash,
}));

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/email/templates', () => ({
  emailTemplates: {
    teamInvitation: () => ({
      subject: 'Invite',
      html: '<p>Invite</p>',
    }),
  },
}));

import { POST } from '../route';

describe('/api/team', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindFirst.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockUserCreate.mockResolvedValue({
      id: 'user-2',
      email: 'invitee@example.com',
      firstName: null,
      lastName: null,
      avatar: null,
      role: 'member',
      status: 'PENDING',
      createdAt: new Date('2026-04-28T12:00:00.000Z'),
      lastLoginAt: null,
      roles: [],
      _count: {
        createdDrafts: 0,
      },
    });
    mockSendEmail.mockResolvedValue(undefined);
  });

  it('ignores a body tenantId and uses the authenticated tenant instead', async () => {
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
    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: {
        email: 'invitee@example.com',
        tenantId: 'tenant-auth',
      },
    });
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'invitee@example.com',
          tenantId: 'tenant-auth',
        }),
      }),
    );
  });
});