import { ProcessingJob, JobStatus, Prisma } from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type ProcessingJobCreateInput = Prisma.ProcessingJobCreateInput;
export type ProcessingJobUpdateInput = Prisma.ProcessingJobUpdateInput;
export type ProcessingJobWhereInput = Prisma.ProcessingJobWhereInput;

export class ProcessingJobRepository extends AbstractRepository<
  ProcessingJob,
  ProcessingJobCreateInput,
  ProcessingJobUpdateInput,
  ProcessingJobWhereInput
> {
  protected modelName = 'processingJob';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find jobs by contract ID
   */
  async findByContractId(contractId: string): Promise<ProcessingJob[]> {
    return await this.prisma.processingJob.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get latest job for a contract
   */
  async getLatestByContractId(contractId: string): Promise<ProcessingJob | null> {
    return await this.prisma.processingJob.findFirst({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find jobs by status
   */
  async findByStatus(status: JobStatus): Promise<ProcessingJob[]> {
    return await this.prisma.processingJob.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update job status
   */
  async updateStatus(
    id: string,
    status: JobStatus,
    options?: {
      progress?: number;
      currentStep?: string;
      error?: string;
      errorStack?: string;
    }
  ): Promise<ProcessingJob> {
    const data: any = {
      status,
      updatedAt: new Date(),
    };

    if (options?.progress !== undefined) {
      data.progress = options.progress;
    }

    if (options?.currentStep) {
      data.currentStep = options.currentStep;
    }

    if (options?.error) {
      data.error = options.error;
      data.errorStack = options.errorStack;
    }

    if (status === JobStatus.RUNNING && !data.startedAt) {
      data.startedAt = new Date();
    }

    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      data.completedAt = new Date();
    }

    return await this.prisma.processingJob.update({
      where: { id },
      data,
    });
  }

  /**
   * Update job progress
   */
  async updateProgress(
    id: string,
    progress: number,
    currentStep?: string
  ): Promise<ProcessingJob> {
    return await this.prisma.processingJob.update({
      where: { id },
      data: {
        progress,
        currentStep,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark job as failed
   */
  async markAsFailed(
    id: string,
    error: string,
    errorStack?: string
  ): Promise<ProcessingJob> {
    return await this.prisma.processingJob.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        error,
        errorStack,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark job as completed
   */
  async markAsCompleted(id: string): Promise<ProcessingJob> {
    return await this.prisma.processingJob.update({
      where: { id },
      data: {
        status: JobStatus.COMPLETED,
        progress: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Increment retry count
   */
  async incrementRetryCount(id: string): Promise<ProcessingJob> {
    const job = await this.findById(id);
    if (!job) {
      throw new Error(`ProcessingJob ${id} not found`);
    }

    return await this.prisma.processingJob.update({
      where: { id },
      data: {
        retryCount: job.retryCount + 1,
        status: JobStatus.RETRYING,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if job can be retried
   */
  async canRetry(id: string): Promise<boolean> {
    const job = await this.findById(id);
    if (!job) {
      return false;
    }
    return job.retryCount < job.maxRetries;
  }

  /**
   * Get pending jobs (for processing queue)
   */
  async getPendingJobs(limit = 10): Promise<ProcessingJob[]> {
    return await this.prisma.processingJob.findMany({
      where: {
        status: JobStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Get stuck jobs (running for too long)
   */
  async getStuckJobs(timeoutMinutes = 30): Promise<ProcessingJob[]> {
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

    return await this.prisma.processingJob.findMany({
      where: {
        status: JobStatus.RUNNING,
        startedAt: {
          lt: timeoutDate,
        },
      },
    });
  }

  /**
   * Get job statistics
   */
  async getStatistics(options?: {
    contractId?: string;
    dateRange?: { from: Date; to: Date };
  }): Promise<{
    total: number;
    byStatus: Record<JobStatus, number>;
    avgProcessingTime: number;
    successRate: number;
  }> {
    const where: Prisma.ProcessingJobWhereInput = {};

    if (options?.contractId) {
      where.contractId = options.contractId;
    }

    if (options?.dateRange) {
      where.createdAt = {
        gte: options.dateRange.from,
        lte: options.dateRange.to,
      };
    }

    const [total, byStatus, completed] = await Promise.all([
      this.prisma.processingJob.count({ where }),
      this.prisma.processingJob.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.processingJob.findMany({
        where: {
          ...where,
          status: { in: [JobStatus.COMPLETED, JobStatus.FAILED] },
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: {
          startedAt: true,
          completedAt: true,
          status: true,
        },
      }),
    ]);

    // Calculate average processing time
    const processingTimes = completed
      .filter(job => job.startedAt && job.completedAt)
      .map(job => {
        const start = new Date(job.startedAt!).getTime();
        const end = new Date(job.completedAt!).getTime();
        return end - start;
      });

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    // Calculate success rate
    const completedCount = completed.filter(j => j.status === JobStatus.COMPLETED).length;
    const successRate = completed.length > 0
      ? (completedCount / completed.length) * 100
      : 0;

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status as JobStatus] = item._count.status;
        return acc;
      }, {} as Record<JobStatus, number>),
      avgProcessingTime: Math.round(avgProcessingTime / 1000), // Convert to seconds
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.processingJob.deleteMany({
      where: {
        status: { in: [JobStatus.COMPLETED, JobStatus.FAILED] },
        completedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}
