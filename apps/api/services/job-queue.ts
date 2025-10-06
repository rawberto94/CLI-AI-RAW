/**
 * Job Queue System for Contract Processing
 * Manages processing jobs with priority, retry logic, and worker coordination
 */

import { EventEmitter } from 'events';
import { processingStateManager, ProcessingState } from './processing-state';

export interface JobDefinition {
  id: string;
  contractId: string;
  tenantId: string;
  type: 'contract_processing';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  data: {
    filePath: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    uploadedBy?: string;
    clientId?: string;
    supplierId?: string;
  };
  createdAt: Date;
  scheduledFor?: Date;
  maxRetries: number;
  retryCount: number;
  timeout: number; // milliseconds
}

export interface WorkerInfo {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentJob?: string;
  lastHeartbeat: Date;
  processedJobs: number;
  errorCount: number;
}

export class JobQueue extends EventEmitter {
  private jobs = new Map<string, JobDefinition>();
  private workers = new Map<string, WorkerInfo>();
  private processingJobs = new Map<string, string>(); // jobId -> workerId
  private jobsByPriority = {
    urgent: [] as string[],
    high: [] as string[],
    normal: [] as string[],
    low: [] as string[]
  };

  private maxConcurrentJobs = 5;
  private heartbeatInterval = 30000; // 30 seconds
  private jobTimeout = 300000; // 5 minutes default

  constructor() {
    super();
    this.startHeartbeatMonitoring();
    this.startJobTimeoutMonitoring();
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobDef: Omit<JobDefinition, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: JobDefinition = {
      ...jobDef,
      id: jobId,
      createdAt: new Date(),
      retryCount: 0
    };

    this.jobs.set(jobId, job);
    this.jobsByPriority[job.priority].push(jobId);

    // Create initial processing state
    const processingState: ProcessingState = {
      jobId,
      contractId: job.contractId,
      tenantId: job.tenantId,
      status: 'queued',
      currentStage: 'text_extraction',
      completedStages: [],
      stageResults: {},
      metadata: {
        filename: job.data.filename,
        fileSize: job.data.fileSize,
        uploadedBy: job.data.uploadedBy,
        startTime: new Date(),
        lastUpdateTime: new Date()
      }
    };

    await processingStateManager.saveState(processingState);

    this.emit('job:added', job);
    
    // Try to assign to a worker immediately
    this.assignJobsToWorkers();

    return jobId;
  }

  /**
   * Register a worker
   */
  registerWorker(workerId: string, type: string): void {
    const worker: WorkerInfo = {
      id: workerId,
      type,
      status: 'idle',
      lastHeartbeat: new Date(),
      processedJobs: 0,
      errorCount: 0
    };

    this.workers.set(workerId, worker);
    this.emit('worker:registered', worker);

    // Try to assign jobs to the new worker
    this.assignJobsToWorkers();
  }

