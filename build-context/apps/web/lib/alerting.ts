/**
 * Simple Alerting Service
 * Webhook-based alerting for critical events (no external dependencies)
 * Configure ALERT_WEBHOOK_URL to receive alerts
 */

import { logger } from '@/lib/logger';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  title: string;
  description: string;
  severity: AlertSeverity;
  source: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface AlertConfig {
  webhookUrl?: string;
  enabled: boolean;
  minSeverity: AlertSeverity;
  cooldownMs: number; // Prevent alert flooding
}

// Track recent alerts to prevent flooding
const alertHistory = new Map<string, number>();

// Severity ordering for comparison
const severityOrder: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

function getConfig(): AlertConfig {
  return {
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    enabled: process.env.ALERTING_ENABLED !== 'false',
    minSeverity: (process.env.ALERT_MIN_SEVERITY as AlertSeverity) || 'warning',
    cooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS || '300000', 10), // 5 minutes default
  };
}

/**
 * Check if alert should be sent based on cooldown
 */
function shouldSendAlert(alertKey: string, cooldownMs: number): boolean {
  const now = Date.now();
  const lastSent = alertHistory.get(alertKey);
  
  if (lastSent && now - lastSent < cooldownMs) {
    return false;
  }
  
  alertHistory.set(alertKey, now);
  return true;
}

/**
 * Send alert via webhook
 */
async function sendWebhookAlert(alert: Alert, webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Standard webhook format (works with Slack, Discord, custom webhooks)
        text: `${getSeverityEmoji(alert.severity)} *${alert.title}*`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${getSeverityEmoji(alert.severity)} ${alert.title}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: alert.description,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Severity:* ${alert.severity} | *Source:* ${alert.source} | *Time:* ${alert.timestamp.toISOString()}`,
              },
            ],
          },
        ],
        // Also include raw data for custom webhook handlers
        alert: {
          ...alert,
          timestamp: alert.timestamp.toISOString(),
        },
      }),
    });

    if (!response.ok) {
      logger.error('Webhook alert failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to send webhook alert', { error });
    return false;
  }
}

function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '📢';
  }
}

/**
 * Send an alert
 */
export async function sendAlert(alert: Omit<Alert, 'timestamp'>): Promise<boolean> {
  const config = getConfig();
  const fullAlert: Alert = {
    ...alert,
    timestamp: new Date(),
  };

  // Check if alerting is enabled
  if (!config.enabled) {
    logger.debug('Alerting disabled, skipping alert', { title: alert.title });
    return false;
  }

  // Check severity threshold
  if (severityOrder[alert.severity] < severityOrder[config.minSeverity]) {
    logger.debug('Alert below minimum severity threshold', {
      alertSeverity: alert.severity,
      minSeverity: config.minSeverity,
    });
    return false;
  }

  // Check cooldown
  const alertKey = `${alert.source}:${alert.title}:${alert.severity}`;
  if (!shouldSendAlert(alertKey, config.cooldownMs)) {
    logger.debug('Alert in cooldown period', { alertKey });
    return false;
  }

  // Log the alert
  logger.warn('Alert triggered', {
    title: alert.title,
    severity: alert.severity,
    source: alert.source,
    description: alert.description,
  });

  // Send via webhook if configured
  if (config.webhookUrl) {
    return sendWebhookAlert(fullAlert, config.webhookUrl);
  }

  // If no webhook, just log (alert was already logged above)
  return true;
}

/**
 * Pre-configured alert helpers
 */
export const alerts = {
  databaseDown: () =>
    sendAlert({
      title: 'Database Connection Lost',
      description: 'Cannot connect to PostgreSQL database. Application functionality is impaired.',
      severity: 'critical',
      source: 'health-check',
    }),

  redisDown: () =>
    sendAlert({
      title: 'Redis Connection Lost',
      description: 'Cannot connect to Redis. Caching and job queues may be affected.',
      severity: 'warning',
      source: 'health-check',
    }),

  highMemoryUsage: (usagePercent: number) =>
    sendAlert({
      title: 'High Memory Usage',
      description: `Memory usage is at ${usagePercent}%. Application may become unstable.`,
      severity: usagePercent > 95 ? 'critical' : 'warning',
      source: 'health-check',
      metadata: { usagePercent },
    }),

  workerQueueBacklog: (queueName: string, pendingJobs: number) =>
    sendAlert({
      title: 'Worker Queue Backlog',
      description: `Queue "${queueName}" has ${pendingJobs} pending jobs. Processing may be delayed.`,
      severity: pendingJobs > 500 ? 'critical' : 'warning',
      source: 'worker-monitor',
      metadata: { queueName, pendingJobs },
    }),

  contractProcessingFailed: (contractId: string, error: string) =>
    sendAlert({
      title: 'Contract Processing Failed',
      description: `Contract ${contractId} failed to process: ${error}`,
      severity: 'warning',
      source: 'contract-processor',
      metadata: { contractId, error },
    }),

  apiErrorSpike: (errorRate: number, endpoint: string) =>
    sendAlert({
      title: 'API Error Rate Spike',
      description: `Error rate for ${endpoint} is ${(errorRate * 100).toFixed(1)}%.`,
      severity: errorRate > 0.2 ? 'critical' : 'warning',
      source: 'api-monitor',
      metadata: { errorRate, endpoint },
    }),

  authenticationFailure: (userId: string, reason: string) =>
    sendAlert({
      title: 'Suspicious Authentication Activity',
      description: `Multiple authentication failures for user ${userId}: ${reason}`,
      severity: 'warning',
      source: 'auth-monitor',
      metadata: { userId, reason },
    }),

  custom: (title: string, description: string, severity: AlertSeverity, source: string) =>
    sendAlert({ title, description, severity, source }),
};

/**
 * Clean up old alert history entries (call periodically)
 */
export function cleanupAlertHistory(): void {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour
  
  for (const [key, timestamp] of alertHistory.entries()) {
    if (now - timestamp > maxAge) {
      alertHistory.delete(key);
    }
  }
}

// Clean up every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupAlertHistory, 3600000);
}
