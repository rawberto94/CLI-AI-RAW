import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'queue-service' });

export interface QueueConfig {
  connection: ConnectionOptions;
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
  private queues: Map<string, Queue<any>> = new Map();
  private workers: Map<string, Worker<any>> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private connection: ConnectionOptions;
  private redisClient?: Redis;

  constructor(config: QueueConfig) {
    this.connection = config.connection;
    
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
  ): Queue<T> {
    if (!this.queues.has(queueName)) {
      const queue = new Queue<T>(queueName, {
        connection: this.connection,
        defaultJobOptions: options?.defaultJobOptions || {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs
        },
      });

      this.queues.set(queueName, queue as Queue);
      logger.info({ queueName }, 'Queue created');
    }

    return this.queues.get(queueName) as Queue<T>;
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
  ): Promise<Job<T> | null> {
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
    processor: (job: Job<T>) => Promise<R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Worker<T, R> {
    if (this.workers.has(queueName)) {
      logger.warn({ queueName }, 'Worker already registered for queue');
      return this.workers.get(queueName) as Worker<T, R>;
    }

    const worker = new Worker<T, R>(
      queueName,
      async (job) => {
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
      }
    );

    // Handle worker events
    worker.on('completed', (job) => {
      logger.debug(
        {
          queueName,
          jobId: job.id,
          returnvalue: job.returnvalue,
        },
        'Worker completed job'
      );
    });

    worker.on('failed', (job, error) => {
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

    worker.on('error', (error) => {
      logger.error({ queueName, error }, 'Worker error');
    });

    this.workers.set(queueName, worker as Worker);
    logger.info({ queueName, concurrency: options?.concurrency }, 'Worker registered');

    return worker;
  }

  /**
   * Get queue events for monitoring
   */
  public getQueueEvents(queueName: string): QueueEvents {
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
  ): Promise<Job<T> | null> {
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
