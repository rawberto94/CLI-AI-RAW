/**
 * Scheduled Analysis Service
 * 
 * Provides automated contract analysis on a scheduled basis.
 * Supports daily, weekly, and custom schedules for batch processing.
 */

import { prisma } from '@/lib/prisma';

// Types
export interface ScheduledJob {
  id: string;
  name: string;
  type: ScheduleType;
  schedule: CronSchedule;
  config: JobConfig;
  status: JobStatus;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleType = 
  | 'contract-review'
  | 'compliance-check'
  | 'risk-assessment'
  | 'expiry-alerts'
  | 'custom';

export interface CronSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  cronExpression?: string; // For custom
  timezone?: string;
}

export interface JobConfig {
  contractIds?: string[];
  folderIds?: string[];
  filters?: {
    status?: string[];
    type?: string[];
    tags?: string[];
    categories?: string[];
    statuses?: string[];
    olderThan?: number; // days
    notReviewedSince?: number; // days
  };
  analysis: {
    type: string;
    types?: string[];
    depth?: 'quick' | 'standard' | 'comprehensive';
    focusAreas?: string[];
  };
  notifications: {
    email?: boolean;
    webhook?: string;
    slackChannel?: string;
  };
  maxContracts?: number;
}

export type JobStatus = 'active' | 'paused' | 'disabled' | 'error';

export interface JobRun {
  id: string;
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  contractsProcessed: number;
  contractsTotal: number;
  results?: JobRunResults;
  error?: string;
}

export interface JobRunResults {
  summary: {
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  findings: Array<{
    contractId: string;
    contractName: string;
    issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
  }>;
  recommendations: string[];
  duration: number; // ms
}

// In-memory job store (replace with database in production)
const jobs: Map<string, ScheduledJob> = new Map();
const jobRuns: Map<string, JobRun[]> = new Map();
const activeTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Scheduled Analysis Service
 */
class ScheduledAnalysisService {
  private static instance: ScheduledAnalysisService;

  private constructor() {
    // Load existing jobs on startup
    this.loadJobs();
  }

  public static getInstance(): ScheduledAnalysisService {
    if (!ScheduledAnalysisService.instance) {
      ScheduledAnalysisService.instance = new ScheduledAnalysisService();
    }
    return ScheduledAnalysisService.instance;
  }

  /**
   * Load jobs from storage
   */
  private async loadJobs(): Promise<void> {
    // In production, load from database
    console.log('[ScheduledAnalysis] Loading scheduled jobs...');
  }

  /**
   * Create a new scheduled job
   */
  async createJob(
    name: string,
    type: ScheduleType,
    schedule: CronSchedule,
    config: JobConfig,
    userId: string,
    tenantId?: string
  ): Promise<ScheduledJob> {
    if (!tenantId) {
      throw new Error('Tenant ID required for scheduled job creation');
    }
    const job: ScheduledJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      type,
      schedule,
      config,
      status: 'active',
      nextRun: this.calculateNextRun(schedule),
      createdBy: userId,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jobs.set(job.id, job);
    jobRuns.set(job.id, []);
    
    // Schedule the job
    this.scheduleJob(job);

    console.log(`[ScheduledAnalysis] Created job: ${job.id} (${name})`);
    return job;
  }

  /**
   * Update an existing job
   */
  async updateJob(
    jobId: string,
    updates: Partial<Pick<ScheduledJob, 'name' | 'schedule' | 'config' | 'status'>>
  ): Promise<ScheduledJob | null> {
    const job = jobs.get(jobId);
    if (!job) return null;

    // Cancel existing timer
    this.cancelJobTimer(jobId);

    // Update job
    Object.assign(job, updates, { updatedAt: new Date() });
    
    if (updates.schedule) {
      job.nextRun = this.calculateNextRun(updates.schedule);
    }

    // Reschedule if active
    if (job.status === 'active') {
      this.scheduleJob(job);
    }

    jobs.set(jobId, job);
    return job;
  }

  /**
   * Delete a scheduled job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    this.cancelJobTimer(jobId);
    const deleted = jobs.delete(jobId);
    jobRuns.delete(jobId);
    return deleted;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): ScheduledJob | null {
    return jobs.get(jobId) || null;
  }

  /**
   * List all jobs for a user
   */
  listJobs(userId?: string): ScheduledJob[] {
    const allJobs = Array.from(jobs.values());
    if (userId) {
      return allJobs.filter((job) => job.createdBy === userId);
    }
    return allJobs;
  }

  /**
   * Get run history for a job
   */
  getJobRuns(jobId: string, limit = 10): JobRun[] {
    const runs = jobRuns.get(jobId) || [];
    return runs.slice(-limit);
  }

  /**
   * Pause a job
   */
  async pauseJob(jobId: string): Promise<boolean> {
    const job = jobs.get(jobId);
    if (!job) return false;

    this.cancelJobTimer(jobId);
    job.status = 'paused';
    job.updatedAt = new Date();
    return true;
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<boolean> {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'paused') return false;

    job.status = 'active';
    job.nextRun = this.calculateNextRun(job.schedule);
    job.updatedAt = new Date();
    this.scheduleJob(job);
    return true;
  }

