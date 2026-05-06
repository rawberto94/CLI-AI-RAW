import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockGetContract,
  mockUpdateContract,
  mockQueueRAGReindex,
  mockRequiresApprovalWorkflow,
  mockGetContractLifecycle,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockGetContract: vi.fn(),
  mockUpdateContract: vi.fn(),
  mockQueueRAGReindex: vi.fn(),
  mockRequiresApprovalWorkflow: vi.fn(),
  mockGetContractLifecycle: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {
    getContract: mockGetContract,
    updateContract: mockUpdateContract,
  },
}));

vi.mock('@/lib/contract-helpers', () => ({
  requiresApprovalWorkflow: mockRequiresApprovalWorkflow,
  getContractLifecycle: mockGetContractLifecycle,
}));

vi.mock('@/lib/rag/reindex-helper', () => ({
  queueRAGReindex: mockQueueRAGReindex,
}));

import { GET, POST } from '../route';

function createRequest(
  method: 'GET' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/lifecycle', {
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

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'ACTIVE',
      documentRole: 'EXISTING',
      metadata: { retained: true },
    });
    mockGetContract.mockResolvedValue({
      success: true,
      data: {
        id: 'contract-1',
        status: 'ACTIVE',
        documentRole: 'EXISTING',
        metadata: { retained: true },
      },
    });
    mockUpdateContract.mockResolvedValue({
      success: true,
      data: {
        id: 'contract-1',
        status: 'DRAFT',
        documentRole: 'NEW_CONTRACT',
      },
    });
    mockGetContractLifecycle.mockReturnValue('new');
    mockRequiresApprovalWorkflow.mockReturnValue(true);
    mockQueueRAGReindex.mockResolvedValue(undefined);
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
  });

  it('returns lifecycle details for a tenant-owned contract', async () => {
    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(data.data.contract.lifecycle).toBe('new');
    expect(data.data.contract.requiresApproval).toBe(true);
  });

  it('returns 400 for an invalid documentRole', async () => {
    const response = await POST(createRequest('POST', true, {
      documentRole: 'INVALID_ROLE',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(mockGetContract).not.toHaveBeenCalled();
  });

  it('updates lifecycle using authenticated tenant context and queues reindex', async () => {
    const response = await POST(createRequest('POST', true, {
      documentRole: 'NEW_CONTRACT',
      metadata: { source: 'manual' },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetContract).toHaveBeenCalledWith('contract-1', 'tenant-1');
    expect(mockUpdateContract).toHaveBeenCalledWith(
      'contract-1',
      'tenant-1',
      expect.objectContaining({
        documentRole: 'NEW_CONTRACT',
        status: 'DRAFT',
        metadata: expect.objectContaining({
          isNewContract: true,
          source: 'manual',
        }),
      }),
    );
    expect(mockQueueRAGReindex).toHaveBeenCalledWith({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      reason: 'lifecycle/status updated',
    });
  });
});