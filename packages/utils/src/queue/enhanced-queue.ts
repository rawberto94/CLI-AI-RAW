/**
 * Enhanced Queue Service with Dead Letter Queue Support
 * Provides reliability features for job processing
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({
  name: 'enhanced-queue-service',
  ...(process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : {}),
});

export const DLQ_QUEUE_NAMES = {
  CONTRACT_PROCESSING_DLQ: 'contract-processing-dlq',
  ARTIFACT_GENERATION_DLQ: 'artifact-generation-dlq',
  WEBHOOK_DELIVERY_DLQ: 'webhook-delivery-dlq',
} as const;

export interface DeadLetterJob {
  originalQueue: string;
  originalJobId: string;
  originalJobName: string;
  originalData: any;
  failureReason: string;
  attemptsMade: number;
  maxAttempts: number;
  failedAt: Date;
  stackTrace?: string;
  lastError?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffType: 'exponential' | 'fixed' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffType: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  nonRetryableErrors: [
    'Invalid file format',
    'File not found',
    'Contract not found',
    'Tenant mismatch',
    'Unauthorized',
  ],
};

/**
 * Calculate backoff delay based on retry policy
 */
export function calculateBackoff(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  switch (policy.backoffType) {
    case 'exponential':
      return Math.min(policy.initialDelay * Math.pow(2, attempt), policy.maxDelay);
    case 'linear':
      return Math.min(policy.initialDelay * (attempt + 1), policy.maxDelay);
    case 'fixed':
    default:
      return policy.initialDelay;
  }
}

/**
 * Check if an error is retryable based on policy
 */
export function isRetryableError(
  error: Error,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): boolean {
  const message = error.message.toLowerCase();
  
  // Check non-retryable errors first
  if (policy.nonRetryableErrors) {
    for (const pattern of policy.nonRetryableErrors) {
      if (message.includes(pattern.toLowerCase())) {
        return false;
      }
    }
  }
  
  // Check retryable errors if specified
  if (policy.retryableErrors && policy.retryableErrors.length > 0) {
    for (const pattern of policy.retryableErrors) {
      if (message.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    return false; // If retryable list is specified, only those are retryable
  }
  
  // Default: most errors are retryable
  return true;
}

/**
 * Create a Dead Letter Queue for a primary queue
 */
export function createDeadLetterQueue(
  queueName: string,
  connection: ConnectionOptions
): Queue<DeadLetterJob> {
  const dlqName = `${queueName}-dlq`;
  
  const dlq = new Queue<DeadLetterJob>(dlqName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 500, // Keep last 500 for debugging
      removeOnFail: false, // Keep all failed for investigation
    },
  });

  logger.info({ dlqName }, 'Dead Letter Queue created');

  return dlq;
}

/**
 * Move a failed job to the Dead Letter Queue
 */
export async function moveToDeadLetterQueue(
  dlq: Queue<DeadLetterJob>,
  job: Job,
  error: Error
): Promise<void> {
  const dlqJob: DeadLetterJob = {
    originalQueue: job.queueName,
    originalJobId: job.id || 'unknown',
    originalJobName: job.name,
    originalData: job.data,
    failureReason: error.message,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts || 3,
    failedAt: new Date(),
    stackTrace: error.stack,
    lastError: error.message,
  };

  await dlq.add('dead-letter', dlqJob, {
    jobId: `dlq-${job.id}-${Date.now()}`,
  });

  logger.warn(
    {
      originalJobId: job.id,
      originalQueue: job.queueName,
      failureReason: error.message,
      attemptsMade: job.attemptsMade,
    },
    'Job moved to Dead Letter Queue'
  );
}

/**
 * Retry a job from the Dead Letter Queue
 */
export async function retryFromDeadLetterQueue<T>(
  originalQueue: Queue<T>,
  dlqJob: Job<DeadLetterJob>
): Promise<string | null> {
  const { originalData, originalJobName, originalJobId } = dlqJob.data;

  try {
    const newJob = await originalQueue.add(
      `${originalJobName}-retry`,
      originalData as T,
      {
        jobId: `retry-${originalJobId}-${Date.now()}`,
        priority: 5, // Higher priority for retries
      }
    );

    logger.info(
      {
        originalJobId,
        newJobId: newJob.id,
        queue: originalQueue.name,
      },
      'Job retried from DLQ'
    );

    // Remove from DLQ after successful retry
    await dlqJob.remove();

    return newJob.id || null;
  } catch (error) {
    logger.error(
      {
        error,
        originalJobId,
        queue: originalQueue.name,
      },
      'Failed to retry job from DLQ'
    );
    return null;
  }
}

/**
 * Get DLQ statistics
 */
