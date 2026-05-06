import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockArtifactFindUnique,
  mockRunIntelligencePipeline,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockArtifactFindUnique: vi.fn(),
  mockRunIntelligencePipeline: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    artifact: {
      findUnique: mockArtifactFindUnique,
    },
  },
}));

vi.mock('@/lib/ai/intelligence-brief.service', () => ({
  runIntelligencePipeline: mockRunIntelligencePipeline,
}));

import { GET, POST } from '../route';

function authRequest(url: string, init?: RequestInit) {
  const extraHeaders = new Headers(init?.headers || {});
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-tenant-id': 'tenant-1',
      'x-user-id': 'user-1',
      ...Object.fromEntries(extraHeaders.entries()),
    },
  } as RequestInit);
}

describe('/api/contracts/intelligence-brief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockArtifactFindUnique.mockResolvedValue(null);
    mockRunIntelligencePipeline.mockResolvedValue({ success: true, brief: 'summary' });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/contracts/intelligence-brief?contractId=contract-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns not_generated for a tenant-owned contract with no artifact', async () => {
    const response = await GET(authRequest('http://localhost:3000/api/contracts/intelligence-brief?contractId=contract-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1', isDeleted: false },
    }));
    expect(data.data).toEqual({ brief: null, status: 'not_generated' });
  });

  it('requires a tenant-owned contract before generation', async () => {
    mockContractFindFirst.mockResolvedValueOnce(null);

    const response = await POST(authRequest('http://localhost:3000/api/contracts/intelligence-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId: 'foreign-contract' }),
    }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockRunIntelligencePipeline).not.toHaveBeenCalled();
  });
});