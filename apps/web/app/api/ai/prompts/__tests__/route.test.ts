import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockActivateVersion,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-ai-prompts',
    tenantId: 'tenant-1' as string | undefined,
    userId: 'user-1',
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockActivateVersion: vi.fn(),
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
  autoPromptOptimizerService: {
    activateVersion: mockActivateVersion,
  },
}));

import { POST } from '../route';

describe('/api/ai/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.tenantId = 'tenant-1';
  });

  it('returns 400 when tenantId is missing', async () => {
    mockCtx.tenantId = undefined;

    const response = await POST(
      new NextRequest('http://localhost:3000/api/ai/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', artifactType: 'RISK', promptId: 'prompt-1' }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
    expect(mockActivateVersion).not.toHaveBeenCalled();
  });

  it('uses the authenticated tenant when activating a prompt version', async () => {
    mockActivateVersion.mockReturnValue(true);

    const response = await POST(
      new NextRequest('http://localhost:3000/api/ai/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', artifactType: 'RISK', promptId: 'prompt-1' }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockActivateVersion).toHaveBeenCalledWith('prompt-1', 'RISK', 'tenant-1');
  });
});