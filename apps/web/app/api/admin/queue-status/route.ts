import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/**
 * Queue status information
 */
interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Job information
 */
interface JobInfo {
  id: string;
  name: string;
  queue: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  data: {
    contractId: string;
    contractTitle: string;
    tenantId: string;
    source: string;
  };
  attemptsMade: number;
  maxAttempts: number;
  createdAt: string;
  duration: number;
  failedReason?: string;
}

/**
 * Import batch information
 */
interface ImportBatch {
  id: string;
  name: string;
  status: string;
  totalContracts: number;
  processedContracts: number;
  failedContracts: number;
  createdAt: string;
}

/**
 * GET /api/admin/queue-status
 * Get status of all processing queues and recent jobs
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
  // Try to get actual queue stats from Redis/BullMQ
  let queues: QueueStatus[] = [];
  let recentJobs: JobInfo[] = [];
  const importBatches: ImportBatch[] = [];
  const statusMap: Record<string, number> = {};

  try {
    // Get real processing metrics from the database
    const [jobCounts, recentJobsRaw] = await Promise.all([
      prisma.processingJob.groupBy({
        by: ['status'],
        where: { tenantId: ctx.tenantId },
        _count: true,
      }),
      prisma.processingJob.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          contractId: true,
          status: true,
          progress: true,
          currentStep: true,
          error: true,
          createdAt: true,
          completedAt: true,
          retryCount: true,
          maxRetries: true,
        },
      }),
    ]);

    for (const row of jobCounts) {
      statusMap[row.status] = row._count;
    }

    queues = [
      {
        name: 'contract-processing',
        waiting: statusMap['PENDING'] || 0,
        active: statusMap['RUNNING'] || 0,
        completed: statusMap['COMPLETED'] || 0,
        failed: statusMap['FAILED'] || 0,
        delayed: statusMap['QUEUED'] || 0,
        paused: false,
      },
    ];

    recentJobs = recentJobsRaw.map((job) => ({
      id: job.id,
      name: job.currentStep || 'process-contract',
      queue: 'contract-processing',
      status: job.status === 'COMPLETED' ? 'completed' : job.status === 'FAILED' ? 'failed' : job.status === 'RUNNING' ? 'active' : 'waiting',
      progress: job.progress || 0,
      data: {
        contractId: job.contractId,
        contractTitle: '',
        tenantId: ctx.tenantId,
        source: 'upload',
      },
      attemptsMade: job.retryCount || 0,
      maxAttempts: job.maxRetries || 3,
      createdAt: job.createdAt.toISOString(),
      duration: job.completedAt ? Math.abs(job.completedAt.getTime() - job.createdAt.getTime()) : 0,
      failedReason: job.error || undefined,
    }));
  } catch {
    // Queue connection not available
  }

  const health = {
    cpu: 0,
    memory: 0,
    queueLatency: 0,
    dbConnections: 0,
    redisConnected: !!process.env.REDIS_URL,
    workersActive: statusMap['PROCESSING'] || 0,
  };

  return createSuccessResponse(ctx, {
    queues,
    recentJobs,
    importBatches,
    health,
    timestamp: new Date().toISOString(),
  });
});
