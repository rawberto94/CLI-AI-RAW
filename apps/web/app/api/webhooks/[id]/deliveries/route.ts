/**
 * Webhook Deliveries API
 */

import { NextRequest } from 'next/server';
import { WebhookConfigType, webhookStore } from '../../route';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

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
  const ctx = getApiContext(request);
  try {

    const { id } = await params;
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');
    
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
    }
    
    interface WebhookDelivery { id: string; webhookId: string; event: string; status: string; createdAt: Date; }
    let deliveries: WebhookDelivery[] = [];
    let total = 0;
    
    if (prisma) {
      try {
        const where: Record<string, unknown> = { webhookId: id };
        if (status) where.status = status;
        
        [deliveries, total] = await Promise.all([
          (prisma as unknown as { webhookDelivery: { findMany: (opts: unknown) => Promise<WebhookDelivery[]> } }).webhookDelivery.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          (prisma as unknown as { webhookDelivery: { count: (opts: unknown) => Promise<number> } }).webhookDelivery.count({ where }),
        ]);
      } catch { deliveries = []; total = 0; }
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: deliveries,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), webhookId: id },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
