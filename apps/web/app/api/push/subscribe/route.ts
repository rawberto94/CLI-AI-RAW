/**
 * Push Notification Subscription API
 * 
 * POST /api/push/subscribe - Subscribe to push notifications
 * DELETE /api/push/subscribe - Unsubscribe from push notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
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

    // Store subscription in database
    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: session.user.id,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        keys: subscription.keys,
        expirationTime: subscription.expirationTime 
          ? new Date(subscription.expirationTime) 
          : null,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        expirationTime: subscription.expirationTime 
          ? new Date(subscription.expirationTime) 
          : null,
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
    // Handle case where PushSubscription model doesn't exist yet
    if (error instanceof Error && error.message.includes('PushSubscription')) {
      logger.warn('PushSubscription model not found, storing in user preferences');
      
      // Fallback: store in user preferences
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        const subscription = await request.json() as PushSubscription;
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            pushSubscription: subscription as unknown as object,
          },
        });
        
        return NextResponse.json({
          success: true,
          message: 'Push subscription saved (fallback)',
        });
      }
    }

    logger.error('Failed to save push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { endpoint } = await request.json();

    if (endpoint) {
      // Delete specific subscription
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: session.user.id,
          endpoint,
        },
      });
    } else {
      // Delete all subscriptions for user
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: session.user.id,
        },
      });
    }

    logger.info('Push subscription removed', {
      userId: session.user.id,
      endpoint: endpoint?.substring(0, 50) || 'all',
    });

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    // Handle case where PushSubscription model doesn't exist
    if (error instanceof Error && error.message.includes('PushSubscription')) {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            pushSubscription: null,
          },
        });
        
        return NextResponse.json({
          success: true,
          message: 'Push subscription removed (fallback)',
        });
      }
    }

    logger.error('Failed to remove push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
}
