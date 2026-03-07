/**
 * Unit Tests for Auth Signup API
 * Tests /api/auth/signup endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password_123'),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    teamInvitation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    userRole: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Import after mocking
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';

// Get mocked modules
const mockPrisma = vi.mocked(prisma);
const mockHash = vi.mocked(hash);

// Helper to create mock request
function createRequest(body: object) {
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

  describe('POST /api/auth/signup', () => {
    const validSignupData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'securePassword123',
      organizationName: 'Acme Corp',
      organizationSlug: 'acme-corp',
    };

    const validInviteSignupData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      password: 'securePassword456',
      inviteToken: 'valid-invite-token',
    };

    // ==================== Validation Tests ====================

    it('should return 400 for missing firstName', async () => {
      const request = createRequest({
        ...validSignupData,
        firstName: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('First name');
    });

    it('should return 400 for missing lastName', async () => {
      const request = createRequest({
        ...validSignupData,
        lastName: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Last name');
    });

    it('should return 400 for invalid email format', async () => {
      const request = createRequest({
        ...validSignupData,
        email: 'invalid-email',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('email');
    });

    it('should return 400 for password shorter than 8 characters', async () => {
      const request = createRequest({
        ...validSignupData,
        password: 'short',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('8 characters');
    });

    it('should return 400 when organization info is missing without invite token', async () => {
      const request = createRequest({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'securePassword123',
        // No organizationName, organizationSlug, or inviteToken
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Organization name');
    });

    // ==================== Email Duplicate Tests ====================

    it('should return 409 when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'john@example.com',
      } as any);

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('email already exists');
    });

    // ==================== Organization Creation Tests ====================

    it('should successfully create user with new organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({
        id: 'new-tenant-id',
        name: 'Acme Corp',
        slug: 'acme-corp',
      } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tenantId: 'new-tenant-id',
        role: 'owner',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'owner-role-id',
        name: 'owner',
      } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('john@example.com');
    });

    it('should return 409 when organization name already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: 'existing-tenant',
        name: 'Acme Corp',
      } as any);

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('organization');
    });

    it('should return 409 when organization slug already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: 'existing-tenant',
        slug: 'acme-corp',
      } as any);

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('organization');
    });

    // ==================== Invitation Flow Tests ====================

    it('should successfully create user via valid invite token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({
        id: 'invite-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant-id',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        tenant: { id: 'existing-tenant-id', name: 'Existing Corp' },
      } as any);
      mockPrisma.teamInvitation.update.mockResolvedValue({} as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        tenantId: 'existing-tenant-id',
        role: 'member',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'member-role-id',
        name: 'member',
      } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validInviteSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('jane@example.com');
    });

    it('should return 400 for invalid invite token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);

      const request = createRequest(validInviteSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid or expired invitation');
    });

    it('should return 400 for expired invite token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // The query includes expiresAt filter, so findFirst returns null for expired
      mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);

      const request = createRequest(validInviteSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid or expired');
    });

    it('should update invitation status to ACCEPTED after signup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({
        id: 'invite-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant-id',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        tenant: { id: 'existing-tenant-id', name: 'Existing Corp' },
      } as any);
      mockPrisma.teamInvitation.update.mockResolvedValue({} as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-id', name: 'member' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validInviteSignupData);
      await POST(request);

      expect(mockPrisma.teamInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: expect.objectContaining({
          status: 'ACCEPTED',
          acceptedAt: expect.any(Date),
        }),
      });
    });

    // ==================== Password Hashing Tests ====================

    it('should hash password with cost factor 12', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-id' } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-id', name: 'owner' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validSignupData);
      await POST(request);

      expect(mockHash).toHaveBeenCalledWith('securePassword123', 12);
    });

    // ==================== Role Assignment Tests ====================

    it('should assign owner role when creating new organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-id' } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'owner-role-id', name: 'owner' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validSignupData);
      await POST(request);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'owner',
        }),
      });
    });

    it('should create role if it does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-id' } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue(null); // Role doesn't exist
      mockPrisma.role.create.mockResolvedValue({ id: 'new-role-id', name: 'owner' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validSignupData);
      await POST(request);

      expect(mockPrisma.role.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'owner',
          isSystem: true,
        }),
      });
    });

    // ==================== Audit Log Tests ====================

    it('should create audit log on successful signup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-id' } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-id', name: 'owner' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validSignupData);
      await POST(request);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'USER_REGISTERED',
          entityType: 'USER',
          metadata: expect.objectContaining({
            email: 'john@example.com',
            role: 'owner',
            method: 'self-registration',
          }),
        }),
      });
    });

    it('should log invitation method in audit when using invite token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.teamInvitation.findFirst.mockResolvedValue({
        id: 'invite-1',
        token: 'valid-invite-token',
        email: 'jane@example.com',
        tenantId: 'existing-tenant-id',
        role: 'member',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        tenant: { id: 'existing-tenant-id' },
      } as any);
      mockPrisma.teamInvitation.update.mockResolvedValue({} as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-id', name: 'member' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validInviteSignupData);
      await POST(request);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            method: 'invitation',
          }),
        }),
      });
    });

    // ==================== Error Handling Tests ====================

    it('should return 500 for database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create account');
    });

    it('should handle malformed JSON body', async () => {
      const request = new NextRequest('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    // ==================== Response Structure Tests ====================

    it('should return correct success response structure', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-id' } as any);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      } as any);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-id', name: 'owner' } as any);
      mockPrisma.userRole.create.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const request = createRequest(validSignupData);
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Account created successfully');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('firstName');
      expect(data.user).toHaveProperty('lastName');
      // Should NOT include sensitive info like password
      expect(data.user).not.toHaveProperty('passwordHash');
    });
  });
});
