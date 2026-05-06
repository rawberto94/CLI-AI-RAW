import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockContractAggregate,
  mockContractFindFirst,
  mockContractUpdate,
  mockProcessingJobUpdate,
  mockStorageUpload,
  mockInitializeStorage,
  mockCreateContractWithSideEffects,
  mockPublishRealtimeEvent,
  mockScanBuffer,
  mockInitializeContractMetadata,
  mockTriggerArtifactGeneration,
  mockMkdir,
  mockWriteFile,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockContractAggregate: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockProcessingJobUpdate: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockInitializeStorage: vi.fn(),
  mockCreateContractWithSideEffects: vi.fn(),
  mockPublishRealtimeEvent: vi.fn(),
  mockScanBuffer: vi.fn(),
  mockInitializeContractMetadata: vi.fn(),
  mockTriggerArtifactGeneration: vi.fn(),
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      aggregate: mockContractAggregate,
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    processingJob: {
      update: mockProcessingJobUpdate,
    },
    taxonomyCategory: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/storage-service', () => ({
  initializeStorage: mockInitializeStorage,
}));

vi.mock('@/lib/transaction-service', () => ({
  createContractWithSideEffects: mockCreateContractWithSideEffects,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: mockPublishRealtimeEvent,
}));

vi.mock('@/lib/security/virus-scan', () => ({
  scanBuffer: mockScanBuffer,
}));

vi.mock('@/lib/contract-integration', () => ({
  initializeContractMetadata: mockInitializeContractMetadata,
}));

vi.mock('@/lib/artifact-trigger', () => ({
  PROCESSING_PRIORITY: {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10,
    BACKGROUND: 20,
  },
  triggerArtifactGeneration: mockTriggerArtifactGeneration,
}));

vi.mock('@/lib/queue-init', () => ({}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

vi.mock('@/lib/security/cors', () => ({
  default: {
    addCorsHeaders: (response: NextResponse) => response,
    optionsResponse: () => new NextResponse(null, { status: 204 }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

import { POST } from '../route';

function createRequest(withAuth = true): NextRequest {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
  const file = new File([bytes], 'contract.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(bytes.buffer),
  });

  const formData = {
    get(key: string) {
      if (key === 'file') return file;
      return null;
    },
  };

  const url = 'http://localhost:3000/api/contracts/upload';
  const headers = new Headers(
    withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  );

  return {
    method: 'POST',
    url,
    nextUrl: new URL(url),
    headers,
    formData: async () => formData as unknown as FormData,
  } as unknown as NextRequest;
}

describe('/api/contracts/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractAggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { fileSize: 0 } });
    mockContractFindFirst.mockResolvedValue(null);
    mockContractUpdate.mockResolvedValue({});
    mockProcessingJobUpdate.mockResolvedValue({});
    mockStorageUpload.mockResolvedValue({ success: true });
    mockInitializeStorage.mockReturnValue({ upload: mockStorageUpload });
    mockCreateContractWithSideEffects.mockResolvedValue({
      result: {
        contract: { id: 'contract-1', tenantId: 'tenant-1', status: 'PROCESSING' },
        processingJob: { id: 'job-1' },
      },
      wasExecuted: true,
    });
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
    mockScanBuffer.mockResolvedValue({ clean: true, threats: [] });
    mockInitializeContractMetadata.mockResolvedValue(undefined);
    mockTriggerArtifactGeneration.mockResolvedValue({ jobId: 'queue-1' });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('creates uploaded contracts with ctx tenant and ctx user identity', async () => {
    const response = await POST(createRequest(true));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockCreateContractWithSideEffects).toHaveBeenCalledWith(expect.objectContaining({
      contractData: expect.objectContaining({
        tenantId: 'tenant-1',
        uploadedBy: 'user-1',
        fileName: 'contract.png',
      }),
    }));
    expect(mockStorageUpload).toHaveBeenCalledWith(expect.objectContaining({
      fileName: expect.stringMatching(/^contracts\/tenant-1\//),
    }));
  });
});