import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    contractMetadata: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contract: {
      findUnique: vi.fn(),
    },
    artifact: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../dal/database.adaptor', () => ({
  dbAdaptor: {
    getClient: () => mockClient,
  },
}));

vi.mock('../../events/event-bus', () => ({
  eventBus: {
    publish: vi.fn(),
  },
  Events: {
    CONTRACT_METADATA_UPDATED: 'contract:metadata:updated',
  },
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../contract-indexing.service', () => ({
  contractIndexingService: {
    indexContract: vi.fn().mockResolvedValue(undefined),
  },
}));

import { metadataEditorService } from '../metadata-editor.service';

describe('MetadataEditorService.addTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.artifact.findMany.mockResolvedValue([]);
    mockClient.contractMetadata.update.mockResolvedValue({});
  });

  it('creates a metadata row when none exists (upsert on missing row)', async () => {
    mockClient.contractMetadata.findUnique.mockResolvedValue(null);
    mockClient.contract.findUnique.mockResolvedValue({ tags: ['msa'] });
    mockClient.contractMetadata.create.mockResolvedValue({
      contractId: 'c1',
      tags: ['msa', 'executed'],
    });

    await metadataEditorService.addTags('c1', 't1', ['executed'], 'u1');

    expect(mockClient.contractMetadata.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: 'c1',
        tenantId: 't1',
        tags: ['msa', 'executed'],
        customFields: {},
        systemFields: {},
        updatedBy: 'u1',
      }),
    });
    expect(mockClient.contractMetadata.create).toHaveBeenCalledOnce();
  });

  it('falls back to an empty tag list when both metadata and contract tags are missing', async () => {
    mockClient.contractMetadata.findUnique.mockResolvedValue(null);
    mockClient.contract.findUnique.mockResolvedValue(null);
    mockClient.contractMetadata.create.mockResolvedValue({
      contractId: 'c2',
      tags: ['executed'],
    });

    await metadataEditorService.addTags('c2', 't1', ['executed'], 'u1');

    expect(mockClient.contractMetadata.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: 'c2',
        tenantId: 't1',
        tags: ['executed'],
      }),
    });
  });
});
