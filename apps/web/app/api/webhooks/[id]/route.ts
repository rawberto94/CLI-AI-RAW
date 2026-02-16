/**
 * Webhook Detail API
 */

import { NextRequest } from 'next/server';
import { WEBHOOK_EVENTS, WebhookEvent, WebhookConfigType, webhookStore } from '../route';
import { getServerSession } from '@/lib/auth';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, handleApiError, createErrorResponse, createValidationErrorResponse } from '@/lib/api-middleware';
import { z } from 'zod';

const webhookUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'No valid fields to update',
});

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
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
    }

    // Mask secret before returning - never expose full webhook secrets
    const safeWebhook = {
      ...webhook,
      secret: webhook.secret ? `${webhook.secret.substring(0, 4)}...${webhook.secret.substring(webhook.secret.length - 4)}` : undefined,
    };

    return createSuccessResponse(ctx, safeWebhook);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const body = await request.json();

    const parsed = webhookUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return createValidationErrorResponse(ctx, parsed.error);
    }
    
    const { name, url, events, isActive } = parsed.data;
    const updateData: Partial<WebhookConfigType> = {};
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid name', 400);
      }
      updateData.name = name;
    }
    
    if (url !== undefined) {
      try { new URL(url); updateData.url = url; } catch {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid URL format', 400);
      }
    }
    
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'At least one event is required', 400);
      }
      const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid events: ${invalidEvents.join(', ')}`, 400);
      }
      updateData.events = events as WebhookEvent[];
    }
    
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    if (Object.keys(updateData).length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No valid fields to update', 400);
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
        return createSuccessResponse(ctx, { ...safeWebhook, message: 'Webhook updated successfully' });
      } catch { /* try in-memory */ }
    }
    
    const stored = webhookStore.get(id);
    if (stored && stored.tenantId === tenantId) {
      const updated = { ...stored, ...updateData };
      webhookStore.set(id, updated);
      // Mask secret in response
      const safeUpdated = { ...updated, secret: updated.secret ? `${updated.secret.substring(0, 4)}...` : undefined };
      return createSuccessResponse(ctx, { ...safeUpdated, message: 'Webhook updated successfully' });
    }

    return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update webhook', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    const prisma = await getPrisma();
    
    if (prisma) {
      try {
        await (prisma as unknown as { webhookConfig: { delete: (opts: unknown) => Promise<unknown> } }).webhookConfig.delete({
          where: { id, tenantId },
        });
        return createSuccessResponse(ctx, { message: 'Webhook deleted successfully' });
      } catch { /* try in-memory */ }
    }
    
    const stored = webhookStore.get(id);
    if (stored && stored.tenantId === tenantId) {
      webhookStore.delete(id);
      return createSuccessResponse(ctx, { message: 'Webhook deleted successfully' });
    }

    return createErrorResponse(ctx, 'NOT_FOUND', 'Webhook not found', 404);
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete webhook', 500);
  }
}
