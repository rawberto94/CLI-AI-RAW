
/**
 * Confidence Scoring Service
 * 
 * Calculates confidence scores for artifacts based on:
 * - Data completeness
 * - AI certainty scores
 * - Field-level confidence
 * - Threshold-based flagging for manual review
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('confidence-scoring-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ConfidenceScore {
  overall: number; // 0-1
  breakdown: {
    completeness: number; // 0-1
    aiCertainty: number; // 0-1
    fieldQuality: number; // 0-1
    consistency: number; // 0-1
  };
  fieldScores: Record<string, number>;
  flags: ConfidenceFlag[];
  requiresReview: boolean;
  reviewReason?: string;
}

export interface ConfidenceFlag {
  type: 'low_confidence' | 'missing_critical' | 'inconsistent' | 'ai_uncertain';
  field?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FieldDefinition {
  name: string;
  required: boolean;
  weight: number; // Importance weight (0-1)
  validator?: (value: any) => boolean;
  expectedType?: 'string' | 'number' | 'date' | 'array' | 'object';
}

export interface ArtifactSchema {
  type: string;
  fields: FieldDefinition[];
  criticalFields: string[];
  reviewThreshold: number; // Confidence below this triggers review
}

// =========================================================================
// ARTIFACT SCHEMAS
// =========================================================================

const ARTIFACT_SCHEMAS: Record<string, ArtifactSchema> = {
  OVERVIEW: {
    type: 'OVERVIEW',
    fields: [
      { name: 'summary', required: true, weight: 0.8, expectedType: 'string' },
      { name: 'parties', required: true, weight: 1.0, expectedType: 'array' },
      { name: 'contractType', required: true, weight: 0.9, expectedType: 'string' },
      { name: 'effectiveDate', required: true, weight: 0.9, expectedType: 'date' },
      { name: 'expirationDate', required: false, weight: 0.7, expectedType: 'date' },
      { name: 'jurisdiction', required: false, weight: 0.5, expectedType: 'string' },
      { name: 'keyTerms', required: false, weight: 0.6, expectedType: 'array' },
    ],
    criticalFields: ['parties', 'contractType', 'effectiveDate'],
    reviewThreshold: 0.7,
  },
  FINANCIAL: {
    type: 'FINANCIAL',
    fields: [
      { name: 'totalValue', required: true, weight: 1.0, expectedType: 'object' },
      { name: 'currency', required: true, weight: 1.0, expectedType: 'string' },
      { name: 'paymentTerms', required: true, weight: 0.9, expectedType: 'array' },
      { name: 'costBreakdown', required: false, weight: 0.7, expectedType: 'array' },
      { name: 'pricingTables', required: false, weight: 0.6, expectedType: 'array' },
      { name: 'discounts', required: false, weight: 0.5, expectedType: 'array' },
    ],
    criticalFields: ['totalValue', 'currency', 'paymentTerms'],
    reviewThreshold: 0.75,
  },
  CLAUSES: {
    type: 'CLAUSES',
    fields: [
      { name: 'clauses', required: true, weight: 1.0, expectedType: 'array' },
      { name: 'riskAssessment', required: false, weight: 0.8, expectedType: 'object' },
      { name: 'complianceFlags', required: false, weight: 0.7, expectedType: 'array' },
    ],
    criticalFields: ['clauses'],
    reviewThreshold: 0.65,
  },
  RATES: {
    type: 'RATES',
    fields: [
      { name: 'rateCards', required: true, weight: 1.0, expectedType: 'array' },
      { name: 'roles', required: true, weight: 0.9, expectedType: 'array' },
      { name: 'locations', required: false, weight: 0.6, expectedType: 'array' },
      { name: 'effectivePeriod', required: true, weight: 0.8, expectedType: 'object' },
    ],
    criticalFields: ['rateCards', 'roles'],
    reviewThreshold: 0.7,
  },
};

// =========================================================================
// CONFIDENCE SCORING SERVICE
// =========================================================================

export class ConfidenceScoringService {
  private static instance: ConfidenceScoringService;

  private constructor() {
    logger.info('Confidence Scoring Service initialized');
  }

  static getInstance(): ConfidenceScoringService {
    if (!ConfidenceScoringService.instance) {
      ConfidenceScoringService.instance = new ConfidenceScoringService();
    }
    return ConfidenceScoringService.instance;
  }

  // =========================================================================
  // CONFIDENCE CALCULATION
  // =========================================================================

  /**
   * Calculate comprehensive confidence score for an artifact
   */
  calculateConfidence(
    artifactType: string,
    data: any,
    aiCertainty?: number,
    generationMethod?: 'ai' | 'rule-based' | 'hybrid'
  ): ConfidenceScore {
    try {
      const schema = ARTIFACT_SCHEMAS[artifactType];
      
      if (!schema) {
        logger.warn({ artifactType }, 'No schema found for artifact type');
        return this.getDefaultScore();
      }

      // Calculate individual components
      const completeness = this.calculateCompleteness(data, schema);
      const aiCertaintyScore = aiCertainty || this.inferAICertainty(generationMethod);
      const fieldQuality = this.calculateFieldQuality(data, schema);
      const consistency = this.calculateConsistency(data, schema);

      // Calculate field-level scores
      const fieldScores = this.calculateFieldScores(data, schema);

      // Calculate weighted overall score
      const overall = this.calculateOverallScore({
        completeness,
        aiCertainty: aiCertaintyScore,
        fieldQuality,
        consistency,
      });

      // Generate flags
      const flags = this.generateFlags(data, schema, {
        completeness,
        aiCertainty: aiCertaintyScore,
        fieldQuality,
        consistency,
      }, fieldScores);

      // Determine if review is required
      const requiresReview = overall < schema.reviewThreshold || 
                            flags.some(f => f.severity === 'high');
      
      const reviewReason = requiresReview 
        ? this.generateReviewReason(overall, schema.reviewThreshold, flags)
        : undefined;

      const score: ConfidenceScore = {
        overall,
        breakdown: {
          completeness,
          aiCertainty: aiCertaintyScore,
          fieldQuality,
          consistency,
        },
        fieldScores,
        flags,
        requiresReview,
        reviewReason,
      };

      logger.debug(
        {
          artifactType,
          overall,
          requiresReview,
          flagCount: flags.length,
        },
        'Confidence score calculated'
      );

      return score;
    } catch (error) {
      logger.error({ error, artifactType }, 'Failed to calculate confidence score');
      return this.getDefaultScore();
    }
  }

  // =========================================================================
  // COMPONENT CALCULATIONS
  // =========================================================================

  /**
   * Calculate data completeness score
   */
  private calculateCompleteness(data: any, schema: ArtifactSchema): number {
    let totalWeight = 0;
    let achievedWeight = 0;

    for (const field of schema.fields) {
      totalWeight += field.weight;

      const value = this.getNestedValue(data, field.name);
      
      if (this.isFieldComplete(value, field)) {
        achievedWeight += field.weight;
      } else if (!field.required && value !== undefined && value !== null) {
        // Partial credit for optional fields with some data
        achievedWeight += field.weight * 0.5;
      }
    }

    return totalWeight > 0 ? achievedWeight / totalWeight : 0;
  }

  /**
   * Calculate field quality score
   */
  private calculateFieldQuality(data: any, schema: ArtifactSchema): number {
    let totalFields = 0;
    let qualitySum = 0;

    for (const field of schema.fields) {
      const value = this.getNestedValue(data, field.name);
      
      if (value !== undefined && value !== null) {
        totalFields++;
        qualitySum += this.assessFieldQuality(value, field);
      }
    }

    return totalFields > 0 ? qualitySum / totalFields : 0;
  }

  /**
   * Calculate data consistency score
   */
  private calculateConsistency(data: any, schema: ArtifactSchema): number {
    const inconsistencies: number[] = [];

    // Check date consistency
    if (data.effectiveDate && data.expirationDate) {
      const effective = new Date(data.effectiveDate);
      const expiration = new Date(data.expirationDate);
      
      if (effective > expiration) {
        inconsistencies.push(0); // Major inconsistency
      }
    }

    // Check financial consistency
    if (data.totalValue && data.costBreakdown) {
      const total = typeof data.totalValue === 'object' 
        ? data.totalValue.amount 
        : data.totalValue;
      
      if (Array.isArray(data.costBreakdown)) {
        const sum = data.costBreakdown.reduce((acc: number, item: any) => {
          return acc + (item.amount || 0);
        }, 0);
        
        // Allow 1% variance
        if (Math.abs(total - sum) / total > 0.01) {
          inconsistencies.push(0.5); // Moderate inconsistency
        }
      }
    }

    // Check party consistency
    if (data.parties && Array.isArray(data.parties)) {
      const hasClient = data.parties.some((p: any) => p.role === 'client');
      const hasSupplier = data.parties.some((p: any) => p.role === 'supplier');
      
      if (!hasClient || !hasSupplier) {
        inconsistencies.push(0.7); // Minor inconsistency
      }
    }

    // Calculate consistency score (1 - average inconsistency)
    if (inconsistencies.length === 0) {
      return 1.0;
    }

    const avgInconsistency = inconsistencies.reduce((a, b) => a + b, 0) / inconsistencies.length;
    return Math.max(0, 1 - avgInconsistency);
  }

  /**
   * Calculate field-level confidence scores
   */
  private calculateFieldScores(data: any, schema: ArtifactSchema): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const field of schema.fields) {
      const value = this.getNestedValue(data, field.name);
      
      if (value === undefined || value === null) {
        scores[field.name] = 0;
      } else {
        scores[field.name] = this.assessFieldQuality(value, field);
      }
    }

    return scores;
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(breakdown: {
    completeness: number;
    aiCertainty: number;
    fieldQuality: number;
    consistency: number;
  }): number {
    // Weighted average
    const weights = {
      completeness: 0.35,
      aiCertainty: 0.25,
      fieldQuality: 0.25,
      consistency: 0.15,
    };

    return (
      breakdown.completeness * weights.completeness +
      breakdown.aiCertainty * weights.aiCertainty +
      breakdown.fieldQuality * weights.fieldQuality +
      breakdown.consistency * weights.consistency
    );
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Check if field is complete
   */
  private isFieldComplete(value: any, field: FieldDefinition): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    // Check type
    if (field.expectedType) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== field.expectedType) {
        return false;
      }
    }

    // Check custom validator
    if (field.validator && !field.validator(value)) {
      return false;
    }

    // Check for empty values
    if (typeof value === 'string' && value.trim().length === 0) {
      return false;
    }

    if (Array.isArray(value) && value.length === 0) {
      return false;
    }

    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Assess quality of a field value
   */
  private assessFieldQuality(value: any, field: FieldDefinition): number {
    let quality = 1.0;

    // Type mismatch penalty
    if (field.expectedType) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== field.expectedType) {
        quality *= 0.5;
      }
    }

    // String quality checks
    if (typeof value === 'string') {
      if (value.length < 3) {
        quality *= 0.6; // Very short strings
      } else if (value.length < 10) {
        quality *= 0.8; // Short strings
      }
      
      // Check for placeholder text
      if (/^(n\/a|tbd|unknown|pending|null)$/i.test(value.trim())) {
        quality *= 0.3;
      }
    }

    // Array quality checks
    if (Array.isArray(value)) {
      if (value.length === 0) {
        quality = 0;
      } else if (value.length < 2) {
        quality *= 0.7; // Sparse arrays
      }
    }

    // Object quality checks
    if (typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        quality = 0;
      } else if (keys.length < 2) {
        quality *= 0.7; // Sparse objects
      }
    }

    // Custom validator
    if (field.validator && !field.validator(value)) {
      quality *= 0.5;
    }

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Infer AI certainty from generation method
   */
  private inferAICertainty(method?: 'ai' | 'rule-based' | 'hybrid'): number {
    switch (method) {
      case 'ai':
        return 0.85; // High confidence in AI
      case 'hybrid':
        return 0.75; // Good confidence in hybrid
      case 'rule-based':
        return 0.60; // Lower confidence in rules only
      default:
        return 0.70; // Default moderate confidence
    }
  }

  /**
   * Generate confidence flags
   */
  private generateFlags(
    data: any,
    schema: ArtifactSchema,
    breakdown: any,
    fieldScores: Record<string, number>
  ): ConfidenceFlag[] {
    const flags: ConfidenceFlag[] = [];

    // Check overall scores
    if (breakdown.completeness < 0.6) {
      flags.push({
        type: 'low_confidence',
        message: 'Data completeness is below acceptable threshold',
        severity: 'high',
      });
    }

    if (breakdown.aiCertainty < 0.5) {
      flags.push({
        type: 'ai_uncertain',
        message: 'AI extraction confidence is low',
        severity: 'medium',
      });
    }

    if (breakdown.consistency < 0.7) {
      flags.push({
        type: 'inconsistent',
        message: 'Data contains inconsistencies',
        severity: 'medium',
      });
    }

    // Check critical fields
    for (const criticalField of schema.criticalFields) {
      const value = this.getNestedValue(data, criticalField);
      
      if (value === undefined || value === null) {
        flags.push({
          type: 'missing_critical',
          field: criticalField,
          message: `Critical field '${criticalField}' is missing`,
          severity: 'high',
        });
      } else if (fieldScores[criticalField] < 0.5) {
        flags.push({
          type: 'low_confidence',
          field: criticalField,
          message: `Critical field '${criticalField}' has low quality`,
          severity: 'high',
        });
      }
    }

    // Check low-scoring fields
    for (const [field, score] of Object.entries(fieldScores)) {
      if (score < 0.4 && score > 0) {
        flags.push({
          type: 'low_confidence',
          field,
          message: `Field '${field}' has low confidence score`,
          severity: 'low',
        });
      }
    }

    return flags;
  }

  /**
   * Generate review reason
   */
  private generateReviewReason(
    overall: number,
    threshold: number,
    flags: ConfidenceFlag[]
  ): string {
    const reasons: string[] = [];

    if (overall < threshold) {
      reasons.push(`Overall confidence (${(overall * 100).toFixed(1)}%) below threshold (${(threshold * 100).toFixed(1)}%)`);
    }

    const highSeverityFlags = flags.filter(f => f.severity === 'high');
    if (highSeverityFlags.length > 0) {
      reasons.push(`${highSeverityFlags.length} high-severity issue(s) detected`);
    }

    return reasons.join('; ');
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get default low-confidence score
   */
  private getDefaultScore(): ConfidenceScore {
    return {
      overall: 0.5,
      breakdown: {
        completeness: 0.5,
        aiCertainty: 0.5,
        fieldQuality: 0.5,
        consistency: 0.5,
      },
      fieldScores: {},
      flags: [
        {
          type: 'low_confidence',
          message: 'Unable to calculate confidence score',
          severity: 'medium',
        },
      ],
      requiresReview: true,
      reviewReason: 'Confidence calculation failed',
    };
  }

  // =========================================================================
  // PUBLIC UTILITY METHODS
  // =========================================================================

  /**
   * Get artifact schema
   */
  getSchema(artifactType: string): ArtifactSchema | undefined {
    return ARTIFACT_SCHEMAS[artifactType];
  }

  /**
   * Register custom schema
   */
  registerSchema(schema: ArtifactSchema): void {
    ARTIFACT_SCHEMAS[schema.type] = schema;
    logger.info({ type: schema.type }, 'Custom artifact schema registered');
  }

  /**
   * Get artifact confidence score
   */
  async getArtifactConfidence(artifactId: string, tenantId: string): Promise<number> {
    try {
      const artifact = await (dbAdaptor.getClient() as any).artifact?.findFirst({
        where: { id: artifactId, tenantId },
      });

      if (!artifact) {
        logger.warn({ artifactId }, 'Artifact not found for confidence calculation');
        return 0.5;
      }

      const confidenceScore = this.calculateConfidence(
        artifact.type,
        artifact.data,
        artifact.confidence,
        'ai'
      );

      return confidenceScore.overall;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get artifact confidence');
      return 0.5;
    }
  }
}

export const confidenceScoringService = ConfidenceScoringService.getInstance();
