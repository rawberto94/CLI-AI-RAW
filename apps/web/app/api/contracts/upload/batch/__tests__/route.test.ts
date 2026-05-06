import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractCreate,
  mockContractUpdate,
  mockProcessingJobCreate,
  mockProcessingJobUpdate,
  mockOutboxEventCreate,
  mockStorageUpload,
  mockGetStorageService,
  mockTriggerArtifactGeneration,
  mockScanBuffer,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractCreate: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockProcessingJobCreate: vi.fn(),
  mockProcessingJobUpdate: vi.fn(),
  mockOutboxEventCreate: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockGetStorageService: vi.fn(),
  mockTriggerArtifactGeneration: vi.fn(),
  mockScanBuffer: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      create: mockContractCreate,
      update: mockContractUpdate,
    },
    processingJob: {
      create: mockProcessingJobCreate,
      update: mockProcessingJobUpdate,
    },
    outboxEvent: {
      create: mockOutboxEventCreate,
    },
  },
}));

vi.mock('@/lib/storage-service', () => ({
  getStorageService: mockGetStorageService,
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

vi.mock('@/lib/security/virus-scan', () => ({
  scanBuffer: mockScanBuffer,
}));

import { POST } from '../route';

function createRequest(withAuth = true): NextRequest {
  const file = new File(['contract body'], 'contract.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(new TextEncoder().encode('contract body').buffer),
  });

  const formData = {
    getAll(name: string) {
      return name === 'files' ? [file] : [];
    },
  };

  const url = 'http://localhost:3000/api/contracts/upload/batch';
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

describe('/api/contracts/upload/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue(null);
    mockStorageUpload.mockResolvedValue(undefined);
    mockGetStorageService.mockReturnValue({ upload: mockStorageUpload });
    mockScanBuffer.mockResolvedValue({ clean: true, threats: [] });
    mockContractCreate.mockResolvedValue({ id: 'contract-1', status: 'UPLOADED' });
    mockProcessingJobCreate.mockResolvedValue({ id: 'job-1' });
    mockProcessingJobUpdate.mockResolvedValue({});
    mockContractUpdate.mockResolvedValue({});
    mockOutboxEventCreate.mockResolvedValue({});
    mockTriggerArtifactGeneration.mockResolvedValue({ jobId: 'queue-1' });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.userId for uploadedBy and a collision-resistant storage key', async () => {
    const response = await POST(createRequest(true));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          uploadedBy: 'user-1',
          originalName: 'contract.pdf',
        }),
      }),
    );
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringMatching(/contracts\/tenant-1\/\d+-[a-f0-9]{12}-contract\.pdf$/),
      }),
    );
  });
});