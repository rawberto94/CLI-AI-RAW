/**
 * Dead Letter Queue (DLQ) Consumer
 * 
 * Monitors and processes failed jobs that have exhausted all retries.
 * Provides alerting, logging, and manual replay capabilities.
 */

import { Queue, Job, Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';
import { QUEUE_NAMES } from './contract-queue';

const logger = pino({ name: 'dlq-consumer' });

// DLQ naming convention: add "-dlq" suffix to original queue
export const DLQ_QUEUE_NAMES = {
  CONTRACT_PROCESSING_DLQ: `${QUEUE_NAMES.CONTRACT_PROCESSING}-dlq`,
  ARTIFACT_GENERATION_DLQ: `${QUEUE_NAMES.ARTIFACT_GENERATION}-dlq`,
  RAG_INDEXING_DLQ: `${QUEUE_NAMES.RAG_INDEXING}-dlq`,
  METADATA_EXTRACTION_DLQ: `${QUEUE_NAMES.METADATA_EXTRACTION}-dlq`,
  CATEGORIZATION_DLQ: `${QUEUE_NAMES.CATEGORIZATION}-dlq`,
} as const;

export interface DLQJobData {
  originalQueue: string;
  originalJobId: string;
  originalJobName: string;
  originalData: Record<string, unknown>;
  failedAt: string;
  failureReason: string;
  attemptsMade: number;
  stackTrace?: string;
}

export interface DLQStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

class DLQConsumer {
  private static instance: DLQConsumer;
  private connection: ConnectionOptions | null = null;
  private dlqQueues: Map<string, Queue<DLQJobData>> = new Map();
  private dlqWorkers: Map<string, Worker<DLQJobData>> = new Map();
  private redisClient: Redis | null = null;
  private alertHandlers: Array<(job: DLQJobData, queue: string) => Promise<void>> = [];

  private constructor() {}

  public static getInstance(): DLQConsumer {
    if (!DLQConsumer.instance) {
      DLQConsumer.instance = new DLQConsumer();
    }
    return DLQConsumer.instance;
  }

  /**
   * Initialize DLQ consumer with Redis connection
   */
  public async initialize(connectionConfig?: ConnectionOptions): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

    this.connection = connectionConfig || { url: redisUrl } as ConnectionOptions;
    
    try {
      this.redisClient = new Redis(redisUrl);
      await this.redisClient.ping();
      logger.info('DLQ Consumer connected to Redis');
    } catch (error) {
      logger.error({ error }, 'Failed to connect DLQ Consumer to Redis');
      throw error;
    }
  }

  /**
   * Register an alert handler for failed jobs
   */
  public onFailedJob(handler: (job: DLQJobData, queue: string) => Promise<void>): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Move a failed job to its DLQ
   */
  public async moveToDeadLetter(
    originalQueue: string,
    job: Job<any>,
    failureReason: string
  ): Promise<void> {
    if (!this.connection) {
      logger.warn('DLQ Consumer not initialized');
      return;
    }

    const dlqName = `${originalQueue}-dlq`;
    
    // Get or create DLQ
    if (!this.dlqQueues.has(dlqName)) {
      const dlq = new Queue<DLQJobData>(dlqName, { connection: this.connection });
      this.dlqQueues.set(dlqName, dlq);
    }

    const dlqQueue = this.dlqQueues.get(dlqName)!;

    const dlqJobData: DLQJobData = {
      originalQueue,
      originalJobId: job.id || 'unknown',
      originalJobName: job.name,
      originalData: job.data,
      failedAt: new Date().toISOString(),
      failureReason,
      attemptsMade: job.attemptsMade,
      stackTrace: job.failedReason,
    };

    await dlqQueue.add('dead-letter', dlqJobData, {
      jobId: `dlq-${job.id}-${Date.now()}`,
    });

    logger.warn({
      originalQueue,
      originalJobId: job.id,
      failureReason,
    }, 'Job moved to DLQ');

    // Trigger alert handlers
    for (const handler of this.alertHandlers) {
      try {
        await handler(dlqJobData, dlqName);
      } catch (err) {
        logger.error({ error: err }, 'Alert handler failed');
      }
    }
  }

  /**
   * Get DLQ statistics for all queues
   */
  public async getStats(): Promise<DLQStats[]> {
    const stats: DLQStats[] = [];

    for (const [queueName, queue] of this.dlqQueues) {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      stats.push({
        queueName,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      });
    }

    return stats;
  }

  /**
   * Get failed jobs from a DLQ
   */
  public async getFailedJobs(dlqName: string, limit = 100): Promise<Job<DLQJobData>[]> {
    const queue = this.dlqQueues.get(dlqName);
    if (!queue) {
      return [];
    }

    return queue.getJobs(['waiting', 'failed'], 0, limit);
  }

  /**
   * Replay a single job from DLQ back to original queue
   */
  public async replayJob(dlqName: string, jobId: string): Promise<boolean> {
    const queue = this.dlqQueues.get(dlqName);
    if (!queue) {
      logger.warn({ dlqName }, 'DLQ not found');
      return false;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      logger.warn({ dlqName, jobId }, 'Job not found in DLQ');
      return false;
    }

    const { originalQueue, originalJobName, originalData } = job.data;

    // Re-queue to original queue
    const { getQueueService } = await import('./queue-service');
    const queueService = getQueueService();
    
    await queueService.addJob(originalQueue, originalJobName, originalData, {
      jobId: `replay-${job.data.originalJobId}-${Date.now()}`,
    });

    // Remove from DLQ
    await job.remove();

    logger.info({
      dlqName,
      jobId,
      originalQueue,
      originalJobName,
    }, 'Job replayed from DLQ');

    return true;
  }

  /**
   * Replay all jobs from a DLQ back to original queues
   */
  public async replayAll(dlqName: string): Promise<number> {
    const jobs = await this.getFailedJobs(dlqName);
    let replayed = 0;

    for (const job of jobs) {
      if (await this.replayJob(dlqName, job.id!)) {
        replayed++;
      }
    }

    logger.info({ dlqName, replayed }, 'Bulk replay completed');
    return replayed;
  }

  /**
   * Purge all jobs from a DLQ
   */
  public async purge(dlqName: string): Promise<number> {
    const queue = this.dlqQueues.get(dlqName);
    if (!queue) {
      return 0;
    }

    const jobs = await queue.getJobs(['waiting', 'failed', 'delayed']);
    let removed = 0;

    for (const job of jobs) {
      try {
        await job.remove();
        removed++;
      } catch {
        // Job may have been removed already
      }
    }

    logger.info({ dlqName, removed }, 'DLQ purged');
    return removed;
  }

  /**
   * Register DLQ workers to process/monitor failed jobs
   */
  public registerDLQWorker(
    dlqName: string,
    processor?: (job: Job<DLQJobData>) => Promise<void>
  ): Worker<DLQJobData> | null {
    if (!this.connection) {
      logger.warn('DLQ Consumer not initialized');
      return null;
    }

    if (this.dlqWorkers.has(dlqName)) {
      return this.dlqWorkers.get(dlqName)!;
    }

    // Ensure queue exists
    if (!this.dlqQueues.has(dlqName)) {
      const dlq = new Queue<DLQJobData>(dlqName, { connection: this.connection });
      this.dlqQueues.set(dlqName, dlq);
    }

    const worker = new Worker<DLQJobData>(
      dlqName,
      processor || (async (job) => {
        // Default processor just logs the failed job
        logger.info({
          dlqName,
          jobId: job.id,
          originalQueue: job.data.originalQueue,
          failedAt: job.data.failedAt,
          reason: job.data.failureReason,
        }, 'DLQ job received - awaiting manual processing');
      }),
      {
        connection: this.connection,
        concurrency: 1, // Process slowly
        limiter: {
          max: 10,
          duration: 60000, // Max 10 per minute
        },
      }
    );

    this.dlqWorkers.set(dlqName, worker);
    logger.info({ dlqName }, 'DLQ worker registered');

    return worker;
  }

  /**
   * Graceful shutdown
   */
  public async close(): Promise<void> {
    // Close workers
    await Promise.all(
      Array.from(this.dlqWorkers.values()).map((w) => w.close())
    );

    // Close queues
    await Promise.all(
      Array.from(this.dlqQueues.values()).map((q) => q.close())
    );

    // Close Redis
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    logger.info('DLQ Consumer closed');
  }
}

export const dlqConsumer = DLQConsumer.getInstance();

/**
 * Helper to setup DLQ integration for a queue
 */
export async function setupDLQForQueue(queueName: string): Promise<void> {
  // Initialize the DLQ consumer
  await dlqConsumer.initialize();

  // Register worker for DLQ
  const dlqName = `${queueName}-dlq`;
  dlqConsumer.registerDLQWorker(dlqName);
  
  logger.info({ queueName, dlqName }, 'DLQ setup complete');
}
