import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockDbContractFindFirst,
  mockCustomContractAnalysis,
  mockGetAnalysisTemplates,
} = vi.hoisted(() => ({
  mockDbContractFindFirst: vi.fn(),
  mockCustomContractAnalysis: vi.fn(),
  mockGetAnalysisTemplates: vi.fn(),
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
  continueConversation: vi.fn(),
  getAnalysisTemplates: mockGetAnalysisTemplates,
}));

import { GET, POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(method: 'GET' | 'POST', withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/analyze', {
    method,
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

describe('/api/contracts/[id]/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      fileName: 'msa.pdf',
      rawText: '',
      contractArtifacts: [{ type: 'OVERVIEW', value: { clause: 'artifact text' } }],
    });
    mockCustomContractAnalysis.mockResolvedValue({
      answer: 'analysis answer',
      metadata: { model: 'gpt-4o', tokensUsed: 35, processingTime: 90 },
    });
    mockGetAnalysisTemplates.mockReturnValue([{ id: 'custom', label: 'Custom' }]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest('POST', false, { prompt: 'What matters?' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId and artifact fallback for custom analysis', async () => {
    const response = await POST(createRequest('POST', true, { prompt: 'What matters?', format: 'json' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDbContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockCustomContractAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'What matters?',
      contractText: JSON.stringify({ clause: 'artifact text' }, null, 2),
      format: 'json',
    }));
  });

  it('returns the template catalog on GET', async () => {
    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.templates).toEqual([{ id: 'custom', label: 'Custom' }]);
    expect(data.data.supportedLanguages).toContain('de');
  });
});