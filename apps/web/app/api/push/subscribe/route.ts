/**
 * Push Notification Subscription API
 * 
 * POST /api/push/subscribe - Subscribe to push notifications
 * DELETE /api/push/subscribe - Unsubscribe from push notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface PushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNotificationsObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readPushSubscriptionsMap(notifications: Record<string, unknown>): Record<string, unknown> {
  const pushSubscriptions = notifications.pushSubscriptions;
  return isRecord(pushSubscriptions) ? pushSubscriptions : {};
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscription = await request.json() as PushSubscription;

    // Validate subscription
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription' },
        { status: 400 }
      );
    }

    const existing = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { notifications: true },
    });

    const notifications = readNotificationsObject(existing?.notifications);
    const pushSubscriptions = readPushSubscriptionsMap(notifications);

    const nextPushSubscriptions: Record<string, unknown> = {
      ...pushSubscriptions,
      [subscription.endpoint]: subscription,
    };

    const nextNotifications: Record<string, unknown> = {
      ...notifications,
      pushSubscriptions: nextPushSubscriptions,
    };

    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        notifications: nextNotifications as unknown as Prisma.InputJsonValue,
      },
      create: {
        userId: session.user.id,
        notifications: nextNotifications as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info('Push subscription created', {
      userId: session.user.id,
      endpoint: subscription.endpoint.substring(0, 50) + '...',
    });

    return NextResponse.json({
      success: true,
      message: 'Push subscription saved',
    });
  } catch (error) {
    logger.error('Failed to save push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as unknown;
    const endpoint = isRecord(body) && typeof body.endpoint === 'string' ? body.endpoint : undefined;

    const existing = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { notifications: true },
    });

    const notifications = readNotificationsObject(existing?.notifications);
    const pushSubscriptions = readPushSubscriptionsMap(notifications);

    const nextPushSubscriptions: Record<string, unknown> = endpoint
      ? Object.fromEntries(Object.entries(pushSubscriptions).filter(([key]) => key !== endpoint))
      : {};

    const nextNotifications: Record<string, unknown> = {
      ...notifications,
      pushSubscriptions: nextPushSubscriptions,
    };

    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        notifications: nextNotifications as unknown as Prisma.InputJsonValue,
      },
      create: {
        userId: session.user.id,
        notifications: nextNotifications as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info('Push subscription removed', {
      userId: session.user.id,
      endpoint: endpoint?.substring(0, 50) || 'all',
    });

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    logger.error('Failed to remove push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
}
