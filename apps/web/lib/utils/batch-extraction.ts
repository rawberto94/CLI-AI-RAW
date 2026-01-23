/**
 * Batch Extraction Operations
 * 
 * Utilities for batch processing of contracts:
 * - Queue management for large batches
 * - Progress tracking
 * - Error handling and retries
 * - Result aggregation
 */

import {
  getExtractionQueue,
  type BatchExtractionResult,
  type ExtractionJob,
  type QueueStats,
} from "@/lib/ai";

// ============================================================================
// TYPES
// ============================================================================

export interface BatchOperationConfig {
  /** Maximum concurrent extractions */
  concurrency?: number;
  /** Retry failed extractions */
  retryFailed?: boolean;
  /** Maximum retries per contract */
  maxRetries?: number;
  /** Priority for the batch */
  priority?: "high" | "normal" | "low";
  /** Callback on progress update */
  onProgress?: (progress: BatchProgress) => void;
  /** Callback on job completion */
  onJobComplete?: (job: ExtractionJob) => void;
  /** Callback on error */
  onError?: (contractId: string, error: string) => void;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  percentComplete: number;
  estimatedTimeRemaining: number | null;
}

export interface BatchResult {
  batchId: string;
  totalContracts: number;
  successful: number;
  failed: number;
  averageConfidence: number;
  processingTimeMs: number;
  jobs: ExtractionJob[];
  errors: Array<{ contractId: string; error: string }>;
}

// ============================================================================
// BATCH PROCESSOR CLASS
// ============================================================================

export class BatchExtractionProcessor {
  private config: Required<BatchOperationConfig>;
  private startTime: number = 0;
  private completedTimes: number[] = [];

  constructor(config: BatchOperationConfig = {}) {
    this.config = {
      concurrency: config.concurrency ?? 3,
      retryFailed: config.retryFailed ?? true,
      maxRetries: config.maxRetries ?? 2,
      priority: config.priority ?? "normal",
      onProgress: config.onProgress ?? (() => {}),
      onJobComplete: config.onJobComplete ?? (() => {}),
      onError: config.onError ?? (() => {}),
    };
  }

