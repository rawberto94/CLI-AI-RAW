import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractCount,
  mockContractFindMany,
  mockGetContractQueue,
  mockQueueMetadataExtraction,
} = vi.hoisted(() => ({
  mockContractCount: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockGetContractQueue: vi.fn(),
  mockQueueMetadataExtraction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: mockContractCount,
      findMany: mockContractFindMany,
    },
  },
}));

vi.mock('@/lib/queue/contract-queue', () => ({
  getContractQueue: mockGetContractQueue,
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

function createRequest(
  method: 'GET' | 'POST',
  role?: string,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/bulk-extract-metadata', {
    method,
    headers: role
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': role,
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/bulk-extract-metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContractQueue.mockReturnValue({
      queueMetadataExtraction: mockQueueMetadataExtraction,
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for non-admin GET requests', async () => {
    const response = await GET(createRequest('GET', 'member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockContractCount).not.toHaveBeenCalled();
  });

  it('returns tenant metadata extraction statistics for admins', async () => {
    mockContractCount
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3);
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        contractTitle: 'Master Services Agreement',
        updatedAt: new Date('2026-04-28T12:00:00.000Z'),
        contractMetadata: {
          systemFields: { effectiveDate: '2026-01-01' },
          customFields: { region: 'EMEA' },
        },
      },
    ]);

    const response = await GET(createRequest('GET', 'admin'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.statistics.totalContracts).toBe(20);
    expect(data.data.statistics.contractsWithMetadata).toBe(12);
  });

  it('returns 403 for non-admin POST requests', async () => {
    const response = await POST(createRequest('POST', 'member', {
      filter: { missingMetadata: true },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockContractFindMany).not.toHaveBeenCalled();
  });

  it('queues metadata extraction jobs for admins', async () => {
    mockContractFindMany.mockResolvedValue([
      { id: 'contract-1', contractMetadata: null, rawText: 'x'.repeat(200) },
      { id: 'contract-2', contractMetadata: null, rawText: 'y'.repeat(200) },
    ]);
    mockQueueMetadataExtraction
      .mockResolvedValueOnce('job-1')
      .mockResolvedValueOnce('job-2');

    const response = await POST(createRequest('POST', 'admin', {
      filter: { missingMetadata: true },
      priority: 'normal',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.queued).toBe(2);
    expect(mockQueueMetadataExtraction).toHaveBeenCalledTimes(2);
  });
});