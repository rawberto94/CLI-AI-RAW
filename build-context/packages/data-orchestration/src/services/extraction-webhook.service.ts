/**
 * Extraction Webhook Service
 * 
 * Sends webhook notifications for extraction events:
 * - Extraction started/completed/failed
 * - Quality alerts
 * - Batch processing updates
 * - Configurable retry with exponential backoff
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';

const logger = createLogger('extraction-webhooks');

// =============================================================================
// TYPES
// =============================================================================

export type WebhookEventType =
  | 'extraction.started'
  | 'extraction.completed'
  | 'extraction.failed'
  | 'extraction.field_extracted'
  | 'extraction.low_confidence'
  | 'extraction.anomaly_detected'
  | 'batch.started'
  | 'batch.progress'
  | 'batch.completed'
  | 'batch.failed'
  | 'artifact.created'
  | 'artifact.updated'
  | 'artifact.corrected'
  | 'quality.alert'
  | 'quality.degradation';

export interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  active: boolean;
  retryConfig: RetryConfig;
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  tenantId: string;
  data: Record<string, unknown>;
  metadata: {
    source: string;
    version: string;
    environment: string;
  };
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: {
    statusCode: number;
    body?: string;
    durationMs: number;
  };
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookStats {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageLatencyMs: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

// =============================================================================
// EXTRACTION WEBHOOK SERVICE
// =============================================================================

export class ExtractionWebhookService {
  private static instance: ExtractionWebhookService;
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryQueue: WebhookDelivery[] = [];
  private deliveryHistory: Map<string, WebhookDelivery[]> = new Map();
  private stats: Map<string, WebhookStats> = new Map();
  private processingQueue = false;

  private constructor() {
    this.startQueueProcessor();
  }

  static getInstance(): ExtractionWebhookService {
    if (!ExtractionWebhookService.instance) {
      ExtractionWebhookService.instance = new ExtractionWebhookService();
    }
    return ExtractionWebhookService.instance;
  }

  // ===========================================================================
  // WEBHOOK MANAGEMENT
  // ===========================================================================

  registerWebhook(
    tenantId: string,
    url: string,
    events: WebhookEventType[],
    options?: {
      secret?: string;
      headers?: Record<string, string>;
      retryConfig?: Partial<RetryConfig>;
    }
  ): WebhookConfig {
    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const webhook: WebhookConfig = {
      id,
      tenantId,
      url,
      events,
      secret: options?.secret,
      headers: options?.headers,
      active: true,
      retryConfig: { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(id, webhook);
    this.initStats(id);

    logger.info({ webhookId: id, tenantId, url, events }, 'Registered webhook');

    return webhook;
  }

  updateWebhook(
    webhookId: string,
    updates: Partial<Pick<WebhookConfig, 'url' | 'events' | 'active' | 'secret' | 'headers' | 'retryConfig'>>
  ): WebhookConfig | null {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    Object.assign(webhook, updates, { updatedAt: new Date() });
    this.webhooks.set(webhookId, webhook);

    return webhook;
  }

  deleteWebhook(webhookId: string): boolean {
    return this.webhooks.delete(webhookId);
  }

  getWebhook(webhookId: string): WebhookConfig | undefined {
    return this.webhooks.get(webhookId);
  }

  listWebhooks(tenantId: string): WebhookConfig[] {
    return Array.from(this.webhooks.values()).filter(w => w.tenantId === tenantId);
  }

  // ===========================================================================
  // EVENT DISPATCHING
  // ===========================================================================

  async dispatch(
    event: WebhookEventType,
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<string[]> {
    const webhooks = this.getWebhooksForEvent(tenantId, event);
    const deliveryIds: string[] = [];

    for (const webhook of webhooks) {
      const deliveryId = await this.queueDelivery(webhook, event, data);
      deliveryIds.push(deliveryId);
    }

    return deliveryIds;
  }

  async dispatchExtractionStarted(
    tenantId: string,
    contractId: string,
    artifactTypes: string[]
  ): Promise<string[]> {
    return this.dispatch('extraction.started', tenantId, {
      contractId,
      artifactTypes,
      startedAt: new Date().toISOString(),
    });
  }

  async dispatchExtractionCompleted(
    tenantId: string,
    contractId: string,
    results: Record<string, unknown>,
    metrics: {
      durationMs: number;
      fieldsExtracted: number;
      averageConfidence: number;
    }
  ): Promise<string[]> {
    return this.dispatch('extraction.completed', tenantId, {
      contractId,
      results,
      metrics,
      completedAt: new Date().toISOString(),
    });
  }

  async dispatchExtractionFailed(
    tenantId: string,
    contractId: string,
    error: string,
    details?: Record<string, unknown>
  ): Promise<string[]> {
    return this.dispatch('extraction.failed', tenantId, {
      contractId,
      error,
      details,
      failedAt: new Date().toISOString(),
    });
  }

  async dispatchLowConfidence(
    tenantId: string,
    contractId: string,
    field: string,
    confidence: number,
    threshold: number
  ): Promise<string[]> {
    return this.dispatch('extraction.low_confidence', tenantId, {
      contractId,
      field,
      confidence,
      threshold,
      detectedAt: new Date().toISOString(),
    });
  }

  async dispatchAnomalyDetected(
    tenantId: string,
    contractId: string,
    anomaly: {
      type: string;
      field: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }
  ): Promise<string[]> {
    return this.dispatch('extraction.anomaly_detected', tenantId, {
      contractId,
      anomaly,
      detectedAt: new Date().toISOString(),
    });
  }

  async dispatchQualityAlert(
    tenantId: string,
    alert: {
      type: string;
      message: string;
      affectedContracts: string[];
      metrics: Record<string, number>;
    }
  ): Promise<string[]> {
    return this.dispatch('quality.alert', tenantId, {
      alert,
      triggeredAt: new Date().toISOString(),
    });
  }

  // ===========================================================================
  // DELIVERY MANAGEMENT
  // ===========================================================================

  private async queueDelivery(
    webhook: WebhookConfig,
    event: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<string> {
    const deliveryId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload: WebhookPayload = {
      id: deliveryId,
      event,
      timestamp: new Date().toISOString(),
      tenantId: webhook.tenantId,
      data,
      metadata: {
        source: 'contigo-extraction',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
    };

    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    };

    this.deliveryQueue.push(delivery);

    // Store in history
    const history = this.deliveryHistory.get(webhook.id) || [];
    history.push(delivery);
    if (history.length > 1000) {
      history.shift();
    }
    this.deliveryHistory.set(webhook.id, history);

    return deliveryId;
  }

  private async startQueueProcessor(): Promise<void> {
    setInterval(() => this.processQueue(), 1000);
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.deliveryQueue.length === 0) return;
    this.processingQueue = true;

    try {
      const now = new Date();
      const readyDeliveries = this.deliveryQueue.filter(d => 
        d.status === 'pending' || 
        (d.status === 'retrying' && d.nextRetryAt && d.nextRetryAt <= now)
      );

      for (const delivery of readyDeliveries.slice(0, 10)) { // Process 10 at a time
        await this.processDelivery(delivery);
      }

      // Clean up completed/failed deliveries from queue
      this.deliveryQueue = this.deliveryQueue.filter(d => 
        d.status === 'pending' || d.status === 'retrying'
      );
    } finally {
      this.processingQueue = false;
    }
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || !webhook.active) {
      delivery.status = 'failed';
      delivery.error = 'Webhook not found or inactive';
      return;
    }

    delivery.attempts++;
    delivery.lastAttemptAt = new Date();
    delivery.status = 'retrying';

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhook.id,
        'X-Delivery-ID': delivery.id,
        'X-Event-Type': delivery.payload.event,
        ...webhook.headers,
      };

      if (webhook.secret) {
        const signature = await this.generateSignature(
          JSON.stringify(delivery.payload),
          webhook.secret
        );
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => undefined);

      delivery.response = {
        statusCode: response.status,
        body: responseBody?.slice(0, 1000),
        durationMs,
      };

      if (response.ok) {
        delivery.status = 'success';
        delivery.completedAt = new Date();
        this.updateStats(webhook.id, true, durationMs);
        
        logger.debug({ deliveryId: delivery.id, webhookId: webhook.id, status: response.status }, 'Webhook delivered');
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody?.slice(0, 200)}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      delivery.error = errorMessage;

      if (delivery.attempts >= webhook.retryConfig.maxRetries) {
        delivery.status = 'failed';
        delivery.completedAt = new Date();
        this.updateStats(webhook.id, false, Date.now() - startTime);
        
        logger.warn({ deliveryId: delivery.id, webhookId: webhook.id, attempts: delivery.attempts, error: errorMessage }, 'Webhook delivery failed permanently');
      } else {
        // Schedule retry
        const delay = Math.min(
          webhook.retryConfig.initialDelayMs * Math.pow(webhook.retryConfig.backoffMultiplier, delivery.attempts - 1),
          webhook.retryConfig.maxDelayMs
        );
        delivery.nextRetryAt = new Date(Date.now() + delay);
        delivery.status = 'retrying';
        
        logger.debug({ deliveryId: delivery.id, nextRetryAt: delivery.nextRetryAt, attempt: delivery.attempts }, 'Scheduling webhook retry');
      }
    }
  }

  private async generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return 'sha256=' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ===========================================================================
  // STATS & MONITORING
  // ===========================================================================

  private initStats(webhookId: string): void {
    this.stats.set(webhookId, {
      webhookId,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageLatencyMs: 0,
    });
  }

  private updateStats(webhookId: string, success: boolean, latencyMs: number): void {
    const stats = this.stats.get(webhookId);
    if (!stats) return;

    stats.totalDeliveries++;
    if (success) {
      stats.successfulDeliveries++;
      stats.lastSuccessAt = new Date();
    } else {
      stats.failedDeliveries++;
      stats.lastFailureAt = new Date();
    }
    stats.lastDeliveryAt = new Date();

    // Rolling average latency
    stats.averageLatencyMs = (stats.averageLatencyMs * (stats.totalDeliveries - 1) + latencyMs) / stats.totalDeliveries;
  }

  getStats(webhookId: string): WebhookStats | undefined {
    return this.stats.get(webhookId);
  }

  getDeliveryHistory(webhookId: string, limit: number = 100): WebhookDelivery[] {
    const history = this.deliveryHistory.get(webhookId) || [];
    return history.slice(-limit);
  }

  getDelivery(deliveryId: string): WebhookDelivery | undefined {
    for (const history of this.deliveryHistory.values()) {
      const delivery = history.find(d => d.id === deliveryId);
      if (delivery) return delivery;
    }
    return undefined;
  }

  private getWebhooksForEvent(tenantId: string, event: WebhookEventType): WebhookConfig[] {
    return Array.from(this.webhooks.values()).filter(
      w => w.tenantId === tenantId && w.active && w.events.includes(event)
    );
  }

  // ===========================================================================
  // TESTING
  // ===========================================================================

  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
  }> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const testPayload: WebhookPayload = {
      id: `test_${Date.now()}`,
      event: 'extraction.completed',
      timestamp: new Date().toISOString(),
      tenantId: webhook.tenantId,
      data: { test: true, message: 'This is a test webhook delivery' },
      metadata: {
        source: 'contigo-extraction',
        version: '1.0.0',
        environment: 'test',
      },
    };

    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Test': 'true',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      return {
        success: response.ok,
        statusCode: response.status,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const extractionWebhookService = ExtractionWebhookService.getInstance();
