import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockContractFindFirst,
  mockExtractMetadata,
  mockGetSchema,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockExtractMetadata: vi.fn(),
  mockGetSchema: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractMetadata: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
    contract: {
      findFirst: mockContractFindFirst,
    },
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

import { AutoPopulateService } from '../auto-populate.service';

function extractionResult(fieldName: string, value: string, confidence: number) {
  return {
    schemaId: 'schema-1',
    schemaVersion: 1,
    extractedAt: new Date(),
    results: [{
      fieldId: 'f1',
      fieldName,
      fieldLabel: 'Title',
      fieldType: 'text',
      category: 'core',
      value,
      rawValue: value,
      confidence,
      confidenceExplanation: '',
      source: { text: value },
      alternatives: [],
      validationStatus: 'valid',
      validationMessages: [],
      suggestions: [],
      requiresHumanReview: false,
    }],
    summary: {
      totalFields: 1,
      extractedFields: 1,
      highConfidenceFields: 1,
      lowConfidenceFields: 0,
      failedFields: 0,
      averageConfidence: confidence,
      extractionTime: 1,
      passesCompleted: 1,
    },
    rawExtractions: { [fieldName]: value },
    warnings: [],
    processingNotes: [],
  };
}

describe('AutoPopulateService.applyMetadata tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSchema.mockResolvedValue({
      id: 'schema-1',
      tenantId: 'tenant-1',
      name: 'default',
      version: 1,
      isDefault: true,
      fields: [{
        id: 'f1',
        name: 'contract_title',
        label: 'Title',
        type: 'text',
        aiExtractionEnabled: true,
        hidden: false,
      }],
    });
    mockExtractMetadata.mockResolvedValue(extractionResult('contract_title', 'NDA', 0.95));
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
  });

  it('copies Contract.tags when creating metadata', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockContractFindFirst.mockResolvedValue({ tags: ['renewal', 'msa'] });

    const service = new AutoPopulateService({
      notifyOnComplete: false,
      notifyOnReviewRequired: false,
    });
    const result = await service.processContract('c1', 'tenant-1', 'x'.repeat(200));

    expect(result.status).toBe('success');
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: 'c1',
        tenantId: 'tenant-1',
        tags: ['renewal', 'msa'],
        updatedBy: 'auto-populate',
      }),
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not pass tags when updating existing metadata', async () => {
    mockFindUnique.mockResolvedValue({ customFields: { existing: true } });

    const service = new AutoPopulateService({
      notifyOnComplete: false,
      notifyOnReviewRequired: false,
    });
    await service.processContract('c1', 'tenant-1', 'x'.repeat(200));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contractId: 'c1' },
      data: expect.not.objectContaining({ tags: expect.anything() }),
    });
    expect(mockContractFindFirst).not.toHaveBeenCalled();
  });
});
