/**
 * Webhook Trigger API - Internal endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { WEBHOOK_EVENTS, WebhookEvent, WebhookConfig, webhookStore } from '../route';

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

export async function POST(request: NextRequest) {
  try {
    const internalSecret = request.headers.get('x-internal-secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    
    // In production, INTERNAL_API_SECRET must be set and match
    if (process.env.NODE_ENV === 'production') {
      if (!expectedSecret) {
        console.error('INTERNAL_API_SECRET not configured in production');
        return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
      }
      if (internalSecret !== expectedSecret) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    } else if (internalSecret !== (expectedSecret || 'dev-internal-secret')) {
      // In development, allow fallback but still validate
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body: TriggerPayload = await request.json();
    const tenantId = body.tenantId || request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const { event, data } = body;
    
    if (!event || !WEBHOOK_EVENTS.includes(event)) {
      return NextResponse.json({ success: false, error: `Invalid event: ${event}`, validEvents: WEBHOOK_EVENTS }, { status: 400 });
    }
    
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ success: false, error: 'Data object is required' }, { status: 400 });
    }
    
    const prisma = await getPrisma();
    let webhooks: WebhookConfig[] = [];
    
    if (prisma) {
      try {
        webhooks = await (prisma as unknown as { webhookConfig: { findMany: (opts: unknown) => Promise<WebhookConfig[]> } }).webhookConfig.findMany({
          where: { tenantId, isActive: true, events: { has: event } },
        });
      } catch {
        webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId && w.isActive && w.events.includes(event));
      }
    } else {
      webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId && w.isActive && w.events.includes(event));
    }
    
    if (webhooks.length === 0) {
      return NextResponse.json({ success: true, message: 'No active webhooks subscribed to this event', delivered: 0 });
    }
    
    const timestamp = new Date().toISOString();
    const deliveryId = crypto.randomUUID();
    const payload = { id: deliveryId, event, timestamp, tenantId, data };
    
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const signature = crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(payload)).digest('hex');
        const startTime = Date.now();
        
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'ContractIntelligence-Webhook/1.0',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': event,
              'X-Webhook-Delivery': deliveryId,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          
          const deliveryTime = Date.now() - startTime;
          
          const stored = webhookStore.get(webhook.id);
          if (stored) {
            if (response.ok) {
              webhookStore.set(webhook.id, { ...stored, lastDeliveryAt: new Date(), failureCount: 0 });
            } else {
              webhookStore.set(webhook.id, { ...stored, failureCount: stored.failureCount + 1 });
            }
          }
          
          return { webhookId: webhook.id, success: response.ok, statusCode: response.status, deliveryTimeMs: deliveryTime };
        } catch (error) {
          const deliveryTime = Date.now() - startTime;
          const stored = webhookStore.get(webhook.id);
          if (stored) webhookStore.set(webhook.id, { ...stored, failureCount: stored.failureCount + 1 });
          
          return { webhookId: webhook.id, success: false, error: error instanceof Error ? error.message : 'Unknown error', deliveryTimeMs: deliveryTime };
        }
      })
    );
    
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      message: `Webhooks triggered for event: ${event}`,
      delivered: successful,
      failed,
      details: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' }),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to trigger webhooks' }, { status: 500 });
  }
}
