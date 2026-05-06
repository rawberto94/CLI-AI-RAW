/**
 * Individual Obligation Notification API - Update/delete specific notifications
 * 
 * GET /api/obligations/notifications/[id] - Get notification details
 * PATCH /api/obligations/notifications/[id] - Update notification
 * DELETE /api/obligations/notifications/[id] - Delete notification
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// GET /api/obligations/notifications/[id] - Get notification
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { id } = await (ctx as any).params as { id: string };

  const notification = await prisma.obligationNotification.findFirst({
    where: { id, tenantId },
  });

  if (!notification) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Notification not found', 404);
  }

  return createSuccessResponse(ctx, {
    success: true,
    data: { notification },
  });
})

// PATCH /api/obligations/notifications/[id] - Update notification
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { id } = await (ctx as any).params as { id: string };
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.obligationNotification.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Notification not found', 404);
  }

  const {
    status,
    scheduledFor,
    message,
    sentAt,
  } = body;

  const updateData: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!['PENDING', 'SENT', 'FAILED', 'CANCELLED'].includes(status)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid status', 400);
    }
    updateData.status = status;
    
    if (status === 'SENT' && !sentAt) {
      updateData.sentAt = new Date();
    }
  }

  if (scheduledFor !== undefined) updateData.scheduledFor = new Date(scheduledFor);
  if (message !== undefined) updateData.message = message;
  if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;

  const notification = await prisma.obligationNotification.update({
    where: { id },
    data: updateData,
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: { notification },
  });
})

// DELETE /api/obligations/notifications/[id] - Delete notification
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { id } = await (ctx as any).params as { id: string };

  // Verify ownership
  const existing = await prisma.obligationNotification.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Notification not found', 404);
  }

  await prisma.obligationNotification.delete({
    where: { id },
  });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Notification deleted',
  });
})
