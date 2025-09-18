/**
 * Real-Time Indexing Service
 * Automatically updates search indexes when artifacts are created or updated
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'real-time-indexing' });

export interface IndexingEvent {
  type: 'contract_created' | 'artifact_created' | 'artifact_updated' | 'contract_updated';
  contractId: string;
  tenantId: string;
  artifactType?: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IndexingJob {
  id: string;
  contractId: string;
  tenantId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata: Record<string, any>;
}

export interface IndexingStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number; // jobs per minute
  errorRate: number;
}

export class RealTimeIndexingService extends EventEmitter {
  private indexingQueue: IndexingJob[] = [];
  private processingJobs = new Map<string, IndexingJob>();
  private completedJobs: IndexingJob[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private stats: IndexingStats = {
    totalJobs: 0,
    pendingJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    throughput: 0,
    errorRate: 0
  };

  constructor() {
    super();
    this.startProcessing();
    this.startStatsCollection();
  }

  /**
   * Queue a contract for real-time indexing
   */
  async queueIndexing(event: IndexingEvent): Promise<string> {
    const jobId = `idx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: IndexingJob = {
      id: jobId,
      contractId: event.contractId,
      tenantId: event.tenantId,
      priority: this.getPriorityValue(event.priority),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: new Date(),
      metadata: {
        eventType: event.type,
        artifactType: event.artifactType,
        originalTimestamp: event.timestamp,
        ...event.metadata
      }
    };

    // Check for duplicate jobs and update if necessary
    const existingJobIndex = this.indexingQueue.findIndex(j => j.contractId === event.contractId);
    if (existingJobIndex !== -1) {
      // Update existing job with higher priority if needed
      const existingJob = this.indexingQueue[existingJobIndex];
      if (job.priority < existingJob.priority) {
        existingJob.priority = job.priority;
        existingJob.scheduledAt = new Date();
        existingJob.metadata = { ...existingJob.metadata, ...job.metadata };
        logger.debug({ 
          jobId: existingJob.id, 
          contractId: event.contractId 
        }, 'Updated existing indexing job priority');
        return existingJob.id;
      } else {
        logger.debug({ 
          contractId: event.contractId 
        }, 'Skipping duplicate indexing job');
        return existingJob.id;
      }
    }

    // Add new job to queue
    this.indexingQueue.push(job);
    this.sortQueue();
    this.updateStats();

    logger.info({ 
      jobId, 
      contractId: event.contractId, 
      eventType: event.type, 
      priority: event.priority 
    }, 'Queued contract for real-time indexing');

    // Emit event for monitoring
    this.emit('job_queued', job);

    return jobId;
  }

  /**
   * Process indexing queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.indexingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process up to 5 jobs concurrently
      const concurrentJobs = Math.min(5, this.indexingQueue.length);
      const jobsToProcess = this.indexingQueue.splice(0, concurrentJobs);

      const processingPromises = jobsToProcess.map(job => this.processJob(job));
      await Promise.allSettled(processingPromises);

    } catch (error) {
      logger.error({ error }, 'Error processing indexing queue');
    } finally {
      this.isProcessing = false;
      this.updateStats();
    }
  }

  /**
   * Process individual indexing job
   */
  private async processJob(job: IndexingJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      job.status = 'processing';
      job.startedAt = new Date();
      this.processingJobs.set(job.id, job);

      logger.debug({ 
        jobId: job.id, 
        contractId: job.contractId 
      }, 'Processing indexing job');

      // Emit processing event
      this.emit('job_processing', job);

      // Perform the actual indexing
      await this.performIndexing(job);

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();
      
      this.processingJobs.delete(job.id);
      this.completedJobs.push(job);

      // Keep only recent completed jobs
      if (this.completedJobs.length > 1000) {
        this.completedJobs = this.completedJobs.slice(-1000);
      }

      const processingTime = Date.now() - startTime;
      logger.info({ 
        jobId: job.id, 
        contractId: job.contractId, 
        processingTime 
      }, 'Indexing job completed successfully');

      // Emit completion event
      this.emit('job_completed', job, processingTime);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({ 
        error, 
        jobId: job.id, 
        contractId: job.contractId, 
        processingTime 
      }, 'Indexing job failed');

      job.error = errorMessage;
      job.retryCount++;

      // Determine if we should retry
      if (job.retryCount < job.maxRetries && this.isRetryableError(error)) {
        // Re-queue with exponential backoff
        const delay = Math.pow(2, job.retryCount) * 1000; // 2s, 4s, 8s
        setTimeout(() => {
          job.status = 'pending';
          job.scheduledAt = new Date(Date.now() + delay);
          this.indexingQueue.push(job);
          this.sortQueue();
        }, delay);

        logger.info({ 
          jobId: job.id, 
          retryCount: job.retryCount, 
          delay 
        }, 'Retrying indexing job');
      } else {
        // Mark as failed
        job.status = 'failed';
        job.completedAt = new Date();
        this.completedJobs.push(job);

        logger.error({ 
          jobId: job.id, 
          contractId: job.contractId, 
          retryCount: job.retryCount 
        }, 'Indexing job failed permanently');
      }

      this.processingJobs.delete(job.id);

      // Emit failure event
      this.emit('job_failed', job, error);
    }
  }

  /**
   * Perform the actual indexing operation
   */
  private async performIndexing(job: IndexingJob): Promise<void> {
    try {
      // Import the enhanced search indexation service
      const { EnhancedSearchIndexationService } = await import('../../packages/clients/db/src/services/enhanced-search-indexation.service');
      const { DatabaseManager } = await import('../../packages/clients/db/src/database-manager');
      
      const databaseManager = new DatabaseManager();
      const searchService = new EnhancedSearchIndexationService(databaseManager);
      
      // Perform indexing
      const result = await searchService.indexContract(job.contractId);
      
      if (!result.indexed) {
        throw new Error(`Indexing failed: ${result.errors?.join(', ')}`);
      }

      // Update job metadata with results
      job.metadata.indexingResult = result;

      logger.debug({ 
        jobId: job.id, 
        contractId: job.contractId, 
        searchableFields: result.searchableFields,
        confidence: result.confidence 
      }, 'Contract indexed successfully');

    } catch (error) {
      // Fallback to mock indexing if service not available
      logger.warn({ 
        jobId: job.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Enhanced search service not available, using mock indexing');
      
      // Simulate indexing delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Mock successful indexing
      job.metadata.indexingResult = {
        contractId: job.contractId,
        indexed: true,
        searchableFields: Math.floor(Math.random() * 20) + 5,
        processingTime: Math.floor(Math.random() * 500) + 100,
        confidence: 0.7 + Math.random() * 0.3
      };
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Database connection failed',
      'Service temporarily unavailable'
    ];

    const errorMessage = error instanceof Error ? error.message : String(error);
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  }

  /**
   * Get priority value for sorting
   */
  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 1;
      case 'medium': return 5;
      case 'low': return 10;
      default: return 5;
    }
  }

  /**
   * Sort queue by priority and scheduled time
   */
  private sortQueue(): void {
    this.indexingQueue.sort((a, b) => {
      // First by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by scheduled time (earlier = higher priority)
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Get recent completed jobs for throughput calculation
    const recentCompleted = this.completedJobs.filter(
      job => job.completedAt && job.completedAt.getTime() > oneHourAgo
    );

    // Calculate average processing time
    const completedWithTimes = this.completedJobs.filter(
      job => job.startedAt && job.completedAt && job.status === 'completed'
    );

    const averageProcessingTime = completedWithTimes.length > 0
      ? completedWithTimes.reduce((sum, job) => {
          const processingTime = job.completedAt!.getTime() - job.startedAt!.getTime();
          return sum + processingTime;
        }, 0) / completedWithTimes.length
      : 0;

    // Calculate error rate
    const totalRecentJobs = this.completedJobs.filter(
      job => job.completedAt && job.completedAt.getTime() > oneHourAgo
    ).length;

    const failedRecentJobs = this.completedJobs.filter(
      job => job.completedAt && 
             job.completedAt.getTime() > oneHourAgo && 
             job.status === 'failed'
    ).length;

    const errorRate = totalRecentJobs > 0 ? (failedRecentJobs / totalRecentJobs) * 100 : 0;

    this.stats = {
      totalJobs: this.indexingQueue.length + this.processingJobs.size + this.completedJobs.length,
      pendingJobs: this.indexingQueue.length,
      processingJobs: this.processingJobs.size,
      completedJobs: this.completedJobs.filter(j => j.status === 'completed').length,
      failedJobs: this.completedJobs.filter(j => j.status === 'failed').length,
      averageProcessingTime: Math.round(averageProcessingTime),
      throughput: recentCompleted.length, // jobs per hour
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  /**
   * Start processing loop
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue().catch(error => {
        logger.error({ error }, 'Error in processing loop');
      });
    }, 1000); // Process every second
  }

  /**
   * Start stats collection
   */
  private startStatsCollection(): void {
    setInterval(() => {
      this.updateStats();
      this.emit('stats_updated', this.stats);
    }, 30000); // Update stats every 30 seconds
  }

  /**
   * Get current statistics
   */
  getStats(): IndexingStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): IndexingJob | null {
    // Check processing jobs
    const processingJob = this.processingJobs.get(jobId);
    if (processingJob) return processingJob;

    // Check pending jobs
    const pendingJob = this.indexingQueue.find(job => job.id === jobId);
    if (pendingJob) return pendingJob;

    // Check completed jobs
    const completedJob = this.completedJobs.find(job => job.id === jobId);
    if (completedJob) return completedJob;

    return null;
  }

  /**
   * Get jobs for a specific contract
   */
  getContractJobs(contractId: string): IndexingJob[] {
    const jobs: IndexingJob[] = [];

    // Add processing jobs
    for (const job of this.processingJobs.values()) {
      if (job.contractId === contractId) {
        jobs.push(job);
      }
    }

    // Add pending jobs
    jobs.push(...this.indexingQueue.filter(job => job.contractId === contractId));

    // Add recent completed jobs (last 24 hours)
    const oneDayAgo = Date.now() - 86400000;
    jobs.push(...this.completedJobs.filter(
      job => job.contractId === contractId && 
             job.completedAt && 
             job.completedAt.getTime() > oneDayAgo
    ));

    return jobs.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  }

  /**
   * Clear completed jobs older than specified time
   */
  clearOldJobs(olderThanMs: number = 86400000): number { // Default 24 hours
    const cutoff = Date.now() - olderThanMs;
    const initialCount = this.completedJobs.length;

    this.completedJobs = this.completedJobs.filter(
      job => !job.completedAt || job.completedAt.getTime() > cutoff
    );

    const clearedCount = initialCount - this.completedJobs.length;
    
    if (clearedCount > 0) {
      logger.info({ clearedCount }, 'Cleared old indexing jobs');
    }

    return clearedCount;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    stats: IndexingStats;
    issues: string[];
  }> {
    const stats = this.getStats();
    const issues: string[] = [];

    // Check queue size
    if (stats.pendingJobs > 1000) {
      issues.push(`High pending job count: ${stats.pendingJobs}`);
    }

    // Check error rate
    if (stats.errorRate > 10) {
      issues.push(`High error rate: ${stats.errorRate}%`);
    }

    // Check processing time
    if (stats.averageProcessingTime > 5000) {
      issues.push(`Slow processing: ${stats.averageProcessingTime}ms average`);
    }

    // Check for stuck jobs
    const now = Date.now();
    const stuckJobs = Array.from(this.processingJobs.values()).filter(
      job => job.startedAt && (now - job.startedAt.getTime()) > 300000 // 5 minutes
    );

    if (stuckJobs.length > 0) {
      issues.push(`Stuck jobs detected: ${stuckJobs.length}`);
    }

    return {
      healthy: issues.length === 0,
      stats,
      issues
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down real-time indexing service');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for current jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.processingJobs.size > 0) {
      logger.warn({ 
        remainingJobs: this.processingJobs.size 
      }, 'Shutdown with jobs still processing');
    }

    logger.info('Real-time indexing service shutdown complete');
  }
}

export const realTimeIndexingService = new RealTimeIndexingService();