/**
 * Processing Status API
 * GET /api/processing-status - Real-time queue and job metrics
 * POST /api/processing-status - Job management actions
 *
 * Returns real queue depths from Redis/BullMQ and actual job counts from database.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInitializedQueueService } from "@/lib/queue-init";
import { QUEUE_NAMES } from '@repo/utils/queue/contract-queue';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import pino from 'pino';

const logger = pino({ name: 'processing-status-api' });

// Simple in-memory cache for metrics (< 200ms response time)
let metricsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000; // 5 second cache

async function getQueueMetrics() {
  const queueService = getInitializedQueueService();
  if (!queueService) {
    return { available: false, queues: {} };
  }

  const queueNames = [
    QUEUE_NAMES.CONTRACT_PROCESSING,
    QUEUE_NAMES.ARTIFACT_GENERATION,
    QUEUE_NAMES.RAG_INDEXING,
  ];

  const queues: Record<string, any> = {};
  for (const name of queueNames) {
    try {
      const stats = await queueService.getQueueStats(name);
      queues[name] = {
        waiting: stats?.waiting ?? 0,
        active: stats?.active ?? 0,
        completed: stats?.completed ?? 0,
        failed: stats?.failed ?? 0,
        delayed: stats?.delayed ?? 0,
        paused: stats?.paused ?? 0,
      };
    } catch {
      queues[name] = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, error: 'unavailable' };
    }
  }

  return { available: true, queues };
}

async function getJobStats(tenantId: string) {
  try {
    const jobStats = await prisma.processingJob.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    return {
      pending: jobStats.find(s => s.status === 'PENDING')?._count?.id || 0,
      running: jobStats.find(s => s.status === 'RUNNING')?._count?.id || 0,
      completed: jobStats.find(s => s.status === 'COMPLETED')?._count?.id || 0,
      failed: jobStats.find(s => s.status === 'FAILED')?._count?.id || 0,
      retrying: jobStats.find(s => s.status === 'RETRYING')?._count?.id || 0,
      cancelled: jobStats.find(s => s.status === 'CANCELLED')?._count?.id || 0,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get job stats from database');
    return { pending: 0, running: 0, completed: 0, failed: 0, retrying: 0, cancelled: 0 };
  }
}

async function getRecentJobs(tenantId: string, limit = 20) {
  try {
    return await prisma.processingJob.findMany({
      where: { tenantId },
      select: {
        id: true,
        contractId: true,
        status: true,
        progress: true,
        currentStep: true,
        priority: true,
        queueId: true,
        retryCount: true,
        maxRetries: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get recent jobs');
    return [];
  }
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const jobId = searchParams.get("jobId");
  const type = searchParams.get("type") || "all";
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  // If requesting specific contract status, query database directly
  if (contractId && type === "status") {
    try {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
      });

      if (!contract) {
        return createErrorResponse(ctx, 'NOT_FOUND', `Contract ${contractId} not found`, 404);
      }

      const processingJob = await prisma.processingJob.findFirst({
        where: { contractId, tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, progress: true, currentStep: true,
          queueId: true, priority: true, error: true, retryCount: true,
        },
      });

      return createSuccessResponse(ctx, {
        contractId,
        status: contract.status.toLowerCase(),
        currentStage: processingJob?.currentStep || 'unknown',
        progress: processingJob?.progress || (contract.status === 'COMPLETED' ? 100 : 0),
        processingJob,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to get contract status');
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to get contract status', 500);
    }
  }

  // If requesting specific job status
  if (jobId) {
    try {
      const job = await prisma.processingJob.findFirst({
        where: { id: jobId, tenantId },
        select: {
          id: true, contractId: true, status: true, progress: true,
          currentStep: true, queueId: true, priority: true, error: true,
          retryCount: true, maxRetries: true, startedAt: true,
          completedAt: true, createdAt: true,
        },
      });

      if (!job) {
        return createErrorResponse(ctx, 'NOT_FOUND', `Job ${jobId} not found`, 404);
      }

      return createSuccessResponse(ctx, { job, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job status');
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to get job status', 500);
    }
  }

  // Check cache for aggregate metrics
  const now = Date.now();
  if (metricsCache && (now - metricsCache.timestamp) < CACHE_TTL_MS && type === 'all') {
    return createSuccessResponse(ctx, metricsCache.data);
  }

  // Build response based on type
  const timestamp = new Date().toISOString();

  switch (type) {
    case "jobs": {
      const jobs = await getRecentJobs(tenantId);
      const jobCounts = await getJobStats(tenantId);
      return createSuccessResponse(ctx, {
        data: jobs,
        total: Object.values(jobCounts).reduce((a, b) => a + b, 0),
        counts: jobCounts,
        timestamp,
      });
    }

    case "workers": {
      const queueMetrics = await getQueueMetrics();
      return createSuccessResponse(ctx, {
        data: queueMetrics,
        timestamp,
      });
    }

    case "metrics": {
      const [queueMetrics, jobCounts] = await Promise.all([
        getQueueMetrics(),
        getJobStats(tenantId),
      ]);

      const totalJobs = Object.values(jobCounts).reduce((a, b) => a + b, 0);
      const totalActive = Object.values(queueMetrics.queues).reduce(
        (sum: number, q: any) => sum + (q.active || 0), 0
      );
      const totalWaiting = Object.values(queueMetrics.queues).reduce(
        (sum: number, q: any) => sum + (q.waiting || 0), 0
      );

      return createSuccessResponse(ctx, {
        data: {
          totalJobs,
          activeJobs: jobCounts.running,
          completedJobs: jobCounts.completed,
          failedJobs: jobCounts.failed,
          queueDepth: totalWaiting,
          activeWorkers: totalActive,
          queueAvailable: queueMetrics.available,
        },
        timestamp,
      });
    }

    case "all":
    default: {
      const [queueMetrics, jobCounts, recentJobs] = await Promise.all([
        getQueueMetrics(),
        getJobStats(tenantId),
        getRecentJobs(tenantId, 10),
      ]);

      const totalWaiting = Object.values(queueMetrics.queues).reduce(
        (sum: number, q: any) => sum + (q.waiting || 0), 0
      );
      const totalActive = Object.values(queueMetrics.queues).reduce(
        (sum: number, q: any) => sum + (q.active || 0), 0
      );

      const responseData = {
        queues: queueMetrics.queues,
        queueAvailable: queueMetrics.available,
        jobs: jobCounts,
        recentJobs,
        summary: {
          totalQueueDepth: totalWaiting,
          totalActiveWorkers: totalActive,
          totalJobs: Object.values(jobCounts).reduce((a, b) => a + b, 0),
        },
        timestamp,
      };

      // Cache the aggregated response
      metricsCache = { data: responseData, timestamp: now };

      return createSuccessResponse(ctx, responseData);
    }
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action, jobId, data } = body;
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  if (!action) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Action is required', 400);
  }

  const queueService = getInitializedQueueService();

  switch (action) {
    case "pause_job": {
      if (!jobId) return createErrorResponse(ctx, 'BAD_REQUEST', 'Job ID is required', 400);
      // Update job status in database
      try {
        await prisma.processingJob.updateMany({
          where: { id: jobId, tenantId },
          data: { status: 'CANCELLED' },
        });
        return createSuccessResponse(ctx, {
          message: `Job ${jobId} paused`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error, jobId }, 'Failed to pause job');
        return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to pause job', 500);
      }
    }

    case "retry_job": {
      if (!jobId) return createErrorResponse(ctx, 'BAD_REQUEST', 'Job ID is required', 400);
      try {
        const job = await prisma.processingJob.findFirst({
          where: { id: jobId, tenantId },
        });
        if (!job) return createErrorResponse(ctx, 'NOT_FOUND', 'Job not found', 404);

        await prisma.processingJob.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            retryCount: { increment: 1 },
            error: null,
          },
        });

        // Re-queue if queue service is available
        if (queueService && job.contractId) {
          const contract = await prisma.contract.findUnique({
            where: { id: job.contractId },
            select: { storagePath: true, mimeType: true },
          });
          if (contract) {
            const { triggerArtifactGeneration } = await import('@/lib/artifact-trigger');
            await triggerArtifactGeneration({
              contractId: job.contractId,
              tenantId,
              filePath: contract.storagePath || '',
              mimeType: contract.mimeType || 'application/pdf',
              useQueue: true,
              isReprocess: true,
              source: 'reprocess',
            });
          }
        }

        return createSuccessResponse(ctx, {
          message: `Job ${jobId} queued for retry`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error, jobId }, 'Failed to retry job');
        return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to retry job', 500);
      }
    }

    case "cancel_job": {
      if (!jobId) return createErrorResponse(ctx, 'BAD_REQUEST', 'Job ID is required', 400);
      try {
        await prisma.processingJob.updateMany({
          where: { id: jobId, tenantId },
          data: { status: 'CANCELLED', error: 'Cancelled by user' },
        });
        return createSuccessResponse(ctx, {
          message: `Job ${jobId} cancelled`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error, jobId }, 'Failed to cancel job');
        return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to cancel job', 500);
      }
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid action: ${action}`, 400);
  }
});
