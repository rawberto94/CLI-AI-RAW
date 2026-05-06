import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockRecordUsage,
  mockGetBudgetStatus,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-ai-costs',
    tenantId: 'tenant-1' as string | undefined,
    userId: 'user-1',
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockRecordUsage: vi.fn(),
  mockGetBudgetStatus: vi.fn(),
}));

vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-middleware')>('@/lib/api-middleware');

  return {
    ...actual,
    withAuthApiHandler: (handler: (request: NextRequest, context: any) => Promise<Response>) => {
      return (request: NextRequest) => handler(request, mockCtx);
    },
  };
});

vi.mock('data-orchestration/services', () => ({
  aiCostOptimizerService: {
    recordUsage: mockRecordUsage,
    getBudgetStatus: mockGetBudgetStatus,
  },
}));

vi.mock('@/lib/ai/model-router.service', () => ({
  getCostSummary: vi.fn(),
  getHistoricalCostSummary: vi.fn(),
}));

import { GET, POST } from '../route';

describe('/api/ai/costs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.tenantId = 'tenant-1';
    mockGetBudgetStatus.mockReturnValue({ dailySpend: 0, dailyLimit: 100, dailyRemaining: 100, percentUsed: 0, status: 'ok' });
  });

  it('returns 400 on GET when tenantId is missing', async () => {
    mockCtx.tenantId = undefined;

    const response = await GET(new NextRequest('http://localhost:3000/api/ai/costs?action=budget'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(mockGetBudgetStatus).not.toHaveBeenCalled();
  });

  it('records usage against the authenticated tenant instead of a system fallback', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/ai/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-usage',
          model: 'gpt-4o-mini',
          taskType: 'artifact-extraction',
          inputTokens: 100,
          outputTokens: 25,
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRecordUsage).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      taskType: 'artifact-extraction',
      inputTokens: 100,
      outputTokens: 25,
      tenantId: 'tenant-1',
    });
  });
});