  /**
   * Update worker heartbeat
   */
  updateWorkerHeartbeat(workerId: string, status?: WorkerInfo['status']): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.lastHeartbeat = new Date();
      if (status) {
        worker.status = status;
      }
      this.emit('worker:heartbeat', worker);
    }
  }

  /**
   * Get next job for a worker
   */
  getNextJob(workerId: string): JobDefinition | null {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status !== 'idle') {
      return null;
    }

    // Find highest priority job
    for (const priority of ['urgent', 'high', 'normal', 'low'] as const) {
      const jobIds = this.jobsByPriority[priority];
      if (jobIds.length > 0) {
        const jobId = jobIds.shift()!;
        const job = this.jobs.get(jobId);
        
        if (job && (!job.scheduledFor || job.scheduledFor <= new Date())) {
          // Assign job to worker
          this.processingJobs.set(jobId, workerId);
          worker.status = 'busy';
          worker.currentJob = jobId;
          
          this.emit('job:assigned', job, worker);
          return job;
        }
      }
    }

    return null;
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string, workerId: string, result?: any): Promise<void> {
    const job = this.jobs.get(jobId);
    const worker = this.workers.get(workerId);

    if (!job || !worker) {
      throw new Error(`Job ${jobId} or worker ${workerId} not found`);
    }

    // Update processing state
    await processingStateManager.updateJobStatus(jobId, 'completed');

    // Clean up
    this.jobs.delete(jobId);
    this.processingJobs.delete(jobId);
    
    worker.status = 'idle';
    worker.currentJob = undefined;
    worker.processedJobs++;

    this.emit('job:completed', job, worker, result);

    // Try to assign more jobs
    this.assignJobsToWorkers();
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, workerId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    const worker = this.workers.get(workerId);

    if (!job || !worker) {
      throw new Error(`Job ${jobId} or worker ${workerId} not found`);
    }

    job.retryCount++;

    // Check if we should retry
    if (job.retryCount < job.maxRetries) {
      // Retry with exponential backoff
      const delay = Math.pow(2, job.retryCount) * 1000; // 2^n seconds
      job.scheduledFor = new Date(Date.now() + delay);
      
      // Add back to queue
      this.jobsByPriority[job.priority].push(jobId);
      
      await processingStateManager.updateJobStatus(jobId, 'queued', error);
      this.emit('job:retry', job, worker, error);
    } else {
      // Max retries reached, mark as failed
      await processingStateManager.updateJobStatus(jobId, 'failed', error);
      
      this.jobs.delete(jobId);
      this.emit('job:failed', job, worker, error);
    }

    // Clean up worker
    this.processingJobs.delete(jobId);
    worker.status = 'idle';
    worker.currentJob = undefined;
    worker.errorCount++;

    // Try to assign more jobs
    this.assignJobsToWorkers();
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): { job?: JobDefinition; worker?: WorkerInfo; state?: ProcessingState } {
    const job = this.jobs.get(jobId);
    const workerId = this.processingJobs.get(jobId);
    const worker = workerId ? this.workers.get(workerId) : undefined;
    
    return { job, worker };
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalJobs: number;
    jobsByPriority: Record<string, number>;
    activeWorkers: number;
    processingJobs: number;
    averageWaitTime: number;
  } {
    const totalJobs = this.jobs.size;
    const jobsByPriority = {
      urgent: this.jobsByPriority.urgent.length,
      high: this.jobsByPriority.high.length,
      normal: this.jobsByPriority.normal.length,
      low: this.jobsByPriority.low.length
    };
    
    const activeWorkers = Array.from(this.workers.values())
      .filter(w => w.status !== 'offline').length;
    
    const processingJobs = this.processingJobs.size;

    // Calculate average wait time (simplified)
    const now = new Date();
    let totalWaitTime = 0;
    let waitingJobs = 0;

    for (const job of this.jobs.values()) {
      if (!this.processingJobs.has(job.id)) {
        totalWaitTime += now.getTime() - job.createdAt.getTime();
        waitingJobs++;
      }
    }

    const averageWaitTime = waitingJobs > 0 ? totalWaitTime / waitingJobs : 0;

    return {
      totalJobs,
      jobsByPriority,
      activeWorkers,
      processingJobs,
      averageWaitTime
    };
  }

  /**
   * Get jobs by tenant
   */
  getJobsByTenant(tenantId: string): JobDefinition[] {
    return Array.from(this.jobs.values())
      .filter(job => job.tenantId === tenantId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // If job is being processed, notify worker
    const workerId = this.processingJobs.get(jobId);
    if (workerId) {
      const worker = this.workers.get(workerId);
      if (worker) {
        worker.status = 'idle';
        worker.currentJob = undefined;
        this.emit('job:cancelled', job, worker);
      }
      this.processingJobs.delete(jobId);
    }

    // Remove from priority queues
    for (const priority of ['urgent', 'high', 'normal', 'low'] as const) {
      const index = this.jobsByPriority[priority].indexOf(jobId);
      if (index > -1) {
        this.jobsByPriority[priority].splice(index, 1);
      }
    }

    // Update processing state
    await processingStateManager.updateJobStatus(jobId, 'failed', 'Cancelled by user');

    this.jobs.delete(jobId);
    this.emit('job:cancelled', job);

    return true;
  }

  /**
   * Assign jobs to available workers
   */
  private assignJobsToWorkers(): void {
    const idleWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'idle');

    for (const worker of idleWorkers) {
      const job = this.getNextJob(worker.id);
      if (!job) {
        break; // No more jobs available
      }
    }
  }

  /**
   * Monitor worker heartbeats
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - this.heartbeatInterval * 2);

      for (const [workerId, worker] of this.workers.entries()) {
        if (worker.lastHeartbeat < staleThreshold && worker.status !== 'offline') {
          worker.status = 'offline';
          
          // If worker had a job, requeue it
          if (worker.currentJob) {
            const jobId = worker.currentJob;
            const job = this.jobs.get(jobId);
            
            if (job) {
              this.jobsByPriority[job.priority].unshift(jobId); // Add to front
              this.processingJobs.delete(jobId);
              worker.currentJob = undefined;
              
              this.emit('worker:offline', worker, job);
            }
          }
          
          this.emit('worker:stale', worker);
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * Monitor job timeouts
   */
  private startJobTimeoutMonitoring(): void {
    setInterval(() => {
      const now = new Date();

      for (const [jobId, workerId] of this.processingJobs.entries()) {
        const job = this.jobs.get(jobId);
        const worker = this.workers.get(workerId);

        if (job && worker) {
          const jobAge = now.getTime() - job.createdAt.getTime();
          const timeout = job.timeout || this.jobTimeout;

          if (jobAge > timeout) {
            // Job has timed out
            this.failJob(jobId, workerId, 'Job timeout exceeded');
            this.emit('job:timeout', job, worker);
          }
        }
      }
    }, 60000); // Check every minute
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();