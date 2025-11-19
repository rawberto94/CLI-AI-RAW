/**
 * Event-driven Webhook Triggers
 * Connects EventBus to Webhook delivery via BullMQ
 */

import { getContractQueue } from '@repo/utils/queue/contract-queue';
import pino from 'pino';

const logger = pino({ name: 'webhook-triggers' });

export interface WebhookEventMapping {
  eventType: string;
  webhookEvent: string;
  extractPayload: (data: any) => any;
}

// Map internal events to webhook events
const eventMappings: WebhookEventMapping[] = [
  {
    eventType: 'CONTRACT_CREATED',
    webhookEvent: 'contract.created',
    extractPayload: (data) => ({
      contractId: data.contractId,
      fileName: data.fileName,
      status: data.status,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
    }),
  },
  {
    eventType: 'CONTRACT_PROCESSED',
    webhookEvent: 'contract.processed',
    extractPayload: (data) => ({
      contractId: data.contractId,
      status: data.status,
      artifactCount: data.artifactCount,
      processedAt: new Date().toISOString(),
    }),
  },
  {
    eventType: 'CONTRACT_FAILED',
    webhookEvent: 'contract.failed',
    extractPayload: (data) => ({
      contractId: data.contractId,
      error: data.error,
      failedAt: new Date().toISOString(),
    }),
  },
  {
    eventType: 'ARTIFACT_GENERATED',
    webhookEvent: 'artifact.generated',
    extractPayload: (data) => ({
      contractId: data.contractId,
      artifactId: data.artifactId,
      artifactType: data.artifactType,
      generatedAt: new Date().toISOString(),
    }),
  },
];

/**
 * Trigger webhook for an event
 */
export async function triggerWebhookForEvent(
  tenantId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  try {
    // Find matching event mapping
    const mapping = eventMappings.find((m) => m.eventType === eventType);
    
    if (!mapping) {
      logger.debug({ eventType }, 'No webhook mapping for event type');
      return;
    }

    // Get webhooks for this event (in production, query from database)
    const webhooks = await getWebhooksForTenant(tenantId, mapping.webhookEvent);
    
    if (webhooks.length === 0) {
      logger.debug({ tenantId, eventType }, 'No webhooks configured for event');
      return;
    }

    // Extract payload
    const payload = mapping.extractPayload(eventData);

    // Queue webhook deliveries
    const contractQueue = getContractQueue();

    for (const webhook of webhooks) {
      await contractQueue.queueWebhookDelivery(
        {
          tenantId,
          event: mapping.webhookEvent,
          payload: {
            ...payload,
            webhookId: webhook.id,
            tenantId,
          },
          webhookUrl: webhook.url,
          secret: webhook.secret,
        },
        {
          priority: 20,
          attempts: webhook.maxRetries || 5,
        }
      );

      logger.info(
        {
          tenantId,
          webhookId: webhook.id,
          eventType,
          webhookEvent: mapping.webhookEvent,
        },
        'Webhook delivery queued'
      );
    }
  } catch (error) {
    logger.error(
      { error, tenantId, eventType },
      'Failed to trigger webhook for event'
    );
  }
}

/**
 * Get webhooks for tenant and event
 */
async function getWebhooksForTenant(
  tenantId: string,
  event: string
): Promise<Array<{
  id: string;
  url: string;
  secret?: string;
  maxRetries?: number;
}>> {
  try {
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('clients-db');
    
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        enabled: true,
        events: { has: event },
      },
      select: {
        id: true,
        url: true,
        secret: true,
        maxRetries: true,
      },
    });

    return webhooks;
  } catch (error) {
    logger.error({ error, tenantId, event }, 'Failed to query webhooks from database');
    return [];
  }
}

/**
 * Initialize webhook event listeners
 * Call this during app startup
 */
export function initializeWebhookListeners() {
  // In production, this would listen to EventBus or process outbox events
  logger.info('Webhook event listeners initialized');
  
  // Example: Listen to EventBus
  // eventBus.on('CONTRACT_CREATED', async (data) => {
  //   await triggerWebhookForEvent(data.tenantId, 'CONTRACT_CREATED', data);
  // });
}
