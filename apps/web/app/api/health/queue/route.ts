/**
 * Queue Health Check Endpoint
 * GET /api/health/queue
 *
 * Returns health status and statistics for all BullMQ processing queues.
 * Used by monitoring dashboards and load balancers.
 */

import { NextRequest } from 'next/server';
import { getApiContext, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// Queue names matching @repo/utils/queue/contract-queue QUEUE_NAMES
const MONITORED_QUEUES = [
  'contract-processing',
  'artifact-generation',
  'rag-indexing',
  'metadata-extraction',
  'contract-categorization',
] as const;

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export async function GET(request: NextRequest) {
  try {
    // Dynamic import to avoid bundling BullMQ in the Next.js client bundle
    let getQueueService: any;
    try {
      const mod = await import('@repo/utils/queue/queue-service');
      getQueueService = mod.getQueueService;
    } catch {
      // Queue service not available (e.g., no Redis in dev)
      return Response.json({
        status: 'unavailable',
        message: 'Queue service not configured (Redis not available)',
        queues: [],
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    const queueService = getQueueService();
    const queueResults: QueueStats[] = [];

    // Gather stats from all monitored queues
    const statsPromises = MONITORED_QUEUES.map(async (queueName) => {
      try {
        const stats = await queueService.getQueueStats(queueName);
        return {
          name: queueName,
          waiting: stats.waiting ?? 0,
          active: stats.active ?? 0,
          completed: stats.completed ?? 0,
          failed: stats.failed ?? 0,
          delayed: stats.delayed ?? 0,
          paused: stats.paused ?? 0,
        };
      } catch {
        // Individual queue may not exist yet
        return {
          name: queueName,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        };
      }
    });

    const results = await Promise.all(statsPromises);
    queueResults.push(...results);

    // Determine overall health
    const totalWaiting = queueResults.reduce((sum, q) => sum + q.waiting, 0);
    const totalActive = queueResults.reduce((sum, q) => sum + q.active, 0);
    const totalFailed = queueResults.reduce((sum, q) => sum + q.failed, 0);

    // Health thresholds
    const isHealthy = totalWaiting < 1000 && totalActive < 50;
    const isDegraded = totalWaiting >= 1000 || totalActive >= 50 || totalFailed > 100;
    const status = isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'warning';

    return Response.json({
      status,
      summary: {
        totalWaiting,
        totalActive,
        totalFailed,
      },
      queues: queueResults,
      timestamp: new Date().toISOString(),
    }, { status: isHealthy ? 200 : 503 });

  } catch (error) {
    logger.error(`Queue health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return Response.json({
      status: 'error',
      message: 'Failed to retrieve queue health',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
