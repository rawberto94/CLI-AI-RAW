import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractMetadataFindUnique,
  mockArtifactFindMany,
  mockTaxonomyCategoryFindUnique,
  mockTaxonomyCategoryFindFirst,
  mockContractUpdate,
  mockContractCacheInvalidate,
  mockApiCacheInvalidate,
  mockDeleteCachedByPattern,
  mockCheckContractWritePermission,
  mockPublishRealtimeEvent,
  mockSemanticInvalidate,
  mockQueueRagIndexing,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractMetadataFindUnique: vi.fn(),
  mockArtifactFindMany: vi.fn(),
  mockTaxonomyCategoryFindUnique: vi.fn(),
  mockTaxonomyCategoryFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockContractCacheInvalidate: vi.fn(),
  mockApiCacheInvalidate: vi.fn(),
  mockDeleteCachedByPattern: vi.fn(),
  mockCheckContractWritePermission: vi.fn(),
  mockPublishRealtimeEvent: vi.fn(),
  mockSemanticInvalidate: vi.fn(),
  mockQueueRagIndexing: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    contractMetadata: {
      findUnique: mockContractMetadataFindUnique,
    },
    artifact: {
      findMany: mockArtifactFindMany,
    },
    taxonomyCategory: {
      findUnique: mockTaxonomyCategoryFindUnique,
      findFirst: mockTaxonomyCategoryFindFirst,
    },
  },
}));

vi.mock('@/lib/security/contract-acl', () => ({
  checkContractWritePermission: mockCheckContractWritePermission,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: mockPublishRealtimeEvent,
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
    invalidate: mockContractCacheInvalidate,
  },
  apiCache: {
    invalidate: mockApiCacheInvalidate,
  },
}));

vi.mock('@repo/utils/queue/contract-queue', () => ({
  getContractQueue: () => ({
    queueRAGIndexing: mockQueueRagIndexing,
  }),
}));

import { GET, PUT } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(method: 'GET' | 'PUT', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/metadata', {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'member',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/[id]/metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractMetadataFindUnique.mockResolvedValue(null);
    mockArtifactFindMany.mockResolvedValue([]);
    mockTaxonomyCategoryFindUnique.mockResolvedValue(null);
    mockTaxonomyCategoryFindFirst.mockResolvedValue(null);
    mockCheckContractWritePermission.mockResolvedValue({ allowed: true });
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
    mockSemanticInvalidate.mockResolvedValue(undefined);
    mockQueueRagIndexing.mockResolvedValue(undefined);
    mockDeleteCachedByPattern.mockResolvedValue(undefined);
  });

  it('returns 404 when the contract is outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('rejects invalid metadata payloads before writing', async () => {
    const response = await PUT(createRequest('PUT', {
      metadata: {
        start_date: 'not-a-date',
      },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(mockContractFindFirst).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller cannot edit metadata', async () => {
    mockContractFindFirst.mockResolvedValue({ aiMetadata: {}, metadata: {} });
    mockCheckContractWritePermission.mockResolvedValue({ allowed: false });

    const response = await PUT(createRequest('PUT', {
      metadata: {
        document_title: 'Updated title',
      },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  it('updates metadata and queues rag reindexing for trigger fields', async () => {
    mockContractFindFirst.mockResolvedValue({ aiMetadata: {}, metadata: {} });
    mockContractUpdate.mockResolvedValue({ id: 'contract-1' });

    const response = await PUT(createRequest('PUT', {
      metadata: {
        document_title: 'Updated title',
      },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.ragReindexQueued).toBe(true);
    expect(mockQueueRagIndexing).toHaveBeenCalled();
    expect(mockContractCacheInvalidate).toHaveBeenCalledWith('contract:tenant-1:contract-1');
    expect(mockContractCacheInvalidate).toHaveBeenCalledWith('contracts:', true);
    expect(mockApiCacheInvalidate).toHaveBeenCalledWith('contracts:', true);
    expect(mockDeleteCachedByPattern).toHaveBeenCalledWith('contracts:list:*');
  });

  it('mirrors duration metadata to all contract date fields', async () => {
    mockContractFindFirst.mockResolvedValue({ aiMetadata: {}, metadata: {} });
    mockContractUpdate.mockResolvedValue({ id: 'contract-1' });

    const response = await PUT(createRequest('PUT', {
      metadata: {
        start_date: '2026-06-01',
        end_date: '2027-06-01',
      },
    }), routeContext);

    expect(response.status).toBe(200);
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        effectiveDate: new Date('2026-06-01'),
        startDate: new Date('2026-06-01'),
        expirationDate: new Date('2027-06-01'),
        endDate: new Date('2027-06-01'),
        isExpired: false,
        expirationRisk: expect.any(String),
        daysUntilExpiry: expect.any(Number),
      }),
    }));
  });

  it('persists document classification and contract type to the contract record', async () => {
    mockContractFindFirst.mockResolvedValue({ aiMetadata: {}, metadata: {}, contractType: 'UNKNOWN' });
    mockContractUpdate.mockResolvedValue({ id: 'contract-1' });

    const response = await PUT(createRequest('PUT', {
      metadata: {
        document_classification: 'invoice',
        document_classification_confidence: 0.93,
        document_classification_warning: 'Non-binding commercial document',
        contractType: '',
      },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        documentClassification: 'invoice',
        documentClassificationConf: 0.93,
        documentClassificationWarning: 'Non-binding commercial document',
        contractType: null,
      }),
    }));
  });
})