
/**
 * Enhanced Artifact Service
 * 
 * Provides production-grade artifact generation with:
 * - Artifact versioning and history
 * - Confidence scoring
 * - Checkpoint system for resumability
 * - AI analysis with rule-based fallback
 * - Parallel artifact generation
 */

import { dbAdaptor } from '../dal/database.adaptor';
import { enhancedDbAdaptor } from '../dal/enhanced-database.adaptor';
import { processingJobService } from './processing-job.service';
import { eventBus, Events } from '../events/event-bus';
import { createLogger } from '../utils/logger';

const logger = createLogger('enhanced-artifact-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ArtifactGenerationOptions {
  useAI?: boolean;
  parallel?: boolean;
  saveCheckpoints?: boolean;
  maxRetries?: number;
}

export interface ArtifactGenerationResult {
  artifacts: any[];
  confidence: number;
  generationMethod: 'ai' | 'rule-based' | 'hybrid';
  processingTime: number;
  checkpoints: string[];
  errors: string[];
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  data: any;
  changeReason: string;
  createdAt: Date;
  createdBy: string;
}

export interface ConfidenceScore {
  overall: number;
  dataCompleteness: number;
  aiCertainty: number;
  validationScore: number;
}

// =========================================================================
// ENHANCED ARTIFACT SERVICE
// =========================================================================

export class EnhancedArtifactService {
  private static instance: EnhancedArtifactService;

  private constructor() {
    logger.info('Enhanced Artifact Service initialized');
  }

  static getInstance(): EnhancedArtifactService {
    if (!EnhancedArtifactService.instance) {
      EnhancedArtifactService.instance = new EnhancedArtifactService();
    }
    return EnhancedArtifactService.instance;
  }

  // =========================================================================
  // ARTIFACT VERSIONING (Task 5.1)
  // =========================================================================

  /**
   * Create a new version of an artifact
   */
  async createArtifactVersion(
    artifactId: string,
    data: any,
    changeReason: string,
    userId: string
  ): Promise<ArtifactVersion> {
    try {
      logger.info({ artifactId, changeReason }, 'Creating artifact version');

      return await enhancedDbAdaptor.withTransaction(async (tx) => {
        // Get current artifact
        const currentArtifact = await tx.artifact.findUnique({
          where: { id: artifactId },
        });

        if (!currentArtifact) {
          throw new Error(`Artifact ${artifactId} not found`);
        }

        // Increment version
        const newVersion = (currentArtifact.version || 1) + 1;

        // Update artifact with new data and version
        const updatedArtifact = await tx.artifact.update({
          where: { id: artifactId },
          data: {
            data,
            version: newVersion,
            previousVersionId: artifactId,
            changeReason,
            updatedAt: new Date(),
          },
        });

        // Create version history record (if table exists)
        try {
          await (tx as any).artifactVersion?.create({
            data: {
              artifactId,
              version: newVersion,
              data: currentArtifact.data,
              changeReason,
              createdBy: userId,
            },
          });
        } catch (error: any) {
          // Silently fail if table doesn't exist
          if (!error.message?.includes('does not exist')) {
            throw error;
          }
        }

        logger.info(
          { artifactId, version: newVersion },
          'Artifact version created'
        );

        return {
          id: updatedArtifact.id,
          artifactId,
          version: newVersion,
          data: updatedArtifact.data,
          changeReason,
          createdAt: updatedArtifact.updatedAt,
          createdBy: userId,
        };
      });
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to create artifact version');
      throw error;
    }
  }

  /**
   * Get version history for an artifact
   */
  async getArtifactVersionHistory(artifactId: string): Promise<ArtifactVersion[]> {
    try {
      const versions = await (dbAdaptor.getClient() as any).artifactVersion?.findMany({
        where: { artifactId },
        orderBy: { version: 'desc' },
      });

      return versions || [];
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get version history');
      return [];
    }
  }

  /**
   * Compare two artifact versions
   */
  async compareVersions(
    artifactId: string,
    version1: number,
    version2: number
  ): Promise<any> {
    try {
      const versions = await this.getArtifactVersionHistory(artifactId);
      
      const v1 = versions.find(v => v.version === version1);
      const v2 = versions.find(v => v.version === version2);

      if (!v1 || !v2) {
        throw new Error('One or both versions not found');
      }

      return {
        version1: v1,
        version2: v2,
        differences: this.calculateDifferences(v1.data, v2.data),
      };
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to compare versions');
      throw error;
    }
  }

