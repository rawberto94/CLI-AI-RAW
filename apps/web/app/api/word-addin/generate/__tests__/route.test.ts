import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockTemplateFindFirst,
  mockClauseFindMany,
  mockDraftCreate,
  mockTemplateUpdate,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-word-generate',
    tenantId: 'tenant-1',
    userId: undefined as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockTemplateFindFirst: vi.fn(),
  mockClauseFindMany: vi.fn(),
  mockDraftCreate: vi.fn(),
  mockTemplateUpdate: vi.fn(),
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
    contractTemplate: {
      findFirst: mockTemplateFindFirst,
      update: mockTemplateUpdate,
    },
    clauseLibrary: {
      findMany: mockClauseFindMany,
    },
    contractDraft: {
      create: mockDraftCreate,
    },
  },
}));

import { POST } from '../route';

describe('/api/word-addin/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.userId = undefined;
  });

  it('returns 401 before any DB access when userId is missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/word-addin/generate', {
        method: 'POST',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockTemplateFindFirst).not.toHaveBeenCalled();
    expect(mockClauseFindMany).not.toHaveBeenCalled();
    expect(mockDraftCreate).not.toHaveBeenCalled();
    expect(mockTemplateUpdate).not.toHaveBeenCalled();
  });
});