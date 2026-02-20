/**
 * Agent Notifications API
 * 
 * GET /api/ai/notifications — Get agent notifications for the current user
 * POST /api/ai/notifications — Mark notifications as read
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  getUnreadCount,
  type NotificationFilter,
} from '@/lib/ai/agent-notifications';

/**
 * GET — Retrieve agent notifications
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;

  // Rate limit: 60 req/min per user (lightweight)
  const rl = checkRateLimit(tenantId, userId, '/api/ai/notifications', AI_RATE_LIMITS.lightweight);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);
  const { searchParams } = new URL(request.url);

  const filter: NotificationFilter = {
    tenantId,
    userId,
    unreadOnly: searchParams.get('unread') === 'true',
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 50),
  };

  const types = searchParams.get('types');
  if (types) {
    filter.types = types.split(',') as NotificationFilter['types'];
  }

  const severities = searchParams.get('severities');
  if (severities) {
    filter.severities = severities.split(',') as NotificationFilter['severities'];
  }

  const notifications = await getNotifications(filter);
  const unreadCount = await getUnreadCount(tenantId, userId);

  return NextResponse.json({
    notifications,
    unreadCount,
    total: notifications.length,
  });
});

/**
 * POST — Mark notifications as read
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;
  const body = await request.json();

  if (body.markAllRead) {
    const count = await markAllRead(tenantId, userId);
    return NextResponse.json({ success: true, markedRead: count });
  }

  if (body.notificationId) {
    const success = await markNotificationRead(tenantId, body.notificationId);
    return NextResponse.json({ success });
  }

  return NextResponse.json({ error: 'Provide notificationId or markAllRead: true' }, { status: 400 });
});
