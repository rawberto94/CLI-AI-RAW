/**
 * Webhooks API
 * 
 * Manages webhook configurations for external integrations.
 * Supports CRUD operations for webhooks and delivery history.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export interface WebhookConfig {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date;
  failureCount: number;
}

// In-memory storage for webhooks (until database migration is run)
export const webhookStore = new Map<string, WebhookConfig>();

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
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    
    let webhooks: WebhookConfig[] = [];
    
    const prisma = await getPrisma();
    
    if (prisma) {
      try {
        webhooks = await (prisma as unknown as { webhookConfig: { findMany: (opts: unknown) => Promise<WebhookConfig[]> } }).webhookConfig.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId);
      }
    } else {
      webhooks = Array.from(webhookStore.values()).filter(w => w.tenantId === tenantId);
    }

    return NextResponse.json({
      success: true,
      data: webhooks,
      meta: {
        total: webhooks.length,
        supportedEvents: WEBHOOK_EVENTS,
      },
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook configuration
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const body = await request.json();
    
    const { name, url, events, isActive = true } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }
    
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one event is required' },
        { status: 400 }
      );
    }
    
    const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid events: ${invalidEvents.join(', ')}`, validEvents: WEBHOOK_EVENTS },
        { status: 400 }
      );
    }
    
    const secret = crypto.randomBytes(32).toString('hex');
    
    const webhook: WebhookConfig = {
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
        const dbWebhook = await (prisma as unknown as { webhookConfig: { create: (opts: unknown) => Promise<WebhookConfig> } }).webhookConfig.create({
          data: webhook,
        });
        return NextResponse.json({ success: true, data: dbWebhook, message: 'Webhook created successfully' }, { status: 201 });
      } catch {
        webhookStore.set(webhook.id, webhook);
      }
    } else {
      webhookStore.set(webhook.id, webhook);
    }

    return NextResponse.json({ success: true, data: webhook, message: 'Webhook created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ success: false, error: 'Failed to create webhook' }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks
 * Delete a webhook by ID (passed in query string)
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');
    
    if (!webhookId) {
      return NextResponse.json({ success: false, error: 'Webhook ID is required' }, { status: 400 });
    }
    
    const prisma = await getPrisma();
    
    if (prisma) {
      try {
        await (prisma as unknown as { webhookConfig: { delete: (opts: unknown) => Promise<unknown> } }).webhookConfig.delete({
          where: { id: webhookId, tenantId },
        });
        return NextResponse.json({ success: true, message: 'Webhook deleted successfully' });
      } catch {
        // Try in-memory
      }
    }
    
    const webhook = webhookStore.get(webhookId);
    if (webhook && webhook.tenantId === tenantId) {
      webhookStore.delete(webhookId);
      return NextResponse.json({ success: true, message: 'Webhook deleted successfully' });
    }
    
    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete webhook' }, { status: 500 });
  }
}
