/**
 * Unit Tests for Auth Signup API
 * Tests /api/auth/signup endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockHash, mockUserFindUnique, mockUserCreate, mockTenantFindFirst,
  mockTenantCreate, mockInvitationFindFirst, mockInvitationUpdate,
  mockRoleFindFirst, mockRoleCreate, mockUserRoleCreate, mockAuditLogCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockHash: vi.fn().mockResolvedValue('hashed_password_123'),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockTenantFindFirst: vi.fn(),
  mockTenantCreate: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationUpdate: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockUserRoleCreate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  hash: mockHash,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, create: mockUserCreate },
    tenant: { findFirst: mockTenantFindFirst, create: mockTenantCreate },
    teamInvitation: { findFirst: mockInvitationFindFirst, update: mockInvitationUpdate },
    role: { findFirst: mockRoleFindFirst, create: mockRoleCreate },
    userRole: { create: mockUserRoleCreate },
    auditLog: { create: mockAuditLogCreate },
    $transaction: mockTransaction,
  },
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

import { POST } from '../route';

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Auth Signup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validSignupData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'SecurePass1!',
    organizationName: 'Acme Corp',
    organizationSlug: 'acme-corp',
  };

  const validInviteData = {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    password: 'SecurePass2!',
    inviteToken: 'valid-invite-token',
  };

  describe('Validation', () => {
    it('returns 400 for missing firstName', async () => {
      const request = createRequest({ ...validSignupData, firstName: '' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for missing lastName', async () => {
      const request = createRequest({ ...validSignupData, lastName: '' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for invalid email', async () => {
      const request = createRequest({ ...validSignupData, email: 'invalid-email' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for password shorter than 8 characters', async () => {
      const request = createRequest({ ...validSignupData, password: 'Ab1!' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for password without uppercase', async () => {
      const request = createRequest({ ...validSignupData, password: 'securepass1!' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for password without number', async () => {
      const request = createRequest({ ...validSignupData, password: 'SecurePass!' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 for password without special character', async () => {
      const request = createRequest({ ...validSignupData, password: 'SecurePass1' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 when no org info and no invite token', async () => {
      const request = createRequest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePass1!',
      });
      // Need to mock findUnique to return null (no existing user)
      mockUserFindUnique.mockResolvedValue(null);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Email duplicate check', () => {
    it('returns 409 when email already exists', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'existing', email: 'john@example.com' });

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('email already exists');
    });
  });

  describe('Organization creation', () => {
    it('returns 409 when organization name/slug already exists', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockTenantFindFirst.mockResolvedValue({ id: 'existing-tenant', name: 'Acme Corp' });

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('organization');
    });

    it('creates user with new organization via transaction', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockTenantFindFirst.mockResolvedValue(null);

      const mockUser = {
        id: 'new-user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      // The route uses prisma.$transaction, so we mock the transaction callback
      mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txMock = {
          tenant: {
            create: vi.fn().mockResolvedValue({ id: 'new-tenant-id', name: 'Acme Corp', slug: 'acme-corp' }),
          },
          user: {
            create: vi.fn().mockResolvedValue(mockUser),
          },
          role: {
            findFirst: vi.fn().mockResolvedValue({ id: 'owner-role-id', name: 'owner' }),
          },
          userRole: {
            create: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(txMock);
      });

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('john@example.com');
    });

    it('creates owner role if it does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockTenantFindFirst.mockResolvedValue(null);

      mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        const txMock = {
          tenant: {
            create: vi.fn().mockResolvedValue({ id: 'new-tenant-id', name: 'Acme Corp' }),
          },
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'new-user',
              email: 'john@example.com',
              firstName: 'John',
              lastName: 'Doe',
            }),
          },
          role: {
            findFirst: vi.fn().mockResolvedValue(null), // role doesn't exist
            create: vi.fn().mockResolvedValue({ id: 'new-role', name: 'owner' }),
          },
          userRole: {
            create: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(txMock);
      });

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Invite-based signup', () => {
    it('returns 400 for invalid or expired invite token', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockInvitationFindFirst.mockResolvedValue(null);

      const request = createRequest(validInviteData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('invitation');
    });

    it('creates user via invitation successfully', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockInvitationFindFirst.mockResolvedValue({
        id: 'inv-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        tenant: { id: 'existing-tenant', name: 'Acme Corp' },
      });
      mockInvitationUpdate.mockResolvedValue({});
      mockUserCreate.mockResolvedValue({
        id: 'new-user',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      });
      mockRoleFindFirst.mockResolvedValue({ id: 'member-role', name: 'member' });
      mockUserRoleCreate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const request = createRequest(validInviteData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('jane@example.com');
    });

    it('marks invitation as accepted', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockInvitationFindFirst.mockResolvedValue({
        id: 'inv-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        tenant: { id: 'existing-tenant' },
      });
      mockInvitationUpdate.mockResolvedValue({});
      mockUserCreate.mockResolvedValue({
        id: 'new-user',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      });
      mockRoleFindFirst.mockResolvedValue({ id: 'member-role', name: 'member' });
      mockUserRoleCreate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const request = createRequest(validInviteData);
      await POST(request);

      expect(mockInvitationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        })
      );
    });

    it('creates role if it does not exist for invite signup', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockInvitationFindFirst.mockResolvedValue({
        id: 'inv-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        tenant: { id: 'existing-tenant' },
      });
      mockInvitationUpdate.mockResolvedValue({});
      mockUserCreate.mockResolvedValue({
        id: 'new-user',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      });
      mockRoleFindFirst.mockResolvedValue(null); // role doesn't exist
      mockRoleCreate.mockResolvedValue({ id: 'new-role', name: 'member' });
      mockUserRoleCreate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const request = createRequest(validInviteData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRoleCreate).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('handles malformed JSON body', async () => {
      const request = new NextRequest('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('hashes password before storing', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockInvitationFindFirst.mockResolvedValue({
        id: 'inv-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        tenant: { id: 'existing-tenant' },
      });
      mockInvitationUpdate.mockResolvedValue({});
      mockUserCreate.mockResolvedValue({
        id: 'new-user',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      });
      mockRoleFindFirst.mockResolvedValue({ id: 'role-1', name: 'member' });
      mockUserRoleCreate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const request = createRequest(validInviteData);
      await POST(request);

      expect(mockHash).toHaveBeenCalledWith('SecurePass2!', 12);
    });
  });
});
