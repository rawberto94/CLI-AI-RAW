import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockAuth,
  mockUserFindUnique,
  mockWebhookDeliveryFindMany,
  mockWebhookDeliveryGroupBy,
  mockWebhookDeliveryCount,
  mockWebhookConfigCount,
  mockWebhookConfigFindMany,
  mockApiTokenCount,
  mockApiTokenFindMany,
  mockApiTokenCreate,
  mockApiTokenFindFirst,
  mockApiTokenUpdate,
  mockApiTokenUsageAggregate,
  mockApiTokenUsageGroupBy,
  mockApiTokenUsageFindMany,
  mockIntegrationEventCount,
  mockIntegrationEventAggregate,
  mockIntegrationEventFindMany,
  mockIntegrationEventFindFirst,
  mockRequeueDeadDelivery,
  mockRequeueMatchingDeadDeliveries,
  mockTriggerWebhook,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockWebhookDeliveryFindMany: vi.fn(),
  mockWebhookDeliveryGroupBy: vi.fn(),
  mockWebhookDeliveryCount: vi.fn(),
  mockWebhookConfigCount: vi.fn(),
  mockWebhookConfigFindMany: vi.fn(),
  mockApiTokenCount: vi.fn(),
  mockApiTokenFindMany: vi.fn(),
  mockApiTokenCreate: vi.fn(),
  mockApiTokenFindFirst: vi.fn(),
  mockApiTokenUpdate: vi.fn(),
  mockApiTokenUsageAggregate: vi.fn(),
  mockApiTokenUsageGroupBy: vi.fn(),
  mockApiTokenUsageFindMany: vi.fn(),
  mockIntegrationEventCount: vi.fn(),
  mockIntegrationEventAggregate: vi.fn(),
  mockIntegrationEventFindMany: vi.fn(),
  mockIntegrationEventFindFirst: vi.fn(),
  mockRequeueDeadDelivery: vi.fn(),
  mockRequeueMatchingDeadDeliveries: vi.fn(),
  mockTriggerWebhook: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    webhookConfig: {
      count: mockWebhookConfigCount,
      findMany: mockWebhookConfigFindMany,
    },
    webhookDelivery: {
      findMany: mockWebhookDeliveryFindMany,
      groupBy: mockWebhookDeliveryGroupBy,
      count: mockWebhookDeliveryCount,
    },
    apiToken: {
      count: mockApiTokenCount,
      findMany: mockApiTokenFindMany,
      create: mockApiTokenCreate,
      findFirst: mockApiTokenFindFirst,
      update: mockApiTokenUpdate,
    },
    apiTokenUsageBucket: {
      aggregate: mockApiTokenUsageAggregate,
      groupBy: mockApiTokenUsageGroupBy,
      findMany: mockApiTokenUsageFindMany,
    },
    integrationEvent: {
      count: mockIntegrationEventCount,
      aggregate: mockIntegrationEventAggregate,
      findMany: mockIntegrationEventFindMany,
      findFirst: mockIntegrationEventFindFirst,
    },
  },
}));

vi.mock('@/lib/webhooks/delivery', () => ({
  requeueDeadDelivery: mockRequeueDeadDelivery,
  requeueMatchingDeadDeliveries: mockRequeueMatchingDeadDeliveries,
}));

vi.mock('@/lib/webhook-triggers', () => ({
  triggerWebhook: mockTriggerWebhook,
}));

vi.mock('@/app/api/webhooks/route', () => ({
  WEBHOOK_EVENTS: ['contract.created', 'contract.updated'],
}));

vi.mock('@/lib/api/v1/auth', () => ({
  generateApiToken: vi.fn(() => ({ raw: 'raw-token', prefix: 'ctg' })),
  hashApiToken: vi.fn(async () => 'hashed-token'),
}));

