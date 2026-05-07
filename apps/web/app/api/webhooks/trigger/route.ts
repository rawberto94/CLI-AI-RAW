/**
 * Webhook Trigger API - Internal endpoint
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { WEBHOOK_EVENTS, WebhookEvent, WebhookConfigType, webhookStore } from '../route';
import { withApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

interface TriggerPayload {
  event: WebhookEvent;
  data: Record<string, unknown>;
  tenantId?: string;
}

async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
  } catch {
    return null;
  }
}

export const POST = withApiHandler(async (request: NextRequest, ctx) => {
  const internalSecret = request.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  // In production, INTERNAL_API_SECRET must be set and match
  if (process.env.NODE_ENV === 'production') {
    if (!expectedSecret) {
      logger.error('INTERNAL_API_SECRET not configured in production');
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Server misconfiguration', 500);
    }
    if (
      !internalSecret ||
      internalSecret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(internalSecret), Buffer.from(expectedSecret))
    ) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
  } else if (
    !expectedSecret ||
    !internalSecret ||
    internalSecret.length !== expectedSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(internalSecret), Buffer.from(expectedSecret))
  ) {
    // In development, INTERNAL_API_SECRET must still be set
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body: TriggerPayload = await request.json();
  const requestedTenantId = body.tenantId || (ctx.tenantId && ctx.tenantId !== 'unknown' && ctx.tenantId !== 'demo' ? ctx.tenantId : undefined);

  if (!requestedTenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const prisma = await getPrisma();
  if (prisma) {
    const tenant = await (prisma as unknown as { tenant: { findUnique: (opts: unknown) => Promise<{ id: string } | null> } }).tenant.findUnique({
      where: { id: requestedTenantId },
      select: { id: true },
    });

    if (!tenant) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }
  }

  const tenantId = requestedTenantId;

  const { event, data } = body;

  if (!event || !WEBHOOK_EVENTS.includes(event)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid event: ${event}`, 400);
  }

  if (!data || typeof data !== 'object') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Data object is required', 400);
  }
  let webhooks: WebhookConfigType[] = [];

  if (prisma) {
    try {
      webhooks = await (prisma as unknown as { webhookConfig: { findMany: (opts: unknown) => Promise<WebhookConfigType[]> } }).webhookConfig.findMany({
        where: { tenantId, isActive: true, events: { has: event } },
      });
    } catch {
      webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId && w.isActive && w.events.includes(event));
    }
  } else {
    webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId && w.isActive && w.events.includes(event));
  }

  if (webhooks.length === 0) {
    return createSuccessResponse(ctx, { success: true, message: 'No active webhooks subscribed to this event', delivered: 0 });
  }

  const dispatchId = crypto.randomUUID();

  const { enqueueAndAttempt } = await import('@/lib/webhooks/delivery');

  const results = await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const startTime = Date.now();
      try {
        const outcome = await enqueueAndAttempt({
          tenantId,
          webhook: { id: webhook.id, url: webhook.url, secret: webhook.secret },
          event,
          payload: data,
          dispatchId,
        });
        const deliveryTimeMs = Date.now() - startTime;

        // Mirror legacy in-memory failureCount/lastDeliveryAt tracking.
        const stored = webhookStore.get(webhook.id);
        if (stored) {
          if (outcome.status === 'success') {
            webhookStore.set(webhook.id, { ...stored, lastDeliveryAt: new Date(), failureCount: 0 });
          } else {
            webhookStore.set(webhook.id, { ...stored, failureCount: stored.failureCount + 1 });
          }
        }

        return {
          webhookId: webhook.id,
          deliveryRowId: outcome.deliveryRowId,
          deliveryId: outcome.deliveryId,
          dispatchId: outcome.dispatchId,
          success: outcome.status === 'success',
          status: outcome.status,
          statusCode: outcome.statusCode,
          error: outcome.error,
          deliveryTimeMs,
        };
      } catch (error) {
        const deliveryTimeMs = Date.now() - startTime;
        const stored = webhookStore.get(webhook.id);
        if (stored) webhookStore.set(webhook.id, { ...stored, failureCount: stored.failureCount + 1 });
        return {
          webhookId: webhook.id,
          success: false,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          deliveryTimeMs,
        };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
  const failed = results.length - successful;

  return createSuccessResponse(ctx, {
    message: `Webhooks triggered for event: ${event}`,
    dispatchId,
    delivered: successful,
    failed,
    details: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' }),
  });
});
