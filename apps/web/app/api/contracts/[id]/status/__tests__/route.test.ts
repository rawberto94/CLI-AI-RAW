import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractUpdate,
  mockWorkflowExecutionUpdate,
  mockPushAgentNotification,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockWorkflowExecutionUpdate: vi.fn(),
  mockPushAgentNotification: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    workflowExecution: {
      update: mockWorkflowExecutionUpdate,
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ai/agent-notifications', () => ({
  pushAgentNotification: mockPushAgentNotification,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { PATCH } from '../route';

function createRequest(
  role?: string,
  body: Record<string, unknown> = { status: 'ACTIVE' },
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/status', {
    method: 'PATCH',
    headers: role
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': role,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(body),
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('PATCH /api/contracts/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await PATCH(createRequest(undefined), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for non-admin users', async () => {
    const response = await PATCH(createRequest('member'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockContractFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await PATCH(createRequest('admin'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractUpdate).not.toHaveBeenCalled();
  });

  it('allows admins to perform a valid status transition', async () => {
    const updatedAt = new Date('2026-04-28T12:00:00.000Z');
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'ARCHIVED',
      metadata: {},
      contractTitle: 'Master Services Agreement',
      fileName: 'msa.pdf',
    });
    mockContractUpdate.mockResolvedValue({
      id: 'contract-1',
      status: 'ACTIVE',
      contractTitle: 'Master Services Agreement',
      fileName: 'msa.pdf',
      updatedAt,
    });

    const response = await PATCH(createRequest('admin', { status: 'ACTIVE' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        status: 'ACTIVE',
      }),
    }));
    expect(mockPushAgentNotification).not.toHaveBeenCalled();
  });
});