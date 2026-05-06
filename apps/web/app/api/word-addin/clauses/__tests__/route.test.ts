import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockClauseCreate,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-word-clauses',
    tenantId: 'tenant-1',
    userId: undefined as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockClauseCreate: vi.fn(),
}));

vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-middleware')>('@/lib/api-middleware');

  return {
    ...actual,
    withAuthApiHandler: (handler: (request: NextRequest, context: any) => Promise<Response>) => {
      return (request: NextRequest) => handler(request, mockCtx);
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clauseLibrary: {
      create: mockClauseCreate,
      findMany: vi.fn(),
    },
  },
}));

import { POST } from '../route';

describe('/api/word-addin/clauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.userId = undefined;
  });

  it('returns 401 before clause creation when userId is missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/word-addin/clauses', {
        method: 'POST',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockClauseCreate).not.toHaveBeenCalled();
  });
});