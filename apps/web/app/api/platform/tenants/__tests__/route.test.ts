import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockUserFindUnique,
  mockTenantFindUnique,
  mockTransaction,
  mockTenantCreate,
  mockUserCreate,
  mockRoleFindFirst,
  mockRoleCreate,
  mockUserRoleCreate,
  mockPasswordResetTokenCreate,
  mockAuditLogCreate,
  mockHash,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockTenantFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockTenantCreate: vi.fn(),
  mockUserCreate: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockUserRoleCreate: vi.fn(),
  mockPasswordResetTokenCreate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockHash: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    user: { findUnique: mockUserFindUnique },
    tenant: { findUnique: mockTenantFindUnique },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: {},
}));

vi.mock('bcryptjs', () => ({
  hash: mockHash,
}));

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: mockSendEmail,
}));

import { POST } from '../route';

function createPostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/platform/tenants', {
    method: 'POST',
    headers: {
      'x-user-id': 'platform-admin',
      'x-tenant-id': 'platform-tenant',
      'x-user-role': 'owner',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('Platform Tenants API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue('hashed-random-password');
    mockTenantFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'platform-admin') {
        return { role: 'owner' };
      }
      return null;
    });
    mockTenantCreate.mockResolvedValue({
      id: 'tenant-client',
      name: 'Client AG',
      slug: 'client-ag',
      status: 'ACTIVE',
      createdAt: new Date('2026-05-29T08:00:00.000Z'),
    });
    mockUserCreate.mockResolvedValue({
      id: 'client-owner',
      email: 'owner@client.ch',
      firstName: 'Client',
      lastName: 'Owner',
      role: 'owner',
      status: 'ACTIVE',
    });
    mockRoleFindFirst.mockResolvedValue({ id: 'role-owner', name: 'owner' });
    mockRoleCreate.mockResolvedValue({ id: 'role-owner', name: 'owner' });
    mockUserRoleCreate.mockResolvedValue({});
    mockPasswordResetTokenCreate.mockResolvedValue({});
    mockAuditLogCreate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (callback) => callback({
      tenant: { create: mockTenantCreate },
      user: { create: mockUserCreate },
      role: { findFirst: mockRoleFindFirst, create: mockRoleCreate },
      userRole: { create: mockUserRoleCreate },
      passwordResetToken: { create: mockPasswordResetTokenCreate },
      auditLog: { create: mockAuditLogCreate },
    }));
    mockSendEmail.mockResolvedValue(true);
  });

  it('creates a tenant owner with a password setup link', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.contigo.ch');

    const response = await POST(createPostRequest({
      name: 'Client AG',
      slug: 'client-ag',
      adminEmail: 'Owner@Client.ch',
      adminFirstName: 'Client',
      adminLastName: 'Owner',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tenant).toMatchObject({
      id: 'tenant-client',
      name: 'Client AG',
      slug: 'client-ag',
      usersCount: 1,
      contractsCount: 0,
      adminUser: {
        id: 'client-owner',
        email: 'owner@client.ch',
        status: 'ACTIVE',
      },
    });
    expect(data.data.setupLink).toMatch(/^https:\/\/app\.contigo\.ch\/auth\/reset-password\?token=[a-f0-9]{64}$/);
    expect(mockTenantCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Client AG',
        slug: 'client-ag',
        configuration: expect.any(Object),
        subscription: expect.any(Object),
        usage: expect.any(Object),
      }),
    }));
    expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'owner@client.ch',
        tenantId: 'tenant-client',
        role: 'owner',
        status: 'ACTIVE',
        passwordHash: 'hashed-random-password',
      }),
    }));
    expect(mockPasswordResetTokenCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'client-owner',
        token: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@client.ch',
      subject: 'Set up your ConTigo workspace',
    }));
  });

  it('rejects duplicate tenant slugs', async () => {
    mockTenantFindUnique.mockResolvedValue({ id: 'existing-tenant' });

    const response = await POST(createPostRequest({
      name: 'Client AG',
      slug: 'client-ag',
      adminEmail: 'owner@client.ch',
    }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.message).toBe('A tenant with this slug already exists');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
