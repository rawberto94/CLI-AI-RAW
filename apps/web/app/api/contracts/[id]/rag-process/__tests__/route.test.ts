import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindFirst, mockProcessContractWithSemanticChunking } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockProcessContractWithSemanticChunking: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
  },
}));

vi.mock('@/lib/rag/advanced-rag.service', () => ({
  processContractWithSemanticChunking: mockProcessContractWithSemanticChunking,
}));

import { POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/rag-process', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/[id]/rag-process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      rawText: 'contract body',
      fileName: 'contract.pdf',
      tenantId: 'tenant-1',
      storagePath: 'tenant-1/contract.pdf',
      mimeType: 'application/pdf',
    });
    mockProcessContractWithSemanticChunking.mockResolvedValue({
      chunksCreated: 4,
      embeddingsGenerated: 4,
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId before running semantic chunking', async () => {
    const response = await POST(createRequest(true, { semanticChunking: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockProcessContractWithSemanticChunking).toHaveBeenCalledWith(
      'contract-1',
      'contract body',
      expect.objectContaining({ model: 'text-embedding-3-small' }),
    );
    expect(data.data.contractId).toBe('contract-1');
    expect(data.data.features.semanticChunking).toBe(true);
  });
});