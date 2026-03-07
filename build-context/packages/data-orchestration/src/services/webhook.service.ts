import { prisma } from '../lib/prisma';
import crypto from 'crypto';


export type WebhookEvent =
  | 'rate_card.created'
  | 'rate_card.updated'
  | 'rate_card.deleted'
  | 'benchmark.calculated'
  | 'forecast.generated'
  | 'opportunity.identified'
  | 'alert.triggered';

interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  enabled: boolean;
  retryCount: number;
  maxRetries: number;
}

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  tenantId: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: any;
  error?: string;
}

/**
 * Webhook Service for event notifications
 */
export class WebhookService {
  private deliveryQueue: WebhookDelivery[] = [];
  private processing: boolean = false;

  constructor() {
    this.startDeliveryProcessor();
  }

  /**
   * Register a webhook
   */
  async registerWebhook(
    tenantId: string,
    url: string,
    events: WebhookEvent[],
    secret?: string
  ): Promise<WebhookConfig> {
    // Generate secret if not provided
    const webhookSecret = secret || this.generateSecret();

    // Store webhook configuration (in production, use database)
    const webhook: WebhookConfig = {
      id: crypto.randomUUID(),
      tenantId,
      url,
      events,
      secret: webhookSecret,
      enabled: true,
      retryCount: 0,
      maxRetries: 3,
    };

    // Persist to database
    try {
      await prisma.webhookConfig.create({
        data: {
          id: webhook.id,
          tenantId: webhook.tenantId,
          name: `Webhook ${webhook.url}`,
          url: webhook.url,
          secret: webhook.secret,
          events: webhook.events,
          isActive: webhook.enabled,
        },
      });
    } catch (e) {
      console.warn('Failed to persist webhook config to DB:', e);
    }

    return webhook;
  }

  /**
   * Send webhook event
   */
  async sendEvent(tenantId: string, event: WebhookEvent, data: any): Promise<void> {
    // Get webhooks for tenant and event
    const webhooks = await this.getWebhooksForEvent(tenantId, event);

    if (webhooks.length === 0) {
      return;
    }

    // Create payload
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      tenantId,
    };

    // Queue deliveries
    for (const webhook of webhooks) {
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
      };

