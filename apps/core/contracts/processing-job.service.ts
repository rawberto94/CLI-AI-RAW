/**
 * Processing Job Management Service
 * Manages contract processing job lifecycle, status updates, and progress tracking
 */

import { ProcessingJob, JobStatus, Prisma } from '@prisma/client';
import { ProcessingJobRepository } from 'clients-db';

export interface CreateJobDto {
  contractId: string;
  userId?: string;
}

export interface UpdateJobDto {
  status?: JobStatus;
  progress?: number;
  currentStep?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface JobProgress {
  id: string;
  contractId: string;
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  duration?: number;
}

export class ProcessingJobService {
  constructor(private repository: ProcessingJobRepository) {}

  /**
   * Create a new processing job for a contract
   */
  async createJob(data: CreateJobDto): Promise<ProcessingJob> {
    return this.repository.create({
      contractId: data.contractId,
      status: 'PENDING',
      progress: 0,
      currentStep: 'Queued',
    });
  }

  /**
   * Update job status and progress
   */
  async updateJob(id: string, data: UpdateJobDto): Promise<ProcessingJob> {
    return this.repository.update(id, data);
  }

  /**
   * Mark job as started
   */
  async startJob(id: string, step: string): Promise<ProcessingJob> {
    return this.repository.update(id, {
      status: 'PROCESSING',
      startedAt: new Date(),
      currentStep: step,
      progress: 0,
    });
  }

  /**
   * Update job progress
   */
  async updateProgress(
    id: string,
    progress: number,
    step: string
  ): Promise<ProcessingJob> {
    return this.repository.update(id, {
      progress: Math.min(100, Math.max(0, progress)),
      currentStep: step,
    });
  }

  /**
   * Mark job as completed
   */
  async completeJob(id: string): Promise<ProcessingJob> {
    return this.repository.update(id, {
      status: 'COMPLETED',
      progress: 100,
      currentStep: 'Completed',
      completedAt: new Date(),
    });
  }

  /**
   * Mark job as failed
   */
  async failJob(id: string, error: string): Promise<ProcessingJob> {
    return this.repository.update(id, {
      status: 'FAILED',
      error,
      currentStep: 'Failed',
      completedAt: new Date(),
    });
  }

  /**
   * Get job by ID
   */
  async getJob(id: string): Promise<ProcessingJob | null> {
    return this.repository.findById(id);
  }

  /**
   * Get job by contract ID
   */
  async getJobByContractId(contractId: string): Promise<ProcessingJob | null> {
    return this.repository.findByContractId(contractId);
  }

  /**
   * Get job progress with calculated duration
   */
  async getJobProgress(id: string): Promise<JobProgress | null> {
    const job = await this.repository.findById(id);
    if (!job) return null;

    let duration: number | undefined;
    if (job.startedAt) {
      const endTime = job.completedAt || new Date();
      duration = Math.floor(
        (endTime.getTime() - job.startedAt.getTime()) / 1000
      );
    }

    return {
      id: job.id,
      contractId: job.contractId,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      duration,
    };
  }

  /**
   * Get all jobs for a contract (including retries)
   */
  async getContractJobs(contractId: string): Promise<ProcessingJob[]> {
    return this.repository.findByContractId(contractId, { includeAll: true });
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus): Promise<ProcessingJob[]> {
    return this.repository.findByStatus(status);
  }

  /**
   * Reset job for retry
   */
  async resetJobForRetry(id: string): Promise<ProcessingJob> {
    return this.repository.update(id, {
      status: 'PENDING',
      progress: 0,
      currentStep: 'Queued for retry',
      error: null,
      startedAt: null,
      completedAt: null,
    });
  }

  /**
   * Get processing statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    averageDuration: number;
  }> {
    const jobs = await this.repository.findAll();

    const stats = {
      total: jobs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      averageDuration: 0,
    };

    let totalDuration = 0;
    let completedCount = 0;

    jobs.forEach((job) => {
      switch (job.status) {
        case 'PENDING':
          stats.pending++;
          break;
        case 'PROCESSING':
          stats.processing++;
          break;
        case 'COMPLETED':
          stats.completed++;
          if (job.startedAt && job.completedAt) {
            totalDuration +=
              (job.completedAt.getTime() - job.startedAt.getTime()) / 1000;
            completedCount++;
          }
          break;
        case 'FAILED':
          stats.failed++;
          break;
      }
    });

    if (completedCount > 0) {
      stats.averageDuration = Math.floor(totalDuration / completedCount);
    }

    return stats;
  }

  /**
   * Clean up old completed jobs (older than 30 days)
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.repository.deleteOldCompleted(cutoffDate);
  }
}
