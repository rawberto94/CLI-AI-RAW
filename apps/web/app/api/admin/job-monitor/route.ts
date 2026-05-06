import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Job Monitor API — BullMQ queue introspection
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    let queueData: any = {};

    try {
      // Try to connect to Redis and read BullMQ queue info
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(process.env.REDIS_URL || '', { connectTimeout: 3000 });

      const queueNames = [
        'contract-processing',
        'artifact-generation',
        'rag-indexing',
        'metadata-extraction',
        'contract-categorization',
        'agent-orchestration',
        'webhook-delivery',
        'rate-card-import',
        'benchmark-calculation',
        // Dead letter queues
        'contract-processing-dlq',
        'artifact-generation-dlq',
        'rag-indexing-dlq',
        'metadata-extraction-dlq',
      ];

      const queues = await Promise.all(queueNames.map(async (name) => {
        try {
          const prefix = `bull:${name}:`;
          const [waiting, active, completed, failed, delayed] = await Promise.all([
            redis.llen(`${prefix}wait`),
            redis.llen(`${prefix}active`),
            redis.scard(`${prefix}completed`).catch(() => redis.zcard(`${prefix}completed`)),
            redis.scard(`${prefix}failed`).catch(() => redis.zcard(`${prefix}failed`)),
            redis.zcard(`${prefix}delayed`),
          ]);
          return { name, waiting, active, completed, failed, delayed, status: active > 0 ? 'active' : 'idle' };
        } catch {
          return { name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, status: 'unknown' };
        }
      }));

      await redis.quit();

      queueData = {
        queues,
        summary: {
          totalQueues: queues.length,
          activeJobs: queues.reduce((sum, q) => sum + q.active, 0),
          waitingJobs: queues.reduce((sum, q) => sum + q.waiting, 0),
          failedJobs: queues.reduce((sum, q) => sum + q.failed, 0),
        },
      };
    } catch {
      queueData = {
        queues: [],
        summary: { totalQueues: 0, activeJobs: 0, waitingJobs: 0, failedJobs: 0 },
        error: 'Redis not available',
      };
    }

    return createSuccessResponse(ctx, queueData);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch job data. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const body = await request.json();

    if (body.action === 'retry') {
      // Retry failed job
      try {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(process.env.REDIS_URL || '', { connectTimeout: 3000 });
        // Move job from failed to waiting
        await redis.lrem(`bull:${body.queueName}:failed`, 1, body.jobId);
        await redis.rpush(`bull:${body.queueName}:wait`, body.jobId);
        await redis.quit();
        return createSuccessResponse(ctx, { retried: true, jobId: body.jobId });
      } catch {
        return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Redis not available for retry', 500);
      }
    }

    if (body.action === 'clean-failed') {
      try {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(process.env.REDIS_URL || '', { connectTimeout: 3000 });
        const deleted = await redis.del(`bull:${body.queueName}:failed`);
        await redis.quit();
        return createSuccessResponse(ctx, { cleaned: true, deleted });
      } catch {
        return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Redis not available', 500);
      }
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Job monitor error. Please try again.', 500);
  }
});
