import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockTaxonomyCategoryFindUnique,
  mockTaxonomyCategoryFindMany,
  mockExtractionCorrectionCreate,
  mockContractUpdate,
  mockTransaction,
  mockAuditLog,
  mockQueueCategorizationJob,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockTaxonomyCategoryFindUnique: vi.fn(),
  mockTaxonomyCategoryFindMany: vi.fn(),
  mockExtractionCorrectionCreate: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockAuditLog: vi.fn(),
  mockQueueCategorizationJob: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    taxonomyCategory: {
      findUnique: mockTaxonomyCategoryFindUnique,
      findMany: mockTaxonomyCategoryFindMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/security/audit', () => ({
  AuditAction: {
    CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  },
  auditLog: mockAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@repo/workers/categorization-worker', () => ({
  queueCategorizationJob: mockQueueCategorizationJob,
}));

import { GET, PUT, POST } from '../route';

function createRequest(
  method: 'GET' | 'PUT' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/category', {
    method,
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': 'admin',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      contractCategoryId: 'cat-1',
      categoryL1: 'Commercial',
      categoryL2: 'MSA',
      contractType: 'MSA',
      metadata: {
        _pendingCategorization: {
          overallConfidence: 82,
          needsReview: true,
          reviewReason: 'Low confidence',
          taxonomy: {
            categoryL2: { matchScore: 0.73 },
            alternatives: [{ id: 'cat-2', name: 'SaaS' }],
          },
        },
      },
      classifiedAt: new Date('2026-04-29T12:00:00.000Z'),
      rawText: 'contract body',
    });
    mockTaxonomyCategoryFindUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'MSA',
      color: '#333',
      icon: 'file',
      level: 1,
      parent: { id: 'parent-1', name: 'Commercial', color: '#111', icon: 'folder' },
    });
    mockTaxonomyCategoryFindMany.mockResolvedValue([
      { id: 'parent-1', name: 'Commercial', color: '#111', icon: 'folder' },
    ]);
    mockTransaction.mockImplementation(async (callback: any) => callback({
      extractionCorrection: { create: mockExtractionCorrectionCreate },
      contract: { update: mockContractUpdate },
    }));
    mockAuditLog.mockResolvedValue(undefined);
    mockQueueCategorizationJob.mockResolvedValue('job-1');
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns category details for a tenant-owned contract', async () => {
    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(data.data.data.current).toEqual(expect.objectContaining({
      id: 'cat-1',
      l1: 'Commercial',
      l2: 'MSA',
    }));
    expect(data.data.data.needsReview).toBe(true);
  });

  it('returns 404 when the chosen category is missing', async () => {
    mockTaxonomyCategoryFindUnique.mockResolvedValue(null);

    const response = await PUT(createRequest('PUT', true, {
      categoryId: 'missing-cat',
      feedbackType: 'correction',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('updates the category using authenticated tenant and user context', async () => {
    mockTaxonomyCategoryFindUnique.mockResolvedValue({
      id: 'cat-2',
      name: 'SaaS',
      level: 1,
      parent: { id: 'parent-1', name: 'Commercial' },
    });

    const response = await PUT(createRequest('PUT', true, {
      categoryId: 'cat-2',
      feedbackType: 'correction',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockExtractionCorrectionCreate).toHaveBeenCalled();
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        contractCategoryId: 'cat-2',
        categoryL1: 'Commercial',
        categoryL2: 'SaaS',
      }),
    }));
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'user-1',
      metadata: expect.objectContaining({ categoryId: 'cat-2' }),
    }));
  });

  it('queues a categorization job for a tenant-owned contract', async () => {
    const response = await POST(createRequest('POST', true, { force: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockQueueCategorizationJob).toHaveBeenCalledWith({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      forceRecategorize: true,
      autoApply: true,
      autoApplyThreshold: 0.7,
      source: 'manual',
    });
    expect(data.data.data.jobId).toBe('job-1');
  });
});