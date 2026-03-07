
/**
 * Benchmark Notification Service
 * 
 * Detects significant market shifts and sends notifications to relevant users.
 * Tracks notification delivery and manages notification preferences.
 * 
 * @module BenchmarkNotificationService
 */

import { PrismaClient } from '@prisma/client';
import { eventBus, Events } from '../events/event-bus';

export interface MarketShift {
  cohortIdentifier: string;
  roleStandardized: string;
  seniority: string;
  country: string;
  lineOfService: string;
  previousMedian: number;
  newMedian: number;
  changeAmount: number;
  changePercentage: number;
  detectedAt: Date;
  affectedRateCards: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface NotificationPayload {
  id: string;
  tenantId: string;
  userId?: string;
  type: 'MARKET_SHIFT' | 'BEST_RATE_CHANGE' | 'BENCHMARK_UPDATED' | 'OPPORTUNITY_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data: any;
  createdAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  channels: ('IN_APP' | 'EMAIL' | 'WEBHOOK')[];
}

export interface NotificationDeliveryResult {
  notificationId: string;
  success: boolean;
  deliveredChannels: string[];
  failedChannels: string[];
  errors: string[];
}

/**
 * Benchmark Notification Service
 * Handles detection and delivery of benchmark-related notifications
 */
export class BenchmarkNotificationService {
  private prisma: PrismaClient;
  private notifications: NotificationPayload[] = [];
  private marketShiftThreshold: number = 5; // 5% change threshold

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize notification listeners
   */
  initialize(): void {
    // Listen for benchmark calculated events
    eventBus.on(Events.BENCHMARK_CALCULATED, async (data: any) => {
      await this.handleBenchmarkCalculated(data);
    });

    // Listen for market shift events
    eventBus.on(Events.MARKET_SHIFT_DETECTED, async (data: MarketShift) => {
      await this.handleMarketShift(data);
    });

    // Listen for best rate change events
    eventBus.on(Events.BEST_RATE_CHANGED, async (data: any) => {
      await this.handleBestRateChange(data);
    });
  }

  /**
   * Detect significant market shifts from benchmark calculation
   */
  async detectMarketShifts(
    rateCardEntryId: string,
    newBenchmark: any
  ): Promise<MarketShift | null> {
    try {
      // Get previous benchmark snapshot
      const previousBenchmark = await this.prisma.benchmarkSnapshot.findFirst({
        where: {
          rateCardEntryId,
          snapshotDate: {
            lt: newBenchmark.calculatedAt,
          },
        },
        orderBy: { snapshotDate: 'desc' },
      });

      if (!previousBenchmark) {
        // No previous benchmark to compare
        return null;
      }

      const previousMedian = Number(previousBenchmark.median);
      const newMedian = newBenchmark.statistics.median;
      const changeAmount = newMedian - previousMedian;
      const changePercentage = (changeAmount / previousMedian) * 100;

      // Check if change exceeds threshold
      if (Math.abs(changePercentage) >= this.marketShiftThreshold) {
        // Count affected rate cards
        const affectedCount = await this.prisma.rateCardEntry.count({
          where: {
            roleStandardized: newBenchmark.cohortDefinition.roleStandardized,
            seniority: newBenchmark.cohortDefinition.seniority,
            country: newBenchmark.cohortDefinition.country,
            lineOfService: newBenchmark.cohortDefinition.lineOfService,
          },
        });

        // Determine severity
        let severity: MarketShift['severity'];
        if (Math.abs(changePercentage) >= 20) {
          severity = 'CRITICAL';
        } else if (Math.abs(changePercentage) >= 15) {
          severity = 'HIGH';
        } else if (Math.abs(changePercentage) >= 10) {
          severity = 'MEDIUM';
        } else {
          severity = 'LOW';
        }

        const marketShift: MarketShift = {
          cohortIdentifier: `${newBenchmark.cohortDefinition.roleStandardized}:${newBenchmark.cohortDefinition.seniority}:${newBenchmark.cohortDefinition.country}`,
          roleStandardized: newBenchmark.cohortDefinition.roleStandardized,
          seniority: newBenchmark.cohortDefinition.seniority,
          country: newBenchmark.cohortDefinition.country,
          lineOfService: newBenchmark.cohortDefinition.lineOfService,
          previousMedian,
          newMedian,
          changeAmount,
          changePercentage,
          detectedAt: new Date(),
          affectedRateCards: affectedCount,
          severity,
        };

        // Emit market shift event
        eventBus.emit(Events.MARKET_SHIFT_DETECTED, marketShift);

        return marketShift;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Handle benchmark calculated event
   */
  private async handleBenchmarkCalculated(data: any): Promise<void> {
    if (!data.benchmark) {
      return;
    }

    // Detect market shifts
    const marketShift = await this.detectMarketShifts(data.rateCardEntryId, data.benchmark);

    if (marketShift) {
    }

    // Create notification for benchmark update
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: data.rateCardEntryId },
    });

    if (rateCard) {
      await this.createNotification({
        tenantId: data.tenantId,
        type: 'BENCHMARK_UPDATED',
        severity: 'LOW',
        title: 'Benchmark Updated',
        message: `Benchmark recalculated for ${rateCard.roleStandardized} (${rateCard.seniority}) in ${rateCard.country}`,
        data: {
          rateCardEntryId: data.rateCardEntryId,
          benchmark: data.benchmark,
          durationMs: data.durationMs,
        },
        channels: ['IN_APP'],
      });
    }
  }

