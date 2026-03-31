/**
 * Embedding Refresh Scheduler
 *
 * Periodically scans ContractMetadata for stale embeddings and queues
 * re-indexing jobs via BullMQ.
 *
 * "Stale" means:
 *  1. embeddingVersion !== current RAG_EMBED_MODEL  (model upgrade)
 *  2. embeddingVersion === 'text-only'              (prior embedding failure)
 *  3. lastEmbeddingAt < contract.updatedAt          (text updated post-embed)
 *
 * Usage:
 *   import { registerEmbeddingRefreshScheduler } from './embedding-refresh-scheduler';
 *   registerEmbeddingRefreshScheduler();      // registers repeatable BullMQ job
 *
 * Configuration via env:
 *   RAG_EMBED_MODEL           — current model name (default: text-embedding-3-small)
 *   EMBEDDING_REFRESH_CRON    — cron expression   (default: every day at 03:00 UTC)
 *   EMBEDDING_REFRESH_BATCH   — contracts per run  (default: 50)
 *   EMBEDDING_REFRESH_ENABLED — set to 'false' to disable
 */

import pino from 'pino';
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import {
  getQueueService,
  JOB_NAMES,
  QUEUE_NAMES,
  QUEUE_PRIORITY,
  type JobType,
} from './compat/repo-utils';

const logger = pino({ name: 'embedding-refresh-scheduler' });
const prisma = getClient();

// ── Types ───────────────────────────────────────────────────────────────────

interface RefreshResult {
  scanned: number;
  staleFound: number;
  queued: number;
  skipped: number;
  errors: string[];
}

// ── Core processing ─────────────────────────────────────────────────────────

/**
 * Scan for contracts with stale or missing embeddings and queue re-indexing.
 */
export async function processEmbeddingRefresh(
  job?: JobType<Record<string, unknown>>,
): Promise<RefreshResult> {
  const currentModel = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';
  const batchSize = parseInt(process.env.EMBEDDING_REFRESH_BATCH || '50', 10);

  logger.info({ currentModel, batchSize }, 'Starting embedding refresh scan');

  const result: RefreshResult = {
    scanned: 0,
    staleFound: 0,
    queued: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Find contracts whose embeddingVersion doesn't match the current model,
    // or where embedding failed previously (text-only).
    const staleMetadata = await prisma.contractMetadata.findMany({
      where: {
        OR: [
          // Model mismatch — embeddings generated with an older model
          {
            embeddingVersion: { not: currentModel },
            embeddingCount: { gt: 0 },
          },
          // Prior embedding failure — text-only fallback
          {
            embeddingVersion: 'text-only',
          },
          // Never embedded at all (version is null)
          {
            embeddingVersion: null,
          },
        ],
      },
      select: {
        contractId: true,
        tenantId: true,
        embeddingVersion: true,
        embeddingCount: true,
        lastEmbeddingAt: true,
        systemFields: true,
      },
      take: batchSize,
      orderBy: [
        // Prioritize: never-embedded → text-only → stale model
        { embeddingVersion: 'asc' },
        { lastEmbeddingAt: 'asc' },
      ],
    });

    result.scanned = staleMetadata.length;
    result.staleFound = staleMetadata.length;

    if (staleMetadata.length === 0) {
      logger.info('No stale embeddings found');
      return result;
    }

    logger.info({ count: staleMetadata.length }, 'Found contracts with stale embeddings');

    const queueService = getQueueService();

    for (const meta of staleMetadata) {
      try {
        // Check that the contract still exists and has text
        const contract = await prisma.contract.findFirst({
          where: { id: meta.contractId },
          select: { id: true, tenantId: true, rawText: true, status: true },
        });

        if (!contract || !contract.rawText) {
          result.skipped++;
          continue;
        }

        // Queue re-indexing job (deduplicates via jobId)
        await queueService.addJob(
          QUEUE_NAMES.RAG_INDEXING,
          JOB_NAMES.INDEX_CONTRACT,
          {
            contractId: contract.id,
            tenantId: contract.tenantId || meta.tenantId,
            artifactIds: [],
            source: 'embedding-refresh',
          },
          {
            priority: QUEUE_PRIORITY.BACKGROUND,
            jobId: `rag-refresh-${contract.id}`,
            delay: result.queued * 2000, // Stagger jobs by 2s to avoid rate limits
          },
        );

        result.queued++;

        logger.info({
          contractId: contract.id,
          oldVersion: meta.embeddingVersion,
          newVersion: currentModel,
        }, 'Queued embedding refresh');
      } catch (err) {
        const msg = `Failed to queue refresh for ${meta.contractId}: ${(err as Error).message}`;
        result.errors.push(msg);
        logger.warn(msg);
      }
    }

    // Also detect contracts whose text was updated AFTER their last embedding
    try {
      const updatedContracts = await prisma.$queryRaw<
        Array<{ id: string; tenantId: string }>
      >`
        SELECT c.id, c."tenantId"
        FROM "Contract" c
        JOIN "ContractMetadata" cm ON cm."contractId" = c.id
        WHERE cm."embeddingVersion" = ${currentModel}
          AND cm."lastEmbeddingAt" IS NOT NULL
          AND c."updatedAt" > cm."lastEmbeddingAt"
          AND c."rawText" IS NOT NULL
        LIMIT ${batchSize - result.queued}
      `;

      for (const contract of updatedContracts) {
        try {
          await queueService.addJob(
            QUEUE_NAMES.RAG_INDEXING,
            JOB_NAMES.INDEX_CONTRACT,
            {
              contractId: contract.id,
              tenantId: contract.tenantId,
              artifactIds: [],
              source: 'embedding-refresh',
            },
            {
              priority: QUEUE_PRIORITY.BACKGROUND,
              jobId: `rag-refresh-${contract.id}`,
              delay: result.queued * 2000,
            },
          );
          result.queued++;
          result.staleFound++;
        } catch (err) {
          result.errors.push(`Queue failed for ${contract.id}: ${(err as Error).message}`);
        }
      }
    } catch (queryErr) {
      logger.warn({ error: (queryErr as Error).message }, 'Updated-contract query failed (non-fatal)');
    }
  } catch (err) {
    const msg = `Embedding refresh scan failed: ${(err as Error).message}`;
    logger.error(msg);
    result.errors.push(msg);
  }

  logger.info(result, 'Embedding refresh scan complete');
  return result;
}