  /**
   * Process a batch of contracts
   */
  async processBatch(
    contractIds: string[],
    tenantId: string
  ): Promise<BatchResult> {
    this.startTime = Date.now();
    this.completedTimes = [];

    const queue = getExtractionQueue();
    const errors: Array<{ contractId: string; error: string }> = [];

    // Queue all contracts
    const batchResult = await fetch("/api/contracts/bulk-extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify({
        contractIds,
        priority: this.config.priority,
        options: {
          maxRetries: this.config.maxRetries,
        },
      }),
    });

    if (!batchResult.ok) {
      throw new Error("Failed to queue batch extraction");
    }

    const { batchId, jobs: initialJobs } = await batchResult.json() as BatchExtractionResult;

    // Poll for progress
    const completedJobs = await this.pollForCompletion(
      initialJobs.map(j => j.id),
      tenantId,
      contractIds.length
    );

    // Collect results
    let successful = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const job of completedJobs) {
      if (job.status === "completed") {
        successful++;
        if (job.result) {
          // Use the confidence from the extraction result
          const resultObj = job.result as unknown as Record<string, unknown>;
          const confidence = typeof resultObj.confidence === 'number' ? resultObj.confidence : undefined;
          if (confidence !== undefined) {
            totalConfidence += confidence;
            confidenceCount++;
          }
        }
      } else if (job.status === "failed") {
        errors.push({
          contractId: job.contractId,
          error: job.error || "Unknown error",
        });
        this.config.onError(job.contractId, job.error || "Unknown error");
      }
    }

    const result: BatchResult = {
      batchId,
      totalContracts: contractIds.length,
      successful,
      failed: errors.length,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      processingTimeMs: Date.now() - this.startTime,
      jobs: completedJobs,
      errors,
    };

    return result;
  }

  /**
   * Poll queue for job completion
   */
  private async pollForCompletion(
    jobIds: string[],
    tenantId: string,
    totalContracts: number
  ): Promise<ExtractionJob[]> {
    const completedJobs: ExtractionJob[] = [];
    const pendingJobIds = new Set(jobIds);
    const pollInterval = 2000; // 2 seconds
    const maxPollTime = 30 * 60 * 1000; // 30 minutes max
    const pollStartTime = Date.now();

    while (pendingJobIds.size > 0) {
      // Check for timeout
      if (Date.now() - pollStartTime > maxPollTime) {
        break;
      }

      // Check each pending job
      for (const jobId of pendingJobIds) {
        try {
          const response = await fetch(
            `/api/contracts/bulk-extract?jobId=${jobId}`,
            {
              headers: { "x-tenant-id": tenantId },
            }
          );

          if (response.ok) {
            const { job } = await response.json();

            if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
              completedJobs.push(job);
              pendingJobIds.delete(jobId);
              this.completedTimes.push(Date.now());
              this.config.onJobComplete(job);
            }
          }
        } catch {
          // Job check failed, will retry on next poll
        }
      }

      // Update progress
      const progress = this.calculateProgress(
        totalContracts,
        completedJobs.length,
        completedJobs.filter(j => j.status === "failed").length,
        pendingJobIds.size
      );
      this.config.onProgress(progress);

      // Wait before next poll
      if (pendingJobIds.size > 0) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return completedJobs;
  }

  /**
   * Calculate current progress
   */
  private calculateProgress(
    total: number,
    completed: number,
    failed: number,
    pending: number
  ): BatchProgress {
    const inProgress = total - completed - pending;
    const percentComplete = total > 0 ? (completed / total) * 100 : 0;

    // Estimate remaining time based on recent completions
    let estimatedTimeRemaining: number | null = null;
    if (this.completedTimes.length >= 2) {
      const recentTimes = this.completedTimes.slice(-10);
      const firstTime = recentTimes[0];
      const lastTime = recentTimes[recentTimes.length - 1];
      const avgTimePerJob = recentTimes.length > 1 && firstTime !== undefined && lastTime !== undefined
        ? (lastTime - firstTime) / (recentTimes.length - 1)
        : 10000; // Default 10 seconds
      estimatedTimeRemaining = (pending + inProgress) * avgTimePerJob;
    }

    return {
      total,
      completed,
      failed,
      inProgress,
      pending,
      percentComplete,
      estimatedTimeRemaining,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick batch extraction with default settings
 */
export async function extractBatch(
  contractIds: string[],
  tenantId: string,
  onProgress?: (progress: BatchProgress) => void
): Promise<BatchResult> {
  const processor = new BatchExtractionProcessor({ onProgress });
  return processor.processBatch(contractIds, tenantId);
}

/**
 * Get current queue statistics
 */
export async function getQueueStatus(tenantId: string): Promise<QueueStats> {
  const response = await fetch("/api/contracts/bulk-extract", {
    headers: { "x-tenant-id": tenantId },
  });

  if (!response.ok) {
    throw new Error("Failed to get queue status");
  }

  const { stats } = await response.json();
  return stats;
}

/**
 * Cancel a pending job
 */
export async function cancelJob(jobId: string, tenantId: string): Promise<boolean> {
  const response = await fetch(`/api/contracts/bulk-extract?jobId=${jobId}`, {
    method: "DELETE",
    headers: { "x-tenant-id": tenantId },
  });

  return response.ok;
}

/**
 * Retry failed jobs from a batch
 */
export async function retryFailedJobs(
  batchResult: BatchResult,
  tenantId: string
): Promise<BatchResult> {
  const failedContractIds = batchResult.errors.map(e => e.contractId);
  
  if (failedContractIds.length === 0) {
    return batchResult;
  }

  const processor = new BatchExtractionProcessor({
    priority: "high", // Retries get high priority
    retryFailed: false, // Don't retry within retry
  });

  return processor.processBatch(failedContractIds, tenantId);
}

// Types are already exported at definition
