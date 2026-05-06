import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractFindFirst,
  mockContractCommentFindFirst,
  mockContractCommentUpdate,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractCommentFindFirst: vi.fn(),
  mockContractCommentUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

import { POST } from '../route';

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/comments/comment-1/resolve', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1', commentId: 'comment-1' }),
};

describe('POST /api/contracts/[id]/comments/[commentId]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: {
        findFirst: mockContractFindFirst,
      },
      contractComment: {
        findFirst: mockContractCommentFindFirst,
        update: mockContractCommentUpdate,
      },
    });
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractCommentFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when the comment is not on the same contract and tenant', async () => {
    mockContractCommentFindFirst.mockResolvedValue(null);

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractCommentUpdate).not.toHaveBeenCalled();
  });

  it('marks a matching comment as resolved', async () => {
    const resolvedAt = new Date('2026-04-28T12:00:00.000Z');
    mockContractCommentFindFirst.mockResolvedValue({ id: 'comment-1' });
    mockContractCommentUpdate.mockResolvedValue({
      id: 'comment-1',
      isResolved: true,
      resolvedAt,
    });

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCommentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'comment-1' },
      data: expect.objectContaining({
        isResolved: true,
        resolvedBy: 'user-1',
      }),
    }));
  });
});