import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindFirst,
  mockUpsert,
  mockContractUpdate,
  mockTransaction,
  mockExtractMetadata,
  mockGetSchema,
  mockCalibrate,
  mockRecordExtractionStart,
  mockRecordFieldAutoApplied,
  mockRecordExtractionComplete,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpsert: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockExtractMetadata: vi.fn(),
  mockGetSchema: vi.fn(),
  mockCalibrate: vi.fn(),
  mockRecordExtractionStart: vi.fn(),
  mockRecordFieldAutoApplied: vi.fn(),
  mockRecordExtractionComplete: vi.fn(),
}));

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../workflow/processing-job', () => ({
  ensureProcessingJob: vi.fn(),
  updateStep: vi.fn(),
  assertRetryableReady: vi.fn(),
}));

vi.mock('../compat/repo-utils', () => ({
  getQueueService: vi.fn(),
  QUEUE_NAMES: { METADATA_EXTRACTION: 'metadata-extraction' },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: { findFirst: mockFindFirst },
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

vi.mock('@/lib/ai/extraction-analytics', () => ({
  getExtractionAnalytics: () => ({
    recordExtractionStart: mockRecordExtractionStart,
    recordFieldAutoApplied: mockRecordFieldAutoApplied,
    recordExtractionComplete: mockRecordExtractionComplete,
    recordExtractionFailed: vi.fn(),
  }),
}));

vi.mock('@/lib/ai/confidence-calibration', () => ({
  getCalibrationService: () => ({
    calibrateConfidence: mockCalibrate,
  }),
}));

import { processMetadataExtractionJob, tagsFromContract } from '../metadata-extraction-worker';

function makeJob() {
  return {
    id: 'job-1',
    name: 'extract-metadata',
    attemptsMade: 0,
    opts: {},
    updateProgress: vi.fn(),
    data: {
      contractId: 'c1',
      tenantId: 't1',
      forceReExtract: true,
    },
  };
}

describe('tagsFromContract', () => {
  it('copies string tags and drops empty values', () => {
    expect(tagsFromContract([' msa ', '', 'executed'])).toEqual(['msa', 'executed']);
  });

  it('returns [] only when Contract.tags has no string values', () => {
    expect(tagsFromContract([])).toEqual([]);
    expect(tagsFromContract(null)).toEqual([]);
    expect(tagsFromContract([{ name: 'msa' }])).toEqual([]);
  });
});

describe('processMetadataExtractionJob metadata create tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordExtractionStart.mockResolvedValue(undefined);
    mockRecordFieldAutoApplied.mockResolvedValue(undefined);
    mockRecordExtractionComplete.mockResolvedValue(undefined);
    mockCalibrate.mockReturnValue({ calibratedConfidence: 0.95 });
    mockGetSchema.mockResolvedValue({ fields: [] });
    mockExtractMetadata.mockResolvedValue({
      extractedAt: new Date(),
      schemaId: 's1',
      schemaVersion: 1,
      rawExtractions: {},
      warnings: [],
      results: [{
        fieldName: 'department',
        fieldId: 'f1',
        fieldType: 'text',
        value: 'Legal',
        confidence: 0.95,
        validationStatus: 'valid',
        requiresHumanReview: false,
        source: { text: 'The Legal department owns this MSA' },
      }],
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      contractMetadata: { upsert: mockUpsert },
      contract: { update: mockContractUpdate },
    }));
    mockUpsert.mockResolvedValue({});
  });

  it('creates metadata with Contract.tags instead of []', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'c1',
      rawText: `The Legal department owns this MSA. ${'x'.repeat(200)}`,
      status: 'COMPLETED',
      tags: ['msa', 'renewal'],
      contractMetadata: null,
    });

    const result = await processMetadataExtractionJob(makeJob() as any);

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        contractId: 'c1',
        tenantId: 't1',
        tags: ['msa', 'renewal'],
      }),
    }));
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.update.tags).toBeUndefined();
  });

  it('does not auto-apply values that failed validation even at high confidence', async () => {
    mockExtractMetadata.mockResolvedValue({
      extractedAt: new Date(),
      schemaId: 's1',
      schemaVersion: 1,
      pipelineVersion: 'qwen-ml-v2',
      rawExtractions: {},
      warnings: [],
      results: [{
        fieldName: 'department',
        fieldId: 'f1',
        fieldType: 'text',
        value: 'Legal',
        confidence: 0.99,
        validationStatus: 'invalid',
        requiresHumanReview: true,
        source: { text: 'The Legal department owns this MSA' },
      }],
    });
    mockFindFirst.mockResolvedValue({
      id: 'c1',
      rawText: `The Legal department owns this MSA. ${'x'.repeat(200)}`,
      status: 'COMPLETED',
      tags: [],
      contractMetadata: null,
    });

    const result = await processMetadataExtractionJob(makeJob() as any);
    expect(result.fieldsAutoApplied).toBe(0);
    expect(mockRecordFieldAutoApplied).not.toHaveBeenCalled();
  });

  it('does not write TCV/dates/parties onto Contract columns — those stay proposals', async () => {
    mockExtractMetadata.mockResolvedValue({
      extractedAt: new Date(),
      schemaId: 's1',
      schemaVersion: 1,
      pipelineVersion: 'qwen-ml-v2',
      rawExtractions: {},
      warnings: [],
      results: [{
        fieldName: 'total_value',
        fieldId: 'f-tv',
        fieldType: 'currency',
        value: 999999,
        confidence: 0.99,
        validationStatus: 'valid',
        requiresHumanReview: false,
        source: { text: 'Total Contract Value CHF 999999 in this sentence here' },
      }],
    });
    mockFindFirst.mockResolvedValue({
      id: 'c1',
      rawText: `Total Contract Value CHF 999999 in this sentence here. ${'x'.repeat(200)}`,
      status: 'COMPLETED',
      tags: [],
      contractTitle: 'Existing',
      contractMetadata: null,
    });

    await processMetadataExtractionJob(makeJob() as any);
    expect(mockContractUpdate).not.toHaveBeenCalled();
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.update.customFields._aiExtraction.proposedCoreFields.total_value).toBe(999999);
  });

  it('re-extracts when a prior run used a different pipeline version', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'c1',
      rawText: `The Legal department owns this MSA. ${'x'.repeat(200)}`,
      status: 'COMPLETED',
      tags: [],
      contractMetadata: {
        customFields: {
          _aiExtraction: {
            lastExtraction: {
              ok: true,
              pipelineVersion: 'qwen-ml-v1',
              schemaVersion: 1,
              rawTextHash: undefined,
            },
          },
        },
      },
    });
    const job = makeJob();
    job.data.forceReExtract = false;

    const result = await processMetadataExtractionJob(job as any);
    expect(result.success).toBe(true);
    expect(mockExtractMetadata).toHaveBeenCalled();
  });
});
