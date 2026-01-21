/**
 * AI Cost Alerts Service
 * 
 * Monitors AI spending and sends alerts when:
 * - Cost exceeds daily/weekly/monthly thresholds
 * - Unusual spending patterns detected
 * - Approaching budget limits
 */

import { prisma } from '@/lib/prisma';
import { webhookService } from './webhook.service';
import { aiAnalytics as _aiAnalytics } from './analytics.service';

// Types
export interface CostThreshold {
  id: string;
  tenantId: string;
  period: 'daily' | 'weekly' | 'monthly';
  threshold: number;
  enabled: boolean;
  notifyEmail?: string;
  notifyWebhook: boolean;
  lastAlertAt?: Date;
}

export interface CostAlert {
  id: string;
  tenantId: string;
  type: 'threshold_exceeded' | 'unusual_spike' | 'budget_warning';
  currentCost: number;
  threshold?: number;
  period: string;
  message: string;
  createdAt: Date;
  acknowledged: boolean;
}

// In-memory store for thresholds (cached from DB)
const thresholdCache = new Map<string, CostThreshold[]>();

// Alert cooldown (don't alert more than once per period)
const alertCooldowns = new Map<string, number>();

class CostAlertService {
  /**
   * Set a cost threshold for a tenant
   */
  async setThreshold(
    tenantId: string,
    config: Omit<CostThreshold, 'id' | 'tenantId'>
  ): Promise<CostThreshold> {
    const id = `ct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const threshold: CostThreshold = {
      ...config,
      id,
      tenantId,
    };

    // Update cache
    const existing = thresholdCache.get(tenantId) || [];
    const existingIndex = existing.findIndex(t => t.period === config.period);
    if (existingIndex >= 0) {
      existing[existingIndex] = threshold;
    } else {
      existing.push(threshold);
    }
    thresholdCache.set(tenantId, existing);

    // Persist to database
    try {
      await prisma.costThreshold.upsert({
        where: {
          tenantId_period: {
            tenantId,
            period: config.period,
          },
        },
        create: {
          id,
          tenantId,
          period: config.period,
          threshold: config.threshold,
          enabled: config.enabled,
          notifyEmail: config.notifyEmail,
          notifyWebhook: config.notifyWebhook,
        },
        update: {
          threshold: config.threshold,
          enabled: config.enabled,
          notifyEmail: config.notifyEmail,
          notifyWebhook: config.notifyWebhook,
        },
      });
    } catch (error) {
      console.warn('Failed to persist cost threshold:', error);
    }

    return threshold;
  }

  /**
   * Get thresholds for a tenant
   */
  async getThresholds(tenantId: string): Promise<CostThreshold[]> {
    // Check cache first
    if (thresholdCache.has(tenantId)) {
      return thresholdCache.get(tenantId)!;
    }

    // Load from database
    try {
      const dbThresholds = await prisma.costThreshold.findMany({
        where: { tenantId },
      });

      const thresholds = dbThresholds.map(t => ({
        id: t.id,
        tenantId: t.tenantId,
        period: t.period as 'daily' | 'weekly' | 'monthly',
        threshold: t.threshold,
        enabled: t.enabled,
        notifyEmail: t.notifyEmail || undefined,
        notifyWebhook: t.notifyWebhook,
        lastAlertAt: t.lastAlertAt || undefined,
      }));

      thresholdCache.set(tenantId, thresholds);
      return thresholds;
    } catch (error) {
      console.warn('Failed to load cost thresholds:', error);
      return [];
    }
  }

  /**
   * Check cost against thresholds and trigger alerts if needed
   */
  async checkCosts(tenantId: string): Promise<CostAlert[]> {
    const thresholds = await this.getThresholds(tenantId);
    const alerts: CostAlert[] = [];

    for (const threshold of thresholds) {
      if (!threshold.enabled) continue;

      const cost = await this.getCostForPeriod(tenantId, threshold.period);
      
      if (cost >= threshold.threshold) {
        // Check cooldown
        const cooldownKey = `${tenantId}:${threshold.period}`;
        const lastAlert = alertCooldowns.get(cooldownKey) || 0;
        const cooldownMs = this.getCooldownMs(threshold.period);

        if (Date.now() - lastAlert < cooldownMs) {
          continue; // Still in cooldown
        }

        // Create alert
        const alert = await this.createAlert(tenantId, {
          type: 'threshold_exceeded',
          currentCost: cost,
          threshold: threshold.threshold,
          period: threshold.period,
          message: `AI spending has exceeded your ${threshold.period} threshold of $${threshold.threshold.toFixed(2)}. Current spend: $${cost.toFixed(2)}`,
        });

        alerts.push(alert);

        // Update cooldown
        alertCooldowns.set(cooldownKey, Date.now());

        // Send notifications
        await this.sendAlertNotifications(tenantId, threshold, alert);
      } else if (cost >= threshold.threshold * 0.8) {
        // Warning at 80%
        const warningKey = `${tenantId}:${threshold.period}:warning`;
        const lastWarning = alertCooldowns.get(warningKey) || 0;
        const cooldownMs = this.getCooldownMs(threshold.period);

        if (Date.now() - lastWarning >= cooldownMs) {
          const alert = await this.createAlert(tenantId, {
            type: 'budget_warning',
            currentCost: cost,
            threshold: threshold.threshold,
            period: threshold.period,
            message: `AI spending is approaching your ${threshold.period} threshold. Current: $${cost.toFixed(2)} / $${threshold.threshold.toFixed(2)} (${Math.round((cost / threshold.threshold) * 100)}%)`,
          });

          alerts.push(alert);
          alertCooldowns.set(warningKey, Date.now());
        }
      }
    }

    // Check for unusual spikes
    const spikeAlert = await this.checkForSpikes(tenantId);
    if (spikeAlert) {
      alerts.push(spikeAlert);
    }

    return alerts;
  }

  /**
   * Get cost for a specific period
   */
  private async getCostForPeriod(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<number> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    try {
      const result = await prisma.aIUsageLog.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        _sum: {
          cost: true,
        },
      });

      return result._sum.cost || 0;
    } catch (error) {
      console.error('Failed to get cost for period:', error);
      return 0;
    }
  }

  /**
   * Check for unusual spending spikes
   */
  private async checkForSpikes(tenantId: string): Promise<CostAlert | null> {
    try {
      // Get today's cost
      const todayCost = await this.getCostForPeriod(tenantId, 'daily');

      // Get average daily cost for the past 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await prisma.aIUsageLog.aggregate({
        where: {
          tenantId,
          createdAt: {
            gte: sevenDaysAgo,
            lt: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: {
          cost: true,
        },
      });

      const avgDailyCost = (result._sum.cost || 0) / 7;

      // Alert if today's cost is 3x the average
      if (avgDailyCost > 0 && todayCost > avgDailyCost * 3) {
        const spikeKey = `${tenantId}:spike`;
        const lastSpike = alertCooldowns.get(spikeKey) || 0;

        if (Date.now() - lastSpike >= 24 * 60 * 60 * 1000) {
          alertCooldowns.set(spikeKey, Date.now());

          return this.createAlert(tenantId, {
            type: 'unusual_spike',
            currentCost: todayCost,
            period: 'daily',
            message: `Unusual AI spending spike detected. Today's cost ($${todayCost.toFixed(2)}) is ${Math.round(todayCost / avgDailyCost)}x higher than your 7-day average ($${avgDailyCost.toFixed(2)}).`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to check for spikes:', error);
    }

    return null;
  }

  /**
   * Create an alert record
   */
  private async createAlert(
    tenantId: string,
    data: Omit<CostAlert, 'id' | 'tenantId' | 'createdAt' | 'acknowledged'>
  ): Promise<CostAlert> {
    const alert: CostAlert = {
      ...data,
      id: `ca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      createdAt: new Date(),
      acknowledged: false,
    };

    try {
      await prisma.costAlert.create({
        data: {
          id: alert.id,
          tenantId,
          type: alert.type,
          currentCost: alert.currentCost,
          threshold: alert.threshold,
          period: alert.period,
          message: alert.message,
          createdAt: alert.createdAt,
          acknowledged: false,
        },
      });
    } catch (error) {
      console.warn('Failed to persist cost alert:', error);
    }

    return alert;
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(
    tenantId: string,
    threshold: CostThreshold,
    alert: CostAlert
  ): Promise<void> {
    // Send webhook notification
    if (threshold.notifyWebhook) {
      await webhookService.notifyCostThreshold(
        tenantId,
        alert.currentCost,
        threshold.threshold,
        threshold.period
      );
    }

    // Send email notification (implement email service integration)
    if (threshold.notifyEmail) {
      // TODO: Integrate with email service (SendGrid, Resend, etc.)
      console.warn(`Would send email to ${threshold.notifyEmail}:`, alert.message);
    }
  }

  /**
   * Get cooldown duration for a period
   */
  private getCooldownMs(period: 'daily' | 'weekly' | 'monthly'): number {
    switch (period) {
      case 'daily':
        return 6 * 60 * 60 * 1000; // 6 hours
      case 'weekly':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'monthly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
    }
  }

  /**
   * Get recent alerts for a tenant
   */
  async getAlerts(
    tenantId: string,
    options: { limit?: number; unacknowledgedOnly?: boolean } = {}
  ): Promise<CostAlert[]> {
    const { limit = 10, unacknowledgedOnly = false } = options;

    try {
      const alerts = await prisma.costAlert.findMany({
        where: {
          tenantId,
          ...(unacknowledgedOnly && { acknowledged: false }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return alerts.map(a => ({
        id: a.id,
        tenantId: a.tenantId,
        type: a.type as CostAlert['type'],
        currentCost: a.currentCost,
        threshold: a.threshold || undefined,
        period: a.period,
        message: a.message,
        createdAt: a.createdAt,
        acknowledged: a.acknowledged,
      }));
    } catch (error) {
      console.error('Failed to get alerts:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      await prisma.costAlert.update({
        where: { id: alertId },
        data: { acknowledged: true },
      });
      return true;
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      return false;
    }
  }

  /**
   * Get cost summary for dashboard
   */
  async getCostSummary(tenantId: string): Promise<{
    daily: { cost: number; threshold?: number; percentUsed?: number };
    weekly: { cost: number; threshold?: number; percentUsed?: number };
    monthly: { cost: number; threshold?: number; percentUsed?: number };
    alerts: CostAlert[];
  }> {
    const [dailyCost, weeklyCost, monthlyCost, thresholds, alerts] = await Promise.all([
      this.getCostForPeriod(tenantId, 'daily'),
      this.getCostForPeriod(tenantId, 'weekly'),
      this.getCostForPeriod(tenantId, 'monthly'),
      this.getThresholds(tenantId),
      this.getAlerts(tenantId, { limit: 5, unacknowledgedOnly: true }),
    ]);

    const getThresholdData = (period: 'daily' | 'weekly' | 'monthly', cost: number) => {
      const t = thresholds.find(th => th.period === period);
      return {
        cost,
        threshold: t?.threshold,
        percentUsed: t?.threshold ? (cost / t.threshold) * 100 : undefined,
      };
    };

    return {
      daily: getThresholdData('daily', dailyCost),
      weekly: getThresholdData('weekly', weeklyCost),
      monthly: getThresholdData('monthly', monthlyCost),
      alerts,
    };
  }
}

export const costAlertService = new CostAlertService();
