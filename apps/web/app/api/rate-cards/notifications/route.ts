/**
 * Benchmark Notifications API
 * GET /api/rate-cards/notifications
 * 
 * Returns notifications for benchmark updates and market shifts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { BenchmarkNotificationService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type') as any;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Initialize service
    const notificationService = new BenchmarkNotificationService(prisma);

    // Get notifications
    const notifications = notificationService.getNotifications(tenantId, {
      limit,
      unreadOnly,
      type,
    });

    // Get statistics
    const stats = notificationService.getNotificationStatistics(tenantId);

    return NextResponse.json({
      notifications,
      statistics: stats,
      unreadCount: stats.unread,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * Mark notification as read
 * POST /api/rate-cards/notifications
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, action, tenantId } = body;

    const notificationService = new BenchmarkNotificationService(prisma);

    if (action === 'markAsRead' && notificationId) {
      const success = notificationService.markAsRead(notificationId);
      return NextResponse.json({ success });
    }

    if (action === 'markAllAsRead' && tenantId) {
      const count = notificationService.markAllAsRead(tenantId);
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json(
      { error: 'Invalid action or missing parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
