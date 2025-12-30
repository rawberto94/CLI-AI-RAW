/**
 * Parallel Artifact Generator Service
 * 
 * Generates multiple artifact types concurrently with:
 * - Promise.allSettled for error isolation
 * - Resource pooling to prevent system overload
 * - Progress tracking for parallel operations
 * - Intelligent scheduling based on dependencies
 */

import { createLogger } from '../utils/logger';
import { aiArtifactGeneratorService, ArtifactType, GenerationOptions, GenerationResult } from './ai-artifact-generator.service';
import { artifactContextEnrichmentService } from './artifact-context-enrichment.service';
import { artifactValidationService } from './artifact-validation.service';

const logger = createLogger('parallel-artifact-generator-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ParallelGenerationOptions extends GenerationOptions {
  artifactTypes?: ArtifactType[];
  maxConcurrent?: number;
  priorityOrder?: ArtifactType[];
  onProgress?: (progress: ParallelGenerationProgress) => void;
}

export interface ParallelGenerationProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percentage: number;
  currentArtifacts: ArtifactType[];
  completedArtifacts: ArtifactType[];
  failedArtifacts: Array<{ type: ArtifactType; error: string }>;
}

export interface ParallelGenerationResult {
  success: boolean;
  results: Map<ArtifactType, GenerationResult>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    consistencyIssues?: number;
    consistent?: boolean;
  };
  progress: ParallelGenerationProgress;
  consistencyResult?: any;
}

export interface ArtifactDependency {
  type: ArtifactType;
  dependsOn: ArtifactType[];
  priority: number;
}

// =========================================================================
// ARTIFACT DEPENDENCIES AND PRIORITIES
// =========================================================================

const ARTIFACT_DEPENDENCIES: ArtifactDependency[] = [
  {
    type: 'OVERVIEW',
    dependsOn: [],
    priority: 1, // Highest priority - needed by others
  },
  {
    type: 'FINANCIAL',
    dependsOn: ['OVERVIEW'],
    priority: 2,
  },
  {
    type: 'CLAUSES',
    dependsOn: ['OVERVIEW'],
    priority: 2,
  },
  {
    type: 'RATES',
    dependsOn: ['OVERVIEW', 'FINANCIAL'],
    priority: 3,
  },
  {
    type: 'COMPLIANCE',
    dependsOn: ['OVERVIEW', 'CLAUSES'],
    priority: 3,
  },
  {
    type: 'RISK',
    dependsOn: ['OVERVIEW', 'FINANCIAL', 'CLAUSES'],
    priority: 4, // Lowest priority - depends on most others
  },
];

// =========================================================================
// PARALLEL ARTIFACT GENERATOR SERVICE
// =========================================================================

export class ParallelArtifactGeneratorService {
  private static instance: ParallelArtifactGeneratorService;
  private readonly defaultMaxConcurrent = 3;
  private readonly defaultArtifactTypes: ArtifactType[] = [
    'OVERVIEW',
    'FINANCIAL',
    'CLAUSES',
    'RATES',
    'COMPLIANCE',
    'RISK',
  ];

  private constructor() {
    logger.info('Parallel Artifact Generator Service initialized');
  }

  static getInstance(): ParallelArtifactGeneratorService {
    if (!ParallelArtifactGeneratorService.instance) {
      ParallelArtifactGeneratorService.instance = new ParallelArtifactGeneratorService();
    }
    return ParallelArtifactGeneratorService.instance;
  }

  // =========================================================================
  // MAIN GENERATION METHOD
  // =========================================================================

