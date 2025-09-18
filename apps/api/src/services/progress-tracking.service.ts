/**
 * Progress Tracking Service
 * Provides real-time progress tracking for contract upload and processing
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { progressPersistenceService } from './progress-persistence.service';

const logger = pino({ name: 'progress-tracking' });

export interface ProgressUpdate {
  contractId: string;
  tenantId: string;
  stage: ProcessingStage;
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
  startedAt: Date;
  updatedAt: Date;
  completedStages: ProcessingStage[];
  errors?: ProcessingError[];
  metadata?: Record<string, any>;
}

export interface ProcessingError {
  stage: ProcessingStage;
  error: string;
  timestamp: Date;
  recoverable: boolean;
  retryCount?: number;
}

export enum ProcessingStage {
  UPLOAD_VALIDATION = 'upload_validation',
  FILE_EXTRACTION = 'file_extraction',
  CONTENT_ANALYSIS = 'content_analysis',
  TEMPLATE_ANALYSIS = 'template_analysis',
  FINANCIAL_ANALYSIS = 'financial_analysis',
  ENHANCED_OVERVIEW = 'enhanced_overview',
  CLAUSES_ANALYSIS = 'clauses_analysis',
  RATES_ANALYSIS = 'rates_analysis',
  RISK_ASSESSMENT = 'risk_assessment',
  COMPLIANCE_CHECK = 'compliance_check',
  BENCHMARK_ANALYSIS = 'benchmark_analysis',
  ARTIFACT_GENERATION = 'artifact_generation',
  INDEXATION = 'indexation',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface StageDefinition {
  stage: ProcessingStage;
  name: string;
  description: string;
  estimatedDuration: number; // seconds
  weight: number; // for progress calculation
  dependencies: ProcessingStage[];
}

export class ProgressTrackingService extends EventEmitter {
  private progressMap = new Map<string, ProgressUpdate>();
  private stageDefinitions: StageDefinition[] = [
    {
      stage: ProcessingStage.UPLOAD_VALIDATION,
      name: 'Upload Validation',
      description: 'Validating file type, size, and content integrity',
      estimatedDuration: 5,
      weight: 5,
      dependencies: []
    },
    {
      stage: ProcessingStage.FILE_EXTRACTION,
      name: 'File Extraction',
      description: 'Extracting text content from document',
      estimatedDuration: 15,
      weight: 10,
      dependencies: [ProcessingStage.UPLOAD_VALIDATION]
    },
    {
      stage: ProcessingStage.CONTENT_ANALYSIS,
      name: 'Content Analysis',
      description: 'Analyzing document structure and content',
      estimatedDuration: 10,
      weight: 8,
      dependencies: [ProcessingStage.FILE_EXTRACTION]
    },
    {
      stage: ProcessingStage.TEMPLATE_ANALYSIS,
      name: 'Template Analysis',
      description: 'Detecting contract templates and compliance',
      estimatedDuration: 20,
      weight: 12,
      dependencies: [ProcessingStage.CONTENT_ANALYSIS]
    },
    {
      stage: ProcessingStage.FINANCIAL_ANALYSIS,
      name: 'Financial Analysis',
      description: 'Extracting financial terms and rates',
      estimatedDuration: 25,
      weight: 15,
      dependencies: [ProcessingStage.CONTENT_ANALYSIS]
    },
    {
      stage: ProcessingStage.ENHANCED_OVERVIEW,
      name: 'Enhanced Overview',
      description: 'Generating strategic insights and best practices',
      estimatedDuration: 30,
      weight: 18,
      dependencies: [ProcessingStage.CONTENT_ANALYSIS]
    },
    {
      stage: ProcessingStage.CLAUSES_ANALYSIS,
      name: 'Clauses Analysis',
      description: 'Identifying and analyzing contract clauses',
      estimatedDuration: 20,
      weight: 12,
      dependencies: [ProcessingStage.CONTENT_ANALYSIS]
    },
    {
      stage: ProcessingStage.RATES_ANALYSIS,
      name: 'Rates Analysis',
      description: 'Extracting and analyzing rate structures',
      estimatedDuration: 15,
      weight: 10,
      dependencies: [ProcessingStage.FINANCIAL_ANALYSIS]
    },
    {
      stage: ProcessingStage.RISK_ASSESSMENT,
      name: 'Risk Assessment',
      description: 'Assessing contract risks and mitigation strategies',
      estimatedDuration: 25,
      weight: 15,
      dependencies: [ProcessingStage.CLAUSES_ANALYSIS, ProcessingStage.FINANCIAL_ANALYSIS]
    },
    {
      stage: ProcessingStage.COMPLIANCE_CHECK,
      name: 'Compliance Check',
      description: 'Checking regulatory compliance and requirements',
      estimatedDuration: 20,
      weight: 12,
      dependencies: [ProcessingStage.CLAUSES_ANALYSIS]
    },
    {
      stage: ProcessingStage.BENCHMARK_ANALYSIS,
      name: 'Benchmark Analysis',
      description: 'Comparing against industry benchmarks',
      estimatedDuration: 15,
      weight: 8,
      dependencies: [ProcessingStage.FINANCIAL_ANALYSIS, ProcessingStage.RISK_ASSESSMENT]
    },
    {
      stage: ProcessingStage.ARTIFACT_GENERATION,
      name: 'Artifact Generation',
      description: 'Creating searchable artifacts and metadata',
      estimatedDuration: 10,
      weight: 5,
      dependencies: [ProcessingStage.ENHANCED_OVERVIEW, ProcessingStage.FINANCIAL_ANALYSIS, ProcessingStage.TEMPLATE_ANALYSIS]
    },
    {
      stage: ProcessingStage.INDEXATION,
      name: 'Indexation',
      description: 'Indexing for search and cross-contract intelligence',
      estimatedDuration: 8,
      weight: 3,
      dependencies: [ProcessingStage.ARTIFACT_GENERATION]
    }
  ];

  constructor() {
    super();
    this.setMaxListeners(1000); // Allow many concurrent progress trackers
    
    // Load persisted progress on startup
    this.loadPersistedProgress();
  }

  /**
   * Initialize progress tracking for a contract
   */
  initializeProgress(contractId: string, tenantId: string): ProgressUpdate {
    const progress: ProgressUpdate = {
      contractId,
      tenantId,
      stage: ProcessingStage.UPLOAD_VALIDATION,
      progress: 0,
      message: 'Starting contract processing...',
      startedAt: new Date(),
      updatedAt: new Date(),
      completedStages: [],
      estimatedTimeRemaining: this.calculateTotalEstimatedTime()
    };

    this.progressMap.set(contractId, progress);
    
    logger.info({ contractId, tenantId }, 'Progress tracking initialized');
    
    // Emit initial progress
    this.emit('progress', progress);
    
    return progress;
  }

  /**
   * Update progress for a specific stage
   */
  updateProgress(
    contractId: string, 
    stage: ProcessingStage, 
    stageProgress: number, 
    message?: string,
    metadata?: Record<string, any>
  ): ProgressUpdate | null {
    const current = this.progressMap.get(contractId);
    if (!current) {
      logger.warn({ contractId, stage }, 'Progress update for unknown contract');
      return null;
    }

    // Calculate overall progress
    const overallProgress = this.calculateOverallProgress(current.completedStages, stage, stageProgress);
    
    // Calculate estimated time remaining
    const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(
      current.startedAt,
      overallProgress
    );

    const updated: ProgressUpdate = {
      ...current,
      stage,
      progress: overallProgress,
      message: message || this.getStageDescription(stage),
      estimatedTimeRemaining,
      updatedAt: new Date(),
      metadata: { ...current.metadata, ...metadata }
    };

    this.progressMap.set(contractId, updated);
    
    // Persist progress
    progressPersistenceService.saveProgress(updated).catch(err => 
      logger.warn({ err, contractId }, 'Failed to persist progress')
    );
    
    logger.debug({ 
      contractId, 
      stage, 
      progress: overallProgress, 
      estimatedTimeRemaining 
    }, 'Progress updated');
    
    // Emit progress update
    this.emit('progress', updated);
    
    return updated;
  }

  /**
   * Mark a stage as completed
   */
  completeStage(contractId: string, stage: ProcessingStage, message?: string): ProgressUpdate | null {
    const current = this.progressMap.get(contractId);
    if (!current) {
      logger.warn({ contractId, stage }, 'Stage completion for unknown contract');
      return null;
    }

    // Add to completed stages if not already there
    const completedStages = [...current.completedStages];
    if (!completedStages.includes(stage)) {
      completedStages.push(stage);
    }

    // Determine next stage
    const nextStage = this.getNextStage(completedStages);
    const isCompleted = nextStage === ProcessingStage.COMPLETED;
    
    const updated: ProgressUpdate = {
      ...current,
      stage: nextStage,
      progress: isCompleted ? 100 : this.calculateOverallProgress(completedStages, nextStage, 0),
      message: message || (isCompleted ? 'Contract processing completed!' : this.getStageDescription(nextStage)),
      completedStages,
      estimatedTimeRemaining: isCompleted ? 0 : this.calculateEstimatedTimeRemaining(current.startedAt, current.progress),
      updatedAt: new Date()
    };

    this.progressMap.set(contractId, updated);
    
    // Persist progress
    progressPersistenceService.saveProgress(updated).catch(err => 
      logger.warn({ err, contractId }, 'Failed to persist progress')
    );
    
    logger.info({ 
      contractId, 
      completedStage: stage, 
      nextStage, 
      totalCompleted: completedStages.length 
    }, 'Stage completed');
    
    // Emit progress update
    this.emit('progress', updated);
    
    // Emit completion event if fully done
    if (isCompleted) {
      this.emit('completed', updated);
      // Clean up after a delay to allow final status checks
      setTimeout(() => {
        this.progressMap.delete(contractId);
        progressPersistenceService.deleteProgress(contractId).catch(err => 
          logger.warn({ err, contractId }, 'Failed to delete persisted progress')
        );
      }, 300000); // 5 minutes
    }
    
    return updated;
  }

  /**
   * Add an error to the progress tracking
   */
  addError(
    contractId: string, 
    stage: ProcessingStage, 
    error: string, 
    recoverable: boolean = true,
    retryCount: number = 0
  ): ProgressUpdate | null {
    const current = this.progressMap.get(contractId);
    if (!current) {
      logger.warn({ contractId, stage, error }, 'Error for unknown contract');
      return null;
    }

    const processingError: ProcessingError = {
      stage,
      error,
      timestamp: new Date(),
      recoverable,
      retryCount
    };

    const errors = [...(current.errors || []), processingError];
    
    const updated: ProgressUpdate = {
      ...current,
      errors,
      message: recoverable ? `Error in ${this.getStageDescription(stage)} - retrying...` : `Failed: ${error}`,
      updatedAt: new Date()
    };

    // If not recoverable, mark as failed
    if (!recoverable) {
      updated.stage = ProcessingStage.FAILED;
      updated.progress = 0;
      updated.estimatedTimeRemaining = 0;
    }

    this.progressMap.set(contractId, updated);
    
    // Persist progress
    progressPersistenceService.saveProgress(updated).catch(err => 
      logger.warn({ err, contractId }, 'Failed to persist progress')
    );
    
    logger.error({ 
      contractId, 
      stage, 
      error, 
      recoverable, 
      retryCount 
    }, 'Processing error added');
    
    // Emit error event
    this.emit('error', { progress: updated, error: processingError });
    
    // Emit failure event if not recoverable
    if (!recoverable) {
      this.emit('failed', updated);
      // Clean up after a delay
      setTimeout(() => {
        this.progressMap.delete(contractId);
        progressPersistenceService.deleteProgress(contractId).catch(err => 
          logger.warn({ err, contractId }, 'Failed to delete persisted progress')
        );
      }, 300000); // 5 minutes
    }
    
    return updated;
  }

  /**
   * Get current progress for a contract
   */
  getProgress(contractId: string): ProgressUpdate | null {
    return this.progressMap.get(contractId) || null;
  }

  /**
   * Get progress for all contracts of a tenant
   */
  getTenantProgress(tenantId: string): ProgressUpdate[] {
    return Array.from(this.progressMap.values())
      .filter(progress => progress.tenantId === tenantId);
  }

  /**
   * Calculate overall progress based on completed stages and current stage progress
   */
  private calculateOverallProgress(
    completedStages: ProcessingStage[], 
    currentStage: ProcessingStage, 
    stageProgress: number
  ): number {
    const totalWeight = this.stageDefinitions.reduce((sum, def) => sum + def.weight, 0);
    
    // Weight from completed stages
    const completedWeight = this.stageDefinitions
      .filter(def => completedStages.includes(def.stage))
      .reduce((sum, def) => sum + def.weight, 0);
    
    // Weight from current stage
    const currentStageWeight = this.stageDefinitions
      .find(def => def.stage === currentStage)?.weight || 0;
    
    const currentStageContribution = (currentStageWeight * stageProgress) / 100;
    
    const overallProgress = ((completedWeight + currentStageContribution) / totalWeight) * 100;
    
    return Math.min(100, Math.max(0, Math.round(overallProgress)));
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTimeRemaining(startedAt: Date, currentProgress: number): number {
    if (currentProgress <= 0) {
      return this.calculateTotalEstimatedTime();
    }

    const elapsedSeconds = (Date.now() - startedAt.getTime()) / 1000;
    const progressRatio = currentProgress / 100;
    const estimatedTotalTime = elapsedSeconds / progressRatio;
    const remainingTime = estimatedTotalTime - elapsedSeconds;
    
    return Math.max(0, Math.round(remainingTime));
  }

  /**
   * Calculate total estimated processing time
   */
  private calculateTotalEstimatedTime(): number {
    return this.stageDefinitions.reduce((sum, def) => sum + def.estimatedDuration, 0);
  }

  /**
   * Get the next stage to process based on completed stages
   */
  private getNextStage(completedStages: ProcessingStage[]): ProcessingStage {
    // Find the first stage that hasn't been completed and whose dependencies are met
    for (const stageDef of this.stageDefinitions) {
      if (completedStages.includes(stageDef.stage)) {
        continue; // Already completed
      }
      
      // Check if all dependencies are completed
      const dependenciesMet = stageDef.dependencies.every(dep => 
        completedStages.includes(dep)
      );
      
      if (dependenciesMet) {
        return stageDef.stage;
      }
    }
    
    // All stages completed
    return ProcessingStage.COMPLETED;
  }

  /**
   * Get stage description
   */
  private getStageDescription(stage: ProcessingStage): string {
    const stageDef = this.stageDefinitions.find(def => def.stage === stage);
    return stageDef?.description || 'Processing...';
  }

  /**
   * Load persisted progress on startup
   */
  private async loadPersistedProgress(): Promise<void> {
    try {
      const persistedProgress = await progressPersistenceService.loadAllProgress();
      
      for (const progress of persistedProgress) {
        // Only load progress that's not too old (within 24 hours)
        const ageHours = (Date.now() - progress.updatedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours < 24 && progress.stage !== ProcessingStage.COMPLETED && progress.stage !== ProcessingStage.FAILED) {
          this.progressMap.set(progress.contractId, progress);
          logger.info({ 
            contractId: progress.contractId, 
            stage: progress.stage, 
            ageHours: Math.round(ageHours * 10) / 10 
          }, 'Restored progress from persistence');
        }
      }
      
      logger.info({ 
        total: persistedProgress.length, 
        restored: this.progressMap.size 
      }, 'Progress restoration completed');
      
    } catch (error) {
      logger.error({ error }, 'Failed to load persisted progress');
    }
  }

  /**
   * Clean up old progress entries
   */
  cleanup(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [contractId, progress] of this.progressMap.entries()) {
      if (progress.updatedAt < cutoff) {
        this.progressMap.delete(contractId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info({ cleaned, maxAgeHours }, 'Cleaned up old progress entries');
    }
  }
}

export const progressTrackingService = new ProgressTrackingService();

// Clean up old entries every hour
setInterval(() => {
  progressTrackingService.cleanup();
}, 60 * 60 * 1000);