import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const notifications = await notificationService.getUnreadNotifications(
      userId
    );

    return NextResponse.json(notifications);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, userId, markAllAsRead } = body;

    if (markAllAsRead && userId) {
      await notificationService.markAllAsRead(userId);
      return NextResponse.json({ success: true });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Missing notificationId' },
        { status: 400 }
      );
    }

    await notificationService.markAsRead(notificationId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update alert' },
      { status: 500 }
    );
  }
}
