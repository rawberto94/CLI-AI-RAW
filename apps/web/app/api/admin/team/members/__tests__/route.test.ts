/**
 * Unit Tests for Admin Team Members API
 * Tests /api/admin/team/members endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: {},
}));

import { GET } from '../route';

function createAuthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'owner',
    },
  });
}

function createMemberRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': 'user-2',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'member',
    },
  });
}

function createUnauthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

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

describe('Admin Team Members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/team/members', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns list of team members for authenticated user', async () => {
      mockFindMany.mockResolvedValue(mockMembers);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.members).toHaveLength(3);
    });

    it('returns 403 for non-admin team members', async () => {
      const request = createMemberRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it('queries with correct tenant filter', async () => {
      mockFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith({
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

    it('returns proper member structure', async () => {
      mockFindMany.mockResolvedValue([mockMembers[0]]);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      const member = data.data.members[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('firstName');
      expect(member).toHaveProperty('lastName');
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('status');
    });

    it('returns empty array when no members exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.members).toEqual([]);
    });

    it('handles database errors gracefully', async () => {
      mockFindMany.mockRejectedValue(new Error('Database connection failed'));

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
    });

    it('orders members by role first, then createdAt', async () => {
      mockFindMany.mockResolvedValue(mockMembers);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        })
      );
    });

    it('selects only required fields', async () => {
      mockFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          }),
        })
      );
    });

    it('returns members with correct email values', async () => {
      mockFindMany.mockResolvedValue(mockMembers);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      const emails = data.data.members.map((m: any) => m.email);
      expect(emails).toContain('admin@example.com');
      expect(emails).toContain('member@example.com');
      expect(emails).toContain('viewer@example.com');
    });

    it('returns members with various roles', async () => {
      mockFindMany.mockResolvedValue(mockMembers);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      const roles = data.data.members.map((m: any) => m.role);
      expect(roles).toContain('owner');
      expect(roles).toContain('member');
      expect(roles).toContain('viewer');
    });

    it('returns data with meta information', async () => {
      mockFindMany.mockResolvedValue(mockMembers);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(data.meta).toBeDefined();
      expect(data.meta.requestId).toBeDefined();
      expect(data.meta.timestamp).toBeDefined();
    });

    it('includes single member correctly', async () => {
      mockFindMany.mockResolvedValue([mockMembers[1]]);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.members).toHaveLength(1);
      expect(data.data.members[0].email).toBe('member@example.com');
      expect(data.data.members[0].firstName).toBe('Team');
    });

    it('returns inactive members as well', async () => {
      mockFindMany.mockResolvedValue([mockMembers[2]]);

      const request = createAuthenticatedRequest('http://localhost:3000/api/admin/team/members');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.members).toHaveLength(1);
      expect(data.data.members[0].status).toBe('INACTIVE');
    });
  });
});
