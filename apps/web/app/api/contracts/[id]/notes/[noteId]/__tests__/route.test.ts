import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractActivityCreate,
  mockContractCommentDelete,
  mockContractCommentFindFirst,
  mockContractCommentUpdate,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractActivityCreate: vi.fn(),
  mockContractCommentDelete: vi.fn(),
  mockContractCommentFindFirst: vi.fn(),
  mockContractCommentUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

import { DELETE, GET, PATCH } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1', noteId: 'note-1' }),
};

function createRequest(
  method: 'GET' | 'PATCH' | 'DELETE',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/notes/note-1', {
    method,
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': 'member',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/[id]/notes/[noteId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contractComment: {
        delete: mockContractCommentDelete,
        findFirst: mockContractCommentFindFirst,
        update: mockContractCommentUpdate,
      },
      contractActivity: {
        create: mockContractActivityCreate,
      },
    });
    mockContractActivityCreate.mockResolvedValue(undefined);
    mockContractCommentFindFirst.mockResolvedValue({
      id: 'note-1',
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      content: 'Initial note',
      createdAt: new Date('2026-04-29T12:00:00.000Z'),
      updatedAt: new Date('2026-04-29T12:00:00.000Z'),
      reactions: [],
      mentions: [],
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the note is not in the tenant contract scope', async () => {
    mockContractCommentFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('rejects note updates from non-authors who are not admins', async () => {
    mockContractCommentFindFirst.mockResolvedValue({
      id: 'note-1',
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      userId: 'user-2',
      content: 'Initial note',
      createdAt: new Date('2026-04-29T12:00:00.000Z'),
      updatedAt: new Date('2026-04-29T12:00:00.000Z'),
      reactions: [],
      mentions: [],
    });

    const response = await PATCH(createRequest('PATCH', true, { content: 'Updated note' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockContractCommentUpdate).not.toHaveBeenCalled();
  });

  it('updates a note for the author', async () => {
    mockContractCommentUpdate.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      content: 'Updated note',
      createdAt: new Date('2026-04-29T12:00:00.000Z'),
      updatedAt: new Date('2026-04-29T13:00:00.000Z'),
      reactions: [{ type: 'pinned', userId: 'user-1' }],
      mentions: [],
    });

    const response = await PATCH(createRequest('PATCH', true, {
      content: 'Updated note',
      isPinned: true,
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCommentUpdate).toHaveBeenCalled();
    expect(data.data.note.isPinned).toBe(true);
  });

  it('deletes a note for the author', async () => {
    const response = await DELETE(createRequest('DELETE'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCommentDelete).toHaveBeenCalledWith({ where: { id: 'note-1' } });
    expect(mockContractActivityCreate).toHaveBeenCalled();
  });
});