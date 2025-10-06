/**
 * Optimized Processing Pipeline
 * High-performance contract processing with parallel stages and smart scheduling
 */

import { EventEmitter } from 'events';
import { performanceMonitor } from '../performance/performance-monitor';
import { cacheService } from '../cache/redis-cache.service';

interface ProcessingJob {
  id: string;
  contractId: string;
  stages: ProcessingStage[];
  currentStage: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

interface ProcessingStage {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
  dependencies?: string[];
}

interface PipelineConfig {
  maxConcurrentJobs: number;
  maxStageRetries: number;
  stageTimeout: number;
  enableParallelStages: boolean;
}

export class OptimizedPipelineService extends EventEmitter {
  private jobQueue: ProcessingJob[] = [];
  private activeJobs = new Map<string, ProcessingJob>();
  private completedJobs = new Map<string, ProcessingJob>();
  
  private config: PipelineConfig = {
    maxConcurrentJobs: 10,
    maxStageRetries: 3,
    stageTimeout: 300000, // 5 minutes
    enableParallelStages: true,
  };

  constructor(config?: Partial<PipelineConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Start job processor
    this.startJobProcessor();
  }

  /**
   * Create and queue processing job
   */
  async createJob(contractId: string, priority: number = 5): Promise<string> {
    return performanceMonitor.measure('pipeline:create-job', async () => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const job: ProcessingJob = {
        id: jobId,
        contractId,
        stages: this.defineStages(),
        currentStage: 0,
        status: 'pending',
        priority,
      };

      // Add to queue (sorted by priority)
      this.jobQueue.push(job);
      this.jobQueue.sort((a, b) => b.priority - a.priority);

      this.emit('job:created', { jobId, contractId });

      return jobId;
    });
  }

  /**
   * Execute processing pipeline
   */
  async executeJob(jobId: string): Promise<void> {
    return performanceMonitor.measure('pipeline:execute', async () => {
      const job = this.activeJobs.get(jobId) || this.findJobInQueue(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      job.status = 'processing';
      job.startTime = Date.now();
      this.activeJobs.set(jobId, job);

      this.emit('job:started', { jobId, contractId: job.contractId });

      try {
        // Execute stages
        if (this.config.enableParallelStages) {
          await this.executeStagesParallel(job);
        } else {
          await this.executeStagesSequential(job);
        }

        job.status = 'completed';
        job.endTime = Date.now();

        // Cache result
        await this.cacheJobResult(job);

        this.emit('job:completed', {
          jobId,
          contractId: job.contractId,
          duration: job.endTime - (job.startTime || 0),
        });

        // Move to completed
        this.completedJobs.set(jobId, job);
        this.activeJobs.delete(jobId);

      } catch (error) {
        job.status = 'failed';
        job.endTime = Date.now();
        job.error = error instanceof Error ? error.message : 'Unknown error';

        this.emit('job:failed', {
          jobId,
          contractId: job.contractId,
          error: job.error,
        });

        this.activeJobs.delete(jobId);
        throw error;
      }
    });
  }

  /**
   * Execute stages in parallel (where possible)
   */
  private async executeStagesParallel(job: ProcessingJob): Promise<void> {
    const stageGroups = this.groupStagesByDependencies(job.stages);

    for (const group of stageGroups) {
      // Execute all stages in group in parallel
      await Promise.all(
        group.map(stage => this.executeStage(job, stage))
      );
    }
  }

  /**
   * Execute stages sequentially
   */
  private async executeStagesSequential(job: ProcessingJob): Promise<void> {
    for (const stage of job.stages) {
      await this.executeStage(job, stage);
    }
  }

  /**
   * Execute single stage with retry logic
   */
  private async executeStage(job: ProcessingJob, stage: ProcessingStage): Promise<void> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.config.maxStageRetries) {
      try {
        stage.status = 'processing';
        stage.startTime = Date.now();

        this.emit('stage:started', {
          jobId: job.id,
          stage: stage.name,
        });

        // Execute stage with timeout
        const result = await this.executeStageWithTimeout(job, stage);

        stage.status = 'completed';
        stage.endTime = Date.now();
        stage.result = result;

        this.emit('stage:completed', {
          jobId: job.id,
          stage: stage.name,
          duration: stage.endTime - (stage.startTime || 0),
        });

        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        retries++;

        this.emit('stage:retry', {
          jobId: job.id,
          stage: stage.name,
          attempt: retries,
          error: lastError.message,
        });

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }

    // All retries failed
    stage.status = 'failed';
    stage.endTime = Date.now();
    stage.error = lastError?.message || 'Unknown error';

    throw new Error(`Stage ${stage.name} failed after ${retries} retries: ${stage.error}`);
  }

