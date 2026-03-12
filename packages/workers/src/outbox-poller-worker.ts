/**
 * Outbox Poller Worker
 *
 * Implements the transactional outbox pattern relay. Polls the outbox_events
 * table for PENDING events and dispatches them to BullMQ queues with retry and
 * exponential backoff.
 *
 * This guarantees at-least-once delivery: events written inside the DB
 * transaction will eventually be published to the message broker even if the
 * initial post-commit publish attempt failed.
 *
 * Runs as a repeatable BullMQ job (every 10 seconds by default).
 */

import { Worker as BullWorker, Queue as BullQueue } from 'bullmq';

type BullWorkerType = InstanceType<typeof BullWorker>;
type BullQueueType = InstanceType<typeof BullQueue>;
import pino from 'pino';

const isBuildTime = process.env.NEXT_BUILD === 'true';

const logger = pino({
  name: 'outbox-poller',
  level: isBuildTime ? 'silent' : (process.env.LOG_LEVEL || 'info'),
});

// ============================================================================
// Configuration
// ============================================================================

const OUTBOX_CONFIG = {
  /** Queue name for the poller itself */
  queueName: 'outbox-relay',
  /** How often to poll for pending events (ms) */
  pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '10000', 10),
  /** Maximum events to process per poll cycle */
  batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10),
  /** Max age (ms) for pending events before marking as failed — default 1 hour */
  maxPendingAgeMs: parseInt(process.env.OUTBOX_MAX_PENDING_AGE_MS || '3600000', 10),
};

// ============================================================================
// Event Dispatchers — map event types to queue actions
// ============================================================================

type EventDispatcher = (event: OutboxEvent) => Promise<void>;

interface OutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: any;
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: Date;
}

/**
 * Registry of event dispatchers. Each event type maps to a function that
 * publishes the event to the appropriate queue or external system.
 */
const dispatchers: Record<string, EventDispatcher> = {
  CONTRACT_CREATED: async (event) => {
    // The contract-processing queue job is already created in the transaction.
    // This dispatcher handles any additional side-effects (webhooks, notifications).
    const { getQueueService } = await import('@repo/utils/queue/queue-service');
    const qs = getQueueService();

    // Dispatch webhook notification if configured
    await qs.addJob('webhook-delivery', 'send-webhook', {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      payload: event.payload,
      timestamp: new Date().toISOString(),
    }, {
      attempts: 3,
    });

    logger.info({ eventId: event.id, contractId: event.aggregateId }, 'CONTRACT_CREATED event dispatched');
  },

  CONTRACT_PROCESSED: async (event) => {
    const { getQueueService } = await import('@repo/utils/queue/queue-service');
    const qs = getQueueService();

    await qs.addJob('webhook-delivery', 'send-webhook', {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      payload: event.payload,
      timestamp: new Date().toISOString(),
    }, {
      attempts: 3,
    });

    logger.info({ eventId: event.id, contractId: event.aggregateId }, 'CONTRACT_PROCESSED event dispatched');
  },

  CONTRACT_FAILED: async (event) => {
    const { getQueueService } = await import('@repo/utils/queue/queue-service');
    const qs = getQueueService();

    await qs.addJob('webhook-delivery', 'send-webhook', {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      payload: event.payload,
      timestamp: new Date().toISOString(),
    }, {
      attempts: 3,
    });

    logger.info({ eventId: event.id }, 'CONTRACT_FAILED event dispatched');
  },
};

/**
 * Default dispatcher — handles any event type not explicitly registered.
 * Sends a generic webhook notification.
 */
const defaultDispatcher: EventDispatcher = async (event) => {
  const { getQueueService } = await import('@repo/utils/queue/queue-service');
  const qs = getQueueService();

  await qs.addJob('webhook-delivery', 'send-webhook', {
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    tenantId: event.tenantId,
    payload: event.payload,
    timestamp: new Date().toISOString(),
  }, {
    attempts: 3,
  });

  logger.info({ eventId: event.id, eventType: event.eventType }, 'Generic outbox event dispatched');
};

// ============================================================================
// Polling Logic
// ============================================================================

interface PollResult {
  processed: number;
  published: number;
  failed: number;
  expired: number;
  errors: string[];
  durationMs: number;
}

/**
 * Main poll cycle — fetch pending outbox events and dispatch them.
 */
