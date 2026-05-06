import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractActivityCreate,
  mockContractCommentCreate,
  mockContractCommentFindMany,
  mockContractFindFirst,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractActivityCreate: vi.fn(),
  mockContractCommentCreate: vi.fn(),
  mockContractCommentFindMany: vi.fn(),
  mockContractFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

import { GET, POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(
  method: 'GET' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/notes', {
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

describe('/api/contracts/[id]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: {
        findFirst: mockContractFindFirst,
      },
      contractComment: {
        create: mockContractCommentCreate,
        findMany: mockContractCommentFindMany,
      },
      contractActivity: {
        create: mockContractActivityCreate,
      },
    });
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1', contractTitle: 'Master Services Agreement' });
    mockContractCommentFindMany.mockResolvedValue([]);
    mockContractActivityCreate.mockResolvedValue(undefined);
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

  it('sorts pinned notes ahead of newer unpinned notes', async () => {
    mockContractCommentFindMany.mockResolvedValue([
      {
        id: 'note-1',
        userId: 'user-2',
        content: 'Newer note',
        createdAt: new Date('2026-04-29T12:00:00.000Z'),
        updatedAt: new Date('2026-04-29T12:00:00.000Z'),
        reactions: [],
        mentions: [],
      },
      {
        id: 'note-2',
        userId: 'user-3',
        content: 'Pinned note',
        createdAt: new Date('2026-04-28T12:00:00.000Z'),
        updatedAt: new Date('2026-04-28T12:00:00.000Z'),
        reactions: [{ type: 'pinned' }],
        mentions: [],
      },
    ]);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.notes[0].id).toBe('note-2');
    expect(mockContractCommentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        parentId: null,
      },
    }));
  });

  it('creates a note for a tenant-owned contract', async () => {
    mockContractCommentCreate.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      content: 'Follow up with legal',
      createdAt: new Date('2026-04-29T12:00:00.000Z'),
      updatedAt: new Date('2026-04-29T12:00:00.000Z'),
      reactions: [],
      mentions: ['user-2'],
    });

    const response = await POST(createRequest('POST', true, {
      content: 'Follow up with legal',
      mentions: ['user-2'],
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockContractCommentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        content: 'Follow up with legal',
      }),
    }));
    expect(mockContractActivityCreate).toHaveBeenCalled();
  });
});