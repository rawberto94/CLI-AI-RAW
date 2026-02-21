/**
 * Contract Source Sync Worker
 * 
 * BullMQ worker that handles scheduled and manual sync jobs for contract sources.
 */

// @ts-ignore - bullmq types resolve correctly from workers tsconfig
import { Worker, Queue, Job } from 'bullmq';
import clientsDb from 'clients-db';
import { ContractSourceStatus } from '@prisma/client';

// Get prisma client
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as { default: typeof clientsDb }).default;
const prisma = getClient();

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST,
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
// @ts-ignore - generic Queue resolved from workers tsconfig
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
    // Mark source as SYNCING
    const source = await prisma.contractSource.update({
      where: { id: sourceId },
      data: { status: ContractSourceStatus.SYNCING },
    });

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    // Create sync audit record
    const sync = await prisma.sourceSync.create({
      data: {
        tenantId,
        sourceId,
        status: 'PENDING' as any,
        syncMode: source.syncMode || ('FULL' as any),
        triggeredBy: triggeredBy || 'WORKER',
      },
    });

    await job.updateProgress(10);

    // Call the sync API endpoint to trigger the actual sync
    // This delegates to the ContractSourceSyncService which handles
    // connector creation, file listing, downloading, and contract creation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3005';
    const internalSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;
    
    const response = await fetch(`${appUrl}/api/contract-sources/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'Authorization': `Bearer ${internalSecret}` } : {}),
        'x-user-id': triggeredBy?.replace('USER:', '') || 'system',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        sourceId,
        syncMode: source.syncMode || 'FULL',
      }),
      signal: AbortSignal.timeout(1_800_000), // 30 minute timeout for large syncs (500+ contracts)
    });

    await job.updateProgress(50);

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Sync API returned ${response.status}: ${error}`);
    }

    const result = await response.json();

    await job.updateProgress(90);

    // Update source with completion info
    await prisma.contractSource.update({
      where: { id: sourceId },
      data: {
        lastSyncAt: new Date(),
        status: ContractSourceStatus.CONNECTED,
      },
    });

    // Update sync record
    await prisma.sourceSync.update({
      where: { id: sync.id },
      data: {
        status: 'COMPLETED' as any,
        completedAt: new Date(),
        filesFound: result?.data?.progress?.filesFound || 0,
        filesProcessed: result?.data?.progress?.filesProcessed || 0,
        filesFailed: result?.data?.progress?.filesFailed || 0,
      },
    });

    await job.updateProgress(100);
    console.log(`[Sync Worker] Sync completed for source ${sourceId} — ${result?.data?.progress?.filesProcessed || 0} files processed`);
  } catch (error) {
    console.error(`[Sync Worker] Error syncing source ${sourceId}:`, error);
    
    // Mark source as error state
    await prisma.contractSource.update({
      where: { id: sourceId },
      data: { 
        status: ContractSourceStatus.ERROR,
        lastErrorMessage: error instanceof Error ? error.message : String(error),
        lastErrorAt: new Date(),
      },
    }).catch(() => {}); // Don't fail on cleanup

    throw error; // Re-throw for BullMQ retry
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
// @ts-ignore - generic Worker resolved from workers tsconfig
export function createContractSourceSyncWorker(): Worker<JobData> {
  // @ts-ignore
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
  // Get job counts using BullMQ - casting to access methods
  const queue = contractSourceSyncQueue as any;
  
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount?.() ?? queue.count?.() ?? 0,
      queue.getActiveCount?.() ?? 0,
      queue.getCompletedCount?.() ?? 0,
      queue.getFailedCount?.() ?? 0,
      queue.getDelayedCount?.() ?? 0,
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  } catch {
    // Fallback if methods not available
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
    };
  }
}

/**
 * Get recent jobs for a source
 */
export async function getRecentJobsForSource(sourceId: string, limit = 10) {
  try {
    const syncs = await prisma.sourceSync.findMany({
      where: { sourceId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        syncMode: true,
        triggeredBy: true,
        startedAt: true,
        completedAt: true,
        filesFound: true,
        filesProcessed: true,
        filesFailed: true,
        errorMessage: true,
      },
    });
    return syncs;
  } catch (error) {
    console.warn(`[Sync Worker] Failed to fetch recent jobs for source ${sourceId}:`, error);
    return [];
  }
}
