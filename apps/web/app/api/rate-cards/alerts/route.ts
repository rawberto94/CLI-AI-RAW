import { NextRequest } from 'next/server';
import { notificationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing userId', 400);
    }

    const notifications = await notificationService.getUnreadNotifications(
      userId
    );

    return createSuccessResponse(ctx, notifications);
  });

export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { notificationId, userId, markAllAsRead } = body;

    if (markAllAsRead && userId) {
      await notificationService.markAllAsRead(userId);
      return createSuccessResponse(ctx, { success: true });
    }

    if (!notificationId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing notificationId', 400);
    }

    await notificationService.markAsRead(notificationId);

    return createSuccessResponse(ctx, { success: true });
  });
