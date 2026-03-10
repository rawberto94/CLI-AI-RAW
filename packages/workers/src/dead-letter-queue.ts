/**
 * Dead Letter Queue Handler (P4: Worker Scalability)
 * 
 * Handles failed jobs that exceed retry limits
 * Provides monitoring and manual retry capabilities
 */

import { Queue } from 'bullmq';
// Use local type definitions for cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any; stacktrace?: string[] };
type ConnectionOptions = { host?: string; port?: number; password?: string; maxRetriesPerRequest?: number | null };
import pino from 'pino';

const logger = pino({ name: 'dead-letter-queue' });

export interface DeadLetterJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  originalQueue: string;
  stacktrace?: string[];
}

/**
 * Dead Letter Queue Manager
 */
export class DeadLetterQueueManager {
  // Using any to avoid BullMQ type issues with different versions
  private dlq: any;
  private connection: ConnectionOptions;

  constructor(connection: ConnectionOptions) {
    this.connection = connection;
    this.dlq = new Queue('dead-letter-queue', {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 10000, age: 30 * 24 * 60 * 60 }, // Retain up to 10k / 30 days
        removeOnFail: { count: 5000, age: 30 * 24 * 60 * 60 },
      },
    });
    
    logger.info('Dead Letter Queue initialized');
  }

  /**
   * Move a failed job to the DLQ
   */
  async moveToDeadLetter(
    job: Job,
    reason: string,
    originalQueue: string
  ): Promise<void> {
    const deadLetterJob: DeadLetterJob = {
      id: job.id || 'unknown',
      name: job.name,
      data: job.data,
      failedReason: reason,
      attemptsMade: job.attemptsMade || 0,
      timestamp: Date.now(),
      originalQueue,
      stacktrace: (job as any).stacktrace,
    };

    await this.dlq.add('dead-letter', deadLetterJob, {
      jobId: `dlq-${originalQueue}-${job.id}`,
    });

    logger.warn({
      jobId: job.id,
      jobName: job.name,
      originalQueue,
      reason,
    }, 'Job moved to Dead Letter Queue');
  }

  /**
   * Get all jobs in the DLQ
   */
  async getDeadLetterJobs(
    start = 0,
    end = 100
  ): Promise<{ jobs: DeadLetterJob[]; total: number }> {
    const jobs = await this.dlq.getJobs(['waiting', 'delayed'], start, end);
    const total = await this.dlq.getWaitingCount();

    return {
      jobs: jobs.map((job: any) => job.data as DeadLetterJob),
      total,
    };
  }

  /**
   * Retry a job from the DLQ
   */
  async retryJob(
    dlqJobId: string,
    targetQueue: any
  ): Promise<Job | null> {
    const dlqJob = await this.dlq.getJob(dlqJobId);
    if (!dlqJob) {
      logger.warn({ dlqJobId }, 'DLQ job not found');
      return null;
    }

    const deadLetterData = dlqJob.data as DeadLetterJob;
    
    // Add back to original queue
    const newJob = await targetQueue.add(
      deadLetterData.name,
      deadLetterData.data,
      {
        priority: 1, // High priority for retried jobs
        attempts: 3, // Fresh attempts
      }
    );

    // Remove from DLQ
    await dlqJob.remove();

    logger.info({
      dlqJobId,
      newJobId: newJob.id,
      targetQueue: deadLetterData.originalQueue,
    }, 'Job retried from Dead Letter Queue');

    return newJob;
  }

  /**
   * Remove a job from the DLQ (after investigation)
   */
  async removeFromDeadLetter(dlqJobId: string): Promise<boolean> {
    const job = await this.dlq.getJob(dlqJobId);
    if (job) {
      await job.remove();
      logger.info({ dlqJobId }, 'Job removed from Dead Letter Queue');
      return true;
    }
    return false;
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<{
    total: number;
    byQueue: Record<string, number>;
    oldest: number | null;
  }> {
    const jobs = await this.dlq.getJobs(['waiting', 'delayed']);
    const byQueue: Record<string, number> = {};
    let oldest: number | null = null;

    for (const job of jobs) {
      const data = job.data as DeadLetterJob;
      byQueue[data.originalQueue] = (byQueue[data.originalQueue] || 0) + 1;
      
      if (oldest === null || data.timestamp < oldest) {
        oldest = data.timestamp;
      }
    }

    return {
      total: jobs.length,
      byQueue,
      oldest,
    };
  }

  /**
   * Purge old jobs from DLQ
   */
  async purgeOldJobs(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const jobs = await this.dlq.getJobs(['waiting', 'delayed']);
    let purged = 0;

    for (const job of jobs) {
      const data = job.data as DeadLetterJob;
      if (data.timestamp < cutoff) {
        await job.remove();
        purged++;
      }
    }

    if (purged > 0) {
      logger.info({ purged, olderThanMs }, 'Purged old jobs from DLQ');
    }

    return purged;
  }

  /**
   * Close the DLQ
   */
  async close(): Promise<void> {
    await this.dlq.close();
    logger.info('Dead Letter Queue closed');
  }
}

// Singleton instance
let dlqManager: DeadLetterQueueManager | null = null;

export function getDeadLetterQueueManager(
  connection?: ConnectionOptions
): DeadLetterQueueManager {
  if (!dlqManager && connection) {
    dlqManager = new DeadLetterQueueManager(connection);
  }

  if (!dlqManager) {
    throw new Error(
      'DeadLetterQueueManager not initialized. Call getDeadLetterQueueManager(connection) first.'
    );
  }

  return dlqManager;
}
