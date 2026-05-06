import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockCheckRateLimit,
  mockContractTemplateCreate,
  mockParseWordDocument,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-template-import',
    tenantId: 'tenant-1',
    userId: undefined as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockCheckRateLimit: vi.fn(),
  mockContractTemplateCreate: vi.fn(),
  mockParseWordDocument: vi.fn(),
  mockAuditLog: vi.fn(),
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

vi.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitResponse: vi.fn(),
  AI_RATE_LIMITS: { standard: { windowMs: 60000, max: 20 } },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractTemplate: {
      create: mockContractTemplateCreate,
    },
  },
}));

vi.mock('@/lib/templates/document-service', () => ({
  parseWordDocument: mockParseWordDocument,
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    CONTRACT_CREATED: 'CONTRACT_CREATED',
  },
}));

import { POST } from '../route';

describe('/api/templates/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.userId = undefined;
  });

  it('returns 401 before rate limiting or template creation when userId is missing', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/templates/import', {
        method: 'POST',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockParseWordDocument).not.toHaveBeenCalled();
    expect(mockContractTemplateCreate).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});