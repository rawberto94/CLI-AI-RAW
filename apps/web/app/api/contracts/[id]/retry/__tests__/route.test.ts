import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetContract,
  mockUpdateContract,
  mockFindProcessingJob,
  mockUpdateProcessingJob,
  mockCreateProcessingJob,
  mockDeleteArtifacts,
  mockTriggerArtifactGeneration,
  mockPublishRealtimeEvent,
} = vi.hoisted(() => ({
  mockGetContract: vi.fn(),
  mockUpdateContract: vi.fn(),
  mockFindProcessingJob: vi.fn(),
  mockUpdateProcessingJob: vi.fn(),
  mockCreateProcessingJob: vi.fn(),
  mockDeleteArtifacts: vi.fn(),
  mockTriggerArtifactGeneration: vi.fn(),
  mockPublishRealtimeEvent: vi.fn(),
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {
    getContract: mockGetContract,
    updateContract: mockUpdateContract,
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    processingJob: {
      findFirst: mockFindProcessingJob,
      update: mockUpdateProcessingJob,
      create: mockCreateProcessingJob,
    },
    artifact: {
      deleteMany: mockDeleteArtifacts,
    },
  },
}));

vi.mock('@/lib/artifact-trigger', () => ({
  triggerArtifactGeneration: mockTriggerArtifactGeneration,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: mockPublishRealtimeEvent,
}));

import { POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(withAuth = true) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/retry', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/[id]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContract.mockResolvedValue({
      success: true,
      data: {
        id: 'contract-1',
        tenantId: 'tenant-1',
        storagePath: 'tenant-1/contract-1.pdf',
        mimeType: 'application/pdf',
      },
    });
    mockFindProcessingJob.mockResolvedValue({ id: 'job-1' });
    mockTriggerArtifactGeneration.mockResolvedValue({ jobId: 'queue-1' });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('retries processing using ctx.tenantId', async () => {
    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetContract).toHaveBeenCalledWith('contract-1', 'tenant-1');
    expect(mockUpdateContract).toHaveBeenCalledWith('contract-1', 'tenant-1', expect.objectContaining({ status: 'PROCESSING' }));
    expect(mockPublishRealtimeEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: { tenantId: 'tenant-1', contractId: 'contract-1' },
    }));
    expect(mockDeleteArtifacts).toHaveBeenCalledWith({ where: { contractId: 'contract-1' } });
  });
});