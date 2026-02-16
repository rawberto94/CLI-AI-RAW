/**
 * Sync Event Webhook Service
 * 
 * Sends webhook notifications for contract source sync events.
 * Supports multiple webhook destinations per tenant with retry logic.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export type SyncEventType = 
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'sync.progress'
  | 'source.connected'
  | 'source.disconnected'
  | 'source.error'
  | 'file.synced'
  | 'file.processed'
  | 'file.failed';

export interface SyncWebhookPayload {
  event: SyncEventType;
  timestamp: string;
  data: {
    sourceId: string;
    sourceName: string;
    provider: string;
    tenantId: string;
    syncId?: string;
    progress?: {
      filesFound: number;
      filesProcessed: number;
      filesFailed: number;
      percentComplete: number;
    };
    file?: {
      id: string;
      name: string;
      path: string;
      size?: number;
      contractId?: string;
    };
    error?: {
      message: string;
      code?: string;
    };
  };
}

interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: SyncEventType[];
  enabled: boolean;
  retryCount: number;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Send webhook notification
 */
async function sendWebhook(
  config: WebhookConfig,
  payload: SyncWebhookPayload,
  retryCount = 0
): Promise<boolean> {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, config.secret);
  const deliveryId = crypto.randomUUID();

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Delivery': deliveryId,
        'X-Webhook-Event': payload.event,
        'User-Agent': 'Contigo-Webhooks/1.0',
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const success = response.ok;

    // Log delivery attempt
    await logWebhookDelivery(config.id, deliveryId, payload.event, success, response.status);

    if (!success && retryCount < MAX_RETRIES) {
      // Schedule retry with exponential backoff
      const delay = RETRY_DELAYS[retryCount] || 30000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(config, payload, retryCount + 1);
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed delivery
    await logWebhookDelivery(config.id, deliveryId, payload.event, false, 0, errorMessage);

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 30000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendWebhook(config, payload, retryCount + 1);
    }

    return false;
  }
}

/**
 * Log webhook delivery attempt
 */
async function logWebhookDelivery(
  webhookId: string,
  deliveryId: string,
  event: string,
  success: boolean,
  statusCode: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Webhook] ${success ? '✓' : '✗'} ${event} to ${webhookId} (${statusCode})`);
      if (errorMessage) {
        console.log(`  Error: ${errorMessage}`);
      }
    }

    // Store in WebhookLog table for audit trail
    // Only persist if we have a real webhook ID (not 'default' from env vars)
    if (webhookId && webhookId !== 'default') {
      await (prisma as any).webhookLog?.create({
        data: {
          webhookId,
          event,
          success,
          statusCode,
        },
      });
    }
  } catch (error) {
    // Don't fail the webhook delivery if logging fails
    console.error('Failed to log webhook delivery:', error);
  }
}

/**
 * Get webhooks configured for a tenant
 */
async function getTenantWebhooks(tenantId: string): Promise<WebhookConfig[]> {
  const webhooks: WebhookConfig[] = [];
  
  // Fetch webhook configurations from database (may not be available in all deployments)
  try {
    const prismaAny = prisma as any;
    const dbWebhooks = await prismaAny.webhookConfig?.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    }) || [];

    // Map database records to WebhookConfig interface
    dbWebhooks.forEach((wh: any) => {
      webhooks.push({
        id: wh.id,
        url: wh.url,
        secret: wh.secret || '',
        events: wh.events as SyncEventType[],
        enabled: wh.isActive,
        retryCount: 0,
      });
    });
  } catch (error) {
    // Database may not have webhookConfig table, that's okay
    console.debug('Could not fetch webhooks from database:', error);
  }

  // Also support environment variable for backward compatibility/demo
  const webhookUrl = process.env.SYNC_WEBHOOK_URL;
  const webhookSecret = process.env.SYNC_WEBHOOK_SECRET;

  if (webhookUrl) {
    webhooks.push({
      id: 'default',
      url: webhookUrl,
      secret: webhookSecret || 'default-secret',
      events: [
        'sync.started',
        'sync.completed',
        'sync.failed',
        'source.connected',
        'source.disconnected',
        'source.error',
      ],
      enabled: true,
      retryCount: 0,
    });
  }

  return webhooks;
}

/**
 * Emit a sync event to all configured webhooks
 */
export async function emitSyncEvent(
  event: SyncEventType,
  data: Omit<SyncWebhookPayload['data'], 'tenantId'> & { tenantId: string }
): Promise<void> {
  const webhooks = await getTenantWebhooks(data.tenantId);
  
  if (webhooks.length === 0) {
    return;
  }

  const payload: SyncWebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Send to all configured webhooks in parallel
  const results = await Promise.allSettled(
    webhooks
      .filter(wh => wh.enabled && wh.events.includes(event))
      .map(wh => sendWebhook(wh, payload))
  );

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Webhook ${webhooks[index].id} failed:`, result.reason);
    }
  });
}

/**
 * Convenience methods for common events
 */
export const webhookEvents = {
  syncStarted: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    syncId: string
  ) => emitSyncEvent('sync.started', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    syncId,
  }),

  syncCompleted: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    syncId: string,
    progress: SyncWebhookPayload['data']['progress']
  ) => emitSyncEvent('sync.completed', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    syncId,
    progress,
  }),

  syncFailed: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    syncId: string,
    error: { message: string; code?: string }
  ) => emitSyncEvent('sync.failed', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    syncId,
    error,
  }),

  syncProgress: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    syncId: string,
    progress: SyncWebhookPayload['data']['progress']
  ) => emitSyncEvent('sync.progress', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    syncId,
    progress,
  }),

  sourceConnected: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string
  ) => emitSyncEvent('source.connected', {
    sourceId,
    sourceName,
    provider,
    tenantId,
  }),

  sourceError: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    error: { message: string; code?: string }
  ) => emitSyncEvent('source.error', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    error,
  }),

  fileSynced: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    file: SyncWebhookPayload['data']['file']
  ) => emitSyncEvent('file.synced', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    file,
  }),

  fileProcessed: (
    sourceId: string,
    sourceName: string,
    provider: string,
    tenantId: string,
    file: SyncWebhookPayload['data']['file']
  ) => emitSyncEvent('file.processed', {
    sourceId,
    sourceName,
    provider,
    tenantId,
    file,
  }),
};

export default webhookEvents;
