import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { withAuthApiHandler, createSuccessResponse, handleApiError, createErrorResponse } from '@/lib/api-middleware';
import { notificationService } from 'data-orchestration/services';
import { notificationBuffer } from '@/lib/notifications/notification-engine';

export const dynamic = 'force-dynamic';

/**
 * Notification Types:
 * - APPROVAL_REQUEST: New approval request assigned
 * - APPROVAL_COMPLETED: Approval completed by someone in chain
 * - COMMENT_MENTION: @mentioned in a comment
 * - COMMENT_REPLY: Reply to your comment
 * - CONTRACT_DEADLINE: Contract deadline approaching
 * - CONTRACT_UPDATE: Contract was updated
 * - WORKFLOW_STEP: Workflow step requires action
 * - SHARE_INVITE: Document shared with you
 * - SYSTEM: System notifications
 */

/**
 * GET /api/notifications - Get user notifications
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    const { searchParams } = new URL(request.url);
    
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const type = searchParams.get('type');

    // Try database first
    try {
      const where: Record<string, unknown> = { tenantId, userId };
      if (unreadOnly) where.isRead = false;
      if (type) where.type = type;

      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const unreadCount = await prisma.notification.count({
        where: { tenantId, userId, isRead: false },
      });

      return createSuccessResponse(ctx, {
        notifications,
        unreadCount,
        agentNotifications: notificationBuffer.getRecent(tenantId, userId, 20),
        agentUnreadCount: notificationBuffer.getUnreadCount(tenantId, userId),
        total: notifications.length,
        source: 'database',
      });
    } catch (error) {
      // DB failed — fall back to in-memory agent notifications only
      return createSuccessResponse(ctx, {
        notifications: [],
        unreadCount: 0,
        agentNotifications: notificationBuffer.getRecent(tenantId, userId, 50),
        agentUnreadCount: notificationBuffer.getUnreadCount(tenantId, userId),
        total: 0,
        source: 'buffer-only',
      });
    }
  } catch (error) {
    return handleApiError(ctx, error);
  }
})

/**
 * POST /api/notifications - Create a notification
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const body = await request.json();
    
    const { userId, type, title, message, link, metadata, recipients } = body;

    if (!title || !message) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Title and message are required', 400);
    }

    // Support bulk notifications to multiple recipients
    const targetUsers = recipients || (userId ? [userId] : []);
    
    if (targetUsers.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'At least one recipient is required', 400);
    }

    const tenantRecipients = await prisma.user.findMany({
      where: {
        id: { in: targetUsers.map((uid: string) => String(uid)) },
        tenantId,
      },
      select: { id: true },
    });

    if (tenantRecipients.length !== targetUsers.length) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'One or more recipients were not found', 404);
    }

    try {
      const notifications = await prisma.notification.createMany({
        data: tenantRecipients.map(({ id }) => ({
          tenantId,
          userId: id,
          type: type || 'SYSTEM',
          title,
          message,
          link,
          metadata: metadata || {},
          isRead: false,
        })),
      });

      void publishRealtimeEvent({
        event: 'notification:new',
        data: { tenantId },
        source: 'api:notifications',
      });

      return createSuccessResponse(ctx, {
        message: `${notifications.count} notification(s) created`,
        count: notifications.count,
        source: 'database',
      });
    } catch {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database operation failed', 503);
    }
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create notification', 500);
  }
})

/**
 * PATCH /api/notifications - Mark notifications as read
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    const body = await request.json();
    
    const { notificationIds, markAllRead } = body;

    try {
      if (markAllRead) {
        const result = await prisma.notification.updateMany({
          where: { tenantId, userId, isRead: false },
          data: { isRead: true },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return createSuccessResponse(ctx, {
          message: `${result.count} notifications marked as read`,
          count: result.count,
          source: 'database',
        });
      }

      if (notificationIds && notificationIds.length > 0) {
        const result = await prisma.notification.updateMany({
          where: { id: { in: notificationIds }, tenantId, userId },
          data: { isRead: true },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return createSuccessResponse(ctx, {
          message: `${result.count} notifications marked as read`,
          count: result.count,
          source: 'database',
        });
      }

      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Either notificationIds or markAllRead is required', 400);
    } catch {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database operation failed', 503);
    }
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update notifications', 500);
  }
})

/**
 * DELETE /api/notifications - Delete notifications
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    const { searchParams } = new URL(request.url);
    
    const notificationId = searchParams.get('id');
    const deleteRead = searchParams.get('deleteRead') === 'true';

    try {
      if (notificationId) {
        await prisma.notification.delete({
          where: { id: notificationId, tenantId, userId },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return createSuccessResponse(ctx, {
          message: 'Notification deleted',
          source: 'database',
        });
      }

      if (deleteRead) {
        const result = await prisma.notification.deleteMany({
          where: { tenantId, userId, isRead: true },
        });

        void publishRealtimeEvent({
          event: 'notification:new',
          data: { tenantId },
          source: 'api:notifications',
        });

        return createSuccessResponse(ctx, {
          message: `${result.count} read notifications deleted`,
          count: result.count,
          source: 'database',
        });
      }

      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Either id or deleteRead parameter is required', 400);
    } catch {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database operation failed', 503);
    }
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete notification', 500);
  }
})
