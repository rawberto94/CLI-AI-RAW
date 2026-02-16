/**
 * Individual Obligation Notification API - Update/delete specific notifications
 * 
 * GET /api/obligations/notifications/[id] - Get notification details
 * PATCH /api/obligations/notifications/[id] - Update notification
 * DELETE /api/obligations/notifications/[id] - Delete notification
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// GET /api/obligations/notifications/[id] - Get notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// PATCH /api/obligations/notifications/[id] - Update notification
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {

    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.obligationNotification.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Notification not found', 404);
    }

    const {
      status, // 'PENDING', 'SENT', 'FAILED', 'CANCELLED'
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
      
      // Auto-set timestamps based on status
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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// DELETE /api/obligations/notifications/[id] - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
