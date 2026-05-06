import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractCommentFindMany,
  mockContractCommentCount,
  mockContractCommentFindFirst,
  mockContractCommentFindUnique,
  mockContractCommentCreate,
  mockContractCommentUpdate,
  mockContractCommentDelete,
  mockContractActivityCreate,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractCommentFindMany: vi.fn(),
  mockContractCommentCount: vi.fn(),
  mockContractCommentFindFirst: vi.fn(),
  mockContractCommentFindUnique: vi.fn(),
  mockContractCommentCreate: vi.fn(),
  mockContractCommentUpdate: vi.fn(),
  mockContractCommentDelete: vi.fn(),
  mockContractActivityCreate: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    contractComment: {
      findMany: mockContractCommentFindMany,
      count: mockContractCommentCount,
      findFirst: mockContractCommentFindFirst,
      findUnique: mockContractCommentFindUnique,
      create: mockContractCommentCreate,
      update: mockContractCommentUpdate,
      delete: mockContractCommentDelete,
    },
    contractActivity: {
      create: mockContractActivityCreate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    COLLABORATOR_COMMENTED: 'COLLABORATOR_COMMENTED',
    CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  },
}));

import { GET, POST, PUT, DELETE } from '../route';

function createRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options?: {
    withAuth?: boolean;
    role?: string;
    body?: Record<string, unknown>;
  },
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: options?.withAuth === false
      ? undefined
      : {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': options?.role || 'member',
          'Content-Type': 'application/json',
        },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

describe('/api/contracts/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractCommentFindMany.mockResolvedValue([]);
    mockContractCommentCount.mockResolvedValue(0);
    mockContractCommentCreate.mockResolvedValue({
      id: 'comment-1',
      contractId: 'contract-1',
      content: 'Created comment',
      userId: 'user-1',
      createdAt: new Date('2026-04-29T10:00:00.000Z'),
      updatedAt: new Date('2026-04-29T10:00:00.000Z'),
      isPinned: false,
      isResolved: false,
      parentId: null,
      reactions: [],
      mentions: [],
      replies: [],
      resolvedBy: null,
      resolvedAt: null,
    });
    mockContractActivityCreate.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', 'http://localhost:3000/api/contracts/comments?contractId=contract-1', { withAuth: false }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET', 'http://localhost:3000/api/contracts/comments?contractId=contract-1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractCommentFindMany).not.toHaveBeenCalled();
  });

  it('returns comments with transformed replies and unresolved count', async () => {
    const createdAt = new Date('2026-04-29T10:00:00.000Z');
    mockContractCommentFindMany.mockResolvedValue([
      {
        id: 'comment-1',
        contractId: 'contract-1',
        content: 'Top level',
        userId: 'user-1',
        userName: 'User One',
        createdAt,
        updatedAt: createdAt,
        isPinned: false,
        isResolved: false,
        parentId: null,
        reactions: [],
        mentions: ['user-2'],
        resolvedBy: null,
        resolvedAt: null,
        replies: [
          {
            id: 'reply-1',
            contractId: 'contract-1',
            content: 'Reply',
            userId: 'user-2',
            createdAt,
            updatedAt: createdAt,
            isPinned: false,
            isResolved: false,
            parentId: 'comment-1',
            reactions: [],
            mentions: [],
            resolvedBy: null,
            resolvedAt: null,
            replies: [],
          },
        ],
      },
    ]);
    mockContractCommentCount.mockResolvedValue(2);

    const response = await GET(createRequest('GET', 'http://localhost:3000/api/contracts/comments?contractId=contract-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.comments).toHaveLength(1);
    expect(data.data.comments[0].replies).toHaveLength(1);
    expect(data.data.comments[0].authorId).toBe('user-1');
    expect(data.data.unresolved).toBe(2);
  });

  it('returns 404 when the parent comment is not on the same contract and tenant', async () => {
    mockContractCommentFindFirst.mockResolvedValue(null);

    const response = await POST(createRequest('POST', 'http://localhost:3000/api/contracts/comments', {
      body: {
        contractId: 'contract-1',
        content: 'Reply',
        parentId: 'comment-9',
      },
    }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('creates a comment and activity entry', async () => {
    const response = await POST(createRequest('POST', 'http://localhost:3000/api/contracts/comments', {
      body: {
        contractId: 'contract-1',
        content: 'Created comment',
        mentions: ['user-2'],
      },
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.comment.id).toBe('comment-1');
    expect(mockContractCommentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        mentions: ['user-2'],
      }),
    }));
    expect(mockContractActivityCreate).toHaveBeenCalled();
  });

  it('returns 403 when a non-author edits comment content', async () => {
    mockContractCommentFindUnique.mockResolvedValue({
      id: 'comment-1',
      tenantId: 'tenant-1',
      userId: 'other-user',
      contractId: 'contract-1',
    });

    const response = await PUT(createRequest('PUT', 'http://localhost:3000/api/contracts/comments', {
      body: {
        commentId: 'comment-1',
        content: 'Edited',
      },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockContractCommentUpdate).not.toHaveBeenCalled();
  });

  it('allows resolution-only updates by non-authors', async () => {
    const resolvedAt = new Date('2026-04-28T12:00:00.000Z');
    mockContractCommentFindUnique.mockResolvedValue({
      id: 'comment-1',
      tenantId: 'tenant-1',
      userId: 'other-user',
      contractId: 'contract-1',
    });
    mockContractCommentUpdate.mockResolvedValue({
      id: 'comment-1',
      contractId: 'contract-1',
      content: 'Hello',
      userId: 'other-user',
      createdAt: resolvedAt,
      updatedAt: resolvedAt,
      isPinned: false,
      isResolved: true,
      parentId: null,
      reactions: [],
      mentions: [],
      resolvedBy: 'user-1',
      resolvedAt,
      replies: [],
    });

    const response = await PUT(createRequest('PUT', 'http://localhost:3000/api/contracts/comments', {
      body: {
        commentId: 'comment-1',
        isResolved: true,
      },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCommentUpdate).toHaveBeenCalled();
  });

  it('returns 403 when a non-author deletes a comment', async () => {
    mockContractCommentFindUnique.mockResolvedValue({
      id: 'comment-1',
      tenantId: 'tenant-1',
      userId: 'other-user',
      contractId: 'contract-1',
    });

    const response = await DELETE(createRequest('DELETE', 'http://localhost:3000/api/contracts/comments?commentId=comment-1'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockContractCommentDelete).not.toHaveBeenCalled();
  });
});