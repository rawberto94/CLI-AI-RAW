/**
 * Priority Queue System for Worker Jobs
 * 
 * Implements priority lanes for different job types:
 * - Critical: User-facing immediate actions (blocking operations)
 * - High: User-triggered but can wait briefly
 * - Normal: Standard background processing
 * - Low: Batch operations, maintenance tasks
 * 
 * Features:
 * - Multi-lane priority processing
 * - Priority escalation for aging jobs
 * - Fair scheduling within priority bands
 */

import pino from 'pino';
// Use local types for BullMQ compatibility
type QueueLike = any;
type QueueEventsLike = any;
type WorkerLike = any;
type JobLike<T = any> = { id?: string; name: string; data: T; opts: any; timestamp?: number; changePriority: (opts: { priority: number }) => Promise<void> };
type JobsOptionsLike = Record<string, any>;

const logger = pino({ name: 'priority-queue' });

// ============================================================================
// PRIORITY DEFINITIONS
// ============================================================================

export enum JobPriority {
  CRITICAL = 1,   // Processed immediately (user blocking)
  HIGH = 5,       // Processed soon (user-triggered)
  NORMAL = 10,    // Standard processing
  LOW = 20,       // Background/batch jobs
  MAINTENANCE = 50, // Lowest priority, maintenance tasks
}

export interface PriorityJobOptions extends JobsOptionsLike {
  priority?: JobPriority;
  escalateAfterMs?: number;  // Escalate priority if waiting too long
  metadata?: Record<string, unknown>;
}

// ============================================================================
// PRIORITY QUEUE MANAGER
// ============================================================================

export interface PriorityQueueConfig {
  name: string;
  redisConnection: { host: string; port: number };
  defaultConcurrency: number;
  priorityConcurrency: Partial<Record<JobPriority, number>>;
  escalationCheckInterval: number;
}

/**
 * Manages priority-based job processing
 */
export class PriorityQueueManager {
  private queue: QueueLike;
  private workers: Map<JobPriority, WorkerLike> = new Map();
  private queueEvents: QueueEventsLike;
  private escalationInterval?: NodeJS.Timeout;
  private config: PriorityQueueConfig;

  constructor(config: PriorityQueueConfig) {
    this.config = config;
    
    // Dynamically import Queue and QueueEvents to avoid type issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Queue, QueueEvents } = require('bullmq');
    
    // Create the main queue
    this.queue = new Queue(config.name, {
      connection: config.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.queueEvents = new QueueEvents(config.name, {
      connection: config.redisConnection,
    });

    logger.info({ queue: config.name }, 'Priority queue manager initialized');
  }

  /**
   * Add a job with priority
   */
  async addJob<T>(
    jobName: string,
    data: T,
    options: PriorityJobOptions = {}
  ): Promise<JobLike<T>> {
    const priority = options.priority ?? JobPriority.NORMAL;
    
    const job = await this.queue.add(jobName, data, {
      ...options,
      priority,
      timestamp: Date.now(),
    });

    logger.debug({
      jobId: job.id,
      jobName,
      priority,
    }, 'Job added to priority queue');

    return job;
  }

  /**
   * Add a critical priority job (user-blocking)
   */
  async addCritical<T>(jobName: string, data: T, options: Omit<PriorityJobOptions, 'priority'> = {}): Promise<JobLike<T>> {
    return this.addJob(jobName, data, { ...options, priority: JobPriority.CRITICAL });
  }

  /**
   * Add a high priority job (user-triggered)
   */
  async addHigh<T>(jobName: string, data: T, options: Omit<PriorityJobOptions, 'priority'> = {}): Promise<JobLike<T>> {
    return this.addJob(jobName, data, { ...options, priority: JobPriority.HIGH });
  }

  /**
   * Add a normal priority job (standard)
   */
  async addNormal<T>(jobName: string, data: T, options: Omit<PriorityJobOptions, 'priority'> = {}): Promise<JobLike<T>> {
    return this.addJob(jobName, data, { ...options, priority: JobPriority.NORMAL });
  }

  /**
   * Add a low priority job (background)
   */
  async addLow<T>(jobName: string, data: T, options: Omit<PriorityJobOptions, 'priority'> = {}): Promise<JobLike<T>> {
    return this.addJob(jobName, data, { ...options, priority: JobPriority.LOW });
  }

  /**
   * Add a maintenance job (lowest priority)
   */
  async addMaintenance<T>(jobName: string, data: T, options: Omit<PriorityJobOptions, 'priority'> = {}): Promise<JobLike<T>> {
    return this.addJob(jobName, data, { ...options, priority: JobPriority.MAINTENANCE });
  }

  /**
   * Create a worker for processing jobs
   */
  createWorker<T, R>(
    processor: (job: JobLike<T>) => Promise<R>,
    concurrency?: number
  ): WorkerLike {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Worker } = require('bullmq');
    
    const worker = new Worker(
      this.config.name,
      processor,
      {
        connection: this.config.redisConnection,
        concurrency: concurrency ?? this.config.defaultConcurrency,
      }
    );

    // Event handlers
    worker.on('completed', (job: JobLike) => {
      logger.debug({ jobId: job.id, name: job.name }, 'Job completed');
    });

    worker.on('failed', (job: JobLike | undefined, err: Error) => {
      logger.error({ jobId: job?.id, name: job?.name, error: err.message }, 'Job failed');
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn({ jobId }, 'Job stalled');
    });

    return worker;
  }

  /**
   * Start priority escalation monitoring
   */
  startEscalation(): void {
    this.escalationInterval = setInterval(
      () => this.checkEscalation(),
      this.config.escalationCheckInterval
    );
    logger.info('Priority escalation monitoring started');
  }

  /**
   * Stop priority escalation monitoring
   */
  stopEscalation(): void {
    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
      this.escalationInterval = undefined;
    }
  }

