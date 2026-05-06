import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindMany,
  mockCreateOpenAIClient,
  mockHasAIClientConfig,
  mockGetOpenAIApiKey,
  mockOpenAICompletionCreate,
} = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockCreateOpenAIClient: vi.fn(),
  mockHasAIClientConfig: vi.fn(),
  mockGetOpenAIApiKey: vi.fn(),
  mockOpenAICompletionCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
  },
}));

vi.mock('@/lib/openai-client', () => ({
  createOpenAIClient: mockCreateOpenAIClient,
  getOpenAIApiKey: mockGetOpenAIApiKey,
  hasAIClientConfig: mockHasAIClientConfig,
}));

import { GET, POST } from '../route';

function createRequest(method: 'GET' | 'POST', withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/ai-report', {
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

describe('/api/contracts/ai-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        fileName: 'msa.pdf',
        contractTitle: 'Master Agreement',
        rawText: 'contract text',
        status: 'ACTIVE',
        totalValue: 1000,
        expirationRisk: 'LOW',
        contractType: 'MSA',
        supplierName: 'Vendor',
        expirationDate: new Date('2027-04-29T00:00:00.000Z'),
        startDate: new Date('2026-04-29T00:00:00.000Z'),
        createdAt: new Date('2026-04-29T00:00:00.000Z'),
      },
    ]);

    mockHasAIClientConfig.mockReturnValue(true);
    mockGetOpenAIApiKey.mockReturnValue('test-key');
    mockOpenAICompletionCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              executiveSummary: 'summary',
              keyFindings: [],
              contractHighlights: [],
              actionItems: [],
              recommendations: [],
            }),
          },
        },
      ],
    });
    mockCreateOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: mockOpenAICompletionCreate,
        },
      },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest('POST', false, { contractIds: ['contract-1'] }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId for report contract selection', async () => {
    const response = await POST(createRequest('POST', true, { contractIds: ['contract-1'] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['contract-1'] }, tenantId: 'tenant-1' },
    }));
    expect(mockOpenAICompletionCreate).toHaveBeenCalled();
    expect(data.data.report.contractCount).toBe(1);
  });

  it('returns the descriptor on GET', async () => {
    const response = await GET(createRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.endpoint).toBe('/api/contracts/ai-report');
  });
});