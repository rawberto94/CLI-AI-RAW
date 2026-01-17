/**
 * Extraction Queue System
 * 
 * Manages background metadata extraction with:
 * - Priority queuing
 * - Rate limiting
 * - Retry logic
 * - Progress tracking
 * - Batch processing
 */

import { SchemaAwareMetadataExtractor, type ExtractionResult } from "./metadata-extractor";
import { ConfidenceCalibrationService } from "./confidence-calibration";

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionJob {
  id: string;
  contractId: string;
  tenantId: string;
  priority: "high" | "normal" | "low";
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
  result?: ExtractionResult;
  options: ExtractionJobOptions;
}

export interface ExtractionJobOptions {
  forceReExtract?: boolean;
  onlyEmptyFields?: boolean;
  specificFields?: string[];
  notifyOnComplete?: boolean;
  webhookUrl?: string;
}

export type JobStatus = 
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
  successRate: number;
}

export interface BatchExtractionRequest {
  contractIds: string[];
  tenantId: string;
  priority?: "high" | "normal" | "low";
  options?: ExtractionJobOptions;
}

export interface BatchExtractionResult {
  batchId: string;
  jobs: ExtractionJob[];
  totalContracts: number;
  estimatedTime: number;
}

// ============================================================================
// EXTRACTION QUEUE SERVICE
// ============================================================================

export class ExtractionQueueService {
  private queue: Map<string, ExtractionJob> = new Map();
  private processing: Set<string> = new Set();
  private processingHistory: Array<{
    duration: number;
    success: boolean;
    timestamp: Date;
  }> = [];
  private maxConcurrent = 3;
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private calibrationService: ConfidenceCalibrationService;

  constructor(options?: {
    maxConcurrent?: number;
    processIntervalMs?: number;
  }) {
    this.maxConcurrent = options?.maxConcurrent ?? 3;
    this.calibrationService = new ConfidenceCalibrationService();
    
    // Start processing loop
    const intervalMs = options?.processIntervalMs ?? 1000;
    this.processInterval = setInterval(() => this.processQueue(), intervalMs);
  }

  // --------------------------------------------------------------------------
  // Queue Management
  // --------------------------------------------------------------------------

  /**
   * Add a single contract to extraction queue
   */
  async enqueue(
    contractId: string,
    tenantId: string,
    options: ExtractionJobOptions = {},
    priority: "high" | "normal" | "low" = "normal"
  ): Promise<ExtractionJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ExtractionJob = {
      id: jobId,
      contractId,
      tenantId,
      priority,
      status: "pending",
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
      options,
    };

    this.queue.set(jobId, job);
    
