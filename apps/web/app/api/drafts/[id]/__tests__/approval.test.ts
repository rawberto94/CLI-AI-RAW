import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindFirst,
  mockDraftUpdate,
  mockUserFindUnique,
  mockGetApiTenantId,
  mockPushNotification,
} = vi.hoisted(() => ({
  mockDraftFindFirst: vi.fn(),
  mockDraftUpdate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockGetApiTenantId: vi.fn(),
  mockPushNotification: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: {
      findFirst: mockDraftFindFirst,
      update: mockDraftUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
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

vi.mock('@/lib/ai/agent-notifications', () => ({
  pushAgentNotification: mockPushNotification,
}));

import { POST as APPROVE } from '../approve/route';
import { POST as REJECT } from '../reject/route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(method: string, url: string, body?: object) {
  return new NextRequest(url, {
    method,
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  });
}

function noAuthReq(method: string, url: string) {
  return new NextRequest(url, { method });
}

const URL_APPROVE = 'http://localhost:3000/api/drafts/d1/approve';
const URL_REJECT  = 'http://localhost:3000/api/drafts/d1/reject';
const params = Promise.resolve({ id: 'd1' });

const REVIEW_DRAFT = {
  id: 'd1', title: 'Review Draft', status: 'IN_REVIEW', version: 2,
  tenantId: 'tenant-1', approvalWorkflow: [], createdBy: 'user-2',
  createdByUser: { id: 'user-2', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' },
};

// ── Approve Tests ────────────────────────────────────────────────────

describe('POST /api/drafts/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
    mockUserFindUnique.mockResolvedValue({ id: 'user-2', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    // Suppress fire-and-forget fetch in tests
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('returns 401 without auth', async () => {
    const res = await APPROVE(noAuthReq('POST', URL_APPROVE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when draft not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await APPROVE(authReq('POST', URL_APPROVE), { params });
    expect(res.status).toBe(404);
  });

  it('rejects approval for DRAFT status', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...REVIEW_DRAFT, status: 'DRAFT' });
    const res = await APPROVE(authReq('POST', URL_APPROVE), { params });
    expect(res.status).toBe(400);
  });

  it('approves an IN_REVIEW draft', async () => {
    mockDraftFindFirst.mockResolvedValue(REVIEW_DRAFT);
    mockDraftUpdate.mockResolvedValue({ ...REVIEW_DRAFT, status: 'APPROVED' });

    const res = await APPROVE(authReq('POST', URL_APPROVE, { comment: 'LGTM' }), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('approved');
    expect(mockDraftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
  });

  it('sends in-app notification on approval', async () => {
    mockDraftFindFirst.mockResolvedValue(REVIEW_DRAFT);
    mockDraftUpdate.mockResolvedValue({ ...REVIEW_DRAFT, status: 'APPROVED' });

    await APPROVE(authReq('POST', URL_APPROVE, { comment: 'Looks good' }), { params });

    expect(mockPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent_complete',
        title: 'Draft Approved',
        source: 'approval-workflow',
      }),
    );
  });

  it('approves PENDING_APPROVAL status', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...REVIEW_DRAFT, status: 'PENDING_APPROVAL' });
    mockDraftUpdate.mockResolvedValue({ ...REVIEW_DRAFT, status: 'APPROVED' });

    const res = await APPROVE(authReq('POST', URL_APPROVE), { params });
    expect(res.status).toBe(200);
  });
});

// ── Reject Tests ─────────────────────────────────────────────────────

describe('POST /api/drafts/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
    mockUserFindUnique.mockResolvedValue({ id: 'user-2', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('returns 401 without auth', async () => {
    const res = await REJECT(noAuthReq('POST', URL_REJECT), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 without reason', async () => {
    mockDraftFindFirst.mockResolvedValue(REVIEW_DRAFT);
    const res = await REJECT(authReq('POST', URL_REJECT, {}), { params });
    expect(res.status).toBe(400);
  });

  it('returns 404 when draft not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await REJECT(authReq('POST', URL_REJECT, { reason: 'Needs work' }), { params });
    expect(res.status).toBe(404);
  });

  it('rejects approval for DRAFT status', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...REVIEW_DRAFT, status: 'DRAFT' });
    const res = await REJECT(authReq('POST', URL_REJECT, { reason: 'Nope' }), { params });
    expect(res.status).toBe(400);
  });

  it('rejects an IN_REVIEW draft', async () => {
    mockDraftFindFirst.mockResolvedValue(REVIEW_DRAFT);
    mockDraftUpdate.mockResolvedValue({ ...REVIEW_DRAFT, status: 'REJECTED' });

    const res = await REJECT(authReq('POST', URL_REJECT, { reason: 'Missing clauses' }), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDraftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    );
  });

  it('sends in-app notification on rejection', async () => {
    mockDraftFindFirst.mockResolvedValue(REVIEW_DRAFT);
    mockDraftUpdate.mockResolvedValue({ ...REVIEW_DRAFT, status: 'REJECTED' });

    await REJECT(authReq('POST', URL_REJECT, { reason: 'Incomplete' }), { params });

    expect(mockPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'risk_alert',
        title: 'Draft Rejected',
        severity: 'high',
      }),
    );
  });
});
