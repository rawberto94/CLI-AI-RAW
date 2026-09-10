import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockMetadataFindUnique,
  mockMetadataCreate,
  mockMetadataUpdate,
  mockContractUpdate,
  mockTransaction,
  mockExtractMetadata,
  mockGetSchema,
  mockQueueRAGReindex,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockMetadataFindUnique: vi.fn(),
  mockMetadataCreate: vi.fn(),
  mockMetadataUpdate: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockExtractMetadata: vi.fn(),
  mockGetSchema: vi.fn(),
  mockQueueRAGReindex: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    contractMetadata: {
      findUnique: mockMetadataFindUnique,
      create: mockMetadataCreate,
      update: mockMetadataUpdate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/ai/metadata-extractor', () => ({
  SchemaAwareMetadataExtractor: class {
    extractMetadata = mockExtractMetadata;
  },
}));

vi.mock('@/lib/services/metadata-schema.service', () => ({
  MetadataSchemaService: {
    getInstance: () => ({ getSchema: mockGetSchema }),
  },
}));

vi.mock('@/lib/rag/reindex-helper', () => ({
  queueRAGReindex: mockQueueRAGReindex,
}));

vi.mock('@/lib/openai-client', () => ({
  hasAIClientConfig: () => true,
}));

import { POST, PUT } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(method: 'POST' | 'PUT', body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/extract-metadata', {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'member',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('/api/contracts/[id]/extract-metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueRAGReindex.mockResolvedValue(undefined);
    mockMetadataCreate.mockResolvedValue({});
    mockMetadataUpdate.mockResolvedValue({});
    mockContractUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      contractMetadata: { create: mockMetadataCreate, update: mockMetadataUpdate },
      contract: { update: mockContractUpdate },
    }));
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      rawText: 'x'.repeat(200),
      searchableText: 'x'.repeat(200),
      tags: ['msa', 'executed'],
    });
  });

  it('copies Contract.tags when saving extraction results onto a new metadata row', async () => {
    mockMetadataFindUnique.mockResolvedValue(null);
    mockGetSchema.mockResolvedValue({
      id: 'schema-1',
      version: 1,
      fields: [{ id: 'f1', name: 'contract_title', aiExtractionEnabled: true }],
    });
    mockExtractMetadata.mockResolvedValue({
      schemaId: 'schema-1',
      schemaVersion: 1,
      extractedAt: new Date(),
      results: [],
      summary: {},
      rawExtractions: {},
      warnings: [],
      processingNotes: [],
    });

    const response = await POST(createRequest('POST', { useContractText: true }), routeContext);

    expect(response.status).toBe(200);
    expect(mockMetadataCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        tags: ['msa', 'executed'],
        updatedBy: 'ai-extractor',
      }),
    });
    expect(mockMetadataUpdate).not.toHaveBeenCalled();
  });

  it('does not overwrite tags when extraction results already have a metadata row', async () => {
    mockMetadataFindUnique.mockResolvedValue({ customFields: {} });
    mockGetSchema.mockResolvedValue({ id: 'schema-1', version: 1, fields: [] });
    mockExtractMetadata.mockResolvedValue({
      schemaId: 'schema-1',
      schemaVersion: 1,
      extractedAt: new Date(),
      results: [],
      summary: {},
      rawExtractions: {},
      warnings: [],
      processingNotes: [],
    });

    const response = await POST(createRequest('POST', { useContractText: true }), routeContext);

    expect(response.status).toBe(200);
    expect(mockMetadataCreate).not.toHaveBeenCalled();
    expect(mockMetadataUpdate).toHaveBeenCalledWith({
      where: { contractId: 'contract-1' },
      data: expect.not.objectContaining({ tags: expect.anything() }),
    });
  });

  it('copies Contract.tags when applying extracted fields creates metadata', async () => {
    mockMetadataFindUnique.mockResolvedValue(null);

    const response = await PUT(createRequest('PUT', {
      fields: { contract_title: { value: 'NDA', confidence: 0.9 } },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockMetadataCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        tags: ['msa', 'executed'],
      }),
    });
    expect(mockMetadataUpdate).not.toHaveBeenCalled();
  });

  it('does not pass tags when applying fields to existing metadata', async () => {
    mockMetadataFindUnique.mockResolvedValue({ customFields: { existing: true } });

    const response = await PUT(createRequest('PUT', {
      fields: { contract_title: { value: 'NDA', confidence: 0.9 } },
    }), routeContext);

    expect(response.status).toBe(200);
    expect(mockMetadataCreate).not.toHaveBeenCalled();
    expect(mockMetadataUpdate).toHaveBeenCalledWith({
      where: { contractId: 'contract-1' },
      data: expect.not.objectContaining({ tags: expect.anything() }),
    });
  });
});
