import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const notifications = await notificationService.getUnreadNotifications(
      ctx.userId
    );

    return createSuccessResponse(ctx, notifications);
  });

export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { notificationId, markAllAsRead } = body;

    if (markAllAsRead) {
      await notificationService.markAllAsRead(ctx.userId);
      return createSuccessResponse(ctx, { success: true });
    }

    if (!notificationId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing notificationId', 400);
    }

    const notification = await prisma.rateCardAlert.findFirst({
      where: {
        id: notificationId,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      },
      select: { id: true },
    });

    if (!notification) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Notification not found', 404);
    }

    await notificationService.markAsRead(notificationId);

    return createSuccessResponse(ctx, { success: true });
  });
