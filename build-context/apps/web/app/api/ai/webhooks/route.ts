/**
 * Extraction Webhooks API
 * Manage webhook subscriptions for extraction events
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import to avoid build-time resolution issues
async function getWebhookService() {
  const services = await import('data-orchestration/services');
  return (services as any).extractionWebhookService;
}

/**
 * GET /api/ai/webhooks
 * List all webhook subscriptions
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhookId');
    const deliveryHistory = searchParams.get('history') === 'true';

    const webhookService = await getWebhookService();

    // Get specific webhook with delivery history
    if (webhookId && deliveryHistory) {
      const history = webhookService.getDeliveryHistory(webhookId);
      return createSuccessResponse(ctx, {
        webhookId,
        deliveries: history });
    }

    // Get specific webhook
    if (webhookId) {
      const webhooks = webhookService.getWebhooks(tenantId);
      const webhook = webhooks.find((w: any) => w.id === webhookId);
      
      if (!webhook) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
      }
      
      return createSuccessResponse(ctx, {
        webhook });
    }

    // List all webhooks
    const webhooks = webhookService.getWebhooks(tenantId);

    return createSuccessResponse(ctx, {
      webhooks,
      totalCount: webhooks.length });
  });

/**
 * POST /api/ai/webhooks
 * Register a new webhook subscription
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action, ...data } = body;

    const webhookService = await getWebhookService();

    // Test a webhook
    if (action === 'test') {
      const { webhookId } = data;
      if (!webhookId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'webhookId is required for test action', 400);
      }

      const result = await webhookService.testWebhook(webhookId);
      return createSuccessResponse(ctx, {
        success: result.success,
        message: result.success ? 'Webhook test successful' : 'Webhook test failed',
        response: result });
    }

    // Dispatch an event manually (for testing)
    if (action === 'dispatch') {
      const { eventType, payload } = data;
      if (!eventType) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'eventType is required for dispatch action', 400);
      }

      await webhookService.dispatchEvent(tenantId, eventType, payload || {});
      return createSuccessResponse(ctx, {
        message: `Event ${eventType} dispatched to all subscribed webhooks` });
    }

    // Register new webhook
    const { url, events, secret, headers, retryConfig, metadata } = data;

    if (!url) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'url is required', 400);
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'events array is required with at least one event type', 400);
    }

    const webhookId = webhookService.registerWebhook(tenantId, {
      url,
      events,
      secret,
      headers,
      retryConfig,
      metadata });

    return createSuccessResponse(ctx, {
      webhookId,
      message: 'Webhook registered successfully',
      subscribedEvents: events });
  });

/**
 * PATCH /api/ai/webhooks
 * Update an existing webhook
 */
export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { webhookId, updates } = body;

    if (!webhookId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'webhookId is required', 400);
    }

    const webhookService = await getWebhookService();
    const success = webhookService.updateWebhook(webhookId, updates);

    if (!success) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found or update failed', 404);
    }

    return createSuccessResponse(ctx, {
      webhookId,
      message: 'Webhook updated successfully' });
  });

/**
 * DELETE /api/ai/webhooks
 * Remove a webhook subscription
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhookId');

    if (!webhookId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'webhookId is required', 400);
    }

    const webhookService = await getWebhookService();
    const success = webhookService.unregisterWebhook(webhookId);

    if (!success) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
    }

    return createSuccessResponse(ctx, {
      message: 'Webhook unregistered successfully' });
  });
