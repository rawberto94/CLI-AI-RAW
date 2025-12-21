/**
 * Unit Tests for Admin Team Members API
 * Tests /api/admin/team/members endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '../route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get mocked modules
const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

// Helper to create mock request
function createRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(`http://localhost${url}`, options);
}

describe('Admin Team Members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/team/members', () => {
    const mockSession = {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        tenantId: 'tenant-1',
        role: 'owner',
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };

    const mockMembers = [
      {
        id: 'user-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'owner',
        status: 'ACTIVE',
        lastLoginAt: new Date('2024-12-01'),
        createdAt: new Date('2024-01-15'),
      },
      {
        id: 'user-2',
        email: 'member@example.com',
        firstName: 'Team',
        lastName: 'Member',
        role: 'member',
        status: 'ACTIVE',
        lastLoginAt: new Date('2024-12-15'),
        createdAt: new Date('2024-03-01'),
      },
      {
        id: 'user-3',
        email: 'viewer@example.com',
        firstName: 'View',
        lastName: 'Only',
        role: 'viewer',
        status: 'INACTIVE',
        lastLoginAt: null,
        createdAt: new Date('2024-06-01'),
      },
    ];

    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session has no tenantId', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'admin@example.com',
          // No tenantId
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as any);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return list of team members for authenticated user', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue(mockMembers as any);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toHaveLength(3);
      expect(data.members[0].email).toBe('admin@example.com');
    });

    it('should query with correct tenant filter', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const request = createRequest('/api/admin/team/members');
      await GET(request);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: [
          { role: 'asc' },
          { createdAt: 'asc' },
        ],
      });
    });

    it('should return proper member structure', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue([mockMembers[0]] as any);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      const member = data.members[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('firstName');
      expect(member).toHaveProperty('lastName');
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('status');
      expect(member).toHaveProperty('lastLoginAt');
      expect(member).toHaveProperty('createdAt');
    });

    it('should return empty array when no members exist', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get team members');
    });

    it('should order members by role first, then createdAt', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue(mockMembers as any);

      const request = createRequest('/api/admin/team/members');
      await GET(request);

      const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
      expect(findManyCall?.orderBy).toEqual([
        { role: 'asc' },
        { createdAt: 'asc' },
      ]);
    });

    it('should only select required fields for security', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const request = createRequest('/api/admin/team/members');
      await GET(request);

      const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
      // Should NOT include sensitive fields like passwordHash
      expect(findManyCall?.select).not.toHaveProperty('passwordHash');
      expect(findManyCall?.select).not.toHaveProperty('password');
    });

    it('should isolate data by tenant', async () => {
      const differentTenantSession = {
        ...mockSession,
        user: { ...mockSession.user, tenantId: 'tenant-2' },
      };
      mockAuth.mockResolvedValue(differentTenantSession as any);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const request = createRequest('/api/admin/team/members');
      await GET(request);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-2' },
        })
      );
    });

    it('should handle null lastLoginAt correctly', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue([mockMembers[2]] as any);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members[0].lastLoginAt).toBeNull();
    });

    it('should return members with different statuses', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      mockPrisma.user.findMany.mockResolvedValue(mockMembers as any);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      const statuses = data.members.map((m: any) => m.status);
      expect(statuses).toContain('ACTIVE');
      expect(statuses).toContain('INACTIVE');
    });

    it('should handle Prisma timeout errors', async () => {
      mockAuth.mockResolvedValue(mockSession as any);
      const timeoutError = new Error('Query timeout');
      timeoutError.name = 'PrismaClientKnownRequestError';
      mockPrisma.user.findMany.mockRejectedValue(timeoutError);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get team members');
    });

    it('should handle session with undefined user', async () => {
      mockAuth.mockResolvedValue({ expires: new Date().toISOString() } as any);

      const request = createRequest('/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});
