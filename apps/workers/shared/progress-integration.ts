/**
 * Progress Integration for Workers
 * Provides utilities for workers to update progress tracking
 */

import { ProcessingStage } from '../../api/src/services/progress-tracking.service';

export interface WorkerProgressUpdate {
  contractId: string;
  tenantId: string;
  stage: ProcessingStage;
  progress: number; // 0-100 for this stage
  message?: string;
  metadata?: Record<string, any>;
}

export interface WorkerProgressError {
  contractId: string;
  tenantId: string;
  stage: ProcessingStage;
  error: string;
  recoverable?: boolean;
  retryCount?: number;
}

/**
 * Progress reporter for workers
 */
export class WorkerProgressReporter {
  private apiUrl: string;
  private contractId: string;
  private tenantId: string;
  private currentStage: ProcessingStage;

  constructor(contractId: string, tenantId: string, apiUrl: string = 'http://localhost:3001') {
    this.contractId = contractId;
    this.tenantId = tenantId;
    this.apiUrl = apiUrl;
    this.currentStage = ProcessingStage.UPLOAD_VALIDATION;
  }

  /**
   * Update progress for current stage
   */
  async updateProgress(
    stage: ProcessingStage,
    progress: number,
    message?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.currentStage = stage;
    
    try {
      await this.sendProgressUpdate({
        contractId: this.contractId,
        tenantId: this.tenantId,
        stage,
        progress,
        message,
        metadata
      });
    } catch (error) {
      console.warn('Failed to update progress:', error);
      // Don't throw - progress updates are non-critical
    }
  }

  /**
   * Mark stage as started
   */
  async startStage(stage: ProcessingStage, message?: string): Promise<void> {
    await this.updateProgress(stage, 0, message || `Starting ${stage}...`);
  }

  /**
   * Mark stage as completed
   */
  async completeStage(stage: ProcessingStage, message?: string): Promise<void> {
    await this.updateProgress(stage, 100, message || `Completed ${stage}`);
    
    try {
      await this.sendStageCompletion(stage, message);
    } catch (error) {
      console.warn('Failed to mark stage as completed:', error);
    }
  }

  /**
   * Report an error
   */
  async reportError(
    stage: ProcessingStage,
    error: string,
    recoverable: boolean = true,
    retryCount: number = 0
  ): Promise<void> {
    try {
      await this.sendProgressError({
        contractId: this.contractId,
        tenantId: this.tenantId,
        stage,
        error,
        recoverable,
        retryCount
      });
    } catch (err) {
      console.warn('Failed to report error:', err);
    }
  }

  /**
   * Send progress update to API
   */
  private async sendProgressUpdate(update: WorkerProgressUpdate): Promise<void> {
    const response = await fetch(`${this.apiUrl}/internal/progress/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId
      },
      body: JSON.stringify(update)
    });

    if (!response.ok) {
      throw new Error(`Progress update failed: ${response.status}`);
    }
  }

  /**
   * Send stage completion to API
   */
  private async sendStageCompletion(stage: ProcessingStage, message?: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/internal/progress/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId
      },
      body: JSON.stringify({
        contractId: this.contractId,
        tenantId: this.tenantId,
        stage,
        message
      })
    });

    if (!response.ok) {
      throw new Error(`Stage completion failed: ${response.status}`);
    }
  }

  /**
   * Send error report to API
   */
  private async sendProgressError(error: WorkerProgressError): Promise<void> {
    const response = await fetch(`${this.apiUrl}/internal/progress/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId
      },
      body: JSON.stringify(error)
    });

    if (!response.ok) {
      throw new Error(`Error report failed: ${response.status}`);
    }
  }
}

/**
 * Create a progress reporter for a worker
 */
export function createProgressReporter(
  contractId: string, 
  tenantId: string, 
  apiUrl?: string
): WorkerProgressReporter {
  return new WorkerProgressReporter(contractId, tenantId, apiUrl);
}

/**
 * Progress tracking decorator for worker functions
 */
export function withProgressTracking<T extends any[], R>(
  stage: ProcessingStage,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    // Extract contractId and tenantId from args (assuming they're in job data)
    const job = args[0] as any;
    const { docId: contractId, tenantId } = job?.data || {};
    
    if (!contractId || !tenantId) {
      // If we can't track progress, just run the function
      return fn(...args);
    }

    const reporter = createProgressReporter(contractId, tenantId);
    
    try {
      await reporter.startStage(stage);
      const result = await fn(...args);
      await reporter.completeStage(stage);
      return result;
    } catch (error) {
      await reporter.reportError(
        stage,
        error instanceof Error ? error.message : String(error),
        true // Assume recoverable by default
      );
      throw error;
    }
  };
}

/**
 * Stage mapping for different worker types
 */
export const WORKER_STAGE_MAPPING = {
  ingestion: ProcessingStage.FILE_EXTRACTION,
  template: ProcessingStage.TEMPLATE_ANALYSIS,
  financial: ProcessingStage.FINANCIAL_ANALYSIS,
  'enhanced-overview': ProcessingStage.ENHANCED_OVERVIEW,
  overview: ProcessingStage.ENHANCED_OVERVIEW,
  clauses: ProcessingStage.CLAUSES_ANALYSIS,
  rates: ProcessingStage.RATES_ANALYSIS,
  risk: ProcessingStage.RISK_ASSESSMENT,
  compliance: ProcessingStage.COMPLIANCE_CHECK,
  benchmark: ProcessingStage.BENCHMARK_ANALYSIS
} as const;