export async function getDeadLetterQueueStats(
  dlq: Queue<DeadLetterJob>
): Promise<{
  total: number;
  byQueue: Record<string, number>;
  byError: Record<string, number>;
  oldest?: Date;
  newest?: Date;
}> {
  const jobs = await dlq.getJobs(['waiting', 'completed', 'failed'], 0, 1000);

  const byQueue: Record<string, number> = {};
  const byError: Record<string, number> = {};
  let oldest: Date | undefined;
  let newest: Date | undefined;

  for (const job of jobs) {
    const data = job.data;

    // Count by queue
    byQueue[data.originalQueue] = (byQueue[data.originalQueue] || 0) + 1;

    // Count by error type (first 50 chars)
    const errorKey = data.failureReason.substring(0, 50);
    byError[errorKey] = (byError[errorKey] || 0) + 1;

    // Track dates
    const failedAt = new Date(data.failedAt);
    if (!oldest || failedAt < oldest) oldest = failedAt;
    if (!newest || failedAt > newest) newest = failedAt;
  }

  return {
    total: jobs.length,
    byQueue,
    byError,
    oldest,
    newest,
  };
}

/**
 * Create an enhanced worker with DLQ support
 */
export function createEnhancedWorker<T, R>(
  queueName: string,
  processor: (job: Job<T>) => Promise<R>,
  dlq: Queue<DeadLetterJob>,
  connection: ConnectionOptions,
  options?: {
    concurrency?: number;
    retryPolicy?: RetryPolicy;
  }
): Worker<T, R> {
  const { concurrency = 5, retryPolicy = DEFAULT_RETRY_POLICY } = options || {};

  const worker = new Worker<T, R>(
    queueName,
    async (job) => {
      const jobLogger = logger.child({
        jobId: job.id,
        jobName: job.name,
        queue: queueName,
        attempt: job.attemptsMade + 1,
      });

      try {
        jobLogger.info('Processing job');
        const result = await processor(job);
        jobLogger.info('Job completed successfully');
        return result;
      } catch (error) {
        const err = error as Error;
        jobLogger.error({ error: err.message }, 'Job processing failed');
        throw error;
      }
    },
    {
      connection,
      concurrency,
    }
  );

  // Handle failed jobs
  worker.on('failed', async (job, error) => {
    if (!job) return;

    const isRetryable = isRetryableError(error, retryPolicy);
    const hasRetriesLeft = job.attemptsMade < retryPolicy.maxRetries;

    if (!isRetryable || !hasRetriesLeft) {
      // Move to DLQ
      await moveToDeadLetterQueue(dlq, job, error);
    } else {
      logger.info(
        {
          jobId: job.id,
          attempt: job.attemptsMade,
          maxAttempts: retryPolicy.maxRetries,
          nextRetryIn: calculateBackoff(job.attemptsMade, retryPolicy),
        },
        'Job will be retried'
      );
    }
  });

  worker.on('error', (error) => {
    logger.error({ error, queue: queueName }, 'Worker error');
  });

  logger.info({ queueName, concurrency }, 'Enhanced worker created with DLQ support');

  return worker;
}

/**
 * Job deduplication using Redis
 */
export async function isJobDuplicate(
  redis: Redis,
  queueName: string,
  deduplicationKey: string,
  ttlSeconds: number = 3600
): Promise<boolean> {
  const key = `job:dedup:${queueName}:${deduplicationKey}`;
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  
  // If result is null, key already exists (duplicate)
  return result === null;
}

/**
 * Clear deduplication key
 */
export async function clearDeduplicationKey(
  redis: Redis,
  queueName: string,
  deduplicationKey: string
): Promise<void> {
  const key = `job:dedup:${queueName}:${deduplicationKey}`;
  await redis.del(key);
}

/**
 * Job priority calculator
 */
export function calculateJobPriority(options: {
  isRetry?: boolean;
  tenantTier?: 'free' | 'basic' | 'professional' | 'enterprise';
  contractValue?: number;
  isUrgent?: boolean;
}): number {
  const { isRetry, tenantTier = 'basic', contractValue = 0, isUrgent } = options;

  let priority = 10; // Default priority

  // Retries get higher priority
  if (isRetry) priority -= 2;

  // Tier-based priority
  switch (tenantTier) {
    case 'enterprise':
      priority -= 4;
      break;
    case 'professional':
      priority -= 2;
      break;
    case 'basic':
      priority -= 1;
      break;
    case 'free':
      priority += 2;
      break;
  }

  // High-value contracts get priority
  if (contractValue > 1000000) priority -= 2;
  else if (contractValue > 100000) priority -= 1;

  // Urgent flag
  if (isUrgent) priority -= 3;

  // Clamp to valid range (1-20)
  return Math.max(1, Math.min(20, priority));
}
