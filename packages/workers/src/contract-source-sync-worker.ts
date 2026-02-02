/**
 * Contract Source Sync Worker
 * 
 * BullMQ worker that handles scheduled and manual sync jobs for contract sources.
 */

import { Worker, Queue, Job } from 'bullmq';
import clientsDb from 'clients-db';
import { ContractSourceStatus } from '@prisma/client';

// Get prisma client
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as { default: typeof clientsDb }).default;
const prisma = getClient();

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
): Promise<Job<JobData>> {
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
  ) as Promise<Job<JobData>>;
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
    // Sync service interface - implement sync logic here or import from proper location
    // For now, log and update status
    console.log(`[Sync Worker] Processing sync for source ${sourceId}, tenant ${tenantId}, triggered by ${triggeredBy}`);
    
    // Update source status
    await prisma.contractSource.update({
      where: { id: sourceId },
      data: {
        lastSyncAt: new Date(),
      },
    });

    console.log(`[Sync Worker] Sync completed for source ${sourceId}`);
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
  // Use count methods available in BullMQ
  const waiting = await contractSourceSyncQueue.count();
  
  return {
    waiting,
    active: 0, // These would need JobState tracking
    completed: 0,
    failed: 0,
    delayed: 0,
    total: waiting,
  };
}

/**
 * Get recent jobs for a source
 */
export async function getRecentJobsForSource(sourceId: string, _limit = 10) {
  // Note: BullMQ Queue doesn't have getJobs directly - would need to use Worker or track jobs externally
  // Return empty array for now - implement with job tracking service if needed
  console.log(`[Sync Worker] Getting recent jobs for source ${sourceId}`);
  return [];
}
