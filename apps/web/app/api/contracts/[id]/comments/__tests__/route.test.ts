import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractFindFirst,
  mockContractCommentFindMany,
  mockContractCommentFindFirst,
  mockContractCommentCreate,
  mockUserFindMany,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractCommentFindMany: vi.fn(),
  mockContractCommentFindFirst: vi.fn(),
  mockContractCommentCreate: vi.fn(),
  mockUserFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

import { GET, POST } from '../route';

function createRequest(
  method: 'GET' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/comments', {
    method,
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: {
        findFirst: mockContractFindFirst,
      },
      contractComment: {
        findMany: mockContractCommentFindMany,
        findFirst: mockContractCommentFindFirst,
        create: mockContractCommentCreate,
      },
      user: {
        findMany: mockUserFindMany,
      },
    });
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractCommentFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractCommentFindMany).not.toHaveBeenCalled();
  });

  it('returns comments for a tenant-owned contract', async () => {
    const createdAt = new Date('2026-04-28T12:00:00.000Z');
    mockContractCommentFindMany.mockResolvedValue([
      {
        id: 'comment-1',
        userId: 'user-2',
        content: 'Needs review',
        createdAt,
        mentions: [],
        isResolved: false,
        likes: 0,
        replies: [],
      },
    ]);
    mockUserFindMany.mockResolvedValue([
      { id: 'user-2', email: 'reviewer@example.com', firstName: 'Review', lastName: 'User' },
    ]);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCommentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        parentId: null,
      },
    }));
    expect(data.data.comments).toHaveLength(1);
  });

  it('returns 404 when the parent comment is not on the same contract and tenant', async () => {
    mockContractCommentFindFirst.mockResolvedValue(null);

    const response = await POST(createRequest('POST', true, {
      content: 'Reply',
      parentId: 'comment-999',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractCommentCreate).not.toHaveBeenCalled();
  });

  it('creates a comment for a tenant-owned contract', async () => {
    const createdAt = new Date('2026-04-28T12:00:00.000Z');
    mockContractCommentCreate.mockResolvedValue({
      id: 'comment-1',
      content: 'Hello',
      createdAt,
      mentions: [],
      isResolved: false,
      likes: 0,
      parentId: null,
    });

    const response = await POST(createRequest('POST', true, {
      content: 'Hello',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCommentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        content: 'Hello',
      }),
    }));
  });
});