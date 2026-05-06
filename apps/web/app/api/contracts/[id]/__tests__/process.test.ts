import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetContract,
  mockTriggerArtifactGeneration,
} = vi.hoisted(() => ({
  mockGetContract: vi.fn(),
  mockTriggerArtifactGeneration: vi.fn(),
}));

vi.mock('@/lib/data-orchestration', () => ({
  contractService: {
    getContract: mockGetContract,
  },
}));

vi.mock('@/lib/artifact-trigger', () => ({
  triggerArtifactGeneration: mockTriggerArtifactGeneration,
  PROCESSING_PRIORITY: {
    HIGH: 100,
  },
}));

import { POST } from '../process/route';

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-auth',
    },
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'POST' });
}

const BASE = 'http://localhost:3000/api/contracts/c1/process';
const params = Promise.resolve({ id: 'c1' });

describe('POST /api/contracts/[id]/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContract.mockResolvedValue({
      success: true,
      data: {
        id: 'c1',
        storagePath: '/tmp/contract.pdf',
        mimeType: 'application/pdf',
      },
    });
    mockTriggerArtifactGeneration.mockResolvedValue({
      status: 'queued',
      jobId: 'job-1',
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(noAuthReq(BASE), { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses the authenticated tenant context for contract lookup and queueing', async () => {
    const response = await POST(authReq(BASE), { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetContract).toHaveBeenCalledWith('c1', 'tenant-auth');
    expect(mockTriggerArtifactGeneration).toHaveBeenCalledWith(expect.objectContaining({
      contractId: 'c1',
      tenantId: 'tenant-auth',
      priority: 100,
      isReprocess: true,
      source: 'reprocess',
    }));
  });
});