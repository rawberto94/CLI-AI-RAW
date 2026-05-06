import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockContractTemplateCreate,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-word-templates',
    tenantId: 'tenant-1',
    userId: undefined as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockContractTemplateCreate: vi.fn(),
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
      create: mockContractTemplateCreate,
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { POST } from '../route';

describe('/api/word-addin/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.userId = undefined;
  });

  it('returns 401 before template creation when userId is missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/word-addin/templates', {
        method: 'POST',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockContractTemplateCreate).not.toHaveBeenCalled();
  });
});