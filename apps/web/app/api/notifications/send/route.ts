import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { createNotificationWithPush, notifyByRole } from '@/lib/push-notification.service';

// POST /api/notifications/send - Send notification with optional push
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action, userId, role, title, message, type, priority, actionUrl } = body;

  if (!title || !message) {
    return createErrorResponse(ctx, 'MISSING_FIELDS', 'title and message required', 400);
  }

  if (action === 'notify-role' && role) {
    const result = await notifyByRole(ctx.tenantId, role, {
      title, message, type: type || 'SYSTEM', priority, actionUrl,
    });
    return createSuccessResponse(ctx, result);
  }

  if (!userId) {
    return createErrorResponse(ctx, 'MISSING_USER', 'userId or action=notify-role required', 400);
  }

  await createNotificationWithPush(userId, ctx.tenantId, {
    title, message, type: type || 'SYSTEM', priority, actionUrl,
  });

  return createSuccessResponse(ctx, { sent: true });
});
