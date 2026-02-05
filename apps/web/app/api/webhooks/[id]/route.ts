/**
 * Webhook Detail API
 */

import { NextRequest, NextResponse } from 'next/server';
import { WEBHOOK_EVENTS, WebhookEvent, WebhookConfigType, webhookStore } from '../route';

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

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Mask secret before returning - never expose full webhook secrets
    const safeWebhook = {
      ...webhook,
      secret: webhook.secret ? `${webhook.secret.substring(0, 4)}...${webhook.secret.substring(webhook.secret.length - 4)}` : undefined,
    };

    return NextResponse.json({ success: true, data: safeWebhook });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch webhook' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    const { name, url, events, isActive } = body;
    const updateData: Partial<WebhookConfigType> = {};
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ success: false, error: 'Invalid name' }, { status: 400 });
      }
      updateData.name = name;
    }
    
    if (url !== undefined) {
      try { new URL(url); updateData.url = url; } catch {
        return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
      }
    }
    
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json({ success: false, error: 'At least one event is required' }, { status: 400 });
      }
      const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return NextResponse.json({ success: false, error: `Invalid events: ${invalidEvents.join(', ')}` }, { status: 400 });
      }
      updateData.events = events as WebhookEvent[];
    }
    
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }
    
    updateData.updatedAt = new Date();
    
    const prisma = await getPrisma();
    
    if (prisma) {
      try {
        const webhook = await (prisma as unknown as { webhookConfig: { update: (opts: unknown) => Promise<WebhookConfigType> } }).webhookConfig.update({
          where: { id, tenantId },
          data: updateData,
        });
        // Mask secret in response
        const safeWebhook = { ...webhook, secret: webhook.secret ? `${webhook.secret.substring(0, 4)}...` : undefined };
        return NextResponse.json({ success: true, data: safeWebhook, message: 'Webhook updated successfully' });
      } catch { /* try in-memory */ }
    }
    
    const stored = webhookStore.get(id);
    if (stored && stored.tenantId === tenantId) {
      const updated = { ...stored, ...updateData };
      webhookStore.set(id, updated);
      // Mask secret in response
      const safeUpdated = { ...updated, secret: updated.secret ? `${updated.secret.substring(0, 4)}...` : undefined };
      return NextResponse.json({ success: true, data: safeUpdated, message: 'Webhook updated successfully' });
    }

    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update webhook' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    
    if (prisma) {
      try {
        await (prisma as unknown as { webhookConfig: { delete: (opts: unknown) => Promise<unknown> } }).webhookConfig.delete({
          where: { id, tenantId },
        });
        return NextResponse.json({ success: true, message: 'Webhook deleted successfully' });
      } catch { /* try in-memory */ }
    }
    
    const stored = webhookStore.get(id);
    if (stored && stored.tenantId === tenantId) {
      webhookStore.delete(id);
      return NextResponse.json({ success: true, message: 'Webhook deleted successfully' });
    }

    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete webhook' }, { status: 500 });
  }
}
