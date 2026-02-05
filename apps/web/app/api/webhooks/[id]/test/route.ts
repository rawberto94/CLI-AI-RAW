/**
 * Webhook Test API
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { WebhookConfigType, webhookStore } from '../../route';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getPrisma() {
  try {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const prisma = await getPrisma();
    let webhook: WebhookConfigType | null = null;
    
    if (prisma) {
      try {
        webhook = await (prisma as unknown as { webhookConfig: { findFirst: (opts: unknown) => Promise<WebhookConfigType | null> } }).webhookConfig.findFirst({
          where: { id, tenantId },
        });
      } catch { /* ignore */ }
    }
    
    if (!webhook) {
      const stored = webhookStore.get(id);
      if (stored && stored.tenantId === tenantId) webhook = stored;
    }
    
    if (!webhook) {
      return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
    }
    
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      webhookId: webhook.id,
      tenantId,
      data: { message: 'Test webhook from Contract Intelligence Platform', testId: crypto.randomUUID() },
    };
    
    const signature = crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(testPayload)).digest('hex');
    const startTime = Date.now();
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ContractIntelligence-Webhook/1.0',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'webhook.test',
          'X-Webhook-Delivery': crypto.randomUUID(),
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });
      
      const deliveryTime = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }
      
      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: 'Webhook endpoint returned an error',
          details: { statusCode: response.status, statusText: response.statusText, response: responseData, deliveryTimeMs: deliveryTime },
        }, { status: 422 });
      }
      
      // Update stats
      const stored = webhookStore.get(id);
      if (stored) webhookStore.set(id, { ...stored, lastDeliveryAt: new Date(), failureCount: 0 });
      
      return NextResponse.json({
        success: true,
        message: 'Test webhook sent successfully',
        details: { statusCode: response.status, response: responseData, deliveryTimeMs: deliveryTime },
      });
    } catch (fetchError) {
      const deliveryTime = Date.now() - startTime;
      const stored = webhookStore.get(id);
      if (stored) webhookStore.set(id, { ...stored, failureCount: stored.failureCount + 1 });
      
      return NextResponse.json({
        success: false,
        error: 'Failed to deliver test webhook',
        details: { message: fetchError instanceof Error ? fetchError.message : 'Unknown error', deliveryTimeMs: deliveryTime },
      }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to test webhook' }, { status: 500 });
  }
}
