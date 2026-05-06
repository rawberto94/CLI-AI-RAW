import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockArtifactFindMany,
  mockProcessingJobFindFirst,
  mockTaxonomyCategoryFindUnique,
  mockContractUpdate,
  mockLearningRecordCreate,
  mockCheckContractReadPermission,
  mockCheckContractWritePermission,
  mockSafeDeleteContract,
  mockSemanticInvalidate,
  mockDeleteCachedByPattern,
  mockContractCacheGet,
  mockContractCacheMatches,
  mockContractCacheSet,
  mockContractCacheInvalidate,
  mockApiCacheInvalidate,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockArtifactFindMany: vi.fn(),
  mockProcessingJobFindFirst: vi.fn(),
  mockTaxonomyCategoryFindUnique: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockLearningRecordCreate: vi.fn(),
  mockCheckContractReadPermission: vi.fn(),
  mockCheckContractWritePermission: vi.fn(),
  mockSafeDeleteContract: vi.fn(),
  mockSemanticInvalidate: vi.fn(),
  mockDeleteCachedByPattern: vi.fn(),
  mockContractCacheGet: vi.fn(),
  mockContractCacheMatches: vi.fn(),
  mockContractCacheSet: vi.fn(),
  mockContractCacheInvalidate: vi.fn(),
  mockApiCacheInvalidate: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    artifact: {
      findMany: mockArtifactFindMany,
    },
    processingJob: {
      findFirst: mockProcessingJobFindFirst,
    },
    taxonomyCategory: {
      findUnique: mockTaxonomyCategoryFindUnique,
    },
    learningRecord: {
      create: mockLearningRecordCreate,
    },
  },
}));

vi.mock('@/lib/security/contract-acl', () => ({
  checkContractWritePermission: mockCheckContractWritePermission,
  checkContractReadPermission: mockCheckContractReadPermission,
}));

vi.mock('@/lib/services/contract-deletion.service', () => ({
  safeDeleteContract: mockSafeDeleteContract,
}));

vi.mock('@/lib/ai/semantic-cache.service', () => ({
  semanticCache: {
    invalidate: mockSemanticInvalidate,
  },
}));

vi.mock('@/lib/cache', () => ({
  deleteCachedByPattern: mockDeleteCachedByPattern,
}));

