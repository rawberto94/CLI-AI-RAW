import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuthenticateApiToken,
  mockRequireScope,
  mockEnforceApiV1RateLimit,
  mockWebhookDeliveryFindMany,
} = vi.hoisted(() => ({
  mockAuthenticateApiToken: vi.fn(),
  mockRequireScope: vi.fn(),
  mockEnforceApiV1RateLimit: vi.fn(),
  mockWebhookDeliveryFindMany: vi.fn(),
}));

vi.mock('@/lib/api/v1/auth', () => ({
  authenticateApiToken: mockAuthenticateApiToken,
  requireScope: mockRequireScope,
}));

vi.mock('@/lib/api/v1/rate-limit', () => ({
  enforceApiV1RateLimit: mockEnforceApiV1RateLimit,
  withRateLimitHeaders: (response: Response) => response,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    webhookDelivery: {
      findMany: mockWebhookDeliveryFindMany,
    },
  },
}));

import { GET } from '../route';

function createRow(id: string) {
  const timestamp = new Date('2026-05-08T10:00:00.000Z');
  return {
    id,
    webhookId: 'webhook-1',
    event: 'contract.updated',
    status: 'pending',
    attempt: 1,
    maxAttempts: 8,
    statusCode: 503,
    error: 'HTTP 503',
    deliveryId: `delivery-${id}`,
    payload: { dispatchId: 'dispatch-1' },
    sentAt: null,
    lastAttemptAt: timestamp,
    nextAttemptAt: timestamp,
    deadAt: null,
    createdAt: timestamp,
  };
}

describe('GET /api/v1/webhook-deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiToken.mockResolvedValue({
      ok: true,
      auth: {
        tenantId: 'tenant-1',
        tokenId: 'token-1',
        scopes: new Set(['webhooks:read']),
      },
    });
    mockRequireScope.mockReturnValue(null);
    mockEnforceApiV1RateLimit.mockResolvedValue({
      exceeded: null,
      result: {
        ok: true,
        limit: 600,
        remaining: 599,
        resetSeconds: 60,
      },
    });
  });

  it('returns nextCursor = null on the terminal page', async () => {
    mockWebhookDeliveryFindMany.mockResolvedValue([createRow('row-1'), createRow('row-2')]);

    const response = await GET(new Request('http://localhost:3000/api/v1/webhook-deliveries?limit=2'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasMore).toBe(false);
    expect(data.nextCursor).toBeNull();
    expect(data.data).toHaveLength(2);
  });

  it('returns the last visible row id as nextCursor when another page exists', async () => {
    mockWebhookDeliveryFindMany.mockResolvedValue([
      createRow('row-1'),
      createRow('row-2'),
      createRow('row-3'),
    ]);

    const response = await GET(new Request('http://localhost:3000/api/v1/webhook-deliveries?limit=2'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasMore).toBe(true);
    expect(data.nextCursor).toBe('row-2');
    expect(data.data).toHaveLength(2);
  });
});
