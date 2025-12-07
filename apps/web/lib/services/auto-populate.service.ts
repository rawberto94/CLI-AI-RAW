/**
 * Auto-Populate Service
 * 
 * Automatically extracts and populates metadata when a contract is uploaded.
 * Features:
 * - Background processing
 * - Queue management
 * - Confidence-based auto-approval
 * - Human review queue for low-confidence fields
 */

import { SchemaAwareMetadataExtractor } from '@/lib/ai/metadata-extractor';
import { MetadataSchemaService } from '@/lib/services/metadata-schema.service';
import type { MetadataExtractionResult, ExtractionResult } from '@/lib/ai/metadata-extractor';
import type { MetadataSchema } from '@/lib/services/metadata-schema.service';

// ============================================================================
// Types
// ============================================================================

export interface AutoPopulateConfig {
  // Confidence thresholds
  autoApproveThreshold: number; // Auto-approve fields with confidence >= this
  requireReviewThreshold: number; // Require review for fields below this
  
  // Processing options
  maxRetries: number;
  retryDelay: number; // ms
  timeout: number; // ms
  
  // Field handling
  priorityFields: string[]; // Extract these first
  skipFields: string[]; // Don't extract these
  overwriteExisting: boolean; // Overwrite existing metadata values
  
  // Notification
  notifyOnComplete: boolean;
  notifyOnReviewRequired: boolean;
}

export interface AutoPopulateResult {
  contractId: string;
  tenantId: string;
  status: 'success' | 'partial' | 'failed' | 'pending_review';
  extraction: MetadataExtractionResult;
  appliedFields: string[];
  reviewRequiredFields: string[];
  skippedFields: string[];
  errors: string[];
  processingTime: number;
}

export interface ReviewQueueItem {
  id: string;
  contractId: string;
  tenantId: string;
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  extractedValue: any;
  confidence: number;
  source: string;
  alternatives: Array<{ value: any; confidence: number }>;
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  reviewedBy?: string;
  reviewedAt?: Date;
  finalValue?: any;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_AUTO_POPULATE_CONFIG: AutoPopulateConfig = {
  autoApproveThreshold: 0.85,
  requireReviewThreshold: 0.6,
  maxRetries: 2,
  retryDelay: 1000,
  timeout: 60000,
  priorityFields: [],
  skipFields: ['status'], // Don't auto-populate status
  overwriteExisting: false,
  notifyOnComplete: true,
  notifyOnReviewRequired: true,
};

// ============================================================================
// Auto-Populate Service
// ============================================================================

export class AutoPopulateService {
  private extractor: SchemaAwareMetadataExtractor;
  private schemaService: MetadataSchemaService;
  private config: AutoPopulateConfig;
  private reviewQueue: Map<string, ReviewQueueItem[]> = new Map();

  constructor(config: Partial<AutoPopulateConfig> = {}) {
    this.extractor = new SchemaAwareMetadataExtractor();
    this.schemaService = MetadataSchemaService.getInstance();
    this.config = { ...DEFAULT_AUTO_POPULATE_CONFIG, ...config };
  }

  /**
   * Process a newly uploaded contract and extract metadata
   */
  async processContract(
    contractId: string,
    tenantId: string,
    documentText: string,
    existingMetadata?: Record<string, any>
  ): Promise<AutoPopulateResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const appliedFields: string[] = [];
    const reviewRequiredFields: string[] = [];
    const skippedFields: string[] = [];

