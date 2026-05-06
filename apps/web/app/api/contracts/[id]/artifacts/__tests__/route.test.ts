import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetContractArtifacts } = vi.hoisted(() => ({
  mockGetContractArtifacts: vi.fn(),
}));

vi.mock('@/lib/data-orchestration', () => ({
  artifactService: {
    getContractArtifacts: mockGetContractArtifacts,
  },
}));

import { GET } from '../route';

function createRequest(withAuth = true, search = '?type=overview&page=2&limit=2') {
  return new NextRequest(`http://localhost:3000/api/contracts/contract-1/artifacts${search}`, {
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
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/artifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContractArtifacts.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'artifact-1',
          type: 'OVERVIEW',
          confidence: 0.91,
          data: { completeness: 88, summary: 'Overview' },
        },
        {
          id: 'artifact-2',
          type: 'RISK',
          confidence: 0.5,
          data: { summary: 'Risk' },
        },
      ],
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns a 500 when the artifact service fails', async () => {
    mockGetContractArtifacts.mockResolvedValue({
      success: false,
      error: { message: 'artifact backend failed' },
    });

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns transformed artifacts and pagination for a tenant-owned contract', async () => {
    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetContractArtifacts).toHaveBeenCalledWith('contract-1', 'tenant-1', {
      type: 'overview',
      page: 2,
      limit: 2,
    });
    expect(data.data.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-1',
        type: 'OVERVIEW',
        confidence: 0.91,
        completeness: 88,
      }),
      expect.objectContaining({
        id: 'artifact-2',
        type: 'RISK',
        confidence: 0.5,
        completeness: 0,
      }),
    ]);
    expect(data.data.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 2,
      hasMore: true,
    });
    expect(data.meta.dataSource).toBe('database');
    expect(data.meta.responseTime).toMatch(/ms$/);
  });
});