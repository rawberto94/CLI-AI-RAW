import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindFirst,
  mockVersionFindMany,
  mockVersionFindFirst,
  mockGetApiTenantId,
} = vi.hoisted(() => ({
  mockDraftFindFirst: vi.fn(),
  mockVersionFindMany: vi.fn(),
  mockVersionFindFirst: vi.fn(),
  mockGetApiTenantId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: { findFirst: mockDraftFindFirst },
    draftVersion: { findMany: mockVersionFindMany, findFirst: mockVersionFindFirst },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } }),
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
  getServerTenantId: mockGetApiTenantId,
}));

import { GET } from '../versions/route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/drafts/d1/versions';
const params = Promise.resolve({ id: 'd1' });

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/drafts/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when draft not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await GET(authReq(BASE), { params });
    expect(res.status).toBe(404);
  });

  it('returns version list', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1', version: 3 });
    mockVersionFindMany.mockResolvedValue([
      { id: 'v2', version: 2, label: 'Auto-save', createdAt: new Date(), user: { id: 'user-1' } },
      { id: 'v1', version: 1, label: 'Auto-save', createdAt: new Date(), user: { id: 'user-1' } },
    ]);

    const res = await GET(authReq(BASE), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.versions).toHaveLength(2);
    expect(data.data.currentVersion).toBe(3);
  });

  it('returns specific version with content', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1', version: 3 });
    mockVersionFindFirst.mockResolvedValue({
      id: 'v1', version: 1, content: '<p>Original</p>', label: 'Initial',
      user: { id: 'user-1', firstName: 'A', lastName: 'B', email: 'a@b.com' },
    });

    const res = await GET(authReq(`${BASE}?version=1`), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.version.content).toBe('<p>Original</p>');
  });

  it('returns 404 for non-existent version', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1', version: 3 });
    mockVersionFindFirst.mockResolvedValue(null);

    const res = await GET(authReq(`${BASE}?version=99`), { params });
    expect(res.status).toBe(404);
  });
});
