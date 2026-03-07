/**
 * Alerting Service
 * Monitors system metrics and generates alerts when thresholds are exceeded
 */

import { monitoringService } from './monitoring.service';

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  window?: number; // Time window in milliseconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface Alert {
  id: string;
  threshold: AlertThreshold;
  currentValue: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
  type: string;
  metric: string;
  message: string;
  acknowledged: boolean;
}

export interface AlertNotification {
  alert: Alert;
  channels: ('email' | 'webhook' | 'console')[];
}

class AlertingService {
  private thresholds: Map<string, AlertThreshold> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;
  private webhookUrl?: string;
  private emailRecipients: string[] = [];

  constructor() {
    // Define default critical thresholds
    this.defineDefaultThresholds();
  }

  /**
   * Define default critical thresholds
   */
  private defineDefaultThresholds(): void {
    // Error rate threshold
    this.addThreshold({
      metric: 'error_rate',
      operator: 'gt',
      value: 1.0, // More than 1 error per minute
      window: 5 * 60 * 1000, // 5 minutes
      severity: 'high',
      description: 'Error rate exceeds 1 error per minute',
    });

    // SSE connection threshold
    this.addThreshold({
      metric: 'sse_connections',
      operator: 'gt',
      value: 100, // More than 100 connections
      severity: 'medium',
      description: 'SSE connections exceed capacity',
    });

    // Cache hit ratio threshold
    this.addThreshold({
      metric: 'cache_hit_ratio',
      operator: 'lt',
      value: 50, // Less than 50%
      severity: 'medium',
      description: 'Cache hit ratio below 50%',
    });

    // API response time threshold
    this.addThreshold({
      metric: 'api_response_p95',
      operator: 'gt',
      value: 2000, // More than 2 seconds
      severity: 'high',
      description: 'API P95 response time exceeds 2 seconds',
    });

    // Memory usage threshold (if available)
    this.addThreshold({
      metric: 'memory_usage_percent',
      operator: 'gt',
      value: 90, // More than 90%
      severity: 'critical',
      description: 'Memory usage exceeds 90%',
    });
  }

  /**
   * Add a custom threshold
   */
  addThreshold(threshold: AlertThreshold): void {
    const key = this.getThresholdKey(threshold);
    this.thresholds.set(key, threshold);
    
    monitoringService.logInfo('Alert threshold added', {
      metric: threshold.metric,
      severity: threshold.severity,
    });
  }

  /**
   * Remove a threshold
   */
  removeThreshold(metric: string, operator: string): void {
    const key = `${metric}:${operator}`;
    this.thresholds.delete(key);
  }

  /**
   * Configure webhook URL for notifications
   */
  configureWebhook(url: string): void {
    this.webhookUrl = url;
    monitoringService.logInfo('Webhook configured for alerts', { url });
  }

  /**
   * Configure email recipients
   */
  configureEmail(recipients: string[]): void {
    this.emailRecipients = recipients;
    monitoringService.logInfo('Email recipients configured', { 
      count: recipients.length 
    });
  }