      this.deliveryQueue.push(delivery);
    }

    // Trigger processing
    this.processDeliveryQueue();
  }

  /**
   * Get webhooks for event
   */
  private async getWebhooksForEvent(
    tenantId: string,
    event: WebhookEvent
  ): Promise<WebhookConfig[]> {
    try {
      const dbWebhooks = await prisma.webhookConfig.findMany({
        where: {
          tenantId,
          isActive: true,
          events: { has: event },
        },
      });
      return dbWebhooks.map(w => ({
        id: w.id,
        tenantId: w.tenantId,
        url: w.url,
        events: w.events as WebhookEvent[],
        secret: w.secret,
        enabled: w.isActive,
        retryCount: 0,
        maxRetries: 3,
      }));
    } catch (e) {
      console.warn('Failed to fetch webhooks from DB:', e);
      return [];
    }
  }

  /**
   * Deliver webhook
   */
  private async deliverWebhook(
    webhook: WebhookConfig,
    delivery: WebhookDelivery
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      // Generate signature
      const signature = this.generateSignature(delivery.payload, webhook.secret);

      // Send HTTP request
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Delivery-ID': delivery.id,
        },
        body: JSON.stringify(delivery.payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json().catch(() => null);

      return {
        success: true,
        response: responseData,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process delivery queue
   */
  private async processDeliveryQueue(): Promise<void> {
    if (this.processing || this.deliveryQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.deliveryQueue.length > 0) {
      const delivery = this.deliveryQueue.shift();
      if (!delivery) continue;

      // Get webhook config
      const webhook = await this.getWebhookById(delivery.webhookId);
      if (!webhook || !webhook.enabled) {
        continue;
      }

      // Attempt delivery
      delivery.attempts++;
      delivery.lastAttemptAt = new Date();

      const result = await this.deliverWebhook(webhook, delivery);

      if (result.success) {
        delivery.status = 'success';
        delivery.response = result.response;
        await this.recordDelivery(delivery);
      } else {
        delivery.error = result.error;

        // Retry logic
        if (delivery.attempts < webhook.maxRetries) {
          // Calculate next retry time (exponential backoff)
          const backoffMs = Math.pow(2, delivery.attempts) * 1000; // 2s, 4s, 8s
          delivery.nextRetryAt = new Date(Date.now() + backoffMs);
          delivery.status = 'pending';

          // Re-queue for retry
          setTimeout(() => {
            this.deliveryQueue.push(delivery);
            this.processDeliveryQueue();
          }, backoffMs);
        } else {
          delivery.status = 'failed';
          await this.recordDelivery(delivery);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Start delivery processor
   */
  private startDeliveryProcessor(): void {
    setInterval(() => {
      this.processDeliveryQueue();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Get webhook by ID
   */
  private async getWebhookById(webhookId: string): Promise<WebhookConfig | null> {
    try {
      const w = await prisma.webhookConfig.findUnique({ where: { id: webhookId } });
      if (!w) return null;
      return {
        id: w.id,
        tenantId: w.tenantId,
        url: w.url,
        events: w.events as WebhookEvent[],
        secret: w.secret,
        enabled: w.isActive,
        retryCount: w.failureCount,
        maxRetries: 3,
      };
    } catch (e) {
      console.warn('Failed to fetch webhook by ID:', e);
      return null;
    }
  }

  /**
   * Record delivery
   */
  private async recordDelivery(delivery: WebhookDelivery): Promise<void> {
    try {
      await prisma.webhookLog.create({
        data: {
          id: delivery.id,
          webhookId: delivery.webhookId,
          event: delivery.event,
          success: delivery.status === 'success',
          statusCode: delivery.response?.status || null,
        },
      });
      // Update delivery tracking on config
      await prisma.webhookConfig.update({
        where: { id: delivery.webhookId },
        data: {
          lastDeliveryAt: new Date(),
          ...(delivery.status === 'failed' ? { failureCount: { increment: 1 } } : {}),
        },
      });
    } catch (e) {
      console.warn('Failed to record webhook delivery:', e);
    }
  }

  /**
   * Generate webhook secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate signature for webhook payload
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * List webhook deliveries
   */
  async listDeliveries(
    webhookId: string,
    options?: {
      status?: 'pending' | 'success' | 'failed';
      limit?: number;
    }
  ): Promise<WebhookDelivery[]> {
    try {
      const logs = await prisma.webhookLog.findMany({
        where: {
          webhookId,
          ...(options?.status === 'success' ? { success: true } : options?.status === 'failed' ? { success: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
      });
      return logs.map(log => ({
        id: log.id,
        webhookId: log.webhookId,
        event: log.event as WebhookEvent,
        payload: {},
        status: log.success ? 'success' as const : 'failed' as const,
        attempts: 1,
        lastAttemptAt: log.createdAt,
      }));
    } catch (e) {
      console.warn('Failed to fetch webhook deliveries:', e);
      return [];
    }
  }

  /**
   * Disable webhook
   */
  async disableWebhook(webhookId: string): Promise<void> {
    try {
      await prisma.webhookConfig.update({ where: { id: webhookId }, data: { isActive: false } });
    } catch (e) {
      console.warn('Failed to disable webhook:', e);
    }
  }

  /**
   * Enable webhook
   */
  async enableWebhook(webhookId: string): Promise<void> {
    try {
      await prisma.webhookConfig.update({ where: { id: webhookId }, data: { isActive: true } });
    } catch (e) {
      console.warn('Failed to enable webhook:', e);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await prisma.webhookConfig.delete({ where: { id: webhookId } });
    } catch (e) {
      console.warn('Failed to delete webhook:', e);
    }
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string): Promise<{ success: boolean; error?: string }> {
    const webhook = await this.getWebhookById(webhookId);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const testPayload: WebhookPayload = {
      event: 'rate_card.created',
      timestamp: new Date().toISOString(),
      data: { test: true },
      tenantId: webhook.tenantId,
    };

    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      event: 'rate_card.created',
      payload: testPayload,
      status: 'pending',
      attempts: 0,
    };

    const result = await this.deliverWebhook(webhook, delivery);
    return result;
  }
}

// Global instance
export const webhookService = new WebhookService();

// Helper function to send webhook events
export async function sendWebhookEvent(
  tenantId: string,
  event: WebhookEvent,
  data: any
): Promise<void> {
  await webhookService.sendEvent(tenantId, event, data);
}
