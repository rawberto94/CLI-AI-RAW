import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDbContractFindFirst, mockCustomContractAnalysis } = vi.hoisted(() => ({
  mockDbContractFindFirst: vi.fn(),
  mockCustomContractAnalysis: vi.fn(),
}));

vi.mock('data-orchestration', () => ({
  dbAdaptor: {
    getClient: () => ({
      contract: {
        findFirst: mockDbContractFindFirst,
      },
    }),
  },
}));

vi.mock('@/lib/ai/custom-analysis', () => ({
  customContractAnalysis: mockCustomContractAnalysis,
  getAnalysisTemplates: vi.fn(),
}));

import { POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/summarize', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/[id]/summarize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      fileName: 'msa.pdf',
      rawText: '',
      artifacts: [{ type: 'OVERVIEW', data: { overview: 'artifact text' } }],
      totalValue: 1000,
      currency: 'USD',
      effectiveDate: new Date('2026-04-29T00:00:00.000Z'),
      expirationDate: new Date('2027-04-29T00:00:00.000Z'),
      aiMetadata: { external_parties: [{ legalName: 'Acme', role: 'Client' }] },
    });
    mockCustomContractAnalysis.mockResolvedValue({
      answer: JSON.stringify({ overview: 'Overview', keyPoints: ['One'] }),
      keyPoints: ['One'],
      suggestedFollowUps: [],
      metadata: { model: 'gpt-4o', tokensUsed: 50, processingTime: 120 },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId and artifact fallback when summarizing', async () => {
    const response = await POST(createRequest(true, { language: 'de' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDbContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockCustomContractAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      contractText: JSON.stringify({ overview: 'artifact text' }, null, 2),
      language: 'de',
      template: 'summary',
    }));
  });
});