// ── BullMQ registration ─────────────────────────────────────────────────────

/**
 * Register a repeatable BullMQ job that runs the embedding refresh scan
 * on a cron schedule.
 *
 * Also registers the worker that processes the job.
 */
export function registerEmbeddingRefreshScheduler() {
  if (process.env.EMBEDDING_REFRESH_ENABLED === 'false') {
    logger.info('Embedding refresh scheduler disabled via EMBEDDING_REFRESH_ENABLED=false');
    return null;
  }

  const queueService = getQueueService();
  const cron = process.env.EMBEDDING_REFRESH_CRON || '0 3 * * *'; // Default: 03:00 UTC daily

  // Register the worker
  const worker = queueService.registerWorker(
    QUEUE_NAMES.EMBEDDING_REFRESH,
    async (job: JobType<Record<string, unknown>>) => {
      return processEmbeddingRefresh(job);
    },
    {
      concurrency: 1, // Only one refresh scan at a time
    },
  );

  // Add the repeatable job
  const queue = (queueService as any).getQueue(QUEUE_NAMES.EMBEDDING_REFRESH);
  if (queue?.add) {
    queue.add(
      JOB_NAMES.REFRESH_EMBEDDINGS,
      {},
      {
        repeat: { pattern: cron },
        jobId: 'embedding-refresh-repeatable',
        removeOnComplete: { age: 86400, count: 10 },
        removeOnFail: { age: 604800, count: 50 },
      },
    ).then(() => {
      logger.info({ cron }, 'Embedding refresh repeatable job registered');
    }).catch((err: Error) => {
      logger.error({ error: err.message }, 'Failed to register repeatable job');
    });
  }

  logger.info({ cron }, 'Embedding refresh scheduler registered');
  return worker;
}

// ── Manual trigger (CLI / admin API) ────────────────────────────────────────

/**
 * Trigger an immediate embedding refresh scan (for admin endpoints / CLI).
 */
export async function triggerEmbeddingRefresh(): Promise<RefreshResult> {
  return processEmbeddingRefresh();
}