  /**
   * Revert artifact to a previous version
   */
  async revertToVersion(
    artifactId: string,
    version: number,
    userId: string
  ): Promise<void> {
    try {
      const versions = await this.getArtifactVersionHistory(artifactId);
      const targetVersion = versions.find(v => v.version === version);

      if (!targetVersion) {
        throw new Error(`Version ${version} not found`);
      }

      await this.createArtifactVersion(
        artifactId,
        targetVersion.data,
        `Reverted to version ${version}`,
        userId
      );

      logger.info({ artifactId, version }, 'Artifact reverted to version');
    } catch (error) {
      logger.error({ error, artifactId, version }, 'Failed to revert version');
      throw error;
    }
  }

  // =========================================================================
  // CONFIDENCE SCORING (Task 5.2)
  // =========================================================================

  /**
   * Calculate confidence score for an artifact
   */
  async calculateConfidence(artifact: any): Promise<ConfidenceScore> {
    try {
      const dataCompleteness = this.calculateDataCompleteness(artifact.data);
      const aiCertainty = artifact.metadata?.aiCertainty || 0.5;
      const validationScore = this.calculateValidationScore(artifact.data);

      // Weighted average
      const overall = (
        dataCompleteness * 0.4 +
        aiCertainty * 0.4 +
        validationScore * 0.2
      );

      return {
        overall: Math.round(overall * 100) / 100,
        dataCompleteness: Math.round(dataCompleteness * 100) / 100,
        aiCertainty: Math.round(aiCertainty * 100) / 100,
        validationScore: Math.round(validationScore * 100) / 100,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to calculate confidence');
      return {
        overall: 0,
        dataCompleteness: 0,
        aiCertainty: 0,
        validationScore: 0,
      };
    }
  }

  /**
   * Calculate data completeness score
   */
  private calculateDataCompleteness(data: any): number {
    if (!data || typeof data !== 'object') {
      return 0;
    }

    const requiredFields = [
      'contractType',
      'parties',
      'effectiveDate',
      'totalValue',
      'currency',
    ];

    let filledFields = 0;
    let totalFields = requiredFields.length;

    for (const field of requiredFields) {
      if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
        filledFields++;
      }
    }

    return filledFields / totalFields;
  }