    try {
      // Get tenant's schema
      const schema = await this.schemaService.getSchema(tenantId);

      // Determine which fields to extract
      const fieldsToExtract = this.getFieldsToExtract(
        schema,
        existingMetadata
      );

      if (fieldsToExtract.length === 0) {
        return {
          contractId,
          tenantId,
          status: 'success',
          extraction: this.createEmptyExtractionResult(schema),
          appliedFields: [],
          reviewRequiredFields: [],
          skippedFields: schema.fields.map(f => f.name),
          errors: [],
          processingTime: Date.now() - startTime,
        };
      }

      // Create filtered schema with only fields to extract
      const filteredSchema = {
        ...schema,
        fields: schema.fields.filter(f => fieldsToExtract.includes(f.id)),
      };

      // Extract metadata with retry logic
      let extraction: MetadataExtractionResult | null = null;
      let retries = 0;

      while (!extraction && retries <= this.config.maxRetries) {
        try {
          extraction = await this.extractor.extractMetadata(
            documentText,
            filteredSchema,
            {
              maxPasses: 2,
              enableMultiPass: true,
              confidenceThreshold: this.config.requireReviewThreshold,
              priorityFields: this.config.priorityFields,
            }
          );
        } catch (error) {
          retries++;
          if (retries <= this.config.maxRetries) {
            await this.delay(this.config.retryDelay * retries);
          } else {
            throw error;
          }
        }
      }

      if (!extraction) {
        throw new Error('Extraction failed after retries');
      }

      // Process results
      for (const result of extraction.results) {
        if (result.value === null || result.value === undefined) {
          skippedFields.push(result.fieldName);
          continue;
        }

        if (result.confidence >= this.config.autoApproveThreshold) {
          // High confidence - auto-approve
          appliedFields.push(result.fieldName);
        } else if (result.confidence >= this.config.requireReviewThreshold) {
          // Medium confidence - add to review queue
          reviewRequiredFields.push(result.fieldName);
          this.addToReviewQueue(contractId, tenantId, result);
        } else {
          // Low confidence - skip but log
          skippedFields.push(result.fieldName);
          errors.push(`Low confidence (${Math.round(result.confidence * 100)}%) for ${result.fieldLabel}`);
        }
      }

      // Apply high-confidence fields
      if (appliedFields.length > 0) {
        await this.applyMetadata(
          contractId,
          tenantId,
          extraction.results.filter(r => appliedFields.includes(r.fieldName))
        );
      }

      // Determine overall status
      let status: AutoPopulateResult['status'];
      if (errors.length > 0 && appliedFields.length === 0) {
        status = 'failed';
      } else if (reviewRequiredFields.length > 0) {
        status = 'pending_review';
      } else if (appliedFields.length < extraction.results.length) {
        status = 'partial';
      } else {
        status = 'success';
      }

      // Send notifications if configured
      if (this.config.notifyOnComplete && status === 'success') {
        await this.sendNotification('complete', contractId, tenantId, appliedFields.length);
      }
      if (this.config.notifyOnReviewRequired && reviewRequiredFields.length > 0) {
        await this.sendNotification('review_required', contractId, tenantId, reviewRequiredFields.length);
      }

      return {
        contractId,
        tenantId,
        status,
        extraction,
        appliedFields,
        reviewRequiredFields,
        skippedFields,
        errors,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error('Auto-populate error:', error);
      return {
        contractId,
        tenantId,
        status: 'failed',
        extraction: this.createEmptyExtractionResult(null),
        appliedFields: [],
        reviewRequiredFields: [],
        skippedFields: [],
        errors: [(error as Error).message],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get fields that need to be extracted
   */
  private getFieldsToExtract(
    schema: MetadataSchema,
    existingMetadata?: Record<string, any>
  ): string[] {
    return schema.fields
      .filter(field => {
        // Skip if in skip list
        if (this.config.skipFields.includes(field.id) || 
            this.config.skipFields.includes(field.name)) {
          return false;
        }

        // Skip if AI extraction not enabled
        if (!field.aiExtractionEnabled) {
          return false;
        }

        // Skip if hidden
        if (field.hidden) {
          return false;
        }

        // Skip if existing value and not overwriting
        if (!this.config.overwriteExisting && existingMetadata) {
          const existingValue = existingMetadata[field.name];
          if (existingValue !== null && existingValue !== undefined && existingValue !== '') {
            return false;
          }
        }

        return true;
      })
      .map(f => f.id);
  }

  /**
   * Add a field to the review queue
   */
  private addToReviewQueue(
    contractId: string,
    tenantId: string,
    result: ExtractionResult
  ): void {
    const queueKey = `${tenantId}:${contractId}`;
    
    if (!this.reviewQueue.has(queueKey)) {
      this.reviewQueue.set(queueKey, []);
    }

    this.reviewQueue.get(queueKey)!.push({
      id: `${contractId}-${result.fieldId}`,
      contractId,
      tenantId,
      fieldId: result.fieldId,
      fieldName: result.fieldName,
      fieldLabel: result.fieldLabel,
      extractedValue: result.value,
      confidence: result.confidence,
      source: result.source.text,
      alternatives: result.alternatives.map(a => ({
        value: a.value,
        confidence: a.confidence,
      })),
      createdAt: new Date(),
      status: 'pending',
    });
  }

  /**
   * Get review queue for a tenant
   */
  getReviewQueue(tenantId: string, contractId?: string): ReviewQueueItem[] {
    if (contractId) {
      return this.reviewQueue.get(`${tenantId}:${contractId}`) || [];
    }

    // Get all items for tenant
    const items: ReviewQueueItem[] = [];
    for (const [key, queueItems] of this.reviewQueue) {
      if (key.startsWith(`${tenantId}:`)) {
        items.push(...queueItems);
      }
    }
    return items;
  }

  /**
   * Process a review decision
   */
  async processReview(
    tenantId: string,
    contractId: string,
    fieldId: string,
    decision: 'approve' | 'reject' | 'modify',
    modifiedValue?: any,
    reviewedBy?: string
  ): Promise<boolean> {
    const queueKey = `${tenantId}:${contractId}`;
    const queue = this.reviewQueue.get(queueKey);
    
    if (!queue) return false;

    const itemIndex = queue.findIndex(i => i.fieldId === fieldId);
    if (itemIndex === -1) return false;

    const item = queue[itemIndex];
    if (!item) return false;
    
    // Update item
    item.status = decision === 'approve' ? 'approved' : 
                  decision === 'reject' ? 'rejected' : 'modified';
    item.reviewedAt = new Date();
    item.reviewedBy = reviewedBy;
    
    if (decision === 'modify') {
      item.finalValue = modifiedValue;
    } else if (decision === 'approve') {
      item.finalValue = item.extractedValue;
    }

    // If approved or modified, apply the value
    if (decision !== 'reject' && item.finalValue !== undefined) {
      await this.applySingleField(
        contractId,
        tenantId,
        item.fieldName,
        item.finalValue
      );
    }

    // Remove from queue
    queue.splice(itemIndex, 1);
    if (queue.length === 0) {
      this.reviewQueue.delete(queueKey);
    }

    return true;
  }

  /**
   * Apply extracted metadata to contract
   */
  private async applyMetadata(
    contractId: string,
    tenantId: string,
    results: ExtractionResult[]
  ): Promise<void> {
    try {
      const { prisma } = await import('@/lib/prisma');
      
      const existing = await prisma.contractMetadata.findUnique({
        where: { contractId },
      });

      const now = new Date();
      const appliedFields: Record<string, any> = {};
      const fieldConfidences: Record<string, any> = {};

      for (const result of results) {
        appliedFields[result.fieldName] = result.value;
        fieldConfidences[result.fieldName] = {
          confidence: result.confidence,
          source: 'ai-auto',
          appliedAt: now.toISOString(),
        };
      }

      const customFields = {
        ...(existing?.customFields as any || {}),
        ...appliedFields,
        _autoPopulate: {
          lastRun: now.toISOString(),
          fieldsApplied: Object.keys(appliedFields),
          fieldConfidences,
        },
      };

      if (existing) {
        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            customFields,
            lastUpdated: now,
            updatedBy: 'auto-populate',
          },
        });
      } else {
        await prisma.contractMetadata.create({
          data: {
            contractId,
            tenantId,
            customFields,
            systemFields: {},
            tags: [],
            lastUpdated: now,
            updatedBy: 'auto-populate',
          },
        });
      }

      console.log(`✅ Auto-applied ${Object.keys(appliedFields).length} fields to contract ${contractId}`);
    } catch (error) {
      console.error('Error applying metadata:', error);
      throw error;
    }
  }