    return job;
  }

  /**
   * Add multiple contracts as a batch
   */
  async enqueueBatch(request: BatchExtractionRequest): Promise<BatchExtractionResult> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobs: ExtractionJob[] = [];

    for (const contractId of request.contractIds) {
      const job = await this.enqueue(
        contractId,
        request.tenantId,
        {
          ...request.options,
          // Group jobs by batch for tracking
        },
        request.priority ?? "normal"
      );
      jobs.push(job);
    }

    // Estimate time based on average processing time
    const stats = this.getStats();
    const avgTime = stats.averageProcessingTime || 10000; // 10s default
    const estimatedTime = Math.ceil(
      (request.contractIds.length / this.maxConcurrent) * avgTime
    );

    return {
      batchId,
      jobs,
      totalContracts: request.contractIds.length,
      estimatedTime,
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ExtractionJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get all jobs for a contract
   */
  getJobsForContract(contractId: string): ExtractionJob[] {
    return Array.from(this.queue.values())
      .filter(job => job.contractId === contractId);
  }

  /**
   * Cancel a pending job
   */
  cancelJob(jobId: string): boolean {
    const job = this.queue.get(jobId);
    if (!job || job.status !== "pending") {
      return false;
    }

    job.status = "cancelled";
    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const jobs = Array.from(this.queue.values());
    
    const pending = jobs.filter(j => j.status === "pending").length;
    const running = jobs.filter(j => j.status === "running").length;
    const completed = jobs.filter(j => j.status === "completed").length;
    const failed = jobs.filter(j => j.status === "failed").length;

    // Calculate average processing time from history
    const recentHistory = this.processingHistory.slice(-100);
    const totalTime = recentHistory.reduce((sum, h) => sum + h.duration, 0);
    const averageProcessingTime = recentHistory.length > 0 
      ? totalTime / recentHistory.length 
      : 0;

    const successfulJobs = recentHistory.filter(h => h.success).length;
    const successRate = recentHistory.length > 0 
      ? successfulJobs / recentHistory.length 
      : 1;

    return {
      pending,
      running,
      completed,
      failed,
      averageProcessingTime,
      successRate,
    };
  }

  /**
   * Clear completed/failed jobs older than specified age
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const [id, job] of this.queue) {
      if (
        (job.status === "completed" || job.status === "failed" || job.status === "cancelled") &&
        job.completedAt &&
        job.completedAt.getTime() < cutoff
      ) {
        this.queue.delete(id);
        removed++;
      }
    }

    return removed;
  }

  // --------------------------------------------------------------------------
  // Processing Logic
  // --------------------------------------------------------------------------

  /**
   * Main processing loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Get available slots
      const availableSlots = this.maxConcurrent - this.processing.size;
      if (availableSlots <= 0) return;

      // Get pending jobs sorted by priority and creation time
      const pendingJobs = Array.from(this.queue.values())
        .filter(j => j.status === "pending")
        .sort((a, b) => {
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      // Start processing jobs up to available slots
      const jobsToProcess = pendingJobs.slice(0, availableSlots);
      
      for (const job of jobsToProcess) {
        this.processJob(job); // Fire and forget - don't await
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: ExtractionJob): Promise<void> {
    this.processing.add(job.id);
    job.status = "running";
    job.startedAt = new Date();

    const startTime = Date.now();
    let success = false;

    try {
      // Create extractor and run extraction
      // Note: This needs proper integration with the contract text retrieval
      // For now, mark as needing implementation
      const _extractor = new SchemaAwareMetadataExtractor();
      
      // TODO: Get contract text and schema properly
      // For now, set a placeholder result
      
      job.status = "failed";
      job.error = "Extraction queue processing requires contract text retrieval implementation";
      job.completedAt = new Date();
      success = false;
    } catch (error: unknown) {
      job.retryCount++;
      job.error = error instanceof Error ? error.message : "Unknown error";

      if (job.retryCount < job.maxRetries) {
        // Retry with exponential backoff
        job.status = "pending";
        const _backoffMs = Math.pow(2, job.retryCount) * 1000;
      } else {
        job.status = "failed";
        job.completedAt = new Date();
      }
    } finally {
      this.processing.delete(job.id);
      
      // Record processing history
      this.processingHistory.push({
        duration: Date.now() - startTime,
        success,
        timestamp: new Date(),
      });

      // Trim history to last 1000 entries
      if (this.processingHistory.length > 1000) {
        this.processingHistory = this.processingHistory.slice(-1000);
      }
    }
  }

  /**
   * Send webhook notification
   */
  private async notifyWebhook(job: ExtractionJob): Promise<void> {
    if (!job.options.webhookUrl) return;

    try {
      await fetch(job.options.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "extraction.completed",
          jobId: job.id,
          contractId: job.contractId,
          status: job.status,
          result: job.result,
          processingTime: job.completedAt && job.startedAt 
            ? job.completedAt.getTime() - job.startedAt.getTime()
            : null,
        }),
      });
    } catch {
      // Webhook notification failed silently
    }
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Resume processing
   */
  resume(intervalMs: number = 1000): void {
    if (!this.processInterval) {
      this.processInterval = setInterval(() => this.processQueue(), intervalMs);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let queueInstance: ExtractionQueueService | null = null;

export function getExtractionQueue(): ExtractionQueueService {
  if (!queueInstance) {
    queueInstance = new ExtractionQueueService();
  }
  return queueInstance;
}

export function resetExtractionQueue(): void {
  if (queueInstance) {
    queueInstance.stop();
    queueInstance = null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Helper to extract metadata for a contract with queuing
 */
export async function queueMetadataExtraction(
  contractId: string,
  tenantId: string,
  options?: ExtractionJobOptions & { priority?: "high" | "normal" | "low" }
): Promise<ExtractionJob> {
  const queue = getExtractionQueue();
  return queue.enqueue(
    contractId,
    tenantId,
    options,
    options?.priority ?? "normal"
  );
}

/**
 * Helper to extract metadata for multiple contracts
 */
export async function queueBulkMetadataExtraction(
  contractIds: string[],
  tenantId: string,
  options?: ExtractionJobOptions & { priority?: "high" | "normal" | "low" }
): Promise<BatchExtractionResult> {
  const queue = getExtractionQueue();
  return queue.enqueueBatch({
    contractIds,
    tenantId,
    priority: options?.priority,
    options,
  });
}

/**
 * Wait for a job to complete
 */
export async function waitForJob(
  jobId: string,
  timeoutMs: number = 60000
): Promise<ExtractionJob> {
  const queue = getExtractionQueue();
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkJob = () => {
      const job = queue.getJob(jobId);
      
      if (!job) {
        reject(new Error(`Job ${jobId} not found`));
        return;
      }

      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        resolve(job);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for job ${jobId}`));
        return;
      }

      setTimeout(checkJob, 500);
    };

    checkJob();
  });
}
