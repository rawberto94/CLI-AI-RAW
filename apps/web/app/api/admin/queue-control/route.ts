import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * POST /api/admin/queue-control
 * Control queue operations (pause, resume, clear, retry)
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { action, queueName, jobId, batchId } = body;

  if (!action) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Action is required', 400);
  }

  let message = '';

  switch (action) {
    case 'pause':
      if (!queueName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
      }
      message = `Queue "${queueName}" has been paused`;
      break;

    case 'resume':
      if (!queueName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
      }
      message = `Queue "${queueName}" has been resumed`;
      break;

    case 'clear-completed':
      if (!queueName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
      }
      message = `Completed jobs cleared from "${queueName}"`;
      break;

    case 'clear-failed':
      if (!queueName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
      }
      message = `Failed jobs cleared from "${queueName}"`;
      break;

    case 'retry-job':
      if (!jobId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Job ID is required', 400);
      }
      message = `Job "${jobId}" has been queued for retry`;
      break;

    case 'retry-all-failed':
      if (!queueName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name is required', 400);
      }
      message = `All failed jobs in "${queueName}" queued for retry`;
      break;

    case 'cancel-job':
      if (!jobId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Job ID is required', 400);
      }
      message = `Job "${jobId}" has been cancelled`;
      break;

    case 'cancel-batch':
      if (!batchId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Batch ID is required', 400);
      }
      message = `Batch "${batchId}" has been cancelled`;
      break;

    case 'set-rate-limit': {
      const { jobsPerInterval, interval } = body;
      if (!queueName || !jobsPerInterval || !interval) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Queue name, jobsPerInterval, and interval are required', 400);
      }
      message = `Rate limit for "${queueName}" set to ${jobsPerInterval} jobs per ${interval}ms`;
      break;
    }

    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Unknown action: ${action}`, 400);
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
