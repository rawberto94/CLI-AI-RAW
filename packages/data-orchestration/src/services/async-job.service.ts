import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  data: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface JobHandler {
  (job: Job, updateProgress: (progress: number) => Promise<void>): Promise<any>;
}

/**
 * Async Job System for bulk operations
 */
export class AsyncJobService extends EventEmitter {
  private handlers: Map<string, JobHandler> = new Map();
  private runningJobs: Set<string> = new Set();
  private maxConcurrentJobs: number = 5;

  constructor() {
    super();
    this.startJobProcessor();
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  /**
   * Create a new job
   */
  async createJob(type: string, data: any, userId: string): Promise<Job> {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    const job = await prisma.backgroundJob.create({
      data: {
        userId,
        type,
        title: this.getJobTitle(type),
        status: 'PENDING',
        progress: 0,
        metadata: data,
      },
    });

    this.emit('job:created', job);

    return {
      id: job.id,
      type: job.type,
      status: job.status as JobStatus,
      progress: job.progress,
      data: job.metadata,
      createdAt: job.startedAt,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status as JobStatus,
      progress: job.progress,
      data: job.metadata,
      result: job.result,
      error: job.error || undefined,
      createdAt: job.startedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt || undefined,
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    this.runningJobs.delete(jobId);
    this.emit('job:cancelled', jobId);
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { progress },
    });

    this.emit('job:progress', { jobId, progress });
  }

  /**
   * Start job processor
   */
  private startJobProcessor(): void {
    setInterval(async () => {
      await this.processJobs();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    // Check if we can run more jobs
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    // Get pending jobs
    const pendingJobs = await prisma.backgroundJob.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        startedAt: 'asc',
      },
      take: this.maxConcurrentJobs - this.runningJobs.size,
    });

    // Process each job
    for (const job of pendingJobs) {
      this.runJob(job.id);
    }
  }

  /**
   * Run a job
   */
  private async runJob(jobId: string): Promise<void> {
    // Mark as running
    this.runningJobs.add(jobId);

    try {
      // Get job details
      const job = await prisma.backgroundJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Update status to running
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      this.emit('job:started', jobId);

      // Get handler
      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      // Execute handler
      const updateProgress = async (progress: number) => {
        await this.updateJobProgress(jobId, progress);
      };

      const result = await handler(
        {
          id: job.id,
          type: job.type,
          status: 'RUNNING',
          progress: job.progress,
          data: job.metadata,
          createdAt: job.startedAt,
        },
        updateProgress
      );

      // Mark as completed
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          result,
          completedAt: new Date(),
        },
      });

      this.emit('job:completed', { jobId, result });
    } catch (error: any) {
      // Mark as failed
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      this.emit('job:failed', { jobId, error: error.message });
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Get job title from type
   */
  private getJobTitle(type: string): string {
    const titles: Record<string, string> = {
      'bulk-import': 'Bulk Import Rate Cards',
      'bulk-export': 'Bulk Export Rate Cards',
      'bulk-benchmark': 'Bulk Benchmark Calculation',
      'bulk-forecast': 'Bulk Forecast Generation',
      'cluster-analysis': 'Cluster Analysis',
      'report-generation': 'Report Generation',
    };

    return titles[type] || type;
  }

  /**
   * List jobs for user
   */
  async listJobs(
    userId: string,
    options?: {
      status?: JobStatus;
      type?: string;
      limit?: number;
    }
  ): Promise<Job[]> {
    const where: any = { userId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.type) {
      where.type = options.type;
    }

    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: {
        startedAt: 'desc',
      },
      take: options?.limit || 50,
    });

    return jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status as JobStatus,
      progress: job.progress,
      data: job.metadata,
      result: job.result,
      error: job.error || undefined,
      createdAt: job.startedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt || undefined,
    }));
  }

  /**
   * Clean up old jobs
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.backgroundJob.deleteMany({
      where: {
        completedAt: {
          lt: cutoffDate,
        },
        status: {
          in: ['COMPLETED', 'FAILED', 'CANCELLED'],
        },
      },
    });

    return result.count;
  }
}

// Global instance
export const asyncJobService = new AsyncJobService();

// Register default handlers
asyncJobService.registerHandler('bulk-import', async (job, updateProgress) => {
  // Bulk import implementation
  const { data } = job;
  const totalRecords = data.records?.length || 0;

  for (let i = 0; i < totalRecords; i++) {
    // Process record
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate work

    // Update progress
    const progress = Math.floor(((i + 1) / totalRecords) * 100);
    await updateProgress(progress);
  }

  return { imported: totalRecords };
});

asyncJobService.registerHandler('bulk-export', async (job, updateProgress) => {
  // Bulk export implementation
  const { filters } = job.data;

  await updateProgress(25);
  // Fetch data
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await updateProgress(50);
  // Format data
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await updateProgress(75);
  // Generate file
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await updateProgress(100);

  return { fileUrl: '/exports/rate-cards-export.csv' };
});

asyncJobService.registerHandler('bulk-benchmark', async (job, updateProgress) => {
  // Bulk benchmark calculation
  const { rateCardIds } = job.data;
  const total = rateCardIds?.length || 0;

  for (let i = 0; i < total; i++) {
    // Calculate benchmark
    await new Promise((resolve) => setTimeout(resolve, 200));

    const progress = Math.floor(((i + 1) / total) * 100);
    await updateProgress(progress);
  }

  return { calculated: total };
});
