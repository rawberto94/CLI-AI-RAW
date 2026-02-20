import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindFirst,
  mockDraftUpdate,
  mockGetApiTenantId,
} = vi.hoisted(() => ({
  mockDraftFindFirst: vi.fn(),
  mockDraftUpdate: vi.fn(),
  mockGetApiTenantId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: { findFirst: mockDraftFindFirst, update: mockDraftUpdate },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } }),
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
  getServerTenantId: mockGetApiTenantId,
}));

import { POST } from '../lock/route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(url: string, body: object) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'POST' });
}

const BASE = 'http://localhost:3000/api/drafts/d1/lock';
const params = Promise.resolve({ id: 'd1' });

const UNLOCKED_DRAFT = {
  id: 'd1', tenantId: 'tenant-1', isLocked: false, lockedBy: null, lockedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/drafts/[id]/lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await POST(noAuthReq(BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid action', async () => {
    mockDraftFindFirst.mockResolvedValue(UNLOCKED_DRAFT);
    const res = await POST(authReq(BASE, { action: 'invalid' }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 404 when draft not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await POST(authReq(BASE, { action: 'lock' }), { params });
    expect(res.status).toBe(404);
  });

  it('acquires a lock', async () => {
    mockDraftFindFirst.mockResolvedValue(UNLOCKED_DRAFT);
    mockDraftUpdate.mockResolvedValue({
      id: 'd1', isLocked: true, lockedBy: 'user-1', lockedAt: new Date(),
    });

    const res = await POST(authReq(BASE, { action: 'lock' }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    // createSuccessResponse wraps in { success, data, meta }
    // lock route passes { success: true, data: { draft } }
    expect(json.data.data.draft.isLocked).toBe(true);
    expect(json.data.data.draft.lockedBy).toBe('user-1');
  });

  it('rejects lock when locked by another user', async () => {
    mockDraftFindFirst.mockResolvedValue({
      ...UNLOCKED_DRAFT,
      isLocked: true,
      lockedBy: 'user-other',
      lockedAt: new Date(), // fresh lock
    });

    const res = await POST(authReq(BASE, { action: 'lock' }), { params });
    expect(res.status).toBe(423);
  });

  it('allows lock override when lock is expired', async () => {
    mockDraftFindFirst.mockResolvedValue({
      ...UNLOCKED_DRAFT,
      isLocked: true,
      lockedBy: 'user-other',
      lockedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago (expired)
    });
    mockDraftUpdate.mockResolvedValue({
      id: 'd1', isLocked: true, lockedBy: 'user-1', lockedAt: new Date(),
    });

    const res = await POST(authReq(BASE, { action: 'lock' }), { params });
    expect(res.status).toBe(200);
  });

  it('releases a lock', async () => {
    mockDraftFindFirst.mockResolvedValue({
      ...UNLOCKED_DRAFT,
      isLocked: true,
      lockedBy: 'user-1',
      lockedAt: new Date(),
    });
    mockDraftUpdate.mockResolvedValue({
      id: 'd1', isLocked: false, lockedBy: null, lockedAt: null,
    });

    const res = await POST(authReq(BASE, { action: 'unlock' }), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.data.draft.isLocked).toBe(false);
  });

  it('rejects unlock by non-owner', async () => {
    mockDraftFindFirst.mockResolvedValue({
      ...UNLOCKED_DRAFT,
      isLocked: true,
      lockedBy: 'user-other',
      lockedAt: new Date(),
    });

    const res = await POST(authReq(BASE, { action: 'unlock' }), { params });
    expect(res.status).toBe(403);
  });
});
