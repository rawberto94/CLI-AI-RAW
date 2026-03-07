/**
 * Benchmark Notifications API
 * GET /api/rate-cards/notifications
 * 
 * Returns notifications for benchmark updates and market shifts
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { benchmarkNotificationService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = await getApiTenantId(request);
    const limit = parseInt(searchParams.get('limit') || '100');
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
    const { notificationId, action, tenantId } = body;

    const notificationService = new benchmarkNotificationService(prisma);

    if (action === 'markAsRead' && notificationId) {
      const success = notificationService.markAsRead(notificationId);
      return createSuccessResponse(ctx, { success });
    }

    if (action === 'markAllAsRead' && tenantId) {
      const count = notificationService.markAllAsRead(tenantId);
      return createSuccessResponse(ctx, { success: true, count });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action or missing parameters', 400);
  });