  /**
   * Generate multiple artifacts in parallel
   */
  async generateArtifactsParallel(
    contractText: string,
    contractId: string,
    tenantId: string,
    options: ParallelGenerationOptions = {}
  ): Promise<ParallelGenerationResult> {
    const startTime = Date.now();
    const artifactTypes = options.artifactTypes || this.defaultArtifactTypes;
    const maxConcurrent = options.maxConcurrent || this.defaultMaxConcurrent;

    logger.info(
      {
        contractId,
        artifactTypes,
        maxConcurrent,
      },
      'Starting parallel artifact generation'
    );

    // Initialize progress tracking
    const progress: ParallelGenerationProgress = {
      total: artifactTypes.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      percentage: 0,
      currentArtifacts: [],
      completedArtifacts: [],
      failedArtifacts: [],
    };

    // Organize artifacts by dependency levels
    const levels = this.organizeDependencyLevels(artifactTypes, options.priorityOrder);
    
    logger.debug({ levels: levels.map(l => l.map(a => a)) }, 'Dependency levels organized');

    // Results map
    const results = new Map<ArtifactType, GenerationResult>();

    // Process each level sequentially, but artifacts within level in parallel
    for (const level of levels) {
      logger.info({ level, count: level.length }, 'Processing dependency level');

      // Process artifacts in this level with concurrency control
      const levelResults = await this.processArtifactsWithConcurrency(
        level,
        contractText,
        contractId,
        tenantId,
        maxConcurrent,
        options,
        progress,
        results
      );

      // Store results
      for (const [type, result] of levelResults) {
        results.set(type, result);
      }

      // Update progress
      progress.completed = results.size;
      progress.percentage = (progress.completed / progress.total) * 100;

      // Notify progress
      if (options.onProgress) {
        options.onProgress(progress);
      }

      // Progress event would be published here if Events.ARTIFACT_GENERATION_PROGRESS was defined
      logger.debug({ contractId, progress: progress.percentage }, 'Artifact generation progress');
    }

    // Calculate summary
    const successful = Array.from(results.values()).filter(r => r.success).length;
    const failed = results.size - successful;
    const totalProcessingTime = Date.now() - startTime;
    const averageProcessingTime = totalProcessingTime / results.size;

    // Validate consistency across artifacts
    const artifactDataMap = new Map<ArtifactType, any>();
    for (const [type, result] of results.entries()) {
      if (result.success && result.data) {
        artifactDataMap.set(type, result.data);
      }
    }

    const consistencyResult = await artifactValidationService.validateConsistency(artifactDataMap);
    
    if (!consistencyResult.consistent) {
      logger.warn(
        { 
          contractId, 
          issues: consistencyResult.issues.length,
          criticalIssues: consistencyResult.issues.filter(i => i.severity === 'critical').length
        },
        'Consistency issues detected across artifacts'
      );
    }

    const summary = {
      total: artifactTypes.length,
      successful,
      failed,
      totalProcessingTime,
      averageProcessingTime,
      consistencyIssues: consistencyResult.issues.length,
      consistent: consistencyResult.consistent
    };

    logger.info(
      {
        contractId,
        summary,
      },
      'Parallel artifact generation completed'
    );

    return {
      success: failed === 0 && consistencyResult.consistent,
      results,
      summary,
      progress,
      consistencyResult
    };
  }

  // =========================================================================
  // CONCURRENCY CONTROL
  // =========================================================================

  /**
   * Process artifacts with concurrency limit
   */
  private async processArtifactsWithConcurrency(
    artifactTypes: ArtifactType[],
    contractText: string,
    contractId: string,
    tenantId: string,
    maxConcurrent: number,
    options: ParallelGenerationOptions,
    progress: ParallelGenerationProgress,
    existingResults: Map<ArtifactType, GenerationResult>
  ): Promise<Map<ArtifactType, GenerationResult>> {
    const results = new Map<ArtifactType, GenerationResult>();
    const queue = [...artifactTypes];
    const inProgress = new Set<Promise<void>>();

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (queue.length > 0 && inProgress.size < maxConcurrent) {
        const artifactType = queue.shift()!;
        
        // Check if dependencies are met
        if (!this.areDependenciesMet(artifactType, existingResults)) {
          // Put back in queue
          queue.push(artifactType);
          continue;
        }

        // Update progress
        progress.inProgress++;
        progress.currentArtifacts.push(artifactType);

        // Start generation
        const task = this.generateArtifactWithTracking(
          artifactType,
          contractText,
          contractId,
          tenantId,
          options,
          progress,
          results
        );

        inProgress.add(task);

        // Remove from inProgress when done
        task.finally(() => {
          inProgress.delete(task);
          progress.inProgress--;
          progress.currentArtifacts = progress.currentArtifacts.filter(t => t !== artifactType);
        });
      }

      // Wait for at least one task to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    return results;
  }

