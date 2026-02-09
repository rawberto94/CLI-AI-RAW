/**
 * Advanced Notification System
 * 
 * Unified notification service supporting:
 * - In-app notifications
 * - Email notifications
 * - Web Push notifications
 * - Slack/Teams webhooks
 * - Notification preferences per user
 * - Notification batching and consolidation
 */

import { prisma } from '@/lib/prisma';
import webpush from "web-push";

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | "contract_uploaded"
  | "contract_shared"
  | "contract_expiring"
  | "contract_expired"
  | "contract_approved"
  | "contract_rejected"
  | "comment_added"
  | "mention"
  | "task_assigned"
  | "task_completed"
  | "reminder"
  | "sync_completed"
  | "sync_failed"
  | "system_update"
  | "security_alert";

export type NotificationChannel = "in_app" | "email" | "push" | "slack" | "teams";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  imageUrl?: string;
  priority?: NotificationPriority;
  expiresAt?: Date;
  groupKey?: string;
}

export interface NotificationRecipient {
  userId: string;
  tenantId: string;
  email?: string;
  pushSubscription?: PushSubscription;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    [K in NotificationType]?: {
      enabled: boolean;
      channels: NotificationChannel[];
      quietHours?: { start: string; end: string };
      batchDigest?: boolean;
    };
  };
  globalQuietHours?: { start: string; end: string; timezone: string };
  emailDigestFrequency?: "instant" | "hourly" | "daily" | "weekly";
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ============================================================================
// Notification Service
// ============================================================================

export class AdvancedNotificationService {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private pendingBatch: Map<string, NotificationPayload[]> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