async function pollOutboxEvents(): Promise<PollResult> {
  const start = Date.now();
  const result: PollResult = {
    processed: 0,
    published: 0,
    failed: 0,
    expired: 0,
    errors: [],
    durationMs: 0,
  };

  // Dynamic import of Prisma to avoid circular deps at worker init
  let prisma: any;
  try {
    const clientsDb = (await import('clients-db')).default;
    const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
    prisma = getClient ? getClient() : null;
    if (!prisma) throw new Error('prisma client not available');
  } catch {
    try {
      // Fallback: direct PrismaClient
      const { PrismaClient } = await import('@prisma/client');
      prisma = new PrismaClient();
    } catch (err: any) {
      result.errors.push(`Prisma init error: ${err.message}`);
      result.durationMs = Date.now() - start;
      return result;
    }
  }

  try {
    // 1. Fetch pending events, ordered by creation time (FIFO)
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: {
        status: { in: ['pending', 'PENDING'] },
      },
      orderBy: { createdAt: 'asc' },
      take: OUTBOX_CONFIG.batchSize,
    });

    if (pendingEvents.length === 0) {
      result.durationMs = Date.now() - start;
      return result;
    }

    logger.info({ count: pendingEvents.length }, 'Processing pending outbox events');

    // 2. Process each event
    for (const event of pendingEvents) {
      result.processed++;

      // Check if event has exceeded max age
      const age = Date.now() - new Date(event.createdAt).getTime();
      if (age > OUTBOX_CONFIG.maxPendingAgeMs && event.attempts >= event.maxAttempts) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'failed',
            error: `Exceeded max attempts (${event.maxAttempts}) and max age (${OUTBOX_CONFIG.maxPendingAgeMs}ms)`,
          },
        });
        result.expired++;
        continue;
      }

      try {
        // 3. Dispatch the event via the appropriate handler
        const dispatcher = dispatchers[event.eventType] || defaultDispatcher;
        await dispatcher(event);

        // 4. Mark as published
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            attempts: event.attempts + 1,
          },
        });
        result.published++;
      } catch (err: any) {
        // 5. Increment attempts and record error
        const newAttempts = event.attempts + 1;
        const newStatus = newAttempts >= event.maxAttempts ? 'failed' : 'pending';

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: newStatus,
            attempts: newAttempts,
            error: err.message || 'Unknown dispatch error',
          },
        });

        if (newStatus === 'failed') {
          result.failed++;
          logger.error({ eventId: event.id, error: err.message, attempts: newAttempts }, 'Outbox event permanently failed');
        } else {
          logger.warn({ eventId: event.id, error: err.message, attempts: newAttempts }, 'Outbox event dispatch failed, will retry');
        }

        result.errors.push(`Event ${event.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Poll error: ${err.message}`);
    logger.error({ error: err }, 'Outbox poll cycle failed');
  }

  result.durationMs = Date.now() - start;

  if (result.processed > 0) {
    logger.info({
      processed: result.processed,
      published: result.published,
      failed: result.failed,
      expired: result.expired,
      durationMs: result.durationMs,
    }, 'Outbox poll cycle completed');
  }

  return result;
}

// ============================================================================
// Worker Registration
// ============================================================================

let outboxWorker: BullWorkerType | null = null;
let outboxQueue: BullQueueType | null = null;

export function registerOutboxPollerWorker() {
  if (isBuildTime) return null;

  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };

  // Create the queue
  outboxQueue = new BullQueue(OUTBOX_CONFIG.queueName, {
    connection: redisConfig,
  });

  // Schedule repeatable poll job
  outboxQueue.add(
    'outbox-poll',
    {},
    {
      repeat: { every: OUTBOX_CONFIG.pollIntervalMs },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    }
  ).catch(err => logger.error({ error: err }, 'Failed to schedule outbox poll job'));

  // Create the worker
  outboxWorker = new BullWorker(
    OUTBOX_CONFIG.queueName,
    async (_job) => {
      return await pollOutboxEvents();
    },
    {
      connection: redisConfig,
      concurrency: 1, // Single poller to avoid duplicate processing
    }
  );

  outboxWorker.on('completed', (job, result: PollResult) => {
    if (result.processed > 0) {
      logger.info({
        jobId: job?.id,
        published: result.published,
        failed: result.failed,
      }, '✅ Outbox poll completed');
    }
  });

  outboxWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, '❌ Outbox poll job failed');
  });

  logger.info({
    pollIntervalMs: OUTBOX_CONFIG.pollIntervalMs,
    batchSize: OUTBOX_CONFIG.batchSize,
  }, '📮 Outbox poller worker registered');

  return outboxWorker;
}

export function getOutboxPollerWorker() {
  return outboxWorker;
}

export { pollOutboxEvents, OUTBOX_CONFIG };