  /**
   * Check for jobs that need priority escalation
   */
  private async checkEscalation(): Promise<void> {
    try {
      // Get waiting jobs
      const waiting = await this.queue.getWaiting(0, 100);
      const now = Date.now();

      for (const job of waiting) {
        const opts = job.opts as PriorityJobOptions;
        const escalateAfter = opts.escalateAfterMs;
        
        if (escalateAfter && job.timestamp) {
          const waitTime = now - job.timestamp;
          
          if (waitTime > escalateAfter) {
            const currentPriority = job.opts.priority || JobPriority.NORMAL;
            const newPriority = this.getEscalatedPriority(currentPriority as JobPriority);
            
            if (newPriority < currentPriority) {
              await job.changePriority({ priority: newPriority });
              logger.info({
                jobId: job.id,
                oldPriority: currentPriority,
                newPriority,
                waitTimeMs: waitTime,
              }, 'Job priority escalated');
            }
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error checking priority escalation');
    }
  }

  /**
   * Get the next higher priority level
   */
  private getEscalatedPriority(current: JobPriority): JobPriority {
    switch (current) {
      case JobPriority.MAINTENANCE:
        return JobPriority.LOW;
      case JobPriority.LOW:
        return JobPriority.NORMAL;
      case JobPriority.NORMAL:
        return JobPriority.HIGH;
      case JobPriority.HIGH:
      case JobPriority.CRITICAL:
        return JobPriority.CRITICAL;
      default:
        return current;
    }
  }

  /**
   * Get queue statistics by priority
   */
  async getStats(): Promise<Record<string, number>> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Close the queue and workers
   */
  async close(): Promise<void> {
    this.stopEscalation();
    await this.queue.close();
    await this.queueEvents.close();
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    logger.info({ queue: this.config.name }, 'Priority queue manager closed');
  }
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Determine priority based on job characteristics
 */
export function inferPriority(options: {
  isUserTriggered?: boolean;
  isBlocking?: boolean;
  isBatch?: boolean;
  isMaintenance?: boolean;
  contractValue?: number;
  urgency?: 'urgent' | 'normal' | 'low';
}): JobPriority {
  // User is waiting for result
  if (options.isBlocking) {
    return JobPriority.CRITICAL;
  }

  // User triggered but not blocking
  if (options.isUserTriggered) {
    return JobPriority.HIGH;
  }

  // Maintenance tasks
  if (options.isMaintenance) {
    return JobPriority.MAINTENANCE;
  }

  // Batch processing
  if (options.isBatch) {
    return JobPriority.LOW;
  }

  // Urgency-based
  switch (options.urgency) {
    case 'urgent':
      return JobPriority.HIGH;
    case 'low':
      return JobPriority.LOW;
    default:
      return JobPriority.NORMAL;
  }
}

/**
 * Priority-aware job options builder
 */
export function buildJobOptions(options: {
  priority?: JobPriority;
  escalateAfterMs?: number;
  delay?: number;
  attempts?: number;
  backoff?: { type: 'fixed' | 'exponential'; delay: number };
}): PriorityJobOptions {
  return {
    priority: options.priority ?? JobPriority.NORMAL,
    escalateAfterMs: options.escalateAfterMs,
    delay: options.delay,
    attempts: options.attempts ?? 3,
    backoff: options.backoff ?? { type: 'exponential', delay: 1000 },
  };
}

/**
 * Get priority name for logging
 */
export function getPriorityName(priority: JobPriority): string {
  switch (priority) {
    case JobPriority.CRITICAL:
      return 'CRITICAL';
    case JobPriority.HIGH:
      return 'HIGH';
    case JobPriority.NORMAL:
      return 'NORMAL';
    case JobPriority.LOW:
      return 'LOW';
    case JobPriority.MAINTENANCE:
      return 'MAINTENANCE';
    default:
      return `PRIORITY-${priority}`;
  }
}
