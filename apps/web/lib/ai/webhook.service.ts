/**
 * Webhook Notification Service
 * 
 * Sends notifications via webhooks for:
 * - Batch processing completion
 * - Cost threshold alerts
 * - Analysis completion
 * - Error alerts
 */

import { prisma } from '@/lib/prisma';

// Types
export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
}

export type WebhookEvent = 
  | 'batch.started'
  | 'batch.progress'
  | 'batch.completed'
  | 'batch.failed'
  | 'analysis.completed'
  | 'cost.threshold'
  | 'error.critical';

// In-memory webhook store (in production, use database)
const webhookStore = new Map<string, WebhookConfig[]>();

class WebhookNotificationService {
  /**
   * Register a webhook for a tenant
   */
  async registerWebhook(
    tenantId: string,
    config: Omit<WebhookConfig, 'id'>
  ): Promise<WebhookConfig> {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const webhook: WebhookConfig = { ...config, id };

    const existing = webhookStore.get(tenantId) || [];
    existing.push(webhook);
    webhookStore.set(tenantId, existing);

    // Persist to database
    try {
      await prisma.webhookConfig.create({
        data: {
          id,
          name: `webhook-${id}`,
          tenantId,
          url: config.url,
          secret: config.secret ?? '',
          events: config.events,
          isActive: config.active,
        },
      });
    } catch (error) {
      console.warn('Failed to persist webhook to database:', error);
    }

    return webhook;
  }

  /**
   * Remove a webhook
   */
  async removeWebhook(tenantId: string, webhookId: string): Promise<boolean> {
    const existing = webhookStore.get(tenantId) || [];
    const index = existing.findIndex(w => w.id === webhookId);
    
    if (index === -1) return false;
    
    existing.splice(index, 1);
    webhookStore.set(tenantId, existing);

    try {
      await prisma.webhookConfig.delete({
        where: { id: webhookId },
      });
    } catch (error) {
      console.warn('Failed to delete webhook from database:', error);
    }

    return true;
  }

  /**
   * Get webhooks for a tenant
   */
  async getWebhooks(tenantId: string): Promise<WebhookConfig[]> {
    // Try database first
    try {
      const dbWebhooks = await prisma.webhookConfig.findMany({
        where: { tenantId },
      }) || [];

      if (dbWebhooks.length > 0) {
        const configs = dbWebhooks.map(w => ({
          id: w.id,
          url: w.url,
          secret: w.secret || undefined,
          events: w.events as string[],
          active: w.isActive,
        }));
        webhookStore.set(tenantId, configs);
        return configs;
      }
    } catch (error) {
      console.warn('Failed to fetch webhooks from database:', error);
    }

    return webhookStore.get(tenantId) || [];
  }

  /**
   * Send webhook notification
   */
  async notify(
    tenantId: string,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<void> {
    const webhooks = await this.getWebhooks(tenantId);
    const activeWebhooks = webhooks.filter(
      w => w.active && w.events.includes(event)
    );

    if (activeWebhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Send to all matching webhooks in parallel
    await Promise.allSettled(
      activeWebhooks.map(webhook => this.sendWebhook(webhook, payload))
    );
  }

  /**
   * Send a single webhook
   */
  private async sendWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = await this.computeSignature(body, webhook.secret);
      headers['X-Webhook-Signature'] = signature;
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${webhook.url} - ${response.status}`);
        await this.logWebhookFailure(webhook.id, response.status, payload.event);
      } else {
        await this.logWebhookSuccess(webhook.id, payload.event);
      }
    } catch (error) {
      console.error(`Webhook error: ${webhook.url}`, error);
      await this.logWebhookFailure(webhook.id, 0, payload.event);
    }
  }

  /**
   * Compute HMAC signature for webhook
   */
  private async computeSignature(body: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    return `sha256=${Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  /**
   * Log webhook success
   */
  private async logWebhookSuccess(webhookId: string, event: string): Promise<void> {
    try {
      await prisma.webhookLog.create({
        data: {
          webhookId,
          event,
          success: true,
          createdAt: new Date(),
        },
      });
    } catch (_error) {
      // Silently fail - logging shouldn't break the flow
    }
  }

  /**
   * Log webhook failure
   */
  private async logWebhookFailure(
    webhookId: string,
    statusCode: number,
    event: string
  ): Promise<void> {
    try {
      await prisma.webhookLog.create({
        data: {
          webhookId,
          event,
          success: false,
          statusCode,
          createdAt: new Date(),
        },
      });
    } catch (_error) {
      // Silently fail - logging shouldn't break the flow
    }
  }

  // =========================================================================
  // Convenience methods for specific events
  // =========================================================================

  /**
   * Notify batch processing started
   */
  async notifyBatchStarted(
    tenantId: string,
    batchId: string,
    totalContracts: number
  ): Promise<void> {
    await this.notify(tenantId, 'batch.started', {
      batchId,
      totalContracts,
    });
  }

  /**
   * Notify batch processing progress
   */
  async notifyBatchProgress(
    tenantId: string,
    batchId: string,
    processed: number,
    total: number
  ): Promise<void> {
    await this.notify(tenantId, 'batch.progress', {
      batchId,
      processed,
      total,
      percentComplete: Math.round((processed / total) * 100),
    });
  }

  /**
   * Notify batch processing completed
   */
  async notifyBatchCompleted(
    tenantId: string,
    batchId: string,
    results: {
      total: number;
      successful: number;
      failed: number;
      duration: number;
    }
  ): Promise<void> {
    await this.notify(tenantId, 'batch.completed', {
      batchId,
      ...results,
    });
  }

  /**
   * Notify batch processing failed
   */
  async notifyBatchFailed(
    tenantId: string,
    batchId: string,
    error: string
  ): Promise<void> {
    await this.notify(tenantId, 'batch.failed', {
      batchId,
      error,
    });
  }

  /**
   * Notify analysis completed
   */
  async notifyAnalysisCompleted(
    tenantId: string,
    contractId: string,
    analysisType: string,
    summary?: string
  ): Promise<void> {
    await this.notify(tenantId, 'analysis.completed', {
      contractId,
      analysisType,
      summary,
    });
  }

  /**
   * Notify cost threshold exceeded
   */
  async notifyCostThreshold(
    tenantId: string,
    currentCost: number,
    threshold: number,
    period: string
  ): Promise<void> {
    await this.notify(tenantId, 'cost.threshold', {
      currentCost,
      threshold,
      period,
      percentOver: Math.round(((currentCost - threshold) / threshold) * 100),
    });
  }

  /**
   * Notify critical error
   */
  async notifyCriticalError(
    tenantId: string,
    errorType: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.notify(tenantId, 'error.critical', {
      errorType,
      message,
      context,
    });
  }
}

export const webhookService = new WebhookNotificationService();
