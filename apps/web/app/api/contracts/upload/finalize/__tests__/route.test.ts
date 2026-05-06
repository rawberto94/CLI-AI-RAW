import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockProviderList,
  mockGetStorageProvider,
  mockDownloadFromStorage,
  mockUploadToStorage,
  mockScanBuffer,
  mockCreateContractWithSideEffects,
  mockPublishRealtimeEvent,
  mockTriggerArtifactGeneration,
  mockDeleteFromStorage,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockProviderList: vi.fn(),
  mockGetStorageProvider: vi.fn(),
  mockDownloadFromStorage: vi.fn(),
  mockUploadToStorage: vi.fn(),
  mockScanBuffer: vi.fn(),
  mockCreateContractWithSideEffects: vi.fn(),
  mockPublishRealtimeEvent: vi.fn(),
  mockTriggerArtifactGeneration: vi.fn(),
  mockDeleteFromStorage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('@/lib/storage/storage-factory', () => ({
  getStorageProvider: mockGetStorageProvider,
}));

vi.mock('@/lib/storage', () => ({
  downloadFromStorage: mockDownloadFromStorage,
  uploadToStorage: mockUploadToStorage,
  deleteFromStorage: mockDeleteFromStorage,
}));

vi.mock('@/lib/security/virus-scan', () => ({
  scanBuffer: mockScanBuffer,
}));

vi.mock('@/lib/transaction-service', () => ({
  createContractWithSideEffects: mockCreateContractWithSideEffects,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: mockPublishRealtimeEvent,
}));

vi.mock('@/lib/artifact-trigger', () => ({
  triggerArtifactGeneration: mockTriggerArtifactGeneration,
}));

import { POST } from '../route';

function createRequest(body: Record<string, unknown>, withAuth = true) {
  return new NextRequest('http://localhost:3000/api/contracts/upload/finalize', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: JSON.stringify(body),
  });
}

describe('/api/contracts/upload/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStorageProvider.mockResolvedValue({ list: mockProviderList });
    mockDownloadFromStorage.mockResolvedValue(Buffer.from('part'));
    mockUploadToStorage.mockResolvedValue({ success: true, key: 'contracts/tenant-1/file.pdf' });
    mockScanBuffer.mockResolvedValue({ clean: true, threats: [] });
    mockCreateContractWithSideEffects.mockResolvedValue({
      result: {
        contract: { id: 'contract-1', status: 'UPLOADED' },
        processingJob: { id: 'job-1' },
      },
    });
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
    mockTriggerArtifactGeneration.mockResolvedValue(undefined);
    mockDeleteFromStorage.mockResolvedValue(true);
    mockExecuteRaw.mockResolvedValue(undefined);
  });

  it('returns 404 when the upload session is outside the tenant scope', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const response = await POST(createRequest({ uploadId: 'upload-1' }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockProviderList).not.toHaveBeenCalled();
  });

  it('lists only tenant-scoped chunk keys and attributes the upload to ctx.userId', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: 'upload-1',
        tenant_id: 'tenant-1',
        file_name: 'contract.pdf',
        file_size: 8,
        mime_type: 'application/pdf',
        total_chunks: 2,
        chunks_uploaded: 2,
        status: 'uploading',
      },
    ]);
    mockProviderList.mockResolvedValue([
      'chunks/tenant-1/upload-1/chunk-0',
      'chunks/tenant-1/upload-1/chunk-1',
    ]);

    const response = await POST(createRequest({ uploadId: 'upload-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockProviderList).toHaveBeenCalledWith('chunks/tenant-1/upload-1/');
    expect(mockCreateContractWithSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        contractData: expect.objectContaining({
          tenantId: 'tenant-1',
          uploadedBy: 'user-1',
          originalName: 'contract.pdf',
        }),
      }),
    );
  });
});