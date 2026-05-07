import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCompletionCreate,
  mockCtx,
} = vi.hoisted(() => ({
  mockCompletionCreate: vi.fn(),
  mockCtx: {
    requestId: 'req-draft-interview',
    tenantId: 'tenant-1' as string | undefined,
    userId: 'user-1',
    startTime: 0,
    dataMode: 'real' as const,
  },
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

vi.mock('@/lib/openai-client', () => ({
  createOpenAIClient: () => ({
    chat: {
      completions: {
        create: mockCompletionCreate,
      },
    },
  }),
  hasAIClientConfig: () => true,
  getDeploymentName: () => 'gpt-4o',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from '../route';

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/agents/draft-interview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createContentFilterError() {
  return Object.assign(new Error('content_filter: blocked by responsible AI policy'), {
    code: 'content_filter',
    status: 400,
  });
}

describe('/api/ai/agents/draft-interview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.tenantId = 'tenant-1';
  });

  it('passes the user\'s raw wording through on the first attempt and only neutralizes on the strict retry after a content-filter false positive', async () => {
    mockCompletionCreate
      .mockRejectedValueOnce(createContentFilterError())
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                content: 'Understood — should this confidentiality agreement be mutual or one-way?',
                finalized: false,
                partialBrief: { contractType: 'NDA' },
                quickAnswers: ['Mutual', 'One-way'],
              }),
            },
          },
        ],
      });

    const response = await POST(createRequest({ messages: [], originalPrompt: 'NDA for consultancy support', detected: {} }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockCompletionCreate).toHaveBeenCalledTimes(2);

    const firstMessages = mockCompletionCreate.mock.calls[0][0].messages;
    const secondMessages = mockCompletionCreate.mock.calls[1][0].messages;

    // First attempt: user wording is sent through verbatim
    expect(firstMessages[1].content).toContain('NDA for consultancy support');
    // Strict retry: replaced with a neutral category summary, not the raw text
    expect(secondMessages[1].content).toContain('avoid repeating the user\'s raw wording');
    expect(secondMessages[1].content).toContain('confidentiality agreement');
  });

  it('falls back to a deterministic interview turn when the content filter trips even after the neutral retry', async () => {
    mockCompletionCreate
      .mockRejectedValueOnce(createContentFilterError())
      .mockRejectedValueOnce(createContentFilterError());

    const response = await POST(createRequest({ messages: [], originalPrompt: 'NDA for consultancy support', detected: {} }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.data.content).toBe('string');
    expect(data.data.content.length).toBeGreaterThan(0);
    expect(data.data.finalized).toBe(false);
    expect(mockCompletionCreate).toHaveBeenCalledTimes(2);
  });
});