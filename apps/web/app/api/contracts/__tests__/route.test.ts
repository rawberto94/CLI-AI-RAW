import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockContractCount, mockTaxonomyFindMany, mockWithCache, mockContractsList, mockGetTenantIdFromRequest } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockContractCount: vi.fn(),
  mockTaxonomyFindMany: vi.fn(),
  mockWithCache: vi.fn(),
  mockContractsList: vi.fn(),
  mockGetTenantIdFromRequest: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockFindMany,
      count: mockContractCount,
    },
    taxonomyCategory: {
      findMany: mockTaxonomyFindMany,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

vi.mock('@/lib/cache', () => ({
  withCache: mockWithCache,
  CacheKeys: {
    contractsList: mockContractsList,
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getTenantIdFromRequest: mockGetTenantIdFromRequest,
}));

import { GET } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method,
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
  });
}

function createUnauthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaxonomyFindMany.mockResolvedValue([]);
    mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    mockContractsList.mockReturnValue('test-cache-key');
    mockGetTenantIdFromRequest.mockResolvedValue('test-tenant');
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/contracts');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns paginated contracts list', async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([
      {
        id: 'c1',
        tenantId: 'test-tenant',
        fileName: 'contract.pdf',
        originalName: 'contract.pdf',
        fileSize: BigInt(1024),
        mimeType: 'application/pdf',
        createdAt: now,
        uploadedAt: now,
        status: 'COMPLETED',
        contractType: 'NDA',
        contractTitle: 'Sample NDA',
        clientName: 'Acme Corp',
        supplierName: 'Vendor Inc',
        category: null,
        totalValue: 50000,
        currency: 'USD',
        effectiveDate: now,
        expirationDate: now,
        description: 'A test contract',
        tags: ['nda'],
        viewCount: 3,
        lastViewedAt: now,
        jurisdiction: null,
        paymentTerms: null,
        paymentFrequency: null,
        aiMetadata: null,
        parentContractId: null,
        relationshipType: null,
        signatureStatus: null,
        signatureDate: null,
        signatureRequiredFlag: false,
        documentClassification: null,
        documentClassificationConf: null,
        documentClassificationWarning: null,
        parentContract: null,
        _count: { childContracts: 0 },
      },
    ]);
    mockContractCount.mockResolvedValue(1);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/contracts');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.contracts).toHaveLength(1);
    expect(data.data.contracts[0].title).toBe('Sample NDA');
    expect(data.data.pagination).toBeDefined();
    expect(data.data.pagination.total).toBe(1);
  });

  it('returns empty list when no contracts', async () => {
    mockFindMany.mockResolvedValue([]);
    mockContractCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/contracts');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.contracts).toEqual([]);
    expect(data.data.pagination.total).toBe(0);
  });

  it('returns 400 for invalid page parameter', async () => {
    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/contracts', {
      searchParams: { page: '0' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for limit out of range', async () => {
    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/contracts', {
      searchParams: { limit: '200' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies search filter', async () => {
    mockFindMany.mockResolvedValue([]);
    mockContractCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/contracts', {
      searchParams: { search: 'acme' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.filters.applied.search).toBe('acme');
  });

  it('filters by metadata quality issues and returns completeness signals', async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([
      {
        id: 'c-missing',
        tenantId: 'test-tenant',
        fileName: 'incomplete.pdf',
        originalName: 'incomplete.pdf',
        fileSize: BigInt(2048),
        mimeType: 'application/pdf',
        createdAt: now,
        updatedAt: now,
        uploadedAt: now,
        status: 'COMPLETED',
        contractType: null,
        contractTitle: null,
        contractCategoryId: null,
        documentRole: null,
        clientName: null,
        supplierName: null,
        category: null,
        categoryL1: null,
        categoryL2: null,
        totalValue: null,
        currency: null,
        effectiveDate: null,
        expirationDate: null,
        description: null,
        tags: [],
        viewCount: 0,
        lastViewedAt: null,
        jurisdiction: null,
        paymentTerms: null,
        paymentFrequency: null,
        aiMetadata: { _confidence: { overall: 0.55 } },
        parentContractId: null,
        relationshipType: null,
        signatureStatus: 'unknown',
        signatureDate: null,
        signatureRequiredFlag: false,
        documentClassification: 'contract',
        documentClassificationConf: 0.5,
        documentClassificationWarning: 'Low confidence classification',
        parentContract: null,
        contractMetadata: { riskScore: null },
        _count: { childContracts: 0, artifacts: 0 },
      },
    ]);
    mockContractCount.mockResolvedValue(1);

    const url = new URL('http://localhost:3000/api/contracts');
    url.searchParams.append('metadataIssue', 'missing-party');
    url.searchParams.append('metadataIssue', 'low-confidence');
    const request = createAuthenticatedRequest('GET', url.toString());

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.filters.applied.metadataIssues).toEqual(['missing-party', 'low-confidence']);
    expect(data.data.contracts[0].metadataCompletenessLabel).toBe('incomplete');
    expect(data.data.contracts[0].metadataIssues.map((issue: { key: string }) => issue.key)).toEqual(expect.arrayContaining([
      'missing-title',
      'missing-party',
      'missing-value',
      'missing-dates',
      'missing-category',
      'missing-tags',
      'low-confidence',
    ]));
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    }));
  });

  it('returns 400 for an invalid cursor', async () => {
    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/contracts', {
      searchParams: { cursor: 'not-base64' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(mockWithCache).not.toHaveBeenCalled();
  });
});
