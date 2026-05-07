/**
 * Webhooks API
 * 
 * Manages webhook configurations for external integrations.
 * Supports CRUD operations for webhooks and delivery history.
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { webhookService } from 'data-orchestration/services';
// Supported webhook events
export const WEBHOOK_EVENTS = [
  'contract.created',
  'contract.updated',
  'contract.deleted',
  'contract.processed',
  'contract.approved',
  'contract.rejected',
  'contract.expired',
  'contract.renewed',
  'artifact.generated',
  'artifact.updated',
  'ocr.completed',
  'ocr.failed',
  'signature.requested',
  'signature.completed',
  'signature.declined',
  'approval.requested',
  'approval.completed',
  'approval.rejected',
  'rate_card.created',
  'rate_card.updated',
  'rate_card.analyzed',
  'alert.risk_detected',
  'alert.deadline_approaching',
  'alert.compliance_issue',
  // Document classification events
  'document.classified',
  'document.non_contract_detected',
  'document.signature_status_changed',
  'document.reclassified',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

// Local type for webhook config (matches Prisma model but with string[] for events)
export interface WebhookConfigType {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date | null;
  failureCount: number;
  pendingDeliveryCount?: number;
  deadDeliveryCount?: number;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
}

// In-memory storage for webhooks (fallback if database not available)
export const webhookStore = new Map<string, WebhookConfigType>();

async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
  } catch {
    return null;
  }
}

/**
 * GET /api/webhooks
 * List all webhooks for a tenant
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  // Authenticate user via session
  // Get tenantId from session (secure) with fallback to header for backward compat
  const tenantId = ctx.tenantId;

  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  let webhooks: WebhookConfigType[] = [];

  const prisma = await getPrisma();

  if (prisma) {
    try {
      webhooks = await prisma.webhookConfig.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (webhooks.length > 0) {
        const deliveryHealth = await (prisma as unknown as {
          webhookDelivery: {
            groupBy: (args: unknown) => Promise<Array<{
              webhookId: string;
              status: string;
              _count: { _all: number };
              _max: {
                lastAttemptAt: Date | null;
                sentAt: Date | null;
                deadAt: Date | null;
              };
            }>>;
          };
        }).webhookDelivery.groupBy({
          by: ['webhookId', 'status'],
          where: {
            tenantId,
            webhookId: { in: webhooks.map(webhook => webhook.id) },
          },
          _count: { _all: true },
          _max: {
            lastAttemptAt: true,
            sentAt: true,
            deadAt: true,
          },
        });

        const healthByWebhookId = new Map<string, {
          pendingDeliveryCount: number;
          deadDeliveryCount: number;
          lastSuccessAt: Date | null;
          lastFailureAt: Date | null;
        }>();

        for (const row of deliveryHealth) {
          const health = healthByWebhookId.get(row.webhookId) ?? {
            pendingDeliveryCount: 0,
            deadDeliveryCount: 0,
            lastSuccessAt: null,
            lastFailureAt: null,
          };

          if (row.status === 'pending' || row.status === 'failed') {
            health.pendingDeliveryCount += row._count._all;
            if (row._max.lastAttemptAt && (!health.lastFailureAt || row._max.lastAttemptAt > health.lastFailureAt)) {
              health.lastFailureAt = row._max.lastAttemptAt;
            }
          }

          if (row.status === 'dead') {
            health.deadDeliveryCount += row._count._all;
            const deadAt = row._max.deadAt ?? row._max.lastAttemptAt;
            if (deadAt && (!health.lastFailureAt || deadAt > health.lastFailureAt)) {
              health.lastFailureAt = deadAt;
            }
          }

          if (row.status === 'success') {
            const successAt = row._max.sentAt ?? row._max.lastAttemptAt;
            if (successAt && (!health.lastSuccessAt || successAt > health.lastSuccessAt)) {
              health.lastSuccessAt = successAt;
            }
          }

          healthByWebhookId.set(row.webhookId, health);
        }

        webhooks = webhooks.map(webhook => ({
          ...webhook,
          pendingDeliveryCount: healthByWebhookId.get(webhook.id)?.pendingDeliveryCount ?? 0,
          deadDeliveryCount: healthByWebhookId.get(webhook.id)?.deadDeliveryCount ?? 0,
          lastSuccessAt: healthByWebhookId.get(webhook.id)?.lastSuccessAt ?? null,
          lastFailureAt: healthByWebhookId.get(webhook.id)?.lastFailureAt ?? null,
        }));
      }
    } catch {
      webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId);
    }
  } else {
    webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId);
  }

  // Mask secrets before returning - never expose webhook secrets in API responses
  const safeWebhooks = webhooks.map(w => ({
    ...w,
    secret: w.secret ? `${w.secret.substring(0, 4)}...${w.secret.substring(w.secret.length - 4)}` : undefined,
  }));

  return createSuccessResponse(ctx, {
    success: true,
    data: safeWebhooks,
    meta: {
      total: webhooks.length,
      supportedEvents: WEBHOOK_EVENTS,
    },
  });
});

/**
 * POST /api/webhooks
 * Create a new webhook configuration
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  // Authenticate user via session
  // Only admins can manage webhooks
  if (ctx.userRole !== 'ADMIN' && ctx.userRole !== 'SUPER_ADMIN') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  // Get tenantId from session (secure) with fallback to header for backward compat
  const tenantId = ctx.tenantId;

  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const body = await request.json();

  const { name, url, events, isActive = true } = body;

  if (!name || typeof name !== 'string') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Name is required', 400);
  }

  if (!url || typeof url !== 'string') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'URL is required', 400);
  }

  try {
    new URL(url);
  } catch {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid URL format', 400);
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'At least one event is required', 400);
  }

  const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid events: ${invalidEvents.join(', ')}`, 400);
  }

  const secret = crypto.randomBytes(32).toString('hex');

  const webhook: WebhookConfigType = {
    id: crypto.randomUUID(),
    tenantId,
    name,
    url,
    secret,
    events: events as WebhookEvent[],
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    failureCount: 0,
  };

  const prisma = await getPrisma();

  if (prisma) {
    try {
      const dbWebhook = await (prisma as unknown as { webhookConfig: { create: (opts: unknown) => Promise<WebhookConfigType> } }).webhookConfig.create({
        data: webhook,
      });
      // Note: Secret is returned once on creation so user can store it - subsequent GETs will mask it
      return createSuccessResponse(ctx, { 
        success: true, 
        data: dbWebhook, 
        message: 'Webhook created successfully. Save the secret now - it will not be shown again.',
        _warning: 'Store this secret securely. It will be masked in future responses.'
      }, { status: 201 });
    } catch {
      webhookStore.set(webhook.id, webhook);
    }
  } else {
    webhookStore.set(webhook.id, webhook);
  }

  // Note: Secret is returned once on creation so user can store it - subsequent GETs will mask it
  return createSuccessResponse(ctx, { 
    success: true, 
    data: webhook, 
    message: 'Webhook created successfully. Save the secret now - it will not be shown again.',
    _warning: 'Store this secret securely. It will be masked in future responses.'
  }, { status: 201 });
});

/**
 * DELETE /api/webhooks
 * Delete a webhook by ID (passed in query string)
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get('id');

  if (!webhookId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Webhook ID is required', 400);
  }

  const prisma = await getPrisma();

  if (prisma) {
    try {
      await (prisma as unknown as { webhookConfig: { delete: (opts: unknown) => Promise<unknown> } }).webhookConfig.delete({
        where: { id: webhookId, tenantId },
      });
      return createSuccessResponse(ctx, { success: true, message: 'Webhook deleted successfully' });
    } catch {
      // Try in-memory
    }
  }

  const webhook = webhookStore.get(webhookId);
  if (webhook && webhook.tenantId === tenantId) {
    webhookStore.delete(webhookId);
    return createSuccessResponse(ctx, { success: true, message: 'Webhook deleted successfully' });
  }

  return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
});