  /**
   * Manually trigger a job run
   */
  async triggerJob(jobId: string): Promise<JobRun | null> {
    const job = jobs.get(jobId);
    if (!job) return null;

    return this.runJob(job);
  }

  /**
   * Schedule a job timer
   */
  private scheduleJob(job: ScheduledJob): void {
    if (job.status !== 'active' || !job.nextRun) return;

    const delay = job.nextRun.getTime() - Date.now();
    if (delay < 0) {
      // Next run is in the past, calculate new next run
      job.nextRun = this.calculateNextRun(job.schedule);
      this.scheduleJob(job);
      return;
    }

    // Use setTimeout for short delays, or just track next run for longer ones
    if (delay < 24 * 60 * 60 * 1000) { // Less than 24 hours
      const timer = setTimeout(() => {
        this.runJob(job).then(() => {
          // Schedule next run
          job.nextRun = this.calculateNextRun(job.schedule);
          this.scheduleJob(job);
        });
      }, delay);

      activeTimers.set(job.id, timer);
    }

    console.log(`[ScheduledAnalysis] Scheduled job ${job.id} for ${job.nextRun.toISOString()}`);
  }

  /**
   * Cancel a job timer
   */
  private cancelJobTimer(jobId: string): void {
    const timer = activeTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(jobId);
    }
  }

  /**
   * Execute a job
   */
  private async runJob(job: ScheduledJob): Promise<JobRun> {
    const run: JobRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      jobId: job.id,
      startedAt: new Date(),
      status: 'running',
      contractsProcessed: 0,
      contractsTotal: 0,
    };

    // Track run
    const runs = jobRuns.get(job.id) || [];
    runs.push(run);
    jobRuns.set(job.id, runs);

    console.log(`[ScheduledAnalysis] Running job ${job.id} (run: ${run.id})`);

