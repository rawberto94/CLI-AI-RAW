import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/users'
): NextRequest {
  return new NextRequest(new URL(url), { method });
}

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return users list successfully', async () => {
    const mockUsers = [
      {
        id: 'u1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'admin',
        avatar: null,
        createdAt: new Date(),
      },
      {
        id: 'u2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        role: 'member',
        avatar: '/avatars/jane.jpg',
        createdAt: new Date(),
      },
    ];

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.users).toHaveLength(2);
    expect(data.users[0].name).toBe('John Doe');
    expect(data.users[0].initials).toBe('JD');
    expect(data.source).toBe('database');
  });

  it('should search users by name or email', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/users?search=john');
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: 'john', mode: 'insensitive' } }),
            expect.objectContaining({ email: { contains: 'john', mode: 'insensitive' } }),
          ]),
        }),
      })
    );
  });

  it('should filter users by role', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/users?role=admin');
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'admin',
        }),
      })
    );
  });

  it('should exclude specified user', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/users?exclude=u1');
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'u1' },
        }),
      })
    );
  });

  it('should respect limit parameter', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/users?limit=10');
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });

  it('should use default limit of 20 when not specified', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const request = createRequest();
    await GET(request);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    );
  });

  it('should generate initials from first and last name', async () => {
    const mockUsers = [
      {
        id: 'u1',
        firstName: 'Alice',
        lastName: 'Wonder',
        email: 'alice@example.com',
        role: 'member',
        avatar: null,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.users[0].initials).toBe('AW');
  });

  it('should fallback to email username when no name provided', async () => {
    const mockUsers = [
      {
        id: 'u1',
        firstName: null,
        lastName: null,
        email: 'testuser@example.com',
        role: 'member',
        avatar: null,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.users[0].name).toBe('testuser');
  });

  it('should fallback to mock users on database error', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    // Should return mock users as fallback
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.users).toBeDefined();
  });
});
