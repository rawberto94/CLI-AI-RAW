import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockContractDraftCreate,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-word-drafts',
    tenantId: 'tenant-1',
    userId: 'user-1' as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockContractDraftCreate: vi.fn(),
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
    contractDraft: {
      create: mockContractDraftCreate,
      findMany: vi.fn(),
    },
  },
}));

import { POST } from '../route';

describe('/api/word-addin/drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.tenantId = 'tenant-1';
    mockCtx.userId = 'user-1';
  });

  it('creates a draft with the authenticated user as creator', async () => {
    mockContractDraftCreate.mockResolvedValue({ id: 'draft-1' });

    const response = await POST(
      new NextRequest('http://localhost:3000/api/word-addin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Draft Title',
          content: 'Draft content',
          variables: { contractTitle: 'Draft Title' },
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.draftId).toBe('draft-1');
    expect(mockContractDraftCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        templateId: null,
        title: 'Draft Title',
        content: 'Draft content',
        variables: { contractTitle: 'Draft Title' },
        status: 'DRAFT',
        createdBy: 'user-1',
      },
    });
  });

  it('returns 401 without a userId in auth context', async () => {
    mockCtx.userId = undefined;

    const response = await POST(
      new NextRequest('http://localhost:3000/api/word-addin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Draft Title' }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockContractDraftCreate).not.toHaveBeenCalled();
  });
});