  /**
   * Execute stage with timeout
   */
  private async executeStageWithTimeout(
    job: ProcessingJob,
    stage: ProcessingStage
  ): Promise<any> {
    return Promise.race([
      this.executeStageLogic(job, stage),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Stage timeout')),
          this.config.stageTimeout
        )
      ),
    ]);
  }

  /**
   * Execute stage logic
   */
  private async executeStageLogic(job: ProcessingJob, stage: ProcessingStage): Promise<any> {
    // Check cache first
    const cacheKey = `stage:${job.contractId}:${stage.name}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute stage based on name
    let result: any;

    switch (stage.name) {
      case 'text-extraction':
        result = await this.extractText(job.contractId);
        break;
      case 'entity-extraction':
        result = await this.extractEntities(job.contractId);
        break;
      case 'clause-analysis':
        result = await this.analyzeClauses(job.contractId);
        break;
      case 'risk-assessment':
        result = await this.assessRisk(job.contractId);
        break;
      case 'financial-analysis':
        result = await this.analyzeFinancials(job.contractId);
        break;
      case 'indexing':
        result = await this.indexContract(job.contractId);
        break;
      default:
        throw new Error(`Unknown stage: ${stage.name}`);
    }

    // Cache result
    await cacheService.set(cacheKey, result, { ttl: 3600 });

    return result;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    // Check active jobs
    const active = this.activeJobs.get(jobId);
    if (active) return active;

    // Check completed jobs
    const completed = this.completedJobs.get(jobId);
    if (completed) return completed;

    // Check queue
    return this.findJobInQueue(jobId);
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Remove from queue
    const queueIndex = this.jobQueue.findIndex(j => j.id === jobId);
    if (queueIndex >= 0) {
      this.jobQueue.splice(queueIndex, 1);
      this.emit('job:cancelled', { jobId });
      return true;
    }

    // Can't cancel active jobs (would need more complex logic)
    return false;
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      queueSize: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
      avgProcessingTime: this.calculateAvgProcessingTime(),
    };
  }

  /**
   * Private helper methods
   */
  private defineStages(): ProcessingStage[] {
    return [
      { name: 'text-extraction', status: 'pending' },
      { name: 'entity-extraction', status: 'pending', dependencies: ['text-extraction'] },
      { name: 'clause-analysis', status: 'pending', dependencies: ['text-extraction'] },
      { name: 'risk-assessment', status: 'pending', dependencies: ['clause-analysis'] },
      { name: 'financial-analysis', status: 'pending', dependencies: ['entity-extraction'] },
      { name: 'indexing', status: 'pending', dependencies: ['entity-extraction', 'clause-analysis'] },
    ];
  }

  private groupStagesByDependencies(stages: ProcessingStage[]): ProcessingStage[][] {
    const groups: ProcessingStage[][] = [];
    const completed = new Set<string>();

    while (completed.size < stages.length) {
      const group = stages.filter(stage => {
        if (completed.has(stage.name)) return false;
        if (!stage.dependencies) return true;
        return stage.dependencies.every(dep => completed.has(dep));
      });

      if (group.length === 0) break; // Circular dependency or error

      groups.push(group);
      group.forEach(stage => completed.add(stage.name));
    }

    return groups;
  }

  private findJobInQueue(jobId: string): ProcessingJob | null {
    return this.jobQueue.find(j => j.id === jobId) || null;
  }

  private async cacheJobResult(job: ProcessingJob): Promise<void> {
    await cacheService.set(`job:${job.id}`, job, { ttl: 3600 });
  }

  private calculateAvgProcessingTime(): number {
    const completed = Array.from(this.completedJobs.values());
    if (completed.length === 0) return 0;

    const total = completed.reduce((sum, job) => {
      return sum + ((job.endTime || 0) - (job.startTime || 0));
    }, 0);

    return total / completed.length;
  }

  private startJobProcessor(): void {
    setInterval(() => {
      // Process jobs from queue
      while (
        this.jobQueue.length > 0 &&
        this.activeJobs.size < this.config.maxConcurrentJobs
      ) {
        const job = this.jobQueue.shift()!;
        this.executeJob(job.id).catch(error => {
          // Error already handled in executeJob
        });
      }
    }, 1000);
  }

  // Stage execution methods (simplified)
  private async extractText(contractId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { text: 'Extracted text...', wordCount: 1000 };
  }

  private async extractEntities(contractId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return { entities: [], count: 0 };
  }

  private async analyzeClauses(contractId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { clauses: [], count: 0 };
  }

  private async assessRisk(contractId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { riskScore: 0.5, level: 'medium' };
  }

  private async analyzeFinancials(contractId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { totalValue: 0, currency: 'USD' };
  }

  private async indexContract(contractId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return { indexed: true };
  }
}

export const optimizedPipelineService = new OptimizedPipelineService();
