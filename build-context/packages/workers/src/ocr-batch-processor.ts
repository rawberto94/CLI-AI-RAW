/**
 * OCR Batch Processing Optimization
 * 
 * Efficiently processes multiple documents in parallel with:
 * - Intelligent batching based on document characteristics
 * - Priority-based queue management
 * - Resource-aware concurrency control
 * - Progress tracking and error handling
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'ocr-batch-processor' });

// ============================================================================
// TYPES
// ============================================================================

export type BatchPriority = 'urgent' | 'high' | 'normal' | 'low';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchJob {
  id: string;
  documents: DocumentInput[];
  priority: BatchPriority;
  status: JobStatus;
  progress: BatchProgress;
  options: BatchOptions;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  results: DocumentResult[];
  errors: BatchError[];
  metadata?: Record<string, unknown>;
}

export interface DocumentInput {
  id: string;
  source: Buffer | string; // Buffer for file, string for URL/path
  filename: string;
  mimeType?: string;
  priority?: BatchPriority;
  metadata?: Record<string, unknown>;
}

export interface DocumentResult {
  documentId: string;
  success: boolean;
  text?: string;
  confidence?: number;
  pageCount?: number;
  processingTime: number;
  model?: string;
  entities?: unknown[];
  error?: string;
  warnings?: string[];
}

export interface BatchProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentDocument?: string;
  estimatedTimeRemaining?: number;
  avgProcessingTime?: number;
}

export interface BatchError {
  documentId: string;
  error: string;
  code?: string;
  retryable: boolean;
  timestamp: Date;
}

export interface BatchOptions {
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  continueOnError?: boolean;
  preprocessDocuments?: boolean;
  useAdaptiveModel?: boolean;
  enableLLMCorrection?: boolean;
  webhookUrl?: string;
  groupByType?: boolean;
}

export interface ProcessorConfig {
  maxConcurrentJobs: number;
  maxConcurrentDocuments: number;
  defaultTimeout: number;
  maxRetries: number;
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
}

// ============================================================================
// BATCH QUEUE MANAGER
// ============================================================================

class BatchQueueManager extends EventEmitter {
  private queue: Map<string, BatchJob> = new Map();
  private processing: Set<string> = new Set();
  private config: ProcessorConfig;

  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 5,
      maxConcurrentDocuments: config.maxConcurrentDocuments || 10,
      defaultTimeout: config.defaultTimeout || 60000,
      maxRetries: config.maxRetries || 3,
      resourceLimits: {
        maxMemoryMB: config.resourceLimits?.maxMemoryMB || 2048,
        maxCpuPercent: config.resourceLimits?.maxCpuPercent || 80,
      },
    };
  }

  /**
   * Add a new batch job to the queue
   */
  enqueue(job: BatchJob): void {
    this.queue.set(job.id, job);
    this.emit('jobAdded', { jobId: job.id, documentCount: job.documents.length });
    logger.info({ jobId: job.id, documents: job.documents.length }, 'Batch job added to queue');
  }

  /**
   * Get next job based on priority
   */
  getNextJob(): BatchJob | null {
    const priorityOrder: BatchPriority[] = ['urgent', 'high', 'normal', 'low'];
    
    for (const priority of priorityOrder) {
      for (const [id, job] of this.queue) {
        if (job.status === 'pending' && job.priority === priority && !this.processing.has(id)) {
          return job;
        }
      }
    }
    return null;
  }

  /**
   * Mark job as processing
   */
  startProcessing(jobId: string): void {
    this.processing.add(jobId);
    const job = this.queue.get(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = new Date();
      this.emit('jobStarted', { jobId });
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, results: DocumentResult[], errors: BatchError[]): void {
    this.processing.delete(jobId);
    const job = this.queue.get(jobId);
    if (job) {
      job.status = errors.length > 0 && results.every(r => !r.success) ? 'failed' : 'completed';
      job.completedAt = new Date();
      job.results = results;
      job.errors = errors;
      this.emit('jobCompleted', { jobId, status: job.status, results, errors });
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): BatchJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalJobs: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    let pending = 0, processing = 0, completed = 0, failed = 0;
    
    for (const job of this.queue.values()) {
      switch (job.status) {
        case 'pending': pending++; break;
        case 'processing': processing++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
      }
    }
    
    return { totalJobs: this.queue.size, pending, processing, completed, failed };
  }

  /**
   * Check if can accept more jobs
   */
  canAcceptJob(): boolean {
    return this.processing.size < this.config.maxConcurrentJobs;
  }

  /**
   * Cancel a pending job
   */
  cancelJob(jobId: string): boolean {
    const job = this.queue.get(jobId);
    if (job && job.status === 'pending') {
      job.status = 'cancelled';
      this.emit('jobCancelled', { jobId });
      return true;
    }
    return false;
  }
}

