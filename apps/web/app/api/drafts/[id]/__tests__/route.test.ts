import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindFirst,
  mockDraftUpdate,
  mockDraftDelete,
  mockVersionCreate,
  mockGetApiTenantId,
} = vi.hoisted(() => ({
  mockDraftFindFirst: vi.fn(),
  mockDraftUpdate: vi.fn(),
  mockDraftDelete: vi.fn(),
  mockVersionCreate: vi.fn(),
  mockGetApiTenantId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: {
      findFirst: mockDraftFindFirst,
      update: mockDraftUpdate,
      delete: mockDraftDelete,
    },
    draftVersion: {
      create: mockVersionCreate,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } }),
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
  getServerTenantId: mockGetApiTenantId,
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, PATCH, DELETE } from '../route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(method: string, url: string, opts?: { body?: object }) {
  return new NextRequest(url, {
    method,
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', 'Content-Type': 'application/json' },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

function noAuthReq(method: string, url: string) {
  return new NextRequest(url, { method });
}

const BASE = 'http://localhost:3000/api/drafts/d1';
const params = Promise.resolve({ id: 'd1' });

const SAMPLE_DRAFT = {
  id: 'd1', title: 'Test', status: 'DRAFT', version: 1, content: '<p>Hello</p>',
  isLocked: false, lockedBy: null, tenantId: 'tenant-1',
  template: null, sourceContract: null,
  createdByUser: { id: 'user-1', firstName: 'A', lastName: 'B', email: 'a@b.com' },
};

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/drafts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq('GET', BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await GET(authReq('GET', BASE), { params });
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns the draft', async () => {
    mockDraftFindFirst.mockResolvedValue(SAMPLE_DRAFT);
    const res = await GET(authReq('GET', BASE), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.data.draft.id).toBe('d1');
  });
});

describe('PATCH /api/drafts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await PATCH(noAuthReq('PATCH', BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await PATCH(authReq('PATCH', BASE, { body: { title: 'Updated' } }), { params });
    expect(res.status).toBe(404);
  });

  it('returns 423 when locked by another user', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...SAMPLE_DRAFT, isLocked: true, lockedBy: 'user-other' });
    const res = await PATCH(authReq('PATCH', BASE, { body: { title: 'Updated' } }), { params });
    expect(res.status).toBe(423);
  });

  it('updates title', async () => {
    mockDraftFindFirst.mockResolvedValue(SAMPLE_DRAFT);
    mockDraftUpdate.mockResolvedValue({ ...SAMPLE_DRAFT, title: 'Updated Title' });
    const res = await PATCH(authReq('PATCH', BASE, { body: { title: 'Updated Title' } }), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.data.draft.title).toBe('Updated Title');
  });

  it('creates version snapshot on content change', async () => {
    mockDraftFindFirst.mockResolvedValue(SAMPLE_DRAFT);
    mockDraftUpdate.mockResolvedValue({ ...SAMPLE_DRAFT, version: 2, content: '<p>New</p>' });
    mockVersionCreate.mockResolvedValue({ id: 'v1', version: 1 });

    await PATCH(authReq('PATCH', BASE, { body: { content: '<p>New</p>' } }), { params });

    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ draftId: 'd1', version: 1 }),
      }),
    );
  });
});

describe('DELETE /api/drafts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await DELETE(noAuthReq('DELETE', BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await DELETE(authReq('DELETE', BASE), { params });
    expect(res.status).toBe(404);
  });

  it('rejects deleting finalized drafts', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...SAMPLE_DRAFT, status: 'FINALIZED' });
    const res = await DELETE(authReq('DELETE', BASE), { params });
    expect(res.status).toBe(400);
  });

  it('deletes the draft', async () => {
    mockDraftFindFirst.mockResolvedValue(SAMPLE_DRAFT);
    mockDraftDelete.mockResolvedValue(SAMPLE_DRAFT);
    const res = await DELETE(authReq('DELETE', BASE), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
