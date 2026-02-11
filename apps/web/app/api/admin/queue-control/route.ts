import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

/**
 * POST /api/admin/queue-control
 * Control queue operations (pause, resume, clear, retry) via real BullMQ APIs
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { action, queueName, jobId, batchId } = body;

  if (!action) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Action is required', 400);
  }

  // Dynamically import BullMQ Queue to connect to Redis
  const { Queue } = await import('bullmq');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || undefined,
  };

  let message = '';

  try {
    switch (action) {
      case 'pause': {
        if (!queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
        const queue = new Queue(queueName, { connection });
        await queue.pause();
        await queue.close();
        message = `Queue "${queueName}" has been paused`;
        break;
      }

      case 'resume': {
        if (!queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
        const queue = new Queue(queueName, { connection });
        await queue.resume();
        await queue.close();
        message = `Queue "${queueName}" has been resumed`;
        break;
      }

      case 'clear-completed': {
        if (!queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
        const queue = new Queue(queueName, { connection });
        await queue.clean(0, 0, 'completed');
        await queue.close();
        message = `Completed jobs cleared from "${queueName}"`;
        break;
      }

      case 'clear-failed': {
        if (!queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
        const queue = new Queue(queueName, { connection });
        await queue.clean(0, 0, 'failed');
        await queue.close();
        message = `Failed jobs cleared from "${queueName}"`;
        break;
      }

      case 'retry-job': {
        if (!jobId || !queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Job ID and queue name are required', 400);
        const queue = new Queue(queueName, { connection });
        const job = await queue.getJob(jobId);
        if (!job) {
          await queue.close();
          return createErrorResponse(ctx, 'NOT_FOUND', `Job "${jobId}" not found in "${queueName}"`, 404);
        }
        await job.retry();
        await queue.close();
        message = `Job "${jobId}" has been queued for retry`;
        break;
      }

      case 'retry-all-failed': {
        if (!queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
        const queue = new Queue(queueName, { connection });
        const failed = await queue.getFailed(0, 1000);
        let retried = 0;
        for (const job of failed) {
          try { await job.retry(); retried++; } catch { /* skip non-retryable */ }
        }
        await queue.close();
        message = `${retried} failed jobs in "${queueName}" queued for retry`;
        break;
      }

      case 'drain': {
        if (!queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
        const queue = new Queue(queueName, { connection });
        await queue.drain();
        await queue.close();
        message = `Queue "${queueName}" has been drained (all waiting jobs removed)`;
        break;
      }

      case 'cancel-job': {
        if (!jobId || !queueName) return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Job ID and queue name are required', 400);
        const queue = new Queue(queueName, { connection });
        const job = await queue.getJob(jobId);
        if (!job) {
          await queue.close();
          return createErrorResponse(ctx, 'NOT_FOUND', `Job "${jobId}" not found in "${queueName}"`, 404);
        }
        await job.remove();
        await queue.close();
        message = `Job "${jobId}" has been cancelled`;
        break;
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', `Unknown action: ${action}`, 400);
    }
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Queue operation failed: ${error.message}`, 500);
  }

  return createSuccessResponse(ctx, {
    message,
    action,
    queueName,
    jobId,
    batchId,
    timestamp: new Date().toISOString(),
  });
});