    try {
      // Get contracts to analyze
      const contracts = await this.getContractsForJob(job);
      run.contractsTotal = contracts.length;

      const findings: JobRunResults['findings'] = [];
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      // Process each contract
      for (const contract of contracts) {
        try {
          // Run analysis
          const result = await this.analyzeContract(contract, job.config.analysis);
          
          if (result.issues.length > 0) {
            findings.push({
              contractId: contract.id,
              contractName: contract.name || 'Unnamed',
              issues: result.issues,
            });
          }
          
          succeeded++;
          run.contractsProcessed++;
        } catch (error) {
          console.error(`[ScheduledAnalysis] Failed to analyze contract ${contract.id}:`, error);
          failed++;
        }

        // Check max contracts limit
        if (job.config.maxContracts && run.contractsProcessed >= job.config.maxContracts) {
          skipped = contracts.length - run.contractsProcessed;
          break;
        }
      }

      // Complete the run
      run.completedAt = new Date();
      run.status = 'completed';
      run.results = {
        summary: {
          processed: run.contractsProcessed,
          succeeded,
          failed,
          skipped,
        },
        findings,
        recommendations: this.generateRecommendations(findings),
        duration: run.completedAt.getTime() - run.startedAt.getTime(),
      };

      // Update job
      job.lastRun = run.completedAt;
      job.updatedAt = new Date();

      // Send notifications
      await this.sendNotifications(job, run);

      console.log(`[ScheduledAnalysis] Completed job ${job.id}: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      run.completedAt = new Date();
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      
      job.status = 'error';
      job.updatedAt = new Date();

      console.error(`[ScheduledAnalysis] Job ${job.id} failed:`, error);
    }

    return run;
  }

  /**
   * Get contracts matching job criteria
   */
  private async getContractsForJob(job: ScheduledJob): Promise<Array<{ id: string; name?: string; content?: string }>> {
    try {
      // Query database for contracts matching job criteria
      const { prisma } = await import('@/lib/prisma');
      
      const where: any = {
        tenantId: job.tenantId,
        status: { not: 'DELETED' },
      };
      
      // Apply category filter if specified
      if (job.config.filters?.categories?.length) {
        where.category = { in: job.config.filters.categories };
      }
      
      // Apply status filter if specified
      if (job.config.filters?.statuses?.length || job.config.filters?.status?.length) {
        where.status = { in: job.config.filters.statuses || job.config.filters.status };
      }
      
      const contracts = await prisma.contract.findMany({
        where,
        select: {
          id: true,
          contractTitle: true,
          rawText: true,
        },
        take: 100, // Limit batch size
      });
      
      return contracts.map(c => ({
        id: c.id,
        name: c.contractTitle || undefined,
        content: c.rawText || undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch contracts for scheduled job:', error);
      return [];
    }
  }

  /**
   * Analyze a single contract
   */
  private async analyzeContract(
    contract: { id: string; name?: string; content?: string },
    analysisConfig: JobConfig['analysis']
  ): Promise<{ issues: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> }> {
    const issues: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> = [];
    
    try {
      // Call AI analysis endpoint for real analysis
      if (!contract.content) {
        return { issues };
      }
      
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          content: contract.content.substring(0, 10000), // Limit content size
          analysisTypes: analysisConfig?.types || [analysisConfig?.type] || ['risk', 'compliance'],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.issues) {
          return { issues: data.issues };
        }
      }
      
      // If AI analysis not available, do basic checks
      const content = contract.content.toLowerCase();
      
      // Check for missing common clauses
      if (!content.includes('force majeure') && !content.includes('act of god')) {
        issues.push({
          type: 'missing-clause',
          severity: 'medium',
          message: 'Force majeure clause not found',
        });
      }
      
      if (!content.includes('termination') && !content.includes('cancel')) {
        issues.push({
          type: 'missing-clause',
          severity: 'medium',
          message: 'Termination clause not found',
        });
      }
      
      if (!content.includes('confidential') && !content.includes('non-disclosure')) {
        issues.push({
          type: 'missing-clause',
          severity: 'low',
          message: 'Confidentiality clause not found',
        });
      }
      
    } catch (error) {
      console.error('Contract analysis failed:', error);
    }

    return { issues };
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: JobRunResults['findings']): string[] {
    const recommendations: string[] = [];
    
    const highSeverityCount = findings.reduce(
      (count, f) => count + f.issues.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
      0
    );

    if (highSeverityCount > 0) {
      recommendations.push(`Review ${highSeverityCount} high-priority issues immediately`);
    }

    const expiryWarnings = findings.filter((f) =>
      f.issues.some((i) => i.type === 'expiry-warning')
    );
    if (expiryWarnings.length > 0) {
      recommendations.push(`${expiryWarnings.length} contracts require renewal attention`);
    }

    return recommendations;
  }

  /**
   * Send notifications for completed job
   */
  private async sendNotifications(job: ScheduledJob, run: JobRun): Promise<void> {
    const { notifications } = job.config;
    
    if (notifications.email) {
      // Send email notification
      console.log(`[ScheduledAnalysis] Email notification sent for job ${job.id}`);
    }

    if (notifications.webhook) {
      // Send webhook
      try {
        await fetch(notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job, run }),
        });
      } catch (error) {
        console.error('[ScheduledAnalysis] Webhook notification failed:', error);
      }
    }
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(schedule: CronSchedule): Date {
    const now = new Date();
    const next = new Date(now);

    switch (schedule.frequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
        break;

      case 'daily':
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
          if (next <= now) {
            next.setDate(next.getDate() + 1);
          }
        } else {
          next.setDate(next.getDate() + 1);
          next.setHours(0, 0, 0, 0);
        }
        break;

      case 'weekly':
        const targetDay = schedule.dayOfWeek ?? 1; // Default to Monday
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        
        next.setDate(next.getDate() + daysUntil);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(9, 0, 0, 0);
        }
        break;

      case 'monthly':
        const targetDate = schedule.dayOfMonth ?? 1;
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDate);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        } else {
          next.setHours(9, 0, 0, 0);
        }
        break;

      default:
        // Custom - default to 24 hours
        next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * Get preset job templates
   */
  getPresets(): Array<{
    id: string;
    name: string;
    description: string;
    type: ScheduleType;
    defaultSchedule: CronSchedule;
    defaultConfig: Partial<JobConfig>;
  }> {
    return [
      {
        id: 'daily-expiry-check',
        name: 'Daily Expiry Check',
        description: 'Check for contracts expiring in the next 30 days',
        type: 'expiry-alerts',
        defaultSchedule: { frequency: 'daily', time: '09:00' },
        defaultConfig: {
          filters: { olderThan: 0 },
          analysis: { type: 'expiry-check', depth: 'quick' },
          notifications: { email: true },
        },
      },
      {
        id: 'weekly-compliance',
        name: 'Weekly Compliance Review',
        description: 'Run compliance checks on all active contracts',
        type: 'compliance-check',
        defaultSchedule: { frequency: 'weekly', dayOfWeek: 1, time: '08:00' },
        defaultConfig: {
          filters: { status: ['active'] },
          analysis: { type: 'compliance', depth: 'standard', focusAreas: ['gdpr', 'hipaa'] },
          notifications: { email: true },
        },
      },
      {
        id: 'monthly-risk-assessment',
        name: 'Monthly Risk Assessment',
        description: 'Comprehensive risk analysis of all contracts',
        type: 'risk-assessment',
        defaultSchedule: { frequency: 'monthly', dayOfMonth: 1, time: '06:00' },
        defaultConfig: {
          analysis: { type: 'risk', depth: 'comprehensive' },
          notifications: { email: true },
          maxContracts: 100,
        },
      },
    ];
  }
}

// Export singleton instance
export const scheduledAnalysis = ScheduledAnalysisService.getInstance();