  /**
   * Check all thresholds and generate alerts
   */
  async checkThresholds(): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    for (const [key, threshold] of this.thresholds) {
      const currentValue = await this.getCurrentValue(threshold);
      
      if (currentValue === null) {
        continue;
      }

      const isViolated = this.checkThreshold(threshold, currentValue);

      if (isViolated) {
        // Check if alert already exists
        if (!this.activeAlerts.has(key)) {
          const alert = this.createAlert(threshold, currentValue);
          this.activeAlerts.set(key, alert);
          this.alertHistory.push(alert);
          newAlerts.push(alert);

          // Trim history
          if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory.shift();
          }

          // Send notifications
          await this.sendNotifications(alert);
        }
      } else {
        // Clear alert if it exists
        if (this.activeAlerts.has(key)) {
          const alert = this.activeAlerts.get(key)!;
          this.activeAlerts.delete(key);
          
          monitoringService.logInfo('Alert resolved', {
            metric: threshold.metric,
            severity: threshold.severity,
          });
        }
      }
    }

    return newAlerts;
  }

  /**
   * Get current value for a metric
   */
  private async getCurrentValue(threshold: AlertThreshold): Promise<number | null> {
    switch (threshold.metric) {
      case 'error_rate':
        return monitoringService.getErrorRate(5);

      case 'sse_connections':
        return monitoringService.getGauge('sse.connections.active') || 0;

      case 'cache_hit_ratio': {
        const hits = monitoringService.getCounter('cache.hits');
        const misses = monitoringService.getCounter('cache.misses');
        const total = hits + misses;
        return total > 0 ? (hits / total) * 100 : 100;
      }

      case 'api_response_p95': {
        // Get average P95 across all endpoints
        const systemMetrics = monitoringService.getSystemMetrics();
        const allMetrics = monitoringService.getAllMetrics();
        
        let totalP95 = 0;
        let count = 0;
        
        for (const [key, values] of allMetrics) {
          if (key.includes('api.response.duration')) {
            const stats = monitoringService.getMetricStats(
              'api.response.duration',
              this.parseMetricTags(key)
            );
            if (stats) {
              totalP95 += stats.p95;
              count++;
            }
          }
        }
        
        return count > 0 ? totalP95 / count : null;
      }

      case 'memory_usage_percent': {
        // Get from gauge if available
        return monitoringService.getGauge('system.memory.usage_percent');
      }

      default:
        // Try to get as gauge or counter
        const gauge = monitoringService.getGauge(threshold.metric);
        if (gauge !== null) return gauge;
        
        return monitoringService.getCounter(threshold.metric);
    }
  }

  /**
   * Check if threshold is violated
   */
  private checkThreshold(threshold: AlertThreshold, currentValue: number): boolean {
    switch (threshold.operator) {
      case 'gt':
        return currentValue > threshold.value;
      case 'lt':
        return currentValue < threshold.value;
      case 'gte':
        return currentValue >= threshold.value;
      case 'lte':
        return currentValue <= threshold.value;
      case 'eq':
        return currentValue === threshold.value;
      default:
        return false;
    }
  }

  /**
   * Create an alert
   */
  private createAlert(threshold: AlertThreshold, currentValue: number): Alert {
    return {
      id: this.generateAlertId(),
      threshold,
      currentValue,
      timestamp: new Date(),
      severity: threshold.severity,
      type: threshold.metric,
      metric: threshold.metric,
      message: `${threshold.description} (current: ${currentValue.toFixed(2)}, threshold: ${threshold.value})`,
      acknowledged: false,
    };
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const channels: ('email' | 'webhook' | 'console')[] = ['console'];

    // Always log to console
    this.sendConsoleNotification(alert);

    // Send webhook if configured
    if (this.webhookUrl) {
      channels.push('webhook');
      await this.sendWebhookNotification(alert);
    }

    // Send email if configured
    if (this.emailRecipients.length > 0) {
      channels.push('email');
      await this.sendEmailNotification(alert);
    }

    monitoringService.incrementCounter('alerts.sent', {
      severity: alert.severity,
    });
  }

  /**
   * Send console notification
   */
  private sendConsoleNotification(alert: Alert): void {
    // Log alert via monitoring service instead of console
    monitoringService.logInfo(`[ALERT] ${alert.message}`, {
      severity: alert.severity,
      metric: alert.threshold.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold.value,
      timestamp: alert.timestamp.toISOString(),
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            severity: alert.severity,
            message: alert.message,
            metric: alert.threshold.metric,
            currentValue: alert.currentValue,
            threshold: alert.threshold.value,
            timestamp: alert.timestamp.toISOString(),
          },
          service: 'contract-intelligence',
          environment: process.env.NODE_ENV,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      monitoringService.logInfo('Alert webhook sent', {
        alertId: alert.id,
        severity: alert.severity,
      });
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'webhook_notification',
        alertId: alert.id,
      });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Log the alert details
    monitoringService.logInfo('Sending alert email', {
      recipients: this.emailRecipients,
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
    });

    // Try to send via email service
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: ${alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#f59e0b' : '#2563eb'};">
            [${alert.severity.toUpperCase()}] ${alert.type} Alert
          </h2>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Metric:</strong> ${alert.metric} = ${alert.currentValue}</p>
          <p><strong>Threshold:</strong> ${alert.threshold}</p>
          <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
          <hr/>
          <p style="color: #6b7280; font-size: 12px;">Alert ID: ${alert.id}</p>
        </div>
      `;

      // Try Resend first
      if (process.env.RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.ALERT_FROM_EMAIL || 'alerts@contigo.ai',
            to: this.emailRecipients,
            subject: `[${alert.severity.toUpperCase()}] ${alert.type} Alert`,
            html: emailHtml,
          }),
        });
        if (response.ok) {
          monitoringService.logInfo('Alert email sent via Resend', { alertId: alert.id });
          return;
        }
      }

      // Fallback to SendGrid
      if (process.env.SENDGRID_API_KEY) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: this.emailRecipients.map(email => ({ email })) }],
            from: { email: process.env.ALERT_FROM_EMAIL || 'alerts@contigo.ai' },
            subject: `[${alert.severity.toUpperCase()}] ${alert.type} Alert`,
            content: [{ type: 'text/html', value: emailHtml }],
          }),
        });
        if (response.ok) {
          monitoringService.logInfo('Alert email sent via SendGrid', { alertId: alert.id });
          return;
        }
      }

      monitoringService.logInfo('No email service configured for alerts', { alertId: alert.id });
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'alert_email',
        alertId: alert.id,
      });
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        monitoringService.logInfo('Alert acknowledged', { alertId });
        return true;
      }
    }
    return false;
  }

  /**
   * Get all thresholds
   */
  getThresholds(): AlertThreshold[] {
    return Array.from(this.thresholds.values());
  }

  /**
   * Clear all alerts (for testing)
   */
  clearAlerts(): void {
    this.activeAlerts.clear();
    this.alertHistory = [];
  }

  // Helper methods

  private getThresholdKey(threshold: AlertThreshold): string {
    return `${threshold.metric}:${threshold.operator}`;
  }

  private parseMetricTags(key: string): Record<string, string> | undefined {
    const match = key.match(/\{(.+)\}/);
    if (!match) return undefined;

    const tags: Record<string, string> = {};
    match[1].split(',').forEach(pair => {
      const [k, v] = pair.split(':');
      tags[k] = v;
    });
    return tags;
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
