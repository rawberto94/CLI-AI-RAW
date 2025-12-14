/**
 * Webhook Detail API
 */

import { NextRequest, NextResponse } from 'next/server';
import { WEBHOOK_EVENTS, WebhookEvent, WebhookConfig, webhookStore } from '../route';

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
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    
    const prisma = await getPrisma();
    let webhook: WebhookConfig | null = null;
    
    if (prisma) {
      try {
        webhook = await (prisma as unknown as { webhookConfig: { findFirst: (opts: unknown) => Promise<WebhookConfig | null> } }).webhookConfig.findFirst({
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

    return NextResponse.json({ success: true, data: webhook });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch webhook' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const body = await request.json();
    
    const { name, url, events, isActive } = body;
    const updateData: Partial<WebhookConfig> = {};
    
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
        const webhook = await (prisma as unknown as { webhookConfig: { update: (opts: unknown) => Promise<WebhookConfig> } }).webhookConfig.update({
          where: { id, tenantId },
          data: updateData,
        });
        return NextResponse.json({ success: true, data: webhook, message: 'Webhook updated successfully' });
      } catch { /* try in-memory */ }
    }
    
    const stored = webhookStore.get(id);
    if (stored && stored.tenantId === tenantId) {
      const updated = { ...stored, ...updateData };
      webhookStore.set(id, updated);
      return NextResponse.json({ success: true, data: updated, message: 'Webhook updated successfully' });
    }

    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json({ success: false, error: 'Failed to update webhook' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    
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
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete webhook' }, { status: 500 });
  }
}
