/**
 * Processing Job Service
 * 
 * Manages contract processing lifecycle with:
 * - Job creation and status tracking
 * - Progress monitoring
 * - Error handling and retry logic
 * - Queue management
 * - Checkpoint system for resumability
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';
import { dbAdaptor } from '../dal/database.adaptor';
import { enhancedDbAdaptor, ErrorCategory } from '../dal/enhanced-database.adaptor';
import { eventBus, Events } from '../events/event-bus';

const logger = createLogger('processing-job-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ProcessingJob {
  id: string;
  contractId: string;
  tenantId: string;
  
  // Status
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  totalStages: number;
  
  // Timing
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedCompletionAt: Date | null;
  
  // Error handling
  error: string | null;
  errorStack: string | null;
  errorCategory: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  
  // Queue
  priority: number;
  queuePosition: number | null;
  
  // Checkpoints
  lastCheckpoint: string | null;
  checkpointData: any;
  
  // Metadata
  metadata: any;
  updatedAt: Date;
}

export interface JobOptions {
  priority?: number;
  maxRetries?: number;
  totalStages?: number;
  metadata?: any;
}

export interface JobStatusDetails {
  job: ProcessingJob;
  contract?: any;
  estimatedTimeRemaining?: number;
  averageProcessingTime?: number;
}

// =========================================================================
// PROCESSING JOB SERVICE
// =========================================================================

export class ProcessingJobService {
  private static instance: ProcessingJobService;

  private constructor() {
    logger.info('Processing Job Service initialized');
  }

  static getInstance(): ProcessingJobService {
    if (!ProcessingJobService.instance) {
      ProcessingJobService.instance = new ProcessingJobService();
    }
    return ProcessingJobService.instance;
  }

  // =========================================================================
  // JOB CREATION
  // =========================================================================

  /**
   * Create a new processing job
   */
  async createJob(
    contractId: string,
    tenantId: string,
    options?: JobOptions
  ): Promise<ProcessingJob> {
    try {
      logger.info({ contractId, tenantId, options }, 'Creating processing job');

      const job = await dbAdaptor.getClient().processingJob.create({
        data: {
          id: randomUUID(),
          contractId,
          tenantId,
          status: 'PENDING',
          progress: 0,
          totalStages: options?.totalStages || 5,
          priority: options?.priority || 0,
          maxRetries: options?.maxRetries || 3,
          retryCount: 0,
          metadata: options?.metadata || {},
        },
      });

      // Emit job created event
      await eventBus.publish(Events.JOB_CREATED, {
        jobId: job.id,
        contractId,
        tenantId,
        timestamp: new Date(),
      });

      logger.info({ jobId: job.id, contractId }, 'Processing job created');
      return job as ProcessingJob;
    } catch (error) {
      logger.error({ error, contractId, tenantId }, 'Failed to create processing job');
      throw error;
    }
  }

  // =========================================================================
  // PROGRESS TRACKING
  // =========================================================================

  /**
   * Update job progress
   */
  async updateProgress(
    jobId: string,
    progress: number,
    stage: string
  ): Promise<void> {
    try {
      // Validate progress
      const validProgress = Math.max(0, Math.min(100, progress));

      await dbAdaptor.getClient().processingJob.update({
        where: { id: jobId },
        data: {
          progress: validProgress,
          currentStep: stage,
        },
      });

      // Emit progress event
      await eventBus.publish(Events.JOB_PROGRESS, {
        jobId,
        progress: validProgress,
        stage,
        timestamp: new Date(),
      });

      logger.debug({ jobId, progress: validProgress, stage }, 'Job progress updated');
    } catch (error) {
      logger.error({ error, jobId, progress, stage }, 'Failed to update job progress');
      throw error;
    }
  }

  // =========================================================================
  // STATUS MANAGEMENT
  // =========================================================================

  /**
   * Update job status
   */
  async updateStatus(
    jobId: string,
    status: JobStatus,
    details?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
      };

      // Set timestamps based on status
      if (status === 'RUNNING' && !details?.startedAt) {
        updateData.startedAt = new Date();
      }

      if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
        updateData.completedAt = new Date();
        
        // Calculate processing duration
        const job = await this.getJob(jobId);
        if (job && job.startedAt) {
          const duration = new Date().getTime() - new Date(job.startedAt).getTime();
          updateData.processingDuration = duration;
        }
      }

      // Add any additional details
      if (details) {
        Object.assign(updateData, details);
      }

      await dbAdaptor.getClient().processingJob.update({
        where: { id: jobId },
        data: updateData,
      });

      // Emit status change event
      await eventBus.publish(Events.JOB_STATUS_CHANGED, {
        jobId,
        status,
        timestamp: new Date(),
      });

      logger.info({ jobId, status }, 'Job status updated');
    } catch (error) {
      logger.error({ error, jobId, status }, 'Failed to update job status');
      throw error;
    }
  }

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  /**
   * Record job error
   */
  async recordError(
    jobId: string,
    error: Error,
    retryable: boolean
  ): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const errorCategory = this.categorizeError(error);
      const canRetry = retryable && job.retryCount < job.maxRetries;

      const updateData: any = {
        error: error.message,
        errorStack: error.stack,
        errorCategory,
        retryCount: job.retryCount + 1,
      };

      if (canRetry) {
        // Calculate next retry time with exponential backoff
        const delay = this.calculateRetryDelay(job.retryCount);
        updateData.nextRetryAt = new Date(Date.now() + delay);
        updateData.status = 'PENDING';
        
        logger.warn(
          { jobId, retryCount: job.retryCount + 1, nextRetryAt: updateData.nextRetryAt },
          'Job will be retried'
        );
      } else {
        updateData.status = 'FAILED';
        updateData.completedAt = new Date();
        
        logger.error({ jobId, error: error.message }, 'Job failed permanently');
      }

      await dbAdaptor.getClient().processingJob.update({
        where: { id: jobId },
        data: updateData,
      });

      // Emit error event
      await eventBus.publish(Events.JOB_ERROR, {
        jobId,
        error: error.message,
        retryable: canRetry,
        timestamp: new Date(),
      });
    } catch (err) {
      logger.error({ error: err, jobId }, 'Failed to record job error');
      throw err;
    }
  }

  /**
   * Categorize error for retry logic
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.TIMEOUT_ERROR;
    }

    if (message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK_ERROR;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION_ERROR;
    }

    return 'PERMANENT';
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 2000; // 2 seconds
    const maxDelay = 30000; // 30 seconds
    const backoffMultiplier = 2;

    const delay = baseDelay * Math.pow(backoffMultiplier, retryCount);
    return Math.min(delay, maxDelay);
  }

  // =========================================================================
  // RETRY LOGIC
  // =========================================================================

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.retryCount >= job.maxRetries) {
        throw new Error(`Job ${jobId} has exceeded maximum retries`);
      }

      await this.updateStatus(jobId, 'PENDING', {
        nextRetryAt: null,
        error: null,
        errorStack: null,
      });

      logger.info({ jobId, retryCount: job.retryCount }, 'Job queued for retry');
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to retry job');
      throw error;
    }
  }

  // =========================================================================
  // JOB MONITORING
  // =========================================================================

  /**
   * Get job status with details
   */
  async getJobStatus(jobId: string): Promise<JobStatusDetails> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Get contract details
      const contractResult = await dbAdaptor.getContract(job.contractId, job.tenantId);
      const contract = contractResult?.success ? contractResult.data : null;

      // Calculate estimated time remaining
      let estimatedTimeRemaining: number | undefined;
      if (job.status === 'RUNNING' && job.estimatedCompletionAt) {
        estimatedTimeRemaining = Math.max(
          0,
          new Date(job.estimatedCompletionAt).getTime() - Date.now()
        );
      }

      // Get average processing time
      const averageProcessingTime = await this.getAverageProcessingTime(job.tenantId);

      return {
        job,
        contract,
        estimatedTimeRemaining,
        averageProcessingTime,
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job status');
      throw error;
    }
  }

  /**
   * Get queue position for a job
   */
  async getQueuePosition(jobId: string): Promise<number> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      return job.queuePosition || 0;
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get queue position');
      throw error;
    }
  }

  /**
   * Get average processing time for tenant
   */
  private async getAverageProcessingTime(tenantId: string): Promise<number> {
    try {
      const result = await dbAdaptor.getClient().$queryRaw<Array<{ avg: number }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")))::INTEGER as avg
        FROM processing_jobs
        WHERE status = 'COMPLETED'
          AND "tenantId" = ${tenantId}
          AND "completedAt" > NOW() - INTERVAL '7 days'
        LIMIT 100
      `;

      return result[0]?.avg || 300; // Default to 5 minutes
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get average processing time');
      return 300;
    }
  }

  // =========================================================================
  // TIMEOUT DETECTION
  // =========================================================================

  /**
   * Detect stalled jobs
   */
  async detectStalledJobs(): Promise<ProcessingJob[]> {
    try {
      const stalledThreshold = 30 * 60 * 1000; // 30 minutes
      const stalledTime = new Date(Date.now() - stalledThreshold);

      const stalledJobs = await dbAdaptor.getClient().processingJob.findMany({
        where: {
          status: 'RUNNING',
          startedAt: {
            lt: stalledTime,
          },
        },
      });

      if (stalledJobs.length > 0) {
        logger.warn({ count: stalledJobs.length }, 'Detected stalled jobs');
      }

      return stalledJobs as ProcessingJob[];
    } catch (error) {
      logger.error({ error }, 'Failed to detect stalled jobs');
      throw error;
    }
  }

  /**
   * Handle stalled job
   */
  async handleStalledJob(jobId: string): Promise<void> {
    try {
      logger.warn({ jobId }, 'Handling stalled job');

      await this.recordError(
        jobId,
        new Error('Job stalled - exceeded timeout threshold'),
        true
      );

      // Emit stalled job alert
      await eventBus.publish(Events.JOB_STALLED, {
        jobId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to handle stalled job');
      throw error;
    }
  }

  // =========================================================================
  // CHECKPOINT SYSTEM
  // =========================================================================

  /**
   * Save checkpoint for resumability
   */
  async saveCheckpoint(
    jobId: string,
    checkpoint: string,
    data: any
  ): Promise<void> {
    try {
      const client = dbAdaptor.getClient();

      const existing = await client.processingJob.findUnique({
        where: { id: jobId },
        select: { checkpointData: true },
      });

      const merged = mergeCheckpointData(existing?.checkpointData, data);

      await client.processingJob.update({
        where: { id: jobId },
        data: {
          lastCheckpoint: checkpoint,
          checkpointData: merged,
        },
      });

      logger.debug({ jobId, checkpoint }, 'Checkpoint saved');
    } catch (error) {
      logger.error({ error, jobId, checkpoint }, 'Failed to save checkpoint');
      throw error;
    }
  }

  /**
   * Resume from last checkpoint
   */
  async resumeFromCheckpoint(jobId: string): Promise<{ checkpoint: string; data: any } | null> {
    try {
      const job = await this.getJob(jobId);
      if (!job || !job.lastCheckpoint) {
        return null;
      }

      logger.info({ jobId, checkpoint: job.lastCheckpoint }, 'Resuming from checkpoint');

      return {
        checkpoint: job.lastCheckpoint,
        data: job.checkpointData,
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to resume from checkpoint');
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get job by ID
   */
  private async getJob(jobId: string): Promise<ProcessingJob | null> {
    try {
      const job = await dbAdaptor.getClient().processingJob.findUnique({
        where: { id: jobId },
      });

      return job as ProcessingJob | null;
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job');
      throw error;
    }
  }

  /**
   * Get pending jobs for processing
   */
  async getPendingJobs(tenantId: string, limit: number = 10): Promise<ProcessingJob[]> {
    try {
      const jobs = await dbAdaptor.getClient().processingJob.findMany({
        where: {
          tenantId,
          status: 'PENDING',
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        take: limit,
      });

      return jobs as ProcessingJob[];
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get pending jobs');
      throw error;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string, reason?: string): Promise<void> {
    try {
      await this.updateStatus(jobId, 'CANCELLED', {
        error: reason || 'Job cancelled by user',
      });

      logger.info({ jobId, reason }, 'Job cancelled');
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to cancel job');
      throw error;
    }
  }

  /**
   * Health check for processing job service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Service is healthy if we can access it
      // No direct database dependency check needed
      return true;
    } catch (error) {
      logger.error({ error }, 'Processing job service health check failed');
      return false;
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergeCheckpointData(existing: unknown, patch: unknown): unknown {
  if (patch === undefined) return existing;
  if (existing === undefined) return patch;

  if (isPlainObject(existing) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = mergeCheckpointData((existing as Record<string, unknown>)[key], value);
    }
    return out;
  }

  // For arrays and primitives, last write wins.
  return patch;
}

export const processingJobService = ProcessingJobService.getInstance();