    if (this.vapidPublicKey && this.vapidPrivateKey) {
      webpush.setVapidDetails(
        `mailto:${process.env.EMAIL_FROM || "notifications@contigo.ch"}`,
        this.vapidPublicKey,
        this.vapidPrivateKey
      );
    }
  }

  /**
   * Send notification to a single user
   */
  async notify(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<void> {
    const preferences = await this.getUserPreferences(recipient.userId);
    const typePrefs = preferences?.channels?.[payload.type];

    // Check if notification type is enabled
    if (typePrefs && !typePrefs.enabled) {
      return;
    }

    // Check quiet hours
    if (this.isInQuietHours(preferences)) {
      // Queue for later or batch
      if (typePrefs?.batchDigest) {
        this.addToBatch(recipient.userId, payload);
        return;
      }
    }

    // Determine channels to use
    const channels = typePrefs?.channels || ["in_app", "email"];

    // Send to each channel
    const promises: Promise<void>[] = [];

    if (channels.includes("in_app")) {
      promises.push(this.sendInApp(recipient, payload));
    }

    if (channels.includes("email") && recipient.email) {
      promises.push(this.sendEmail(recipient, payload));
    }

    if (channels.includes("push") && recipient.pushSubscription) {
      promises.push(this.sendPush(recipient, payload));
    }

    if (channels.includes("slack")) {
      promises.push(this.sendSlack(recipient, payload));
    }

    if (channels.includes("teams")) {
      promises.push(this.sendTeams(recipient, payload));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send notification to multiple users
   */
  async notifyMany(
    recipients: NotificationRecipient[],
    payload: NotificationPayload
  ): Promise<void> {
    await Promise.allSettled(
      recipients.map((recipient) => this.notify(recipient, payload))
    );
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: recipient.userId,
        tenantId: recipient.tenantId,
        type: payload.type,
        title: payload.title,
        message: payload.body,
        body: payload.body,
        metadata: payload.data ? JSON.parse(JSON.stringify(payload.data)) : null,
        link: payload.actionUrl,
        expiresAt: payload.expiresAt,
        isRead: false,
      },
    });

    // Emit real-time event if WebSocket is available
    this.emitRealtime(recipient.userId, "notification", payload);
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<void> {
    if (!recipient.email) return;

    const html = this.generateEmailHtml(payload);
    
    // Use SendGrid or configured email provider
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return;

    try {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient.email }] }],
          from: { email: process.env.EMAIL_FROM || "notifications@contigo.ch" },
          subject: payload.title,
          content: [
            { type: "text/plain", value: payload.body },
            { type: "text/html", value: html },
          ],
        }),
      });
    } catch (error) {
      console.error("[Notification] Email send failed:", error);
    }
  }

  /**
   * Send Web Push notification
   */
  private async sendPush(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<void> {
    if (!recipient.pushSubscription || !this.vapidPublicKey) return;

    const pushPayload = {
      title: payload.title,
      body: payload.body,
      icon: "/icons/notification-icon.png",
      badge: "/icons/notification-badge.png",
      image: payload.imageUrl,
      data: {
        url: payload.actionUrl,
        ...payload.data,
      },
      actions: payload.actionUrl
        ? [{ action: "open", title: "View" }]
        : undefined,
    };

    try {
      await webpush.sendNotification(
        {
          endpoint: recipient.pushSubscription.endpoint,
          keys: recipient.pushSubscription.keys,
        },
        JSON.stringify(pushPayload)
      );
    } catch (error: any) {
      // Handle expired subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        await this.removeExpiredSubscription(recipient.userId);
      }
      console.error("[Notification] Push send failed:", error);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<void> {
    const webhookUrl = await this.getSlackWebhook(recipient.tenantId);
    if (!webhookUrl) return;

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: payload.title },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: payload.body },
      },
    ];

    if (payload.actionUrl) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Details" },
            url: payload.actionUrl,
          },
        ],
      } as any);
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
    } catch (error) {
      console.error("[Notification] Slack send failed:", error);
    }
  }

  /**
   * Send Microsoft Teams notification
   */
  private async sendTeams(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<void> {
    const webhookUrl = await this.getTeamsWebhook(recipient.tenantId);
    if (!webhookUrl) return;

    const card = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: payload.title,
      themeColor: this.getPriorityColor(payload.priority),
      title: payload.title,
      sections: [
        {
          text: payload.body,
        },
      ],
      potentialAction: payload.actionUrl
        ? [
            {
              "@type": "OpenUri",
              name: "View Details",
              targets: [{ os: "default", uri: payload.actionUrl }],
            },
          ]
        : undefined,
    };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
    } catch (error) {
      console.error("[Notification] Teams send failed:", error);
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) return null;
    
    // Map database flat fields to NotificationPreferences interface
    return {
      userId: prefs.userId,
      channels: {}, // Would need to be stored in metadata or separate table
      globalQuietHours: prefs.quietHoursStart && prefs.quietHoursEnd ? {
        start: prefs.quietHoursStart,
        end: prefs.quietHoursEnd,
        timezone: prefs.quietHoursTimezone ?? "UTC",
      } : undefined,
      emailDigestFrequency: prefs.emailDigest as NotificationPreferences["emailDigestFrequency"],
    };
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const data = {
      emailEnabled: true,
      pushEnabled: true,
      emailDigest: preferences.emailDigestFrequency || "daily",
      quietHoursStart: preferences.globalQuietHours?.start,
      quietHoursEnd: preferences.globalQuietHours?.end,
      quietHoursTimezone: preferences.globalQuietHours?.timezone,
    };
    
    await prisma.notificationPreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, tenantId: userId, ...data },
    });
  }

  /**
   * Register push subscription
   */
  async registerPushSubscription(
    userId: string,
    subscription: PushSubscription
  ): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: {
        endpoint: subscription.endpoint,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId,
      },
      create: {
        userId,
        tenantId: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(
    userId: string,
    limit = 50
  ): Promise<any[]> {
    return prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds: string[]): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Get notification count for badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysToKeep = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await prisma.notification.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: cutoff }, isRead: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    return result.count;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private isInQuietHours(preferences: NotificationPreferences | null): boolean {
    if (!preferences?.globalQuietHours) return false;

    const { start, end, timezone: _timezone } = preferences.globalQuietHours;
    const now = new Date();
    
    // Simple hour comparison (would need proper timezone handling in production)
    const hour = now.getHours();
    const startHour = parseInt(start.split(":")[0], 10);
    const endHour = parseInt(end.split(":")[0], 10);

    if (startHour < endHour) {
      return hour >= startHour && hour < endHour;
    } else {
      // Overnight quiet hours
      return hour >= startHour || hour < endHour;
    }
  }

  private addToBatch(userId: string, payload: NotificationPayload): void {
    const existing = this.pendingBatch.get(userId) || [];
    existing.push(payload);
    this.pendingBatch.set(userId, existing);

    // Schedule batch send
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.sendBatches(), 60000);
    }
  }

  private async sendBatches(): Promise<void> {
    this.batchTimeout = null;
    
    for (const [userId, notifications] of this.pendingBatch.entries()) {
      if (notifications.length > 0) {
        // Send digest email
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, tenantId: true },
        });

        if (user?.email) {
          await this.sendDigestEmail(user.email, notifications);
        }
      }
    }

    this.pendingBatch.clear();
  }

  private async sendDigestEmail(
    email: string,
    notifications: NotificationPayload[]
  ): Promise<void> {
    const html = this.generateDigestHtml(notifications);
    
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return;

    try {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: process.env.EMAIL_FROM || "notifications@contigo.ch" },
          subject: `You have ${notifications.length} new notifications`,
          content: [{ type: "text/html", value: html }],
        }),
      });
    } catch (error) {
      console.error("[Notification] Digest email failed:", error);
    }
  }

  private generateEmailHtml(payload: NotificationPayload): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #8b5cf6 100%); padding: 24px; color: white; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
          .content { padding: 24px; }
          .content p { margin: 0 0 16px; color: #4b5563; line-height: 1.6; }
          .button { display: inline-block; background: #8b5cf6; color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>${payload.title}</h1>
            </div>
            <div class="content">
              <p>${payload.body}</p>
              ${payload.actionUrl ? `<a href="${payload.actionUrl}" class="button">View Details</a>` : ""}
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ConTigo - Contract Intelligence Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDigestHtml(notifications: NotificationPayload[]): string {
    const items = notifications
      .map(
        (n) => `
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
              <strong style="color: #1f2937;">${n.title}</strong>
              <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">${n.body}</p>
            </td>
          </tr>
        `
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
        </style>
      </head>
      <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #8b5cf6 100%); padding: 24px; color: white;">
              <h1 style="margin: 0; font-size: 20px;">Notification Digest</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">${notifications.length} new notifications</p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              ${items}
            </table>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPriorityColor(priority?: NotificationPriority): string {
    switch (priority) {
      case "urgent":
        return "FF0000";
      case "high":
        return "FFA500";
      case "normal":
        return "3B82F6";
      case "low":
      default:
        return "6B7280";
    }
  }

  private async getSlackWebhook(tenantId: string): Promise<string | null> {
    const integration = await prisma.integration.findFirst({
      where: { tenantId, provider: "SLACK", isActive: true },
    });
    const config = integration?.config as Record<string, unknown> | null;
    return config?.webhookUrl as string | null;
  }

  private async getTeamsWebhook(tenantId: string): Promise<string | null> {
    const integration = await prisma.integration.findFirst({
      where: { tenantId, provider: "TEAMS", isActive: true },
    });
    const config = integration?.config as Record<string, unknown> | null;
    return config?.webhookUrl as string | null;
  }

  private async removeExpiredSubscription(userId: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({
      where: { userId },
    });
  }

  private emitRealtime(userId: string, event: string, data: unknown): void {
    // This would integrate with the WebSocket server
    // For now, we'll use a simple approach
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      // Publish to Redis for WebSocket server to pick up
      import("ioredis").then(({ default: Redis }) => {
        const redis = new Redis(redisUrl);
        redis.publish(
          "notifications",
          JSON.stringify({ userId, event, data })
        );
        redis.quit();
      }).catch(() => {});
    }
  }
}

// Singleton instance
let notificationService: AdvancedNotificationService | null = null;

export function getNotificationService(): AdvancedNotificationService {
  if (!notificationService) {
    notificationService = new AdvancedNotificationService();
  }
  return notificationService;
}

export default AdvancedNotificationService;