  /**
   * Handle market shift event
   */
  private async handleMarketShift(marketShift: MarketShift): Promise<void> {
    // Get tenant ID from affected rate cards
    const rateCard = await this.prisma.rateCardEntry.findFirst({
      where: {
        roleStandardized: marketShift.roleStandardized,
        seniority: marketShift.seniority as any,
        country: marketShift.country,
      },
      select: { tenantId: true },
    });

    if (!rateCard) {
      return;
    }

    const direction = marketShift.changePercentage > 0 ? 'increased' : 'decreased';
    const absChange = Math.abs(marketShift.changePercentage);

    await this.createNotification({
      tenantId: rateCard.tenantId,
      type: 'MARKET_SHIFT',
      severity: marketShift.severity,
      title: `Significant Market Shift Detected`,
      message: `Market rates for ${marketShift.roleStandardized} (${marketShift.seniority}) in ${marketShift.country} have ${direction} by ${absChange.toFixed(1)}%. ${marketShift.affectedRateCards} rate cards affected.`,
      data: marketShift,
      channels: marketShift.severity === 'CRITICAL' || marketShift.severity === 'HIGH' 
        ? ['IN_APP', 'EMAIL'] 
        : ['IN_APP'],
    });
  }

  /**
   * Handle best rate change event
   */
  private async handleBestRateChange(data: any): Promise<void> {
    await this.createNotification({
      tenantId: data.tenantId,
      type: 'BEST_RATE_CHANGE',
      severity: 'MEDIUM',
      title: 'Best Rate Changed',
      message: `New best rate available for ${data.roleStandardized} (${data.seniority}) in ${data.country}: ${data.newBestRate}/day`,
      data,
      channels: ['IN_APP'],
    });
  }

  /**
   * Create a notification
   */
  async createNotification(payload: Omit<NotificationPayload, 'id' | 'createdAt'>): Promise<NotificationPayload> {
    const notification: NotificationPayload = {
      id: this.generateNotificationId(),
      ...payload,
      createdAt: new Date(),
    };

    this.notifications.push(notification);

    // Keep only last 10000 notifications
    if (this.notifications.length > 10000) {
      this.notifications.shift();
    }

    // Deliver notification
    await this.deliverNotification(notification);

    return notification;
  }

