import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    contract: { findMany: vi.fn() },
    tenantSettings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  mockTaxonomyService: {},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ taxonomyService: mocks.mockTaxonomyService }));

import { GET, POST, DELETE } from '../route';

function req(method = 'GET', url = 'http://localhost:3000/api/tags', body?: Record<string, unknown>, hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', ...hdrs };
  const opts: any = { method, headers: h };
  if (body) { opts.body = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  return new NextRequest(url, opts);
}

describe('GET /api/tags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const r = new NextRequest('http://localhost:3000/api/tags', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
    const res = await GET(r);
    expect(res.status).toBe(401);
  });

  it('should return tags aggregated from contracts', async () => {
    mocks.mockPrisma.contract.findMany.mockResolvedValue([
      { id: 'c1', tags: ['Legal', 'HR'], updatedAt: new Date() },
      { id: 'c2', tags: ['legal', 'Finance'], updatedAt: new Date() },
    ]);
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue(null);

    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    const tags = d.data.data.tags;
    expect(tags.length).toBeGreaterThanOrEqual(2);
  });

  it('should include predefined tags from tenant settings', async () => {
    mocks.mockPrisma.contract.findMany.mockResolvedValue([]);
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue({
      customFields: { predefinedTags: [{ name: 'Important', color: '#FF0000' }] },
    });

    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    const tags = d.data.data.tags;
    expect(tags.some((t: any) => t.name === 'Important')).toBe(true);
  });

  it('should filter by search query', async () => {
    mocks.mockPrisma.contract.findMany.mockResolvedValue([
      { id: 'c1', tags: ['Legal', 'Finance', 'HR'], updatedAt: new Date() },
    ]);
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue(null);

    const res = await GET(req('GET', 'http://localhost:3000/api/tags?search=legal'));
    const d = await res.json();
    const tags = d.data.data.tags;
    expect(tags.every((t: any) => t.name.toLowerCase().includes('legal'))).toBe(true);
  });
});

describe('POST /api/tags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without name', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/tags', {}));
    const d = await res.json();
    expect(res.status).toBe(400);
  });

  it('should create a new tag', async () => {
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue({
      id: 'ts1', tenantId: 'tenant-1', customFields: { predefinedTags: [] },
    });
    mocks.mockPrisma.tenantSettings.update.mockResolvedValue({});

    const res = await POST(req('POST', 'http://localhost:3000/api/tags', { name: 'NewTag', color: '#00FF00' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.data.data.name).toBe('NewTag');
  });

  it('should create tenant settings if not exists', async () => {
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue(null);
    mocks.mockPrisma.tenantSettings.create.mockResolvedValue({
      id: 'ts-new', tenantId: 'tenant-1', customFields: { predefinedTags: [] },
    });
    mocks.mockPrisma.tenantSettings.update.mockResolvedValue({});

    const res = await POST(req('POST', 'http://localhost:3000/api/tags', { name: 'First' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
  });
});

describe('DELETE /api/tags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without tag name', async () => {
    const res = await DELETE(req('DELETE'));
    expect(res.status).toBe(400);
  });

  it('should return 404 when tag not found', async () => {
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue({
      id: 'ts1', customFields: { predefinedTags: [{ name: 'Other' }] },
    });
    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/tags?name=Nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should delete tag successfully', async () => {
    mocks.mockPrisma.tenantSettings.findFirst.mockResolvedValue({
      id: 'ts1', customFields: { predefinedTags: [{ name: 'ToDelete' }, { name: 'Keep' }] },
    });
    mocks.mockPrisma.tenantSettings.update.mockResolvedValue({});

    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/tags?name=ToDelete'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
  });
});
