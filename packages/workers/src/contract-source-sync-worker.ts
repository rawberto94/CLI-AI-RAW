/**
 * Contract Source Sync Worker
 * 
 * BullMQ worker that handles scheduled and manual sync jobs for contract sources.
 */

import { Worker, Queue, Job } from 'bullmq';
import { prisma } from '../../lib/prisma';
import { ContractSourceStatus, SourceSyncStatus } from '@prisma/client';

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Queue name
const QUEUE_NAME = 'contract-source-sync';

// Job types
interface SyncJobData {
  type: 'manual' | 'scheduled';
  sourceId: string;
  tenantId: string;
  triggeredBy?: string;
}

interface SchedulerJobData {
  type: 'check-schedules';
}

type JobData = SyncJobData | SchedulerJobData;

// Create the queue
export const contractSourceSyncQueue = new Queue<JobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * Add a sync job to the queue
 */
export async function queueSyncJob(
  sourceId: string,
  tenantId: string,
  options?: {
    triggeredBy?: string;
    delay?: number;
    priority?: number;
  }
): Promise<Job<SyncJobData>> {
  return contractSourceSyncQueue.add(
    'sync',
    {
      type: 'manual',
      sourceId,
      tenantId,
      triggeredBy: options?.triggeredBy || 'MANUAL',
    },
    {
      delay: options?.delay,
      priority: options?.priority,
      jobId: `sync-${sourceId}-${Date.now()}`,
    }
  );
}

/**
 * Schedule the periodic scheduler job
 */
export async function schedulePeriodicCheck(): Promise<void> {
  // Add a repeating job to check schedules every minute
  await contractSourceSyncQueue.add(
    'check-schedules',
    { type: 'check-schedules' },
    {
      repeat: {
        pattern: '* * * * *', // Every minute
      },
      jobId: 'scheduler',
    }
  );
}

/**
 * Process sync jobs
 */
async function processSyncJob(job: Job<SyncJobData>): Promise<void> {
  const { sourceId, tenantId, triggeredBy } = job.data;

  console.log(`[Sync Worker] Starting sync for source ${sourceId}`);

  try {
    // Import sync service dynamically to avoid circular dependencies
    const { contractSourceSyncService } = await import('../../lib/integrations/sync-service');

    const result = await contractSourceSyncService.startSync(sourceId, tenantId, {
      triggeredBy,
    });

    if (result.success) {
      console.log(
        `[Sync Worker] Sync completed for source ${sourceId}: ` +
        `${result.progress.filesProcessed} files processed, ` +
        `${result.progress.filesSkipped} skipped, ` +
        `${result.progress.filesFailed} failed`
      );
    } else {
      console.error(`[Sync Worker] Sync failed for source ${sourceId}: ${result.error}`);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error(`[Sync Worker] Error syncing source ${sourceId}:`, error);
    throw error;
  }
}

/**
 * Check scheduled syncs and queue due jobs
 */
async function checkScheduledSyncs(): Promise<void> {
  console.log('[Sync Worker] Checking scheduled syncs...');

  try {
    // Find sources that need syncing
    const sources = await prisma.contractSource.findMany({
      where: {
        isActive: true,
        syncEnabled: true,
        status: {
          not: ContractSourceStatus.SYNCING,
        },
        OR: [
          { lastSyncAt: null },
          {
            // lastSyncAt + syncInterval minutes < now
            lastSyncAt: {
              lt: new Date(Date.now() - 1000), // Will be filtered further below
            },
          },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        syncInterval: true,
        lastSyncAt: true,
      },
    });

    const now = Date.now();

    for (const source of sources) {
      // Check if sync is due
      const lastSync = source.lastSyncAt?.getTime() || 0;
      const intervalMs = (source.syncInterval || 60) * 60 * 1000; // Convert minutes to ms
      const nextSyncDue = lastSync + intervalMs;

      if (now >= nextSyncDue) {
        console.log(`[Sync Worker] Queueing scheduled sync for source ${source.name} (${source.id})`);
        
        await queueSyncJob(source.id, source.tenantId, {
          triggeredBy: 'SCHEDULER',
          priority: 10, // Lower priority than manual syncs
        });
      }
    }
  } catch (error) {
    console.error('[Sync Worker] Error checking scheduled syncs:', error);
  }
}

/**
 * Create and start the worker
 */
export function createContractSourceSyncWorker(): Worker<JobData> {
  const worker = new Worker<JobData>(
    QUEUE_NAME,
    async (job) => {
      if (job.data.type === 'check-schedules') {
        await checkScheduledSyncs();
      } else {
        await processSyncJob(job as Job<SyncJobData>);
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 syncs concurrently
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs per minute
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Sync Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Sync Worker] Job ${job?.id} failed:`, error);
  });

  worker.on('error', (error) => {
    console.error('[Sync Worker] Worker error:', error);
  });

  console.log('[Sync Worker] Contract source sync worker started');

  return worker;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    contractSourceSyncQueue.getWaitingCount(),
    contractSourceSyncQueue.getActiveCount(),
    contractSourceSyncQueue.getCompletedCount(),
    contractSourceSyncQueue.getFailedCount(),
    contractSourceSyncQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  };
}

/**
 * Get recent jobs for a source
 */
export async function getRecentJobsForSource(sourceId: string, limit = 10) {
  const jobs = await contractSourceSyncQueue.getJobs(
    ['completed', 'failed', 'active', 'waiting'],
    0,
    100
  );

  return jobs
    .filter((job) => 
      job.data.type !== 'check-schedules' && 
      (job.data as SyncJobData).sourceId === sourceId
    )
    .slice(0, limit)
    .map((job) => ({
      id: job.id,
      status: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : 'running',
      createdAt: new Date(job.timestamp),
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      duration: job.finishedOn ? job.finishedOn - job.timestamp : null,
      error: job.failedReason,
    }));
}