  /**
   * Deliver notification through specified channels
   */
  private async deliverNotification(notification: NotificationPayload): Promise<NotificationDeliveryResult> {
    const deliveredChannels: string[] = [];
    const failedChannels: string[] = [];
    const errors: string[] = [];

    for (const channel of notification.channels) {
      try {
        switch (channel) {
          case 'IN_APP':
            await this.deliverInApp(notification);
            deliveredChannels.push('IN_APP');
            break;

          case 'EMAIL':
            await this.deliverEmail(notification);
            deliveredChannels.push('EMAIL');
            break;

          case 'WEBHOOK':
            await this.deliverWebhook(notification);
            deliveredChannels.push('WEBHOOK');
            break;
        }
      } catch (error) {
        failedChannels.push(channel);
        errors.push(`${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Mark as delivered
    notification.deliveredAt = new Date();

    return {
      notificationId: notification.id,
      success: failedChannels.length === 0,
      deliveredChannels,
      failedChannels,
      errors,
    };
  }

  /**
   * Deliver in-app notification
   */
  private async deliverInApp(notification: NotificationPayload): Promise<void> {
    // In production, would create database record
    // await this.prisma.notification.create({ data: notification });
  }

  /**
   * Deliver email notification
   */
  private async deliverEmail(notification: NotificationPayload): Promise<void> {
    // In production, would integrate with email service (SendGrid, AWS SES, etc.)
    // await emailService.send({
    //   to: userEmail,
    //   subject: notification.title,
    //   body: notification.message,
    // });
  }

  /**
   * Deliver webhook notification
   */
  private async deliverWebhook(notification: NotificationPayload): Promise<void> {
    // In production, would send HTTP POST to configured webhook URL
    // await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(notification),
    // });
  }

  /**
   * Get notifications for a tenant
   */
  getNotifications(tenantId: string, options?: {
    limit?: number;
    unreadOnly?: boolean;
    type?: NotificationPayload['type'];
  }): NotificationPayload[] {
    let filtered = this.notifications.filter(n => n.tenantId === tenantId);

    if (options?.unreadOnly) {
      filtered = filtered.filter(n => !n.readAt);
    }

    if (options?.type) {
      filtered = filtered.filter(n => n.type === options.type);
    }

    const limit = options?.limit || 100;
    return filtered.slice(-limit).reverse();
  }

  /**
   * Get notifications for a user
   */
  getUserNotifications(userId: string, options?: {
    limit?: number;
    unreadOnly?: boolean;
  }): NotificationPayload[] {
    let filtered = this.notifications.filter(n => n.userId === userId);

    if (options?.unreadOnly) {
      filtered = filtered.filter(n => !n.readAt);
    }

    const limit = options?.limit || 100;
    return filtered.slice(-limit).reverse();
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.readAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read for a tenant
   */
  markAllAsRead(tenantId: string): number {
    let count = 0;
    this.notifications
      .filter(n => n.tenantId === tenantId && !n.readAt)
      .forEach(n => {
        n.readAt = new Date();
        count++;
      });
    return count;
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(tenantId: string): number {
    return this.notifications.filter(n => n.tenantId === tenantId && !n.readAt).length;
  }

  /**
   * Set market shift threshold
   */
  setMarketShiftThreshold(percentage: number): void {
    this.marketShiftThreshold = percentage;
  }

  /**
   * Get market shift threshold
   */
  getMarketShiftThreshold(): number {
    return this.marketShiftThreshold;
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all notifications (for testing)
   */
  clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Get notification statistics
   */
  getNotificationStatistics(tenantId: string): {
    total: number;
    unread: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const tenantNotifications = this.notifications.filter(n => n.tenantId === tenantId);

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    tenantNotifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
      bySeverity[n.severity] = (bySeverity[n.severity] || 0) + 1;
    });

    return {
      total: tenantNotifications.length,
      unread: tenantNotifications.filter(n => !n.readAt).length,
      byType,
      bySeverity,
    };
  }
}

export default BenchmarkNotificationService;
