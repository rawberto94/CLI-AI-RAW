/**
 * Extraction Webhooks API
 * Manage webhook subscriptions for extraction events
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to avoid build-time resolution issues
async function getWebhookService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).extractionWebhookService;
}

/**
 * GET /api/ai/webhooks
 * List all webhook subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhookId');
    const deliveryHistory = searchParams.get('history') === 'true';
    const tenantId = searchParams.get('tenantId') || 'default';

    const webhookService = await getWebhookService();

    // Get specific webhook with delivery history
    if (webhookId && deliveryHistory) {
      const history = webhookService.getDeliveryHistory(webhookId);
      return NextResponse.json({
        success: true,
        webhookId,
        deliveries: history,
      });
    }

    // Get specific webhook
    if (webhookId) {
      const webhooks = webhookService.getWebhooks(tenantId);
      const webhook = webhooks.find((w: any) => w.id === webhookId);
      
      if (!webhook) {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        webhook,
      });
    }

    // List all webhooks
    const webhooks = webhookService.getWebhooks(tenantId);

    return NextResponse.json({
      success: true,
      webhooks,
      totalCount: webhooks.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve webhooks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/webhooks
 * Register a new webhook subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenantId = 'default', ...data } = body;

    const webhookService = await getWebhookService();

    // Test a webhook
    if (action === 'test') {
      const { webhookId } = data;
      if (!webhookId) {
        return NextResponse.json(
          { error: 'webhookId is required for test action' },
          { status: 400 }
        );
      }

      const result = await webhookService.testWebhook(webhookId);
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Webhook test successful' : 'Webhook test failed',
        response: result,
      });
    }

    // Dispatch an event manually (for testing)
    if (action === 'dispatch') {
      const { eventType, payload } = data;
      if (!eventType) {
        return NextResponse.json(
          { error: 'eventType is required for dispatch action' },
          { status: 400 }
        );
      }

      await webhookService.dispatchEvent(tenantId, eventType, payload || {});
      return NextResponse.json({
        success: true,
        message: `Event ${eventType} dispatched to all subscribed webhooks`,
      });
    }

    // Register new webhook
    const { url, events, secret, headers, retryConfig, metadata } = data;

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'events array is required with at least one event type' },
        { status: 400 }
      );
    }

    const webhookId = webhookService.registerWebhook(tenantId, {
      url,
      events,
      secret,
      headers,
      retryConfig,
      metadata,
    });

    return NextResponse.json({
      success: true,
      webhookId,
      message: 'Webhook registered successfully',
      subscribedEvents: events,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to register webhook' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai/webhooks
 * Update an existing webhook
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhookId, updates } = body;

    if (!webhookId) {
      return NextResponse.json(
        { error: 'webhookId is required' },
        { status: 400 }
      );
    }

    const webhookService = await getWebhookService();
    const success = webhookService.updateWebhook(webhookId, updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Webhook not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      webhookId,
      message: 'Webhook updated successfully',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/webhooks
 * Remove a webhook subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhookId');

    if (!webhookId) {
      return NextResponse.json(
        { error: 'webhookId is required' },
        { status: 400 }
      );
    }

    const webhookService = await getWebhookService();
    const success = webhookService.unregisterWebhook(webhookId);

    if (!success) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook unregistered successfully',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to unregister webhook' },
      { status: 500 }
    );
  }
}
