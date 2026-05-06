import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { WebhookConfigType, webhookStore } from '../../route';

async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
  } catch {
    return null;
  }
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as { params?: Promise<{ id: string }> }).params as { id: string };

  if (!ctx.tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const prisma = await getPrisma();
  let webhook: WebhookConfigType | null = null;

  if (prisma) {
    try {
      webhook = await (prisma as unknown as { webhookConfig: { findFirst: (opts: unknown) => Promise<WebhookConfigType | null> } }).webhookConfig.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
    } catch {
      webhook = null;
    }
  }

  if (!webhook) {
    const stored = webhookStore.get(id);
    if (stored && stored.tenantId === ctx.tenantId) {
      webhook = stored;
    }
  }

  if (!webhook) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
  }

  const payload = {
    id: crypto.randomUUID(),
    event: 'contract.updated',
    timestamp: new Date().toISOString(),
    tenantId: ctx.tenantId,
    data: {
      test: true,
      message: 'Contigo webhook test delivery',
      webhookId: webhook.id,
    },
  };

  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Contigo-Webhook-Test/1.0',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Delivery': payload.id,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (prisma) {
      try {
        await (prisma as unknown as { webhookConfig: { update: (opts: unknown) => Promise<unknown> } }).webhookConfig.update({
          where: { id: webhook.id },
          data: {
            lastDeliveryAt: new Date(),
            failureCount: response.ok ? 0 : webhook.failureCount + 1,
          },
        });
      } catch {
        // Ignore persistence errors for the test route.
      }
    }

    const stored = webhookStore.get(webhook.id);
    if (stored) {
      webhookStore.set(webhook.id, {
        ...stored,
        lastDeliveryAt: new Date(),
        failureCount: response.ok ? 0 : stored.failureCount + 1,
      });
    }

    if (!response.ok) {
      return createErrorResponse(ctx, 'BAD_GATEWAY', `Webhook endpoint returned ${response.status}`, 502);
    }

    return createSuccessResponse(ctx, { delivered: true });
  } catch (error) {
    return createErrorResponse(ctx, 'BAD_GATEWAY', error instanceof Error ? error.message : 'Webhook delivery failed', 502);
  }
});