vi.mock('@/lib/cache/etag-cache', () => ({
  contractCache: {
    get: mockContractCacheGet,
    matches: mockContractCacheMatches,
    set: mockContractCacheSet,
    invalidate: mockContractCacheInvalidate,
  },
  apiCache: {
    invalidate: mockApiCacheInvalidate,
  },
  etagHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    CONTRACT_UPDATED: 'CONTRACT_UPDATED',
    CONTRACT_DELETED: 'CONTRACT_DELETED',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { DELETE as deleteRoute, GET, PUT } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(
  method: 'GET' | 'PUT' | 'DELETE',
  role?: string,
  body?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1', {
    method,
    headers: role
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': role,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...extraHeaders,
        }
      : extraHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-1',
    tenantId: 'tenant-1',
    status: 'COMPLETED',
    contractTitle: 'Master Services Agreement',
    originalName: 'msa-original.pdf',
    fileName: 'msa.pdf',
    uploadedAt: new Date('2026-04-28T10:00:00.000Z'),
    processedAt: new Date('2026-04-28T10:02:00.000Z'),
    createdAt: new Date('2026-04-28T10:00:00.000Z'),
    updatedAt: new Date('2026-04-29T09:00:00.000Z'),
    uploadedBy: 'user-1',
    fileSize: 1024,
    mimeType: 'application/pdf',
    totalValue: 5000,
    currency: 'USD',
    clientName: 'Acme Corp',
    supplierName: 'Vendor LLC',
    description: 'Fallback description',
    tags: ['priority'],
    searchableText: 'Searchable text',
    effectiveDate: new Date('2026-05-01T00:00:00.000Z'),
    expirationDate: new Date('2027-05-01T00:00:00.000Z'),
    startDate: null,
    endDate: null,
    signatureStatus: 'signed',
    aiMetadata: null,
    contractType: 'MSA',
    parentContract: null,
    childContracts: [],
    parentContractId: null,
    relationshipType: null,
    relationshipNote: null,
    linkedAt: null,
    contractSubtype: null,
    classificationConf: null,
    classificationMeta: null,
    signatureDate: null,
    signatureRequiredFlag: false,
    documentClassification: 'contract',
    jurisdiction: 'Switzerland',
    noticePeriodDays: 30,
    contractCategoryId: null,
    categoryL1: null,
    categoryL2: null,
    classifiedAt: null,
    rawText: 'Raw text',
    contractMetadata: null,
    metadata: {},
    ...overrides,
  };
}

describe('/api/contracts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractCacheGet.mockReturnValue(null);
    mockContractCacheMatches.mockReturnValue(false);
    mockContractCacheSet.mockReturnValue('"etag-1"');
    mockArtifactFindMany.mockResolvedValue([]);
    mockProcessingJobFindFirst.mockResolvedValue(null);
    mockTaxonomyCategoryFindUnique.mockResolvedValue(null);
    mockCheckContractReadPermission.mockResolvedValue({ allowed: true });
    mockCheckContractWritePermission.mockResolvedValue({ allowed: true });
    mockSafeDeleteContract.mockResolvedValue({ success: true, deletedRecords: { contracts: 1 } });
    mockSemanticInvalidate.mockResolvedValue(undefined);
    mockDeleteCachedByPattern.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
    mockLearningRecordCreate.mockResolvedValue(undefined);
  });

  it('returns 401 for GET without auth headers', async () => {
    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockContractFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when GET targets a contract outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET', 'member'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when GET caller lacks read permission', async () => {
    mockContractFindFirst.mockResolvedValue(createContract());
    mockCheckContractReadPermission.mockResolvedValue({ allowed: false });

    const response = await GET(createRequest('GET', 'member'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockArtifactFindMany).not.toHaveBeenCalled();
  });

  it('serves cached terminal GET responses after rechecking ACL', async () => {
    mockContractCacheGet.mockReturnValue({
      etag: '"cached-etag"',
      data: {
        id: 'contract-1',
        processing: { status: 'completed' },
      },
    });

    const response = await GET(createRequest('GET', 'member'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('contract-1');
    expect(data.meta.dataSource).toBe('server-cache');
    expect(data.meta.cached).toBe(true);
    expect(mockContractFindFirst).not.toHaveBeenCalled();
    expect(mockCheckContractReadPermission).toHaveBeenCalledWith(expect.objectContaining({
      contractId: 'contract-1',
    }));
  });

  it('returns fresh GET contract details and caches terminal responses', async () => {
    mockContractFindFirst.mockResolvedValue(createContract());
    mockArtifactFindMany.mockResolvedValue([
      {
        type: 'OVERVIEW',
        data: {
          summary: 'This is a sufficiently long overview summary for the contract details endpoint to prefer over the fallback description.',
          parties: [{ legalName: 'Acme Corp', role: 'Client' }],
          clauses: [{ id: 'c1' }],
        },
      },
      {
        type: 'FINANCIAL',
        data: {
          paymentTerms: ['Net 30'],
          extractedTables: [{ type: 'payment_schedule' }],
          benchmarkingResults: [],
        },
      },
    ]);
    mockProcessingJobFindFirst.mockResolvedValue({
      id: 'job-1',
      progress: 100,
      currentStep: 'completed',
      status: 'COMPLETED',
      startedAt: new Date('2026-04-28T10:00:00.000Z'),
      completedAt: new Date('2026-04-28T10:02:00.000Z'),
    });

    const response = await GET(createRequest('GET', 'member'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('contract-1');
    expect(data.data.contract_short_description).toContain('sufficiently long overview summary');
    expect(data.data.external_parties).toEqual([{ legalName: 'Acme Corp', role: 'Client' }]);
    expect(data.data.financial.paymentTerms).toBe('1 payment milestones');
    expect(data.data.processing.jobId).toBe('job-1');
    expect(data.data.artifactCount).toBe(2);
    expect(data.meta.dataSource).toBe('database');
    expect(data.meta.cached).toBe(false);
    expect(mockContractCacheSet).toHaveBeenCalled();
  });

  it('returns 401 for PUT without auth headers', async () => {
    const response = await PUT(createRequest('PUT', undefined, { description: 'Updated' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockContractFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when PUT targets a contract outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await PUT(createRequest('PUT', 'member', { description: 'Updated' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when PUT caller lacks edit permission', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      tenantId: 'tenant-1',
      isDeleted: false,
      updatedAt: new Date('2026-04-29T09:00:00.000Z'),
      metadata: {},
    });
    mockCheckContractWritePermission.mockResolvedValue({ allowed: false });

    const response = await PUT(createRequest('PUT', 'member', { description: 'Updated' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockCheckContractWritePermission).toHaveBeenCalledWith(expect.objectContaining({
      required: 'EDIT',
    }));
  });

  it('returns 409 when PUT version is stale', async () => {
    const updatedAt = new Date('2026-04-29T09:00:00.000Z');
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      tenantId: 'tenant-1',
      isDeleted: false,
      updatedAt,
      metadata: {},
    });

    const response = await PUT(createRequest('PUT', 'member', {
      description: 'Updated',
      version: '2026-04-29T08:59:00.000Z',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
    expect(mockContractUpdate).not.toHaveBeenCalled();
  });

  it('updates the contract through PUT and invalidates caches', async () => {
    const currentVersion = new Date('2026-04-29T09:00:00.000Z');
    const persistedVersion = new Date('2026-04-29T09:15:00.000Z');

    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      tenantId: 'tenant-1',
      isDeleted: false,
      updatedAt: currentVersion,
      metadata: {},
      contractType: 'MSA',
    });
    mockContractUpdate.mockResolvedValue({
      id: 'contract-1',
      description: 'Revised language',
      updatedAt: persistedVersion,
    });

    const response = await PUT(createRequest('PUT', 'member', {
      description: 'Revised language',
      version: currentVersion.toISOString(),
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.description).toBe('Revised language');
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        description: 'Revised language',
      }),
    }));
    expect(mockContractCacheInvalidate).toHaveBeenCalledWith('contract:tenant-1:contract-1');
    expect(mockApiCacheInvalidate).toHaveBeenCalledWith('contracts:', true);
  });

  it('returns 403 when DELETE caller lacks admin permission', async () => {
    mockCheckContractWritePermission.mockResolvedValue({ allowed: false });

    const response = await deleteRoute(createRequest('DELETE', 'member'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockCheckContractWritePermission).toHaveBeenCalledWith(expect.objectContaining({
      required: 'ADMIN',
    }));
    expect(mockSafeDeleteContract).not.toHaveBeenCalled();
  });

  it('deletes the contract through DELETE and returns deleted records', async () => {
    mockSafeDeleteContract.mockResolvedValue({
      success: true,
      deletedRecords: { contracts: 1, artifacts: 3 },
    });

    const response = await deleteRoute(createRequest('DELETE', 'admin'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('Contract deleted successfully');
    expect(data.data.deletedRecords).toEqual({ contracts: 1, artifacts: 3 });
    expect(mockSafeDeleteContract).toHaveBeenCalledWith('contract-1', 'tenant-1');
  });
});