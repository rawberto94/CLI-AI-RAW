import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindMany,
  mockDraftFindFirst,
  mockDraftCreate,
  mockDraftUpdate,
  mockDraftDelete,
  mockDraftCount,
  mockDraftGroupBy,
  mockGetServerSession,
  mockGetApiTenantId,
} = vi.hoisted(() => ({
  mockDraftFindMany: vi.fn(),
  mockDraftFindFirst: vi.fn(),
  mockDraftCreate: vi.fn(),
  mockDraftUpdate: vi.fn(),
  mockDraftDelete: vi.fn(),
  mockDraftCount: vi.fn(),
  mockDraftGroupBy: vi.fn(),
  mockGetServerSession: vi.fn(),
  mockGetApiTenantId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: {
      findMany: mockDraftFindMany,
      findFirst: mockDraftFindFirst,
      create: mockDraftCreate,
      update: mockDraftUpdate,
      delete: mockDraftDelete,
      count: mockDraftCount,
      groupBy: mockDraftGroupBy,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
  getServerTenantId: mockGetApiTenantId,
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(method: string, url: string, opts?: { body?: object; searchParams?: Record<string, string> }) {
  const u = new URL(url);
  if (opts?.searchParams) Object.entries(opts.searchParams).forEach(([k, v]) => u.searchParams.set(k, v));
  return new NextRequest(u.toString(), {
    method,
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', 'Content-Type': 'application/json' },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

function noAuthReq(method: string, url: string) {
  return new NextRequest(url, { method });
}

const BASE = 'http://localhost:3000/api/drafts';

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } });
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq('GET', BASE), {} as never);
    expect(res.status).toBe(401);
  });

  it('returns drafts list with metrics', async () => {
    mockDraftFindMany.mockResolvedValue([
      { id: 'd1', title: 'Test Draft', status: 'DRAFT', version: 1, template: null, sourceContract: null, createdByUser: { id: 'user-1', firstName: 'A', lastName: 'B', email: 'a@b.com' } },
    ]);
    mockDraftCount.mockResolvedValue(1);
    mockDraftGroupBy.mockResolvedValue([{ status: 'DRAFT', _count: { id: 1 } }]);

    const res = await GET(authReq('GET', BASE), {} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.drafts).toHaveLength(1);
    expect(data.data.data.total).toBe(1);
    expect(data.data.data.metrics.draft).toBe(1);
  });

  it('filters by status', async () => {
    mockDraftFindMany.mockResolvedValue([]);
    mockDraftCount.mockResolvedValue(0);
    mockDraftGroupBy.mockResolvedValue([]);

    const res = await GET(authReq('GET', BASE, { searchParams: { status: 'APPROVED' } }), {} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockDraftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED' }) }),
    );
  });

  it('filters by search', async () => {
    mockDraftFindMany.mockResolvedValue([]);
    mockDraftCount.mockResolvedValue(0);
    mockDraftGroupBy.mockResolvedValue([]);

    await GET(authReq('GET', BASE, { searchParams: { search: 'NDA' } }), {} as never);

    expect(mockDraftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'NDA', mode: 'insensitive' } },
            { content: { contains: 'NDA', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns empty list when no drafts', async () => {
    mockDraftFindMany.mockResolvedValue([]);
    mockDraftCount.mockResolvedValue(0);
    mockDraftGroupBy.mockResolvedValue([]);

    const res = await GET(authReq('GET', BASE), {} as never);
    const data = await res.json();

    expect(data.data.data.drafts).toEqual([]);
    expect(data.data.data.total).toBe(0);
  });
});

describe('POST /api/drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } });
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await POST(noAuthReq('POST', BASE), {} as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 without title', async () => {
    const res = await POST(authReq('POST', BASE, { body: { content: 'abc' } }), {} as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('creates a new draft', async () => {
    const draftResult = {
      id: 'd1', title: 'New Draft', status: 'DRAFT', version: 1,
      template: null, createdByUser: { id: 'user-1', firstName: 'A', lastName: 'B', email: 'a@b.com' },
    };
    mockDraftCreate.mockResolvedValue(draftResult);

    const res = await POST(authReq('POST', BASE, {
      body: { title: 'New Draft', content: '<p>Hello</p>', type: 'contract' },
    }), {} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.draft.title).toBe('New Draft');
    expect(mockDraftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'New Draft', tenantId: 'tenant-1', status: 'DRAFT' }),
      }),
    );
  });
});
