import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockGenerateArtifact,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockGenerateArtifact: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  aiArtifactGeneratorService: {
    generateArtifact: mockGenerateArtifact,
  },
}));

import { POST } from '../route';

function createRequest(withAuth = true, body: Record<string, unknown> = { artifactType: 'OVERVIEW' }) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/artifacts/regenerate', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': 'admin',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(body),
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/artifacts/regenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      rawText: 'Contract text',
      status: 'ACTIVE',
    });
    mockGenerateArtifact.mockResolvedValue({
      success: true,
      data: { summary: 'Regenerated artifact' },
      confidence: 0.89,
      completeness: 0.94,
      validation: { ok: true },
      method: 'ai',
      processingTime: 1200,
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockGenerateArtifact).not.toHaveBeenCalled();
  });

  it('returns 400 when the contract has no extracted text', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      rawText: null,
      status: 'ACTIVE',
    });

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(mockGenerateArtifact).not.toHaveBeenCalled();
  });

  it('regenerates the artifact using authenticated tenant and user context', async () => {
    const response = await POST(createRequest(true, { artifactType: 'OVERVIEW' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockGenerateArtifact).toHaveBeenCalledWith(
      'OVERVIEW',
      'Contract text',
      'contract-1',
      'tenant-1',
      expect.objectContaining({
        preferredMethod: 'ai',
        enableFallback: true,
        userId: 'user-1',
      }),
    );
    expect(data.data.artifact).toEqual({ summary: 'Regenerated artifact' });
  });
});