  /**
   * Calculate validation score
   */
  private calculateValidationScore(data: any): number {
    if (!data) return 0;

    let score = 1.0;

    // Check for data quality issues
    if (data.errors && data.errors.length > 0) {
      score -= 0.2 * data.errors.length;
    }

    if (data.warnings && data.warnings.length > 0) {
      score -= 0.1 * data.warnings.length;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Update artifact with confidence score
   */
  async updateArtifactConfidence(artifactId: string): Promise<void> {
    try {
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        throw new Error(`Artifact ${artifactId} not found`);
      }

      const confidence = await this.calculateConfidence(artifact);

      await dbAdaptor.getClient().artifact.update({
        where: { id: artifactId },
        data: {
          confidence: confidence.overall,
          dataCompleteness: confidence.dataCompleteness,
        },
      });

      logger.info(
        { artifactId, confidence: confidence.overall },
        'Artifact confidence updated'
      );
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to update confidence');
      throw error;
    }
  }

  // =========================================================================
  // CHECKPOINT SYSTEM (Task 5.3)
  // =========================================================================

  /**
   * Save checkpoint during artifact generation
   */
  async saveCheckpoint(
    jobId: string,
    checkpoint: string,
    data: any
  ): Promise<void> {
    try {
      await processingJobService.saveCheckpoint(jobId, checkpoint, data);
      logger.debug({ jobId, checkpoint }, 'Checkpoint saved');
    } catch (error) {
      logger.error({ error, jobId, checkpoint }, 'Failed to save checkpoint');
      throw error;
    }
  }

  /**
   * Resume from last checkpoint
   */
  async resumeFromCheckpoint(jobId: string): Promise<{ checkpoint: string; data: any } | null> {
    try {
      return await processingJobService.resumeFromCheckpoint(jobId);
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to resume from checkpoint');
      return null;
    }
  }

  // =========================================================================
  // AI ANALYSIS WITH FALLBACK (Task 5.4)
  // =========================================================================

  /**
   * Generate artifact with AI analysis and fallback
   */
  async generateWithFallback(
    contractId: string,
    artifactType: string,
    primaryMethod: () => Promise<any>,
    fallbackMethod: () => Promise<any>
  ): Promise<{ data: any; method: 'ai' | 'rule-based' | 'hybrid' }> {
    try {
      logger.info({ contractId, artifactType }, 'Attempting AI generation');

      // Try primary method (AI)
      try {
        const data = await primaryMethod();
        logger.info({ contractId, artifactType }, 'AI generation successful');
        return { data, method: 'ai' };
      } catch (aiError) {
        logger.warn(
          { error: aiError, contractId, artifactType },
          'AI generation failed, falling back to rules'
        );

        // Fall back to rule-based method
        const data = await fallbackMethod();
        logger.info({ contractId, artifactType }, 'Rule-based generation successful');
        return { data, method: 'rule-based' };
      }
    } catch (error) {
      logger.error({ error, contractId, artifactType }, 'Both methods failed');
      throw error;
    }
  }

  // =========================================================================
  // PARALLEL ARTIFACT GENERATION (Task 5.5)
  // =========================================================================

  /**
   * Generate multiple artifacts in parallel
   */
  async generateArtifactsParallel(
    contractId: string,
    tenantId: string,
    artifactTypes: string[],
    generators: Map<string, () => Promise<any>>
  ): Promise<ArtifactGenerationResult> {
    const startTime = Date.now();
    const checkpoints: string[] = [];
    const errors: string[] = [];
    const artifacts: any[] = [];

    try {
      logger.info(
        { contractId, artifactTypes },
        'Starting parallel artifact generation'
      );

      // Generate all artifacts in parallel using Promise.allSettled
      const results = await Promise.allSettled(
        artifactTypes.map(async (type) => {
          const generator = generators.get(type);
          if (!generator) {
            throw new Error(`No generator found for type: ${type}`);
          }

          try {
            const data = await generator();
            
            // Create artifact in database
            const artifact = await dbAdaptor.getClient().artifact.create({
              data: {
                contractId,
                tenantId,
                type: type as any,
                data,
                schemaVersion: 'v1',
                generationMethod: 'ai',
                processingTime: Date.now() - startTime,
              },
            });

            checkpoints.push(`${type}_completed`);
            return artifact;
          } catch (error: any) {
            errors.push(`${type}: ${error.message}`);
            throw error;
          }
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          artifacts.push(result.value);
        }
      }

      const processingTime = Date.now() - startTime;
      const successRate = artifacts.length / artifactTypes.length;

      logger.info(
        {
          contractId,
          total: artifactTypes.length,
          successful: artifacts.length,
          failed: errors.length,
          processingTime,
        },
        'Parallel artifact generation completed'
      );

      return {
        artifacts,
        confidence: successRate,
        generationMethod: 'ai',
        processingTime,
        checkpoints,
        errors,
      };
    } catch (error) {
      logger.error({ error, contractId }, 'Parallel generation failed');
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Calculate differences between two data objects
   */
  private calculateDifferences(data1: any, data2: any): any {
    const differences: any = {};

    const allKeys = new Set([
      ...Object.keys(data1 || {}),
      ...Object.keys(data2 || {}),
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
        differences[key] = {
          old: data1[key],
          new: data2[key],
        };
      }
    }

    return differences;
  }

  /**
   * Flag artifact for manual review
   */
  async flagForReview(
    artifactId: string,
    reason: string
  ): Promise<void> {
    try {
      await dbAdaptor.getClient().artifact.update({
        where: { id: artifactId },
        data: {
          validationStatus: 'pending',
          metadata: {
            flaggedForReview: true,
            flagReason: reason,
            flaggedAt: new Date(),
          },
        },
      });

      logger.info({ artifactId, reason }, 'Artifact flagged for review');
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to flag artifact');
      throw error;
    }
  }
}

export const enhancedArtifactService = EnhancedArtifactService.getInstance();
