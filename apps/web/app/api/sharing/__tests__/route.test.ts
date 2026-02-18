import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    documentShare: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notification: { create: vi.fn() },
  },
  mockContractService: {},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ contractService: mocks.mockContractService }));

import { GET, POST, PATCH, DELETE } from '../route';

function req(method = 'GET', url = 'http://localhost:3000/api/sharing', body?: Record<string, unknown>, hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', ...hdrs };
  const opts: any = { method, headers: h };
  if (body) { opts.body = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  return new NextRequest(url, opts);
}

describe('GET /api/sharing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const r = new NextRequest('http://localhost:3000/api/sharing?documentId=d1', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
    const res = await GET(r);
    expect(res.status).toBe(401);
  });

  it('should return 400 without documentId', async () => {
    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(400);
    expect(d.error.message).toContain('Document ID');
  });

  it('should return shares from database', async () => {
    const shares = [{ id: 's1', documentId: 'd1', sharedWith: 'u2', permission: 'VIEW', isActive: true, createdAt: new Date() }];
    mocks.mockPrisma.documentShare.findMany.mockResolvedValue(shares);
    const res = await GET(req('GET', 'http://localhost:3000/api/sharing?documentId=d1'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.data.shares.length).toBe(1);
  });

  it('should return empty shares on db error', async () => {
    mocks.mockPrisma.documentShare.findMany.mockRejectedValue(new Error('db err'));
    const res = await GET(req('GET', 'http://localhost:3000/api/sharing?documentId=d1'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.shares).toEqual([]);
  });
});

describe('POST /api/sharing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without documentId/recipients', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/sharing', { documentId: '' }));
    const d = await res.json();
    expect(res.status).toBe(400);
  });

  it('should create shares for recipients', async () => {
    mocks.mockPrisma.documentShare.create.mockResolvedValue({
      id: 'sh1', documentId: 'd1', documentType: 'contract', sharedWith: 'u2', sharedBy: 'user-1',
      permission: 'VIEW', expiresAt: null, isActive: true, createdAt: new Date(),
    });
    mocks.mockPrisma.notification.create.mockResolvedValue({});
    const res = await POST(req('POST', 'http://localhost:3000/api/sharing', {
      documentId: 'd1', recipients: ['u2'], permission: 'VIEW',
    }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.data.shares.length).toBe(1);
  });
});

describe('PATCH /api/sharing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without shareId', async () => {
    const res = await PATCH(req('PATCH', 'http://localhost:3000/api/sharing', {}));
    const d = await res.json();
    expect(res.status).toBe(400);
  });

  it('should return 404 when share not found', async () => {
    mocks.mockPrisma.documentShare.findFirst.mockResolvedValue(null);
    const res = await PATCH(req('PATCH', 'http://localhost:3000/api/sharing', { shareId: 'x' }));
    const d = await res.json();
    expect(res.status).toBe(404);
  });

  it('should update share permission', async () => {
    mocks.mockPrisma.documentShare.findFirst.mockResolvedValue({ id: 's1' });
    mocks.mockPrisma.documentShare.update.mockResolvedValue({ id: 's1', permission: 'EDIT' });
    const res = await PATCH(req('PATCH', 'http://localhost:3000/api/sharing', { shareId: 's1', permission: 'EDIT' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
  });
});

describe('DELETE /api/sharing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without share id', async () => {
    const res = await DELETE(req('DELETE'));
    expect(res.status).toBe(400);
  });

  it('should return 404 when share not found', async () => {
    mocks.mockPrisma.documentShare.findFirst.mockResolvedValue(null);
    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/sharing?id=x'));
    expect(res.status).toBe(404);
  });

  it('should revoke share successfully', async () => {
    mocks.mockPrisma.documentShare.findFirst.mockResolvedValue({ id: 's1' });
    mocks.mockPrisma.documentShare.update.mockResolvedValue({ id: 's1', isActive: false });
    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/sharing?id=s1'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
  });
});
