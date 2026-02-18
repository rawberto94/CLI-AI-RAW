import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    user: { findMany: vi.fn() },
  },
  mockAuditTrailService: {},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ auditTrailService: mocks.mockAuditTrailService }));

import { GET } from '../route';

function req(method = 'GET', url = 'http://localhost:3000/api/users', hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', ...hdrs };
  return new NextRequest(url, { method, headers: h } as any);
}

describe('GET /api/users', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const r = new NextRequest('http://localhost:3000/api/users', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
    const res = await GET(r);
    expect(res.status).toBe(401);
  });

  it('should return users list', async () => {
    mocks.mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', role: 'ADMIN', avatar: null, createdAt: new Date() },
      { id: 'u2', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', role: 'MEMBER', avatar: null, createdAt: new Date() },
    ]);
    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.data.users.length).toBe(2);
    expect(d.data.users[0].name).toBe('John Doe');
    expect(d.data.users[0].initials).toBe('JD');
  });

  it('should handle search parameter', async () => {
    mocks.mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', role: 'ADMIN', avatar: null, createdAt: new Date() },
    ]);
    const res = await GET(req('GET', 'http://localhost:3000/api/users?search=john'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.users.length).toBe(1);
  });

  it('should handle db failure', async () => {
    mocks.mockPrisma.user.findMany.mockRejectedValue(new Error('db'));
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it('should generate initials from email when no name', async () => {
    mocks.mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u3', firstName: null, lastName: null, email: 'alice@test.com', role: 'MEMBER', avatar: null, createdAt: new Date() },
    ]);
    const res = await GET(req());
    const d = await res.json();
    expect(d.data.users[0].name).toBe('alice');
    expect(d.data.users[0].initials).toBe('A');
  });
});
