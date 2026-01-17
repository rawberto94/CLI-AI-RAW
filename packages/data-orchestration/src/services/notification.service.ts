import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dynamic import for email service (apps/web)
// For use in workers package, we create a simple HTTP-based sender
async function sendEmailViaAPI(to: string[], subject: string, body: string): Promise<boolean> {
  const apiUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${apiUrl}/api/internal/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET || 'internal-secret'}`,
      },
      body: JSON.stringify({
        to,
        subject,
        html: `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${subject}</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            ${body.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>© ${new Date().getFullYear()} ConTigo - Contract Intelligence Platform</p>
          </div>
        </div>`,
        text: body,
      }),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

// Direct SendGrid integration as fallback
async function sendEmailDirect(to: string[], subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'notifications@contigo.ch';
  
  if (!apiKey) {
    return true;
  }
  
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: to.map(email => ({ email })) }],
        from: { email: fromEmail },
        subject,
        content: [
          { type: 'text/plain', value: body },
          {
            type: 'text/html',
            value: `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">${subject}</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                ${body.split('\n').map(line => `<p>${line}</p>`).join('')}
              </div>
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>© ${new Date().getFullYear()} ConTigo - Contract Intelligence Platform</p>
              </div>
            </div>`,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export interface NotificationOptions {
  userId?: string;
  tenantId: string;
  type: 'email' | 'in-app' | 'both';
  priority: 'low' | 'medium' | 'high';
  consolidate?: boolean;
}

export interface EmailNotification {
  to: string[];
  subject: string;
  body: string;
  html?: string;
}

export interface InAppNotification {
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: any;
}

export class NotificationService {
  /**
   * Send notification via email and/or in-app
   */
  async sendNotification(
    title: string,
    message: string,
    options: NotificationOptions
  ): Promise<void> {
    const { type, userId, tenantId, priority } = options;

    if (type === 'email' || type === 'both') {
      await this.sendEmailNotification(title, message, tenantId, userId);
    }

    if (type === 'in-app' || type === 'both') {
      if (!userId) {
        // Send to all users in tenant
        const users = await prisma.user.findMany({
          where: { tenantId },
          select: { id: true },
        });

        for (const user of users) {
          await this.sendInAppNotification({
            userId: user.id,
            title,
            message,
            type: 'alert',
          });
        }
      } else {
        await this.sendInAppNotification({
          userId,
          title,
          message,
          type: 'alert',
        });
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    subject: string,
    body: string,
    tenantId: string,
    userId?: string
  ): Promise<void> {
    // Get recipient emails
    const recipients = userId
      ? await prisma.user.findMany({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        })
      : await prisma.user.findMany({
          where: { tenantId },
          select: { email: true, firstName: true, lastName: true },
        });

    const emails = recipients.map((r) => r.email).filter(Boolean) as string[];

    if (emails.length === 0) {
      return;
    }

    // Try internal API first, fallback to direct SendGrid
    let success = await sendEmailViaAPI(emails, subject, body);
    
    if (!success) {
      success = await sendEmailDirect(emails, subject, body);
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    notification: InAppNotification
  ): Promise<void> {
    await prisma.rateCardAlert.create({
      data: {
        tenantId: (
          await prisma.user.findUnique({
            where: { id: notification.userId },
            select: { tenantId: true },
          })
        )?.tenantId!,
        userId: notification.userId,
        type: notification.type,
        severity: 'medium',
        title: notification.title,
        description: notification.message,
        data: notification.data || {},
        read: false,
      },
    });
  }

  /**
   * Consolidate multiple alerts into digest
   */
  async consolidateAlerts(
    tenantId: string,
    userId?: string,
    timeWindow: number = 3600000 // 1 hour in ms
  ): Promise<void> {
    const since = new Date(Date.now() - timeWindow);

    const alerts = await prisma.rateCardAlert.findMany({
      where: {
        tenantId,
        userId: userId || undefined,
        createdAt: { gte: since },
        read: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (alerts.length === 0) {
      return;
    }

    // Group alerts by type
    const groupedAlerts = alerts.reduce((acc, alert) => {
      if (!acc[alert.type]) {
        acc[alert.type] = [];
      }
      acc[alert.type].push(alert);
      return acc;
    }, {} as Record<string, typeof alerts>);

    // Create digest message
    const digestParts: string[] = [];
    for (const [type, typeAlerts] of Object.entries(groupedAlerts)) {
      digestParts.push(
        `${typeAlerts.length} ${type.replace('_', ' ')} alert(s)`
      );
    }

    const digestMessage = `You have ${alerts.length} new alerts: ${digestParts.join(', ')}`;

    // Send consolidated notification
    await this.sendNotification('Alert Digest', digestMessage, {
      tenantId,
      userId,
      type: 'email',
      priority: 'medium',
    });

    // Mark alerts as consolidated
    await prisma.rateCardAlert.updateMany({
      where: {
        id: { in: alerts.map((a) => a.id) },
      },
      data: {
        data: { consolidated: true },
      },
    });
  }

  /**
   * Send rate increase alert
   */
  async sendRateIncreaseAlert(
    rateCardId: string,
    oldRate: number,
    newRate: number,
    tenantId: string
  ): Promise<void> {
    const percentChange = ((newRate - oldRate) / oldRate) * 100;

    await this.sendNotification(
      'Rate Increase Detected',
      `A rate card has increased by ${percentChange.toFixed(1)}% from $${oldRate}/hr to $${newRate}/hr`,
      {
        tenantId,
        type: 'both',
        priority: percentChange > 10 ? 'high' : 'medium',
      }
    );
  }

  /**
   * Send market shift alert
   */
  async sendMarketShiftAlert(
    segment: string,
    medianChange: number,
    tenantId: string
  ): Promise<void> {
    await this.sendNotification(
      'Significant Market Shift',
      `The ${segment} market has shifted by ${medianChange.toFixed(1)}%. Review your rate cards.`,
      {
        tenantId,
        type: 'both',
        priority: 'high',
      }
    );
  }

  /**
   * Send opportunity alert
   */
  async sendOpportunityAlert(
    opportunityType: string,
    savingsAmount: number,
    tenantId: string
  ): Promise<void> {
    await this.sendNotification(
      'New Savings Opportunity',
      `A ${opportunityType} opportunity has been identified with potential savings of $${savingsAmount.toLocaleString()}`,
      {
        tenantId,
        type: 'in-app',
        priority: 'medium',
      }
    );
  }

  /**
   * Send quality issue alert
   */
  async sendQualityIssueAlert(
    rateCardId: string,
    qualityScore: number,
    issues: string[],
    tenantId: string
  ): Promise<void> {
    await this.sendNotification(
      'Data Quality Issue',
      `Rate card has a quality score of ${qualityScore}/100. Issues: ${issues.join(', ')}`,
      {
        tenantId,
        type: 'in-app',
        priority: qualityScore < 50 ? 'high' : 'medium',
      }
    );
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(userId: string): Promise<any[]> {
    return prisma.rateCardAlert.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await prisma.rateCardAlert.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.rateCardAlert.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}

export const notificationService = new NotificationService();