  /**
   * Generate single artifact with progress tracking
   */
  private async generateArtifactWithTracking(
    artifactType: ArtifactType,
    contractText: string,
    contractId: string,
    tenantId: string,
    options: ParallelGenerationOptions,
    progress: ParallelGenerationProgress,
    results: Map<ArtifactType, GenerationResult>
  ): Promise<void> {
    try {
      logger.debug({ artifactType, contractId }, 'Generating artifact');

      // Build previous artifacts map from successful results
      const previousArtifacts = new Map<ArtifactType, any>();
      for (const [type, result] of results.entries()) {
        if (result.success && result.data) {
          previousArtifacts.set(type, result.data);
        }
      }

      // Enrich context with previous artifacts
      const enrichedContext = artifactContextEnrichmentService.enrichContext(
        artifactType,
        previousArtifacts
      );

      logger.debug(
        { 
          artifactType, 
          previousArtifactsCount: previousArtifacts.size,
          contextSummary: enrichedContext.contextSummary 
        },
        'Context enriched for artifact generation'
      );

      const result = await aiArtifactGeneratorService.generateArtifact(
        artifactType,
        contractText,
        contractId,
        tenantId,
        {
          ...options,
          previousArtifacts,
          enrichedContext
        }
      );

      results.set(artifactType, result);

      if (result.success) {
        progress.completedArtifacts.push(artifactType);
        logger.info(
          {
            artifactType,
            method: result.method,
            confidence: result.confidence,
            processingTime: result.processingTime,
          },
          'Artifact generated successfully'
        );
      } else {
        progress.failed++;
        progress.failedArtifacts.push({
          type: artifactType,
          error: result.error || 'Unknown error',
        });
        logger.error(
          {
            artifactType,
            error: result.error,
          },
          'Artifact generation failed'
        );
      }

      // Notify progress
      if (options.onProgress) {
        options.onProgress(progress);
      }
    } catch (error) {
      logger.error({ error, artifactType }, 'Artifact generation threw exception');
      
      progress.failed++;
      progress.failedArtifacts.push({
        type: artifactType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      results.set(artifactType, {
        success: false,
        method: 'ai',
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // =========================================================================
  // DEPENDENCY MANAGEMENT
  // =========================================================================

  /**
   * Organize artifacts into dependency levels
   */
  private organizeDependencyLevels(
    artifactTypes: ArtifactType[],
    priorityOrder?: ArtifactType[]
  ): ArtifactType[][] {
    const levels: ArtifactType[][] = [];
    const processed = new Set<ArtifactType>();
    const remaining = new Set(artifactTypes);

    // Apply custom priority order if provided
    const sortedTypes = priorityOrder
      ? this.sortByPriority(artifactTypes, priorityOrder)
      : this.sortByDependencies(artifactTypes);

    while (remaining.size > 0) {
      const currentLevel: ArtifactType[] = [];

      for (const type of sortedTypes) {
        if (remaining.has(type)) {
          const deps = this.getDependencies(type);
          const allDepsMet = deps.every(dep => processed.has(dep) || !remaining.has(dep));

          if (allDepsMet) {
            currentLevel.push(type);
            processed.add(type);
            remaining.delete(type);
          }
        }
      }

      if (currentLevel.length === 0 && remaining.size > 0) {
        // Circular dependency or missing dependency - add remaining to level
        logger.warn(
          { remaining: Array.from(remaining) },
          'Circular or missing dependencies detected'
        );
        currentLevel.push(...Array.from(remaining));
        remaining.clear();
      }

      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }

    return levels;
  }

  /**
   * Check if all dependencies are met
   */
  private areDependenciesMet(
    artifactType: ArtifactType,
    existingResults: Map<ArtifactType, GenerationResult>
  ): boolean {
    const deps = this.getDependencies(artifactType);
    
    return deps.every(dep => {
      const result = existingResults.get(dep);
      return result && result.success;
    });
  }

  /**
   * Get dependencies for an artifact type
   */
  private getDependencies(artifactType: ArtifactType): ArtifactType[] {
    const dep = ARTIFACT_DEPENDENCIES.find(d => d.type === artifactType);
    return dep ? dep.dependsOn : [];
  }

  /**
   * Get priority for an artifact type
   */
  private getPriority(artifactType: ArtifactType): number {
    const dep = ARTIFACT_DEPENDENCIES.find(d => d.type === artifactType);
    return dep ? dep.priority : 999;
  }

  /**
   * Sort artifact types by dependencies
   */
  private sortByDependencies(artifactTypes: ArtifactType[]): ArtifactType[] {
    return [...artifactTypes].sort((a, b) => {
      const priorityA = this.getPriority(a);
      const priorityB = this.getPriority(b);
      return priorityA - priorityB;
    });
  }

  /**
   * Sort artifact types by custom priority order
   */
  private sortByPriority(
    artifactTypes: ArtifactType[],
    priorityOrder: ArtifactType[]
  ): ArtifactType[] {
    return [...artifactTypes].sort((a, b) => {
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get recommended artifact types for a contract
   */
  getRecommendedArtifactTypes(contractText: string): ArtifactType[] {
    const recommended: ArtifactType[] = ['OVERVIEW']; // Always include overview

    // Check for financial indicators
    if (/\$|payment|invoice|fee|cost/i.test(contractText)) {
      recommended.push('FINANCIAL');
    }

    // Check for rate indicators
    if (/rate|hourly|daily|consultant|developer/i.test(contractText)) {
      recommended.push('RATES');
    }

    // Check for compliance indicators
    if (/GDPR|HIPAA|compliance|regulation|certification/i.test(contractText)) {
      recommended.push('COMPLIANCE');
    }

    // Check for risk indicators
    if (/liability|indemnif|penalty|termination/i.test(contractText)) {
      recommended.push('RISK');
    }

    // Always include clauses
    recommended.push('CLAUSES');

    return recommended;
  }

  /**
   * Estimate processing time
   */
  estimateProcessingTime(
    artifactTypes: ArtifactType[],
    contractLength: number,
    maxConcurrent: number
  ): number {
    // Base time per artifact (in ms)
    const baseTime = 5000;
    
    // Additional time based on contract length
    const lengthFactor = Math.min(contractLength / 1000, 10);
    
    // Time per artifact
    const timePerArtifact = baseTime + (lengthFactor * 1000);
    
    // Organize into levels
    const levels = this.organizeDependencyLevels(artifactTypes);
    
    // Calculate time for each level (considering concurrency)
    let totalTime = 0;
    for (const level of levels) {
      const levelTime = Math.ceil(level.length / maxConcurrent) * timePerArtifact;
      totalTime += levelTime;
    }
    
    return totalTime;
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): Map<ArtifactType, ArtifactType[]> {
    const graph = new Map<ArtifactType, ArtifactType[]>();
    
    for (const dep of ARTIFACT_DEPENDENCIES) {
      graph.set(dep.type, dep.dependsOn);
    }
    
    return graph;
  }
}

export const parallelArtifactGeneratorService = ParallelArtifactGeneratorService.getInstance();