  /**
   * Apply a single field value
   */
  private async applySingleField(
    contractId: string,
    tenantId: string,
    fieldName: string,
    value: any
  ): Promise<void> {
    try {
      const { prisma } = await import('@/lib/prisma');
      
      const existing = await prisma.contractMetadata.findUnique({
        where: { contractId },
      });

      const now = new Date();
      const customFields = {
        ...(existing?.customFields as any || {}),
        [fieldName]: value,
        _fieldValidations: {
          ...(existing?.customFields as any)?._fieldValidations || {},
          [fieldName]: {
            status: 'human-validated',
            validatedAt: now.toISOString(),
          },
        },
      };

      if (existing) {
        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            customFields,
            lastUpdated: now,
            updatedBy: 'human-review',
          },
        });
      }

      console.log(`✅ Applied reviewed field "${fieldName}" to contract ${contractId}`);
    } catch (error) {
      console.error('Error applying single field:', error);
      throw error;
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(
    type: 'complete' | 'review_required',
    contractId: string,
    tenantId: string,
    fieldCount: number
  ): Promise<void> {
    // TODO: Implement actual notification system
    // This could integrate with email, Slack, in-app notifications, etc.
    console.log(`📬 Notification: ${type} for contract ${contractId} - ${fieldCount} fields`);
  }

  /**
   * Create empty extraction result
   */
  private createEmptyExtractionResult(schema: MetadataSchema | null): MetadataExtractionResult {
    return {
      schemaId: schema?.id || 'unknown',
      schemaVersion: schema?.version || 0,
      extractedAt: new Date(),
      results: [],
      summary: {
        totalFields: 0,
        extractedFields: 0,
        highConfidenceFields: 0,
        lowConfidenceFields: 0,
        failedFields: 0,
        averageConfidence: 0,
        extractionTime: 0,
        passesCompleted: 0,
      },
      rawExtractions: {},
      warnings: [],
      processingNotes: [],
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let autoPopulateInstance: AutoPopulateService | null = null;

export function getAutoPopulateService(config?: Partial<AutoPopulateConfig>): AutoPopulateService {
  if (!autoPopulateInstance) {
    autoPopulateInstance = new AutoPopulateService(config);
  }
  return autoPopulateInstance;
}

/**
 * Convenience function to auto-populate a contract
 */
export async function autoPopulateContract(
  contractId: string,
  tenantId: string,
  documentText: string,
  existingMetadata?: Record<string, any>,
  config?: Partial<AutoPopulateConfig>
): Promise<AutoPopulateResult> {
  const service = getAutoPopulateService(config);
  return service.processContract(contractId, tenantId, documentText, existingMetadata);
}
