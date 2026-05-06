/**
 * Benchmark Notifications API
 * GET /api/rate-cards/notifications
 * 
 * Returns notifications for benchmark updates and market shifts
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { benchmarkNotificationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
  const tenantId = ctx.tenantId;
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100') || 100), 200);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type') as any;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    // Initialize service
    const notificationService = new benchmarkNotificationService(prisma);

    // Get notifications
    const notifications = notificationService.getNotifications(tenantId, {
      limit,
      unreadOnly,
      type,
    });

    // Get statistics
    const stats = notificationService.getNotificationStatistics(tenantId);

    return createSuccessResponse(ctx, {
      notifications,
      statistics: stats,
      unreadCount: stats.unread,
    });
  });

/**
 * Mark notification as read
 * POST /api/rate-cards/notifications
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
  const { notificationId, action } = body;

    const notificationService = new benchmarkNotificationService(prisma);

    if (action === 'markAsRead' && notificationId) {
      const notification = notificationService
        .getNotifications(ctx.tenantId, { limit: 10000 })
        .find(item => item.id === notificationId);

      if (!notification) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Notification not found', 404);
      }

      const success = notificationService.markAsRead(notificationId);
      return createSuccessResponse(ctx, { success });
    }

    if (action === 'markAllAsRead') {
      const count = notificationService.markAllAsRead(ctx.tenantId);
      return createSuccessResponse(ctx, { success: true, count });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action or missing parameters', 400);
  });
