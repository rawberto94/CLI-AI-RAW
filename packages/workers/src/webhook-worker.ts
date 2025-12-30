import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

import { Job } from 'bullmq';
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, SendWebhookJobData } from '@repo/utils/queue/contract-queue';
import pino from 'pino';
import crypto from 'crypto';

const logger = pino({ name: 'webhook-worker' });
const prisma = getClient();

interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
  deliveryTime: number;
}

/**
 * Send webhook with retry logic
 */
async function sendWebhook(
  url: string,
  payload: Record<string, any>,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();

  try {
    // Create signature
    const signature = secret
      ? crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(payload))
          .digest('hex')
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ContractIntelligence-Webhook/1.0',
    };

    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    const deliveryTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        response: responseData,
        error: `HTTP ${response.status}: ${response.statusText}`,
        deliveryTime,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      response: responseData,
      deliveryTime,
    };
  } catch (error) {
    const deliveryTime = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      deliveryTime,
    };
  }
}

/**
 * Process webhook delivery job
 */
export async function processWebhookJob(
  job: JobType<SendWebhookJobData>
): Promise<WebhookDeliveryResult> {
  const { tenantId, event, payload, webhookUrl, secret } = job.data;

  logger.info(
    { jobId: job.id, tenantId, event, webhookUrl },
    'Processing webhook delivery'
  );

  // Create webhook delivery record
  const delivery = await prisma.webhookDelivery.create({
    data: {
      tenantId,
      webhookId: payload.webhookId || 'system',
      event,
      payload,
      status: 'pending',
      attempt: job.attemptsMade + 1,
    },
  }).catch((error: unknown) => {
    logger.error({ error }, 'Failed to create webhook delivery record');
    return null;
  });

  // Send webhook
  const result = await sendWebhook(webhookUrl, payload, secret);

  // Update delivery record
  if (delivery) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.success ? 'success' : 'failed',
        statusCode: result.statusCode,
        response: result.response,
        error: result.error,
        sentAt: new Date(),
      },
    }).catch((error: unknown) => {
      logger.error({ error, deliveryId: delivery.id }, 'Failed to update webhook delivery');
    });
  }

  if (result.success) {
    logger.info(
      {
        jobId: job.id,
        tenantId,
        event,
        deliveryTime: result.deliveryTime,
        statusCode: result.statusCode,
      },
      'Webhook delivered successfully'
    );
  } else {
    logger.error(
      {
        jobId: job.id,
        tenantId,
        event,
        error: result.error,
        attemptsMade: job.attemptsMade,
      },
      'Webhook delivery failed'
    );

    // Throw error to trigger retry
    throw new Error(result.error || 'Webhook delivery failed');
  }

  return result;
}

/**
 * Register webhook delivery worker
 */
export function registerWebhookWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker<SendWebhookJobData, WebhookDeliveryResult>(
    QUEUE_NAMES.WEBHOOK_DELIVERY,
    processWebhookJob,
    {
      concurrency: 10, // Process 10 webhooks simultaneously
      limiter: {
        max: 50,
        duration: 60000, // Max 50 webhooks per minute
      },
    }
  );

  logger.info('Webhook delivery worker registered');

  return worker;
}
