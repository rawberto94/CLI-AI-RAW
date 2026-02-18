import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    webhookConfig: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockWebhookService: { deliverWebhook: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ webhookService: mocks.mockWebhookService }));

import { GET, POST, DELETE, webhookStore } from '../route';

function req(method = 'GET', url = 'http://localhost:3000/api/webhooks', body?: Record<string, unknown>, hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', 'x-user-role': 'ADMIN', ...hdrs };
  const opts: any = { method, headers: h };
  if (body) { opts.body = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  return new NextRequest(url, opts);
}

describe('GET /api/webhooks', () => {
  beforeEach(() => { vi.clearAllMocks(); webhookStore.clear(); mocks.mockPrisma.webhookConfig.findMany.mockRejectedValue(new Error('no db')); });

  it('should return 401 without x-user-id', async () => {
    const r = new NextRequest('http://localhost:3000/api/webhooks', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
    const res = await GET(r);
    expect(res.status).toBe(401);
    const d = await res.json();
    expect(d.success).toBe(false);
    expect(d.error.code).toBe('UNAUTHORIZED');
  });

  it('should return empty list when no webhooks', async () => {
    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.data.data).toEqual([]);
  });

  it('should return webhooks from store with masked secrets', async () => {
    webhookStore.set('wh1', { id: 'wh1', tenantId: 'tenant-1', name: 'WH', url: 'https://e.com/wh', secret: 'secret12345678', events: ['contract.created'], isActive: true, createdAt: new Date(), updatedAt: new Date(), failureCount: 0 });
    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.data.length).toBe(1);
    expect(d.data.data[0].secret).toContain('...');
  });

  it('should filter by tenant', async () => {
    webhookStore.set('wh1', { id: 'wh1', tenantId: 'tenant-1', name: 'T1', url: 'https://e.com/1', secret: 'secret12345678', events: ['contract.created'], isActive: true, createdAt: new Date(), updatedAt: new Date(), failureCount: 0 });
    webhookStore.set('wh2', { id: 'wh2', tenantId: 'other', name: 'T2', url: 'https://e.com/2', secret: 'secret87654321', events: ['contract.updated'], isActive: true, createdAt: new Date(), updatedAt: new Date(), failureCount: 0 });
    const res = await GET(req());
    const d = await res.json();
    expect(d.data.data.length).toBe(1);
    expect(d.data.data[0].name).toBe('T1');
  });

  it('should return webhooks from DB when available', async () => {
    mocks.mockPrisma.webhookConfig.findMany.mockResolvedValue([{ id: 'db1', tenantId: 'tenant-1', name: 'DB WH', url: 'https://e.com', secret: 'dbsecret12345678', events: ['contract.created'], isActive: true, createdAt: new Date(), updatedAt: new Date(), failureCount: 0 }]);
    const res = await GET(req());
    const d = await res.json();
    expect(d.data.data.length).toBe(1);
    expect(d.data.data[0].name).toBe('DB WH');
  });
});

describe('POST /api/webhooks', () => {
  beforeEach(() => { vi.clearAllMocks(); webhookStore.clear(); mocks.mockPrisma.webhookConfig.create.mockRejectedValue(new Error('no db')); });

  it('should return 401 without auth', async () => {
    const r = new NextRequest('http://localhost:3000/api/webhooks', { method: 'POST', headers: { 'x-tenant-id': 't', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X', url: 'https://e.com', events: ['contract.created'] }) } as any);
    const res = await POST(r);
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/webhooks', { name: 'X', url: 'https://e.com/wh', events: ['contract.created'] }, { 'x-user-role': 'MEMBER' }));
    const d = await res.json();
    expect(res.status).toBe(403);
    expect(d.error.code).toBe('FORBIDDEN');
  });

  it('should return 400 when name missing', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/webhooks', { url: 'https://e.com/wh', events: ['contract.created'] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when url missing', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/webhooks', { name: 'WH', events: ['contract.created'] }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when events missing', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/webhooks', { name: 'WH', url: 'https://e.com/wh' }));
    expect(res.status).toBe(400);
  });

  it('should create webhook via store fallback', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/webhooks', { name: 'New', url: 'https://example.com/wh', events: ['contract.created'] }));
    const d = await res.json();
    expect(res.status).toBe(201);
    expect(d.success).toBe(true);
    expect(d.data.data.name).toBe('New');
  });
});

describe('DELETE /api/webhooks', () => {
  beforeEach(() => { vi.clearAllMocks(); webhookStore.clear(); mocks.mockPrisma.webhookConfig.delete.mockRejectedValue(new Error('no db')); });

  it('should return 400 when id missing', async () => {
    const res = await DELETE(req('DELETE'));
    expect(res.status).toBe(400);
  });

  it('should return 404 when not found', async () => {
    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/webhooks?id=nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should delete webhook from store', async () => {
    webhookStore.set('del1', { id: 'del1', tenantId: 'tenant-1', name: 'Del', url: 'https://e.com', secret: 's', events: ['contract.created'], isActive: true, createdAt: new Date(), updatedAt: new Date(), failureCount: 0 });
    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/webhooks?id=del1'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(webhookStore.has('del1')).toBe(false);
  });
});
