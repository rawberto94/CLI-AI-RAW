import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { createNotificationWithPush, notifyByRole } from '@/lib/push-notification.service';

// POST /api/notifications/send - Send notification with optional push
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
  }

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

  // Verify the target user belongs to the caller's tenant before creating
  // a notification linking them — otherwise a tenant-A admin could spam or
  // create orphaned notifications targeting tenant-B users.
  const targetUser = await prisma.user.findFirst({
    where: { id: String(userId), tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!targetUser) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  await createNotificationWithPush(targetUser.id, ctx.tenantId, {
    title, message, type: type || 'SYSTEM', priority, actionUrl,
  });

  return createSuccessResponse(ctx, { sent: true });
});
