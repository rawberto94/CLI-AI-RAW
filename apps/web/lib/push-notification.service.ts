import prisma from '@/lib/prisma';

/**
 * Push notification sending service.
 * 
 * Uses the Web Push API (web-push) to deliver browser push notifications
 * to users who have subscribed via the service worker.
 * 
 * Falls back to in-app notification creation if push delivery fails.
 */

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to a specific user.
 * Looks up their push subscriptions and sends to all active ones.
 */
export async function sendPushNotification(
  userId: string,
  tenantId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    // Get user's push subscriptions
    const subscriptions = await prisma.$queryRawUnsafe(`
      SELECT * FROM push_subscriptions 
      WHERE user_id = $1 AND tenant_id = $2
    `, userId, tenantId) as any[];

    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Try to use web-push if available
    try {
      const webpush = await import('web-push');
      
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@contigo.app';

      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

        for (const sub of subscriptions) {
          try {
            const pushSubscription = typeof sub.subscription === 'string' 
              ? JSON.parse(sub.subscription) 
              : sub.subscription;

            await webpush.sendNotification(
              pushSubscription,
              JSON.stringify({
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/icons/icon-192x192.png',
                data: { url: payload.url || '/' },
                tag: payload.tag,
              })
            );
            sent++;
          } catch (err: any) {
            failed++;
            // Remove expired subscriptions (410 Gone)
            if (err?.statusCode === 410) {
              await prisma.$queryRawUnsafe(
                `DELETE FROM push_subscriptions WHERE id = $1`,
                sub.id
              );
            }
          }
        }
      }
    } catch {
      // web-push not installed — skip push delivery
    }
  } catch {
    // Push subscriptions table may not exist
  }

  return { sent, failed };
}

/**
 * Create an in-app notification and optionally send push.
 */
export async function createNotificationWithPush(
  userId: string,
  tenantId: string,
  notification: {
    title: string;
    message: string;
    type: string;
    priority?: string;
    actionUrl?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId,
      tenantId,
      title: notification.title,
      message: notification.message,
      type: notification.type as any,
      priority: (notification.priority || 'NORMAL') as any,
      actionUrl: notification.actionUrl,
      metadata: notification.metadata || {},
    },
  });

  // Send push notification
  await sendPushNotification(userId, tenantId, {
    title: notification.title,
    body: notification.message,
    url: notification.actionUrl,
    tag: notification.type,
  });
}

/**
 * Send notifications to all users in a tenant with a specific role.
 */
export async function notifyByRole(
  tenantId: string,
  role: string,
  notification: {
    title: string;
    message: string;
    type: string;
    priority?: string;
    actionUrl?: string;
  }
): Promise<{ notified: number }> {
  const users = await prisma.user.findMany({
    where: { tenantId, role: role as any },
    select: { id: true },
  });

  let notified = 0;
  for (const user of users) {
    await createNotificationWithPush(user.id, tenantId, notification);
    notified++;
  }

  return { notified };
}