// ============================================================================
// DOCUMENT PROCESSOR
// ============================================================================

interface ProcessingContext {
  job: BatchJob;
  documentIndex: number;
  attempt: number;
  startTime: number;
}

/**
 * Process a single document (mock implementation)
 */
async function processDocument(
  input: DocumentInput,
  context: ProcessingContext
): Promise<DocumentResult> {
  const startTime = Date.now();
  
  try {
    // Simulate processing time based on document size
    const processingTime = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, Math.min(processingTime, 100))); // Cap for tests
    
    // Simulate occasional failures (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error('OCR processing failed: Service temporarily unavailable');
    }

    // Generate mock result
    const confidence = 0.7 + Math.random() * 0.25;
    
    return {
      documentId: input.id,
      success: true,
      text: `[Extracted text from ${input.filename}]`,
      confidence,
      pageCount: Math.ceil(Math.random() * 10) + 1,
      processingTime: Date.now() - startTime,
      model: 'TESSERACT_BEST',
      warnings: confidence < 0.8 ? ['Low confidence - review recommended'] : undefined,
    };
    
  } catch (error) {
    return {
      documentId: input.id,
      success: false,
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// BATCH PROCESSOR
// ============================================================================

export class OCRBatchProcessor extends EventEmitter {
  private queueManager: BatchQueueManager;
  private isRunning: boolean = false;
  private config: ProcessorConfig;
  private processingTimes: number[] = [];

  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 5,
      maxConcurrentDocuments: config.maxConcurrentDocuments || 10,
      defaultTimeout: config.defaultTimeout || 60000,
      maxRetries: config.maxRetries || 3,
      resourceLimits: {
        maxMemoryMB: config.resourceLimits?.maxMemoryMB || 2048,
        maxCpuPercent: config.resourceLimits?.maxCpuPercent || 80,
      },
    };
    this.queueManager = new BatchQueueManager(config);

    // Forward events
    this.queueManager.on('jobAdded', (data) => this.emit('jobAdded', data));
    this.queueManager.on('jobStarted', (data) => this.emit('jobStarted', data));
    this.queueManager.on('jobCompleted', (data) => this.emit('jobCompleted', data));
    this.queueManager.on('jobCancelled', (data) => this.emit('jobCancelled', data));
  }

  /**
   * Submit a new batch job
   */
  async submitBatch(
    documents: DocumentInput[],
    options: BatchOptions = {}
  ): Promise<string> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Sort documents by priority if specified
    const sortedDocs = [...documents].sort((a, b) => {
      const priorityOrder: Record<BatchPriority, number> = {
        urgent: 0,
        high: 1,
        normal: 2,
        low: 3,
      };
      return (priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal']);
    });

    const job: BatchJob = {
      id: jobId,
      documents: sortedDocs,
      priority: options.groupByType ? this.determineBatchPriority(sortedDocs) : 'normal',
      status: 'pending',
      progress: {
        total: documents.length,
        processed: 0,
        successful: 0,
        failed: 0,
      },
      options: {
        maxConcurrency: options.maxConcurrency || this.config.maxConcurrentDocuments,
        retryAttempts: options.retryAttempts || this.config.maxRetries,
        retryDelay: options.retryDelay || 1000,
        timeout: options.timeout || this.config.defaultTimeout,
        continueOnError: options.continueOnError ?? true,
        preprocessDocuments: options.preprocessDocuments ?? true,
        useAdaptiveModel: options.useAdaptiveModel ?? true,
        enableLLMCorrection: options.enableLLMCorrection ?? false,
        ...options,
      },
      createdAt: new Date(),
      results: [],
      errors: [],
    };

    this.queueManager.enqueue(job);
    
    // Start processing if not already running
    if (!this.isRunning) {
      this.startProcessing();
    }

    logger.info({
      jobId,
      documentCount: documents.length,
      priority: job.priority,
    }, 'Batch submitted');

    return jobId;
  }

  /**
   * Determine batch priority from documents
   */
  private determineBatchPriority(documents: DocumentInput[]): BatchPriority {
    const priorities = documents.map(d => d.priority || 'normal');
    if (priorities.includes('urgent')) return 'urgent';
    if (priorities.includes('high')) return 'high';
    return 'normal';
  }

  /**
   * Start the batch processing loop
   */
  private async startProcessing(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('Batch processor started');

    while (this.isRunning) {
      const job = this.queueManager.getNextJob();
      
      if (!job) {
        // No jobs to process, check again soon
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      if (!this.queueManager.canAcceptJob()) {
        // Too many concurrent jobs, wait
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Process the job
      await this.processJob(job);
    }

    logger.info('Batch processor stopped');
  }

  /**
   * Process a single batch job
   */
  private async processJob(job: BatchJob): Promise<void> {
    this.queueManager.startProcessing(job.id);
    const results: DocumentResult[] = [];
    const errors: BatchError[] = [];
    const jobStartTime = Date.now();

    logger.info({
      jobId: job.id,
      documents: job.documents.length,
    }, 'Processing batch job');

    // Process documents in parallel batches
    const concurrency = job.options.maxConcurrency || this.config.maxConcurrentDocuments;
    
    for (let i = 0; i < job.documents.length; i += concurrency) {
      const batch = job.documents.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map((doc, idx) =>
          this.processDocumentWithRetry(doc, {
            job,
            documentIndex: i + idx,
            attempt: 1,
            startTime: Date.now(),
          })
        )
      );

      for (const result of batchResults) {
        results.push(result);
        
        if (result.success) {
          job.progress.successful++;
          this.processingTimes.push(result.processingTime);
          // Keep only last 100 processing times for average
          if (this.processingTimes.length > 100) {
            this.processingTimes.shift();
          }
        } else {
          job.progress.failed++;
          errors.push({
            documentId: result.documentId,
            error: result.error || 'Unknown error',
            retryable: false,
            timestamp: new Date(),
          });
        }

        job.progress.processed++;
        job.progress.avgProcessingTime = this.getAverageProcessingTime();
        job.progress.estimatedTimeRemaining = this.estimateRemainingTime(job);

        this.emit('progress', {
          jobId: job.id,
          progress: { ...job.progress },
        });
      }

      // Check if we should continue
      if (!job.options.continueOnError && errors.length > 0) {
        logger.warn({ jobId: job.id }, 'Stopping batch due to errors');
        break;
      }
    }

    // Complete the job
    this.queueManager.completeJob(job.id, results, errors);

    const totalTime = Date.now() - jobStartTime;
    logger.info({
      jobId: job.id,
      totalDocuments: job.documents.length,
      successful: job.progress.successful,
      failed: job.progress.failed,
      totalTime,
    }, 'Batch job completed');
  }

  /**
   * Process document with retry logic
   */
  private async processDocumentWithRetry(
    input: DocumentInput,
    context: ProcessingContext
  ): Promise<DocumentResult> {
    const maxAttempts = context.job.options.retryAttempts || this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await Promise.race([
          processDocument(input, { ...context, attempt }),
          this.createTimeout(context.job.options.timeout || this.config.defaultTimeout),
        ]) as DocumentResult;

        if (result.success) {
          return result;
        }

        // If not successful and retryable, continue to next attempt
        if (attempt < maxAttempts) {
          const delay = (context.job.options.retryDelay || 1000) * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        lastError = new Error(result.error);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxAttempts) {
          const delay = (context.job.options.retryDelay || 1000) * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      documentId: input.id,
      success: false,
      processingTime: Date.now() - context.startTime,
      error: lastError?.message || 'Max retries exceeded',
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), ms);
    });
  }

  /**
   * Get average processing time
   */
  private getAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    return this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }

  /**
   * Estimate remaining time for a job
   */
  private estimateRemainingTime(job: BatchJob): number {
    const avgTime = this.getAverageProcessingTime();
    const remaining = job.progress.total - job.progress.processed;
    const concurrency = job.options.maxConcurrency || this.config.maxConcurrentDocuments;
    return (remaining / concurrency) * avgTime;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BatchJob | undefined {
    return this.queueManager.getJob(jobId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queueManager.getStats();
  }

  /**
   * Cancel a pending job
   */
  cancelJob(jobId: string): boolean {
    return this.queueManager.cancelJob(jobId);
  }

  /**
   * Stop the processor
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Stopping batch processor');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a batch from file paths
 */
export function createBatchFromPaths(
  paths: string[],
  options: { priority?: BatchPriority } = {}
): DocumentInput[] {
  return paths.map((path, index) => ({
    id: `doc_${Date.now()}_${index}`,
    source: path,
    filename: path.split('/').pop() || `document_${index}`,
    priority: options.priority || 'normal',
  }));
}

/**
 * Create a batch from buffers
 */
export function createBatchFromBuffers(
  buffers: Array<{ buffer: Buffer; filename: string; mimeType?: string }>,
  options: { priority?: BatchPriority } = {}
): DocumentInput[] {
  return buffers.map((item, index) => ({
    id: `doc_${Date.now()}_${index}`,
    source: item.buffer,
    filename: item.filename,
    mimeType: item.mimeType,
    priority: options.priority || 'normal',
  }));
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let defaultProcessor: OCRBatchProcessor | null = null;

export function getDefaultBatchProcessor(): OCRBatchProcessor {
  if (!defaultProcessor) {
    defaultProcessor = new OCRBatchProcessor();
  }
  return defaultProcessor;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const BatchProcessor = {
  create: (config?: Partial<ProcessorConfig>) => new OCRBatchProcessor(config),
  getDefault: getDefaultBatchProcessor,
  createBatchFromPaths,
  createBatchFromBuffers,
};

export default BatchProcessor;
