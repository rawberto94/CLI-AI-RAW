import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindFirst,
  mockCommentFindMany,
  mockCommentFindFirst,
  mockCommentCreate,
  mockCommentUpdate,
  mockCommentDelete,
  mockCommentDeleteMany,
  mockGetApiTenantId,
} = vi.hoisted(() => ({
  mockDraftFindFirst: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockCommentFindFirst: vi.fn(),
  mockCommentCreate: vi.fn(),
  mockCommentUpdate: vi.fn(),
  mockCommentDelete: vi.fn(),
  mockCommentDeleteMany: vi.fn(),
  mockGetApiTenantId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: { findFirst: mockDraftFindFirst },
    draftComment: {
      findMany: mockCommentFindMany,
      findFirst: mockCommentFindFirst,
      create: mockCommentCreate,
      update: mockCommentUpdate,
      delete: mockCommentDelete,
      deleteMany: mockCommentDeleteMany,
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

import { GET, POST } from '../comments/route';
import { PATCH, DELETE } from '../comments/[commentId]/route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(method: string, url: string, body?: object) {
  return new NextRequest(url, {
    method,
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function noAuthReq(method: string, url: string) {
  return new NextRequest(url, { method });
}

const COMMENTS_URL = 'http://localhost:3000/api/drafts/d1/comments';
const COMMENT_URL  = 'http://localhost:3000/api/drafts/d1/comments/c1';
const draftParams   = Promise.resolve({ id: 'd1' });
const commentParams = Promise.resolve({ id: 'd1', commentId: 'c1' });

// ── GET comments ────────────────────────────────────────────────────

describe('GET /api/drafts/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq('GET', COMMENTS_URL), { params: draftParams });
    expect(res.status).toBe(401);
  });

  it('returns 404 when draft not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await GET(authReq('GET', COMMENTS_URL), { params: draftParams });
    expect(res.status).toBe(404);
  });

  it('returns comments list', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1' });
    mockCommentFindMany.mockResolvedValue([
      { id: 'c1', content: 'Nice', resolved: false, user: { id: 'user-1' }, replies: [] },
    ]);

    const res = await GET(authReq('GET', COMMENTS_URL), { params: draftParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.data.comments).toHaveLength(1);
  });
});

// ── POST comment ────────────────────────────────────────────────────

describe('POST /api/drafts/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 400 without content', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1' });
    const res = await POST(authReq('POST', COMMENTS_URL, { content: '' }), { params: draftParams });
    expect(res.status).toBe(400);
  });

  it('creates a comment', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1' });
    mockCommentCreate.mockResolvedValue({
      id: 'c1', content: 'Test comment', user: { id: 'user-1' }, replies: [],
    });

    const res = await POST(authReq('POST', COMMENTS_URL, { content: 'Test comment' }), { params: draftParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.data.comment.content).toBe('Test comment');
  });

  it('creates a reply', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1' });
    mockCommentFindFirst.mockResolvedValue({ id: 'c1', draftId: 'd1' });
    mockCommentCreate.mockResolvedValue({
      id: 'c2', content: 'Reply', parentId: 'c1', user: { id: 'user-1' }, replies: [],
    });

    const res = await POST(authReq('POST', COMMENTS_URL, { content: 'Reply', parentId: 'c1' }), { params: draftParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.data.comment.parentId).toBe('c1');
  });

  it('returns 404 when parent comment not found', async () => {
    mockDraftFindFirst.mockResolvedValue({ id: 'd1' });
    mockCommentFindFirst.mockResolvedValue(null);

    const res = await POST(authReq('POST', COMMENTS_URL, { content: 'Reply', parentId: 'bad' }), { params: draftParams });
    expect(res.status).toBe(404);
  });
});

// ── PATCH comment ───────────────────────────────────────────────────

describe('PATCH /api/drafts/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 404 when comment not found', async () => {
    mockCommentFindFirst.mockResolvedValue(null);
    const res = await PATCH(authReq('PATCH', COMMENT_URL, { resolved: true }), { params: commentParams });
    expect(res.status).toBe(404);
  });

  it('resolves a comment', async () => {
    mockCommentFindFirst.mockResolvedValue({ id: 'c1', draftId: 'd1' });
    mockCommentUpdate.mockResolvedValue({ id: 'c1', resolved: true, user: { id: 'user-1' }, replies: [] });

    const res = await PATCH(authReq('PATCH', COMMENT_URL, { resolved: true }), { params: commentParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.data.comment.resolved).toBe(true);
  });
});

// ── DELETE comment ──────────────────────────────────────────────────

describe('DELETE /api/drafts/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 404 when comment not found', async () => {
    mockCommentFindFirst.mockResolvedValue(null);
    const res = await DELETE(authReq('DELETE', COMMENT_URL), { params: commentParams });
    expect(res.status).toBe(404);
  });

  it('deletes comment and replies', async () => {
    mockCommentFindFirst.mockResolvedValue({ id: 'c1', draftId: 'd1' });
    mockCommentDeleteMany.mockResolvedValue({ count: 2 });
    mockCommentDelete.mockResolvedValue({ id: 'c1' });

    const res = await DELETE(authReq('DELETE', COMMENT_URL), { params: commentParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockCommentDeleteMany).toHaveBeenCalledWith({ where: { parentId: 'c1' } });
  });
});
