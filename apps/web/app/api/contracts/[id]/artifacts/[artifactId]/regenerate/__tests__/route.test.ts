import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockArtifactFindFirst,
  mockArtifactUpdate,
  mockGenerateArtifact,
  mockQueueRAGReindex,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockArtifactFindFirst: vi.fn(),
  mockArtifactUpdate: vi.fn(),
  mockGenerateArtifact: vi.fn(),
  mockQueueRAGReindex: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    artifact: {
      findFirst: mockArtifactFindFirst,
      update: mockArtifactUpdate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  aiArtifactGeneratorService: {
    generateArtifact: mockGenerateArtifact,
  },
}));

vi.mock('@/lib/rag/reindex-helper', () => ({
  queueRAGReindex: mockQueueRAGReindex,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET, POST } from '../route';

function createPostRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/artifacts/artifact-1/regenerate', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': 'admin',
          'Content-Type': 'application/json',
        }
      : undefined,
  });
}

function createGetRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/artifacts/artifact-1/regenerate', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': 'admin',
        }
      : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1', artifactId: 'artifact-1' }),
};

describe('/api/contracts/[id]/artifacts/[artifactId]/regenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      fileName: 'msa.pdf',
      rawText: 'Contract text',
      status: 'ACTIVE',
    });
    mockArtifactFindFirst.mockResolvedValue({
      id: 'artifact-1',
      type: 'OVERVIEW',
      validationStatus: 'COMPLETED',
      data: { summary: 'Existing artifact' },
      updatedAt: new Date('2026-04-29T12:00:00.000Z'),
    });
    mockArtifactUpdate.mockResolvedValue(undefined);
    mockGenerateArtifact.mockResolvedValue({
      success: true,
      artifact: {
        data: { summary: 'New artifact' },
      },
    });
    mockQueueRAGReindex.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createPostRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the artifact is not in the tenant contract', async () => {
    mockArtifactFindFirst.mockResolvedValue(null);

    const response = await POST(createPostRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockArtifactUpdate).not.toHaveBeenCalled();
  });

  it('starts background regeneration and marks the artifact as processing', async () => {
    const response = await POST(createPostRequest(), routeContext);
    const data = await response.json();
    await vi.dynamicImportSettled();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('Artifact regeneration started');
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockArtifactUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'artifact-1' },
      data: expect.objectContaining({ validationStatus: 'PROCESSING' }),
    }));
    expect(mockGenerateArtifact).toHaveBeenCalledWith('contract-1', 'tenant-1', 'OVERVIEW', {
      rawText: 'Contract text',
    });
    expect(mockQueueRAGReindex).toHaveBeenCalledWith({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      reason: 'artifact OVERVIEW regenerated',
    });
    expect(mockArtifactUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'artifact-1' },
      data: expect.objectContaining({ validationStatus: 'COMPLETED' }),
    }));
  });

  it('returns current regeneration status for a tenant-owned artifact', async () => {
    const response = await GET(createGetRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(expect.objectContaining({
      artifactId: 'artifact-1',
      type: 'OVERVIEW',
      status: 'COMPLETED',
    }));
  });

  it('returns 404 when regeneration status is requested for a missing artifact', async () => {
    mockArtifactFindFirst.mockResolvedValue(null);

    const response = await GET(createGetRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });
});