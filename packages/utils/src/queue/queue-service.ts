/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
// BullMQ types are problematic with the current TypeScript module resolution.
// Using runtime require with inline type definitions as a workaround.

import Redis from 'ioredis';
import pino from 'pino';

// Type definitions matching BullMQ's actual types
export type ConnectionOptions = Record<string, any> | typeof Redis.prototype;

export interface JobsOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  jobId?: string;
  removeOnComplete?: boolean | number | { count?: number; age?: number };
  removeOnFail?: boolean | number | { count?: number; age?: number };
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  parent?: { queue: string; id: string };
  repeat?: { pattern?: string; every?: number; limit?: number };
}

export interface QueueBaseOptions {
  connection?: ConnectionOptions;
  defaultJobOptions?: JobsOptions;
}

export interface WorkerOptions {
  connection?: ConnectionOptions;
  concurrency?: number;
  limiter?: { max: number; duration: number };
  lockDuration?: number;
  lockRenewTime?: number;
  stalledInterval?: number;
  maxStalledCount?: number;
  drainDelay?: number;
  removeOnComplete?: boolean | number | { count?: number; age?: number };
  removeOnFail?: boolean | number | { count?: number; age?: number };
}

// Runtime imports
const bullmq = require('bullmq');
const Queue = bullmq.Queue;
const Worker = bullmq.Worker;
const QueueEvents = bullmq.QueueEvents;

// Type aliases for the BullMQ classes
type QueueType<T = any> = {
  add(name: string, data: T, opts?: JobsOptions): Promise<JobType<T>>;
  getWaitingCount(): Promise<number>;
  getActiveCount(): Promise<number>;
  getCompletedCount(): Promise<number>;
  getFailedCount(): Promise<number>;
  getDelayedCount(): Promise<number>;
  getJob(id: string): Promise<JobType<T> | undefined>;
  isPaused(): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  obliterate(opts?: { force?: boolean }): Promise<void>;
  clean(grace: number, limit: number, type: 'completed' | 'failed'): Promise<string[]>;
  close(): Promise<void>;
};

type WorkerType = {
  on(event: 'completed', handler: (job: JobType) => void): void;
  on(event: 'failed', handler: (job: JobType | undefined, error: Error) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  close(): Promise<void>;
  // Additional properties from BullMQ Worker
  opts?: any;
  id?: string;
  [key: string]: any;
};

type QueueEventsType = {
  on(event: 'completed', handler: (args: { jobId: string; returnvalue: any }) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  close(): Promise<void>;
};

export type JobType<T = any> = {
  id?: string;
  name: string;
  data: T;
  opts: JobsOptions;
  attemptsMade: number;
  returnvalue?: any;
  progress?: number | object;
  failedReason?: string;
  remove(): Promise<void>;
  getState(): Promise<'active' | 'completed' | 'failed' | 'waiting' | 'delayed' | 'paused' | 'unknown'>;
  // Required methods used by workers
  updateProgress(progress: number | object): Promise<void>;
  // Additional properties from BullMQ Job to ensure compatibility
  queue?: any;
  queueQualifiedName?: string;
  stacktrace?: string[];
  delay?: number;
  timestamp?: number;
  finishedOn?: number;
  processedOn?: number;
  log?(row: string): Promise<void>;
  moveToFailed?(error: Error, token?: string): Promise<void>;
  isCompleted?(): Promise<boolean>;
  isFailed?(): Promise<boolean>;
  isDelayed?(): Promise<boolean>;
  isActive?(): Promise<boolean>;
  isWaiting?(): Promise<boolean>;
  updateData?(data: T): Promise<void>;
  extendLock?(token: string, duration: number): Promise<void>;
  [key: string]: any;
};

const logger = pino({
  name: 'queue-service',
  ...(process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : {}),
});

export interface QueueConfig {
  connection?: ConnectionOptions;
  redis?: { url: string } | ConnectionOptions;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number | { age?: number; count?: number };
    removeOnFail?: boolean | number | { age?: number; count?: number };
  };
}

export interface JobData {
  [key: string]: any;
}

export interface JobResult {
  [key: string]: any;
}

/**
 * Queue Service for managing background jobs with BullMQ
 * Provides unified interface for job queuing, processing, and monitoring
 */
export class QueueService {
  private queues: Map<string, QueueType> = new Map();
  private workers: Map<string, WorkerType> = new Map();
  private queueEvents: Map<string, QueueEventsType> = new Map();
  private connection: ConnectionOptions;
  private redisClient?: InstanceType<typeof Redis>;

  constructor(config: QueueConfig) {
    // Support both 'connection' and 'redis' formats
    if (config.connection) {
      this.connection = config.connection;
    } else if (config.redis) {
      // Handle redis: { url: string } or redis: ConnectionOptions
      this.connection = typeof (config.redis as any).url === 'string' 
        ? config.redis as any  // ioredis can parse the url option
        : config.redis as ConnectionOptions;
    } else {
      throw new Error('Redis connection configuration is required: provide config.connection or config.redis');
    }
    
    // Test Redis connection
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      this.redisClient = new Redis(this.connection as any);
      await this.redisClient.ping();
      logger.info('✅ Queue service connected to Redis');
    } catch (error) {
      logger.error({ error }, '❌ Failed to connect to Redis for queue service');
      // Don't throw - allow graceful degradation
    }
  }

  /**
   * Create or get a queue
   */
  public getQueue<T extends JobData = JobData>(
    queueName: string,
    options?: {
      defaultJobOptions?: {
        attempts?: number;
        backoff?: {
          type: 'exponential' | 'fixed';
          delay: number;
        };
        removeOnComplete?: boolean | number;
        removeOnFail?: boolean | number;
      };
    }
  ): QueueType<T> {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: options?.defaultJobOptions || {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: { age: 86400, count: 500 }, // 24h or 500 jobs
          removeOnFail: { age: 604800, count: 1000 },   // 7d or 1000 jobs
        },
      }) as QueueType<T>;

      this.queues.set(queueName, queue);
      logger.info({ queueName }, 'Queue created');
    }

    return this.queues.get(queueName) as QueueType<T>;
  }

  /**
   * Add a job to the queue
   */
  public async addJob<T extends JobData = JobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      jobId?: string;
    }
  ): Promise<JobType<T> | null> {
    try {
      const queue = this.getQueue<T>(queueName);
      
      const job = await queue.add(jobName, data, {
        priority: options?.priority,
        delay: options?.delay,
        attempts: options?.attempts,
        jobId: options?.jobId,
      });

      logger.info(
        {
          queueName,
          jobName,
          jobId: job.id,
          priority: options?.priority,
        },
        'Job added to queue'
      );

      return job;
    } catch (error) {
      logger.error(
        { error, queueName, jobName },
        'Failed to add job to queue'
      );
      return null;
    }
  }

  /**
   * Register a worker to process jobs
   */
  public registerWorker<T extends JobData = JobData, R extends JobResult = JobResult>(
    queueName: string,
    processor: (job: JobType<T>) => Promise<R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
      lockDuration?: number;
      lockRenewTime?: number;
      stalledInterval?: number;
      maxStalledCount?: number;
      removeOnComplete?: boolean | number | { count?: number; age?: number };
      removeOnFail?: boolean | number | { count?: number; age?: number };
    }
  ): WorkerType {
    if (this.workers.has(queueName)) {
      logger.warn({ queueName }, 'Worker already registered for queue');
      return this.workers.get(queueName) as WorkerType;
    }

    const worker = new Worker(
      queueName,
      async (job: JobType<T>) => {
        logger.info(
          {
            queueName,
            jobId: job.id,
            jobName: job.name,
            attemptsMade: job.attemptsMade,
          },
          'Processing job'
        );

        try {
          const result = await processor(job);
          
          logger.info(
            {
              queueName,
              jobId: job.id,
              jobName: job.name,
            },
            'Job completed successfully'
          );

          return result;
        } catch (error) {
          logger.error(
            {
              error,
              queueName,
              jobId: job.id,
              jobName: job.name,
              attemptsMade: job.attemptsMade,
            },
            'Job processing failed'
          );
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency: options?.concurrency || 5,
        limiter: options?.limiter,
        // Lock & stall hardening — prevents jobs from getting permanently stuck
        lockDuration: options?.lockDuration ?? 120_000,       // 2 min (default 30s too low for AI/OCR)
        lockRenewTime: options?.lockRenewTime ?? 30_000,      // renew lock every 30s (half of lockDuration)
        stalledInterval: options?.stalledInterval ?? 30_000,   // check for stalled jobs every 30s
        maxStalledCount: options?.maxStalledCount ?? 2,        // allow 2 stalls before failing (default: 1)
        ...(options?.removeOnComplete !== undefined && { removeOnComplete: options.removeOnComplete }),
        ...(options?.removeOnFail !== undefined && { removeOnFail: options.removeOnFail }),
      }
    );

    // Handle worker events
    worker.on('completed', (job: JobType) => {
      logger.debug(
        {
          queueName,
          jobId: job.id,
          returnvalue: job.returnvalue,
        },
        'Worker completed job'
      );
    });

    worker.on('failed', (job: JobType | undefined, error: Error) => {
      logger.error(
        {
          queueName,
          jobId: job?.id,
          error,
          attemptsMade: job?.attemptsMade,
        },
        'Worker failed to process job'
      );
    });

    worker.on('error', (error: Error) => {
      // Only log as error if it's not a transient connection issue
      const msg = error?.message || String(error);
      if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')) {
        logger.warn({ queueName, error: msg }, 'Worker connection issue (transient)');
      } else {
        logger.error({ queueName, error: msg }, 'Worker error');
      }
    });

    // Log stalled jobs for visibility (BullMQ emits this before auto-retry)
    worker.on('stalled', (jobId: string) => {
      logger.warn({ queueName, jobId }, 'Job stalled — BullMQ will auto-retry if maxStalledCount not exceeded');
    });

    this.workers.set(queueName, worker as WorkerType);
    logger.info({ queueName, concurrency: options?.concurrency }, 'Worker registered');

    return worker;
  }

  /**
   * Get queue events for monitoring
   */
  public getQueueEvents(queueName: string): QueueEventsType {
    if (!this.queueEvents.has(queueName)) {
      const queueEvents = new QueueEvents(queueName, {
        connection: this.connection,
      });

      this.queueEvents.set(queueName, queueEvents);
      logger.info({ queueName }, 'Queue events listener created');
    }

    return this.queueEvents.get(queueName)!;
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Check if queue is paused
    const isPaused = await queue.isPaused();

    return { waiting, active, completed, failed, delayed, paused: isPaused ? 1 : 0 };
  }

  /**
   * Get job by ID
   */
  public async getJob<T extends JobData = JobData>(
    queueName: string,
    jobId: string
  ): Promise<JobType<T> | null> {
    const queue = this.getQueue<T>(queueName);
    const job = await queue.getJob(jobId);
    return job ?? null;
  }

  /**
   * Remove a job
   */
  public async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      logger.info({ queueName, jobId }, 'Job removed');
    }
  }

  /**
   * Add a job that depends on another job completing successfully
   * Uses BullMQ's native job dependencies feature
   */
  public async addDependentJob<T extends JobData = JobData>(
    queueName: string,
    jobName: string,
    data: T,
    parentJob: { queue: string; id: string },
    options?: {
      priority?: number;
      attempts?: number;
      jobId?: string;
    }
  ): Promise<JobType<T> | null> {
    try {
      const queue = this.getQueue<T>(queueName);
      
      const job = await queue.add(jobName, data, {
        priority: options?.priority,
        attempts: options?.attempts,
        jobId: options?.jobId,
        parent: {
          queue: parentJob.queue,
          id: parentJob.id,
        },
      });

      logger.info(
        {
          queueName,
          jobName,
          jobId: job.id,
          parentQueue: parentJob.queue,
          parentJobId: parentJob.id,
        },
        'Dependent job added to queue'
      );

      return job;
    } catch (error) {
      logger.error(
        { error, queueName, jobName },
        'Failed to add dependent job to queue'
      );
      return null;
    }
  }

  /**
   * Add multiple jobs that will execute after a parent job completes
   * This is a simpler approach using event-based triggering
   */
  public async addChildJobs<T extends JobData = JobData>(
    parentQueue: string,
    parentJobId: string,
    children: Array<{
      queue: string;
      name: string;
      data: T;
      options?: { priority?: number; delay?: number };
    }>
  ): Promise<void> {
    // Get parent job
    const parentJob = await this.getJob(parentQueue, parentJobId);
    if (!parentJob) {
      logger.warn({ parentQueue, parentJobId }, 'Parent job not found for child jobs');
      return;
    }

    // Listen for parent completion and add children
    const queueEvents = this.getQueueEvents(parentQueue);
    
    const completedHandler = async (args: { jobId: string; returnvalue: any }) => {
      if (args.jobId === parentJobId) {
        logger.info({ parentJobId, childCount: children.length }, 'Parent job completed, adding child jobs');
        
        for (const child of children) {
          await this.addJob(child.queue, child.name, child.data, {
            priority: child.options?.priority,
            delay: child.options?.delay || 0,
          });
        }

        // Remove listener after use
        queueEvents.off('completed', completedHandler);
      }
    };

    queueEvents.on('completed', completedHandler);
  }

  /**
   * Pause a queue
   */
  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info({ queueName }, 'Queue paused');
  }

  /**
   * Resume a queue
   */
  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info({ queueName }, 'Queue resumed');
  }

  /**
   * Clean up completed/failed jobs
   */
  public async cleanQueue(
    queueName: string,
    grace: number = 3600000, // 1 hour
    limit: number = 1000,
    type: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    const jobs = await queue.clean(grace, limit, type);
    logger.info({ queueName, count: jobs.length, type }, 'Queue cleaned');
    return jobs;
  }

  /**
   * Graceful shutdown
   */
  public async close(): Promise<void> {
    logger.info('Closing queue service...');

    // Close workers
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.close())
    );

    // Close queue events
    await Promise.all(
      Array.from(this.queueEvents.values()).map((qe) => qe.close())
    );

    // Close queues
    await Promise.all(
      Array.from(this.queues.values()).map((queue) => queue.close())
    );

    // Close Redis client
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    logger.info('Queue service closed');
  }
}

// Singleton instance
let queueServiceInstance: QueueService | null = null;

export function getQueueService(config?: QueueConfig): QueueService {
  if (!queueServiceInstance && config) {
    queueServiceInstance = new QueueService(config);
  }

  if (!queueServiceInstance) {
    throw new Error('QueueService not initialized. Call getQueueService(config) first.');
  }

  return queueServiceInstance;
}

export function resetQueueService(): void {
  queueServiceInstance = null;
}
