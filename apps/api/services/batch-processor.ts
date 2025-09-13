import { EventEmitter } from 'events';
import { hash } from '../../../packages/utils/src';
import { logger } from '../../../packages/utils/src/logging';
import { cache } from '../cache';
import { createRun, markStage, updateContract } from '../store';

interface BatchJob {
  id: string;
  contractFiles: Array<{
    id: string;
    filePath: string;
    fileName: string;
    fileType: string;
    metadata?: Record<string, any>;
  }>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  tenantId?: string;
  callback?: {
    url: string;
    headers?: Record<string, string>;
  };
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    failed: number;
    successful: number;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results: Array<{
    contractId: string;
    status: 'success' | 'failed';
    result?: any;
    error?: string;
    processingTime: number;
  }>;
}

interface ProcessingStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number; // contracts per minute
}

class OptimizedBatchProcessor extends EventEmitter {
  private jobs = new Map<string, BatchJob>();
  private processingQueue: string[] = [];
  private activeTasks = new Set<string>();
  private maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_BATCH_JOBS || '5');
  private maxContractsPerBatch = parseInt(process.env.MAX_CONTRACTS_PER_BATCH || '50');
  private retryAttempts = parseInt(process.env.BATCH_RETRY_ATTEMPTS || '3');
  private processingStats: ProcessingStats = {
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    throughput: 0
  };
  private processingTimes: number[] = [];
  
  constructor() {
    super();
    this.startProcessingLoop();
    this.startMetricsCollection();
  }

  /**
   * Submit a batch job for processing
   */
  async submitBatch(
    contractFiles: BatchJob['contractFiles'],
    options: {
      priority?: BatchJob['priority'];
      tenantId?: string;
      callback?: BatchJob['callback'];
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId(contractFiles);
    
    // Validate batch size
    if (contractFiles.length > this.maxContractsPerBatch) {
      throw new Error(`Batch size ${contractFiles.length} exceeds maximum ${this.maxContractsPerBatch}`);
    }

    const job: BatchJob = {
      id: jobId,
      contractFiles,
      priority: options.priority || 'normal',
      tenantId: options.tenantId,
      callback: options.callback,
      status: 'queued',
      progress: {
        total: contractFiles.length,
        processed: 0,
        failed: 0,
        successful: 0
      },
      createdAt: new Date(),
      results: []
    };

    this.jobs.set(jobId, job);
    this.queueJob(jobId);
    this.processingStats.totalJobs++;

    logger.info(`Batch job ${jobId} submitted with ${contractFiles.length} contracts`, {
      jobId,
      priority: job.priority,
      tenantId: job.tenantId
    });

    this.emit('jobSubmitted', job);
    return jobId;
  }

  /**
   * Get job status and progress
   */
  getJobStatus(jobId: string): BatchJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel a queued job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'processing') {
      // Cannot cancel jobs that are already processing
      return false;
    }

    if (job.status === 'queued') {
      job.status = 'failed';
      job.error = 'Job cancelled by user';
      job.completedAt = new Date();
      
      // Remove from queue
      const queueIndex = this.processingQueue.indexOf(jobId);
      if (queueIndex > -1) {
        this.processingQueue.splice(queueIndex, 1);
      }

      this.emit('jobCancelled', job);
      return true;
    }

    return false;
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.processingStats };
  }

  /**
   * Get all jobs for a tenant
   */
  getJobsByTenant(tenantId: string): BatchJob[] {
    return Array.from(this.jobs.values()).filter(job => job.tenantId === tenantId);
  }

  private generateJobId(contractFiles: BatchJob['contractFiles']): string {
    const content = contractFiles.map(f => f.filePath + f.fileName).join(':');
    return hash(content + Date.now().toString()).substring(0, 16);
  }

  private queueJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Insert job based on priority
    const priorities = { critical: 0, high: 1, normal: 2, low: 3 };
    const jobPriority = priorities[job.priority];
    
    let insertIndex = this.processingQueue.length;
    for (let i = 0; i < this.processingQueue.length; i++) {
      const queuedJob = this.jobs.get(this.processingQueue[i]);
      if (queuedJob && priorities[queuedJob.priority] > jobPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.processingQueue.splice(insertIndex, 0, jobId);
  }

  private async startProcessingLoop() {
    setInterval(async () => {
      await this.processNextJob();
    }, 1000); // Check every second
  }

  private async processNextJob() {
    if (this.activeTasks.size >= this.maxConcurrentJobs) {
      return; // At capacity
    }

    if (this.processingQueue.length === 0) {
      return; // No jobs queued
    }

    const jobId = this.processingQueue.shift()!;
    const job = this.jobs.get(jobId);
    
    if (!job || job.status !== 'queued') {
      return;
    }

    this.activeTasks.add(jobId);
    this.processingStats.activeJobs++;

    try {
      await this.processJob(job);
    } catch (error) {
      logger.error(`Batch job ${jobId} failed:`, error);
    } finally {
      this.activeTasks.delete(jobId);
      this.processingStats.activeJobs--;
    }
  }

  private async processJob(job: BatchJob) {
    const startTime = Date.now();
    
    job.status = 'processing';
    job.startedAt = new Date();
    
    logger.info(`Starting batch job ${job.id} with ${job.contractFiles.length} contracts`);
    this.emit('jobStarted', job);

    try {
      // Process contracts in parallel with controlled concurrency
      const concurrency = Math.min(job.contractFiles.length, 10);
      const semaphore = new Map<number, boolean>();
      
      // Initialize semaphore
      for (let i = 0; i < concurrency; i++) {
        semaphore.set(i, true);
      }

      const processingPromises = job.contractFiles.map(async (contractFile, index) => {
        // Wait for available slot
        await this.waitForSemaphoreSlot(semaphore);
        
        try {
          const result = await this.processContractWithRetry(contractFile, job.tenantId);
          
          job.results.push({
            contractId: contractFile.id,
            status: 'success',
            result,
            processingTime: Date.now() - startTime
          });
          
          job.progress.successful++;
        } catch (error) {
          logger.error(`Failed to process contract ${contractFile.id}:`, error);
          
          job.results.push({
            contractId: contractFile.id,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            processingTime: Date.now() - startTime
          });
          
          job.progress.failed++;
        } finally {
          job.progress.processed++;
          this.releaseSemaphoreSlot(semaphore);
          
          // Emit progress update
          this.emit('jobProgress', {
            jobId: job.id,
            progress: job.progress,
            lastProcessed: contractFile.id
          });
        }
      });

      await Promise.all(processingPromises);

      // Job completed
      job.status = 'completed';
      job.completedAt = new Date();
      
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      
      // Update stats
      this.processingStats.completedJobs++;
      this.updateAverageProcessingTime();
      
      logger.info(`Batch job ${job.id} completed successfully`, {
        jobId: job.id,
        successful: job.progress.successful,
        failed: job.progress.failed,
        processingTime
      });

      this.emit('jobCompleted', job);
      
      // Send callback if configured
      if (job.callback) {
        await this.sendCallback(job);
      }

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      
      this.processingStats.failedJobs++;
      
      logger.error(`Batch job ${job.id} failed:`, error);
      this.emit('jobFailed', job);
    }
  }

  private async waitForSemaphoreSlot(semaphore: Map<number, boolean>): Promise<number> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        for (const [slot, available] of semaphore.entries()) {
          if (available) {
            semaphore.set(slot, false);
            resolve(slot);
            return;
          }
        }
        // No slot available, check again in 100ms
        setTimeout(checkSlot, 100);
      };
      checkSlot();
    });
  }

  private releaseSemaphoreSlot(semaphore: Map<number, boolean>, slot?: number) {
    if (slot !== undefined) {
      semaphore.set(slot, true);
    } else {
      // Find first occupied slot and release it
      for (const [slotNum, available] of semaphore.entries()) {
        if (!available) {
          semaphore.set(slotNum, true);
          break;
        }
      }
    }
  }

  private async processContractWithRetry(
    contractFile: BatchJob['contractFiles'][0],
    tenantId?: string,
    attempt = 1
  ): Promise<any> {
    try {
      return await this.processSingleContract(contractFile, tenantId);
    } catch (error) {
      if (attempt < this.retryAttempts) {
        logger.warn(`Contract ${contractFile.id} failed, retrying (${attempt}/${this.retryAttempts})`);
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        
        return this.processContractWithRetry(contractFile, tenantId, attempt + 1);
      }
      throw error;
    }
  }

  private async processSingleContract(
    contractFile: BatchJob['contractFiles'][0],
    tenantId?: string
  ): Promise<any> {
    // Check cache first
    const cacheKey = `contract:processed:${contractFile.id}:${contractFile.filePath}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      logger.info(`Cache hit for contract ${contractFile.id}`);
      return cached;
    }

    // Simulate contract processing (replace with actual processing logic)
    logger.info(`Processing contract ${contractFile.id}: ${contractFile.fileName}`);
    
    // Create run tracking
    const runId = createRun(contractFile.id);
    
    // Mark stages as we process them
    markStage(contractFile.id, 'ingestion', true);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    const result = {
      contractId: contractFile.id,
      fileName: contractFile.fileName,
      processed: true,
      extractedData: {
        parties: ['Company A', 'Company B'],
        effectiveDate: new Date().toISOString(),
        contractType: 'Service Agreement',
        keyTerms: ['Term 1', 'Term 2', 'Term 3']
      },
      processingMetadata: {
        processingTime: Date.now(),
        version: '1.0.0',
        tenantId
      }
    };

    // Update contract status
    updateContract(contractFile.id, {
      status: 'COMPLETED',
      updatedAt: new Date()
    });

    // Cache result
    await cache.set(cacheKey, result, 3600); // 1 hour cache

    return result;
  }

  private async sendCallback(job: BatchJob) {
    if (!job.callback) return;

    try {
      const response = await fetch(job.callback.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...job.callback.headers
        },
        body: JSON.stringify({
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          results: job.results,
          completedAt: job.completedAt
        })
      });

      if (!response.ok) {
        logger.error(`Callback failed for job ${job.id}: ${response.status} ${response.statusText}`);
      } else {
        logger.info(`Callback sent successfully for job ${job.id}`);
      }
    } catch (error) {
      logger.error(`Callback error for job ${job.id}:`, error);
    }
  }

  private updateAverageProcessingTime() {
    if (this.processingTimes.length === 0) return;

    // Keep only last 100 processing times for rolling average
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }

    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    this.processingStats.averageProcessingTime = sum / this.processingTimes.length;
  }

  private startMetricsCollection() {
    setInterval(() => {
      // Calculate throughput (contracts per minute)
      const recentJobs = Array.from(this.jobs.values()).filter(
        job => job.completedAt && job.completedAt.getTime() > Date.now() - 60000 // Last minute
      );
      
      const contractsInLastMinute = recentJobs.reduce(
        (sum, job) => sum + job.progress.successful, 0
      );
      
      this.processingStats.throughput = contractsInLastMinute;
    }, 10000); // Update every 10 seconds
  }

  /**
   * Clean up old completed jobs to prevent memory leaks
   */
  private cleanupOldJobs() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt && job.completedAt.getTime() < cutoffTime) {
        this.jobs.delete(jobId);
      }
    }
  }
}

// Export singleton instance
export const batchProcessor = new OptimizedBatchProcessor();

// Start cleanup process
setInterval(() => {
  (batchProcessor as any).cleanupOldJobs();
}, 60 * 60 * 1000); // Run every hour