import { GET as getOutboundOverview } from '../outbound-overview/route';
import { GET as getWebhookDeliveries } from '../webhook-deliveries/route';
import { POST as bulkRequeueWebhookDeliveries } from '../webhook-deliveries/requeue/route';
import { POST as requeueWebhookDelivery } from '../webhook-deliveries/[id]/requeue/route';
import { GET as getIntegrationEvents } from '../integration-events/route';
import { POST as replayIntegrationEvent } from '../integration-events/[id]/replay/route';
import { GET as getApiTokens, POST as createApiToken } from '../api-tokens/route';
import { DELETE as revokeApiToken } from '../api-tokens/[id]/route';
import { GET as getApiTokenUsage } from '../api-tokens/[id]/usage/route';

describe('admin session routes require admin scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } });
    mockUserFindUnique.mockResolvedValue({ role: 'member', tenantId: 'tenant-1' });
  });

  it('blocks non-admin access to outbound overview before querying aggregates', async () => {
    const response = await getOutboundOverview(new NextRequest('http://localhost:3000/api/admin/outbound-overview'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockWebhookConfigCount).not.toHaveBeenCalled();
    expect(mockIntegrationEventCount).not.toHaveBeenCalled();
  });

  it('blocks non-admin access to webhook deliveries before loading rows', async () => {
    const response = await getWebhookDeliveries(new NextRequest('http://localhost:3000/api/admin/webhook-deliveries'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockWebhookDeliveryFindMany).not.toHaveBeenCalled();
    expect(mockWebhookDeliveryGroupBy).not.toHaveBeenCalled();
  });

  it('blocks non-admin bulk requeue before mutating deliveries', async () => {
    const response = await bulkRequeueWebhookDeliveries(
      new NextRequest('http://localhost:3000/api/admin/webhook-deliveries/requeue', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockRequeueMatchingDeadDeliveries).not.toHaveBeenCalled();
  });

  it('blocks non-admin single-item requeue before mutating deliveries', async () => {
    const response = await requeueWebhookDelivery(
      new NextRequest('http://localhost:3000/api/admin/webhook-deliveries/delivery-1/requeue', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'delivery-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockRequeueDeadDelivery).not.toHaveBeenCalled();
  });

  it('blocks non-admin access to integration events before loading rows', async () => {
    const response = await getIntegrationEvents(new NextRequest('http://localhost:3000/api/admin/integration-events'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockIntegrationEventFindMany).not.toHaveBeenCalled();
  });

  it('blocks non-admin event replay before loading the event', async () => {
    const response = await replayIntegrationEvent(
      new NextRequest('http://localhost:3000/api/admin/integration-events/1/replay', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockIntegrationEventFindFirst).not.toHaveBeenCalled();
    expect(mockTriggerWebhook).not.toHaveBeenCalled();
  });

  it('blocks non-admin API token listing before reading tenant tokens', async () => {
    const response = await getApiTokens(new NextRequest('http://localhost:3000/api/admin/api-tokens'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockApiTokenFindMany).not.toHaveBeenCalled();
    expect(mockApiTokenUsageGroupBy).not.toHaveBeenCalled();
  });

  it('blocks non-admin API token creation before issuing a token', async () => {
    const response = await createApiToken(
      new NextRequest('http://localhost:3000/api/admin/api-tokens', {
        method: 'POST',
        body: JSON.stringify({ name: 'Ops token', scopes: ['webhooks:read'] }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockApiTokenCreate).not.toHaveBeenCalled();
  });

  it('blocks non-admin API token revoke before looking up the token', async () => {
    const response = await revokeApiToken(
      new NextRequest('http://localhost:3000/api/admin/api-tokens/token-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'token-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockApiTokenFindFirst).not.toHaveBeenCalled();
    expect(mockApiTokenUpdate).not.toHaveBeenCalled();
  });

  it('blocks non-admin API token usage reads before loading usage buckets', async () => {
    const response = await getApiTokenUsage(
      new NextRequest('http://localhost:3000/api/admin/api-tokens/token-1/usage', {
        method: 'GET',
      }),
      { params: Promise.resolve({ id: 'token-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe('Admin access required');
    expect(mockApiTokenFindFirst).not.toHaveBeenCalled();
    expect(mockApiTokenUsageFindMany).not.toHaveBeenCalled();
  });
});
