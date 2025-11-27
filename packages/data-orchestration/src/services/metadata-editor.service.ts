// @ts-nocheck
/**
 * Metadata Editor Service
 * 
 * Extends TaxonomyService with editing capabilities and propagation support
 * - Update contract metadata with validation
 * - Manage tags with autocomplete
 * - Handle custom fields
 * - Trigger search index and RAG updates
 */

import { dbAdaptor } from '../dal/database.adaptor';
import { eventBus, Events } from '../events/event-bus';
import { taxonomyService } from './taxonomy.service';
import pino from 'pino';

const logger = pino({ name: 'metadata-editor-service' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface MetadataUpdateRequest {
  contractId: string;
  tenantId: string;
  categoryId?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  systemFields?: Record<string, any>;
  userId: string;
}

export interface BulkMetadataUpdate {
  contractIds: string[];
  updates: Partial<MetadataUpdateRequest>;
  userId: string;
}

export interface TagSuggestion {
  tag: string;
  score: number;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

// =========================================================================
// METADATA EDITOR SERVICE
// =========================================================================

export class MetadataEditorService {
  private static instance: MetadataEditorService;

  private constructor() {
    logger.info('Metadata Editor Service initialized');
  }

  static getInstance(): MetadataEditorService {
    if (!MetadataEditorService.instance) {
      MetadataEditorService.instance = new MetadataEditorService();
    }
    return MetadataEditorService.instance;
  }

  // =========================================================================
  // METADATA UPDATE METHODS
  // =========================================================================

  /**
   * Update contract metadata with propagation
   */
  async updateContractMetadata(
    request: MetadataUpdateRequest
  ): Promise<any> {
    try {
      logger.info(
        { contractId: request.contractId, userId: request.userId },
        'Updating contract metadata'
      );

      // Validate updates
      const validation = await this.validateMetadataUpdate(request);
      if (!validation.isValid) {
        throw new Error(
          `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        );
      }

      // Get existing metadata
      const existing = await dbAdaptor.getClient().contractMetadata.findUnique({
        where: { contractId: request.contractId },
      });

      // Prepare update data
      const updateData: any = {
        lastUpdated: new Date(),
        updatedBy: request.userId,
      };

      if (request.categoryId !== undefined) {
        updateData.categoryId = request.categoryId;
      }

      if (request.tags !== undefined) {
        updateData.tags = request.tags;
      }

      if (request.customFields !== undefined) {
        updateData.customFields = {
          ...(existing?.customFields as any || {}),
          ...request.customFields,
        };
      }

      if (request.systemFields !== undefined) {
        updateData.systemFields = {
          ...(existing?.systemFields as any || {}),
          ...request.systemFields,
        };
      }

      // Update or create metadata
      const metadata = existing
        ? await dbAdaptor.getClient().contractMetadata.update({
            where: { contractId: request.contractId },
            data: updateData,
          })
        : await dbAdaptor.getClient().contractMetadata.create({
            data: {
              contractId: request.contractId,
              tenantId: request.tenantId,
              categoryId: request.categoryId,
              tags: request.tags || [],
              customFields: request.customFields || {},
              systemFields: request.systemFields || {},
              updatedBy: request.userId,
            },
          });

      // Trigger propagation
      await this.propagateMetadataChanges(request.contractId, request.tenantId);

      // Publish event
      await eventBus.publish(Events.CONTRACT_METADATA_UPDATED, {
        contractId: request.contractId,
        tenantId: request.tenantId,
        userId: request.userId,
        changes: updateData,
      });

      logger.info(
        { contractId: request.contractId },
        'Contract metadata updated successfully'
      );

      return metadata;
    } catch (error) {
      logger.error({ error, request }, 'Failed to update contract metadata');
      throw error;
    }
  }

  /**
   * Bulk update metadata for multiple contracts
   */
  async bulkUpdateMetadata(
    request: BulkMetadataUpdate
  ): Promise<{ successful: string[]; failed: Array<{ contractId: string; error: string }> }> {
    const successful: string[] = [];
    const failed: Array<{ contractId: string; error: string }> = [];

    try {
      logger.info(
        { count: request.contractIds.length, userId: request.userId },
        'Starting bulk metadata update'
      );

      for (const contractId of request.contractIds) {
        try {
          await this.updateContractMetadata({
            contractId,
            tenantId: request.updates.tenantId!,
            categoryId: request.updates.categoryId,
            tags: request.updates.tags,
            customFields: request.updates.customFields,
            systemFields: request.updates.systemFields,
            userId: request.userId,
          });
          successful.push(contractId);
        } catch (error: any) {
          failed.push({
            contractId,
            error: error.message,
          });
        }
      }

      logger.info(
        { successful: successful.length, failed: failed.length },
        'Bulk metadata update completed'
      );

      return { successful, failed };
    } catch (error) {
      logger.error({ error }, 'Bulk metadata update failed');
      throw error;
    }
  }

  // =========================================================================
  // TAG MANAGEMENT
  // =========================================================================

  /**
   * Add tags to a contract
   */
  async addTags(
    contractId: string,
    tenantId: string,
    tags: string[],
    userId: string
  ): Promise<void> {
    try {
      const metadata = await dbAdaptor.getClient().contractMetadata.findUnique({
        where: { contractId },
      });

      if (!metadata) {
        throw new Error('Contract metadata not found');
      }

      // Merge with existing tags (remove duplicates)
      const existingTags = metadata.tags || [];
      const newTags = Array.from(new Set([...existingTags, ...tags]));

      await this.updateContractMetadata({
        contractId,
        tenantId,
        tags: newTags,
        userId,
      });

      logger.info({ contractId, tags }, 'Tags added to contract');
    } catch (error) {
      logger.error({ error, contractId, tags }, 'Failed to add tags');
      throw error;
    }
  }

  /**
   * Remove a tag from a contract
   */
  async removeTag(
    contractId: string,
    tenantId: string,
    tagName: string,
    userId: string
  ): Promise<void> {
    try {
      const metadata = await dbAdaptor.getClient().contractMetadata.findUnique({
        where: { contractId },
      });

      if (!metadata) {
        throw new Error('Contract metadata not found');
      }

      const updatedTags = (metadata.tags || []).filter(t => t !== tagName);

      await this.updateContractMetadata({
        contractId,
        tenantId,
        tags: updatedTags,
        userId,
      });

      logger.info({ contractId, tagName }, 'Tag removed from contract');
    } catch (error) {
      logger.error({ error, contractId, tagName }, 'Failed to remove tag');
      throw error;
    }
  }

  /**
   * Get tag suggestions based on contract content
   */
  async getTagSuggestions(
    contractId: string,
    tenantId: string
  ): Promise<TagSuggestion[]> {
    try {
      // Get contract data
      const contract = await dbAdaptor.getClient().contract.findUnique({
        where: { id: contractId },
        include: { artifacts: true },
      });

      if (!contract) {
        return [];
      }

      const suggestions: TagSuggestion[] = [];

      // Suggest based on contract type
      if (contract.contractType) {
        suggestions.push({
          tag: contract.contractType.toLowerCase(),
          score: 0.9,
          reason: 'Based on contract type',
        });
      }

      // Suggest based on supplier
      if (contract.supplierName) {
        suggestions.push({
          tag: contract.supplierName.toLowerCase().replace(/\s+/g, '-'),
          score: 0.8,
          reason: 'Based on supplier name',
        });
      }

      // Suggest based on category
      if (contract.category) {
        suggestions.push({
          tag: contract.category.toLowerCase(),
          score: 0.85,
          reason: 'Based on category',
        });
      }

      // Get popular tags from similar contracts
      const similarTags = await this.getSimilarContractTags(tenantId, contract.contractType);
      suggestions.push(...similarTags);

      // Sort by score and return top 10
      return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to get tag suggestions');
      return [];
    }
  }

  /**
   * Get autocomplete suggestions for tags
   */
  async getTagAutocomplete(
    tenantId: string,
    query: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      // Get all tags for tenant
      const tagsResult = await taxonomyService.getTags(tenantId);
      if (!tagsResult.success || !tagsResult.data) {
        return [];
      }

      // Filter by query
      const filtered = tagsResult.data
        .filter(tag => tag.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.usage.contractCount - a.usage.contractCount)
        .slice(0, limit)
        .map(tag => tag.name);

      return filtered;
    } catch (error) {
      logger.error({ error, query }, 'Failed to get tag autocomplete');
      return [];
    }
  }

  // =========================================================================
  // CUSTOM FIELD MANAGEMENT
  // =========================================================================

  /**
   * Update a custom field value
   */
  async updateCustomField(
    contractId: string,
    tenantId: string,
    fieldName: string,
    value: any,
    userId: string
  ): Promise<void> {
    try {
      const metadata = await dbAdaptor.getClient().contractMetadata.findUnique({
        where: { contractId },
      });

      if (!metadata) {
        throw new Error('Contract metadata not found');
      }

      const customFields = {
        ...(metadata.customFields as any || {}),
        [fieldName]: value,
      };

      await this.updateContractMetadata({
        contractId,
        tenantId,
        customFields,
        userId,
      });

      logger.info({ contractId, fieldName }, 'Custom field updated');
    } catch (error) {
      logger.error({ error, contractId, fieldName }, 'Failed to update custom field');
      throw error;
    }
  }

  /**
   * Delete a custom field
   */
  async deleteCustomField(
    contractId: string,
    tenantId: string,
    fieldName: string,
    userId: string
  ): Promise<void> {
    try {
      const metadata = await dbAdaptor.getClient().contractMetadata.findUnique({
        where: { contractId },
      });

      if (!metadata) {
        throw new Error('Contract metadata not found');
      }

      const customFields = { ...(metadata.customFields as any || {}) };
      delete customFields[fieldName];

      await this.updateContractMetadata({
        contractId,
        tenantId,
        customFields,
        userId,
      });

      logger.info({ contractId, fieldName }, 'Custom field deleted');
    } catch (error) {
      logger.error({ error, contractId, fieldName }, 'Failed to delete custom field');
      throw error;
    }
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Validate metadata update
   */
  async validateMetadataUpdate(
    request: MetadataUpdateRequest
  ): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    try {
      // Validate tags format
      if (request.tags) {
        for (const tag of request.tags) {
          if (!/^[a-z0-9-]+$/.test(tag)) {
            errors.push({
              field: 'tags',
              message: `Invalid tag format: ${tag}. Tags must be lowercase alphanumeric with hyphens.`,
            });
          }
        }

        // Check for duplicates
        const uniqueTags = new Set(request.tags);
        if (uniqueTags.size !== request.tags.length) {
          warnings.push({
            field: 'tags',
            message: 'Duplicate tags will be removed',
          });
        }
      }

      // Validate custom fields against schema
      if (request.customFields) {
        const fieldsResult = await taxonomyService.getMetadataFields(request.tenantId);
        if (fieldsResult.success && fieldsResult.data) {
          for (const [fieldName, value] of Object.entries(request.customFields)) {
            const fieldDef = fieldsResult.data.find(f => f.name === fieldName);
            if (fieldDef) {
              const fieldValidation = this.validateFieldValue(fieldDef, value);
              errors.push(...fieldValidation.errors);
              warnings.push(...fieldValidation.warnings);
            }
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error({ error }, 'Validation failed');
      return {
        isValid: false,
        errors: [{ field: 'unknown', message: 'Validation process failed' }],
        warnings: [],
      };
    }
  }

  /**
   * Validate a field value against its definition
   */
  private validateFieldValue(
    fieldDef: any,
    value: any
  ): { errors: Array<{ field: string; message: string }>; warnings: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Type validation
    if (fieldDef.type === 'number' && typeof value !== 'number') {
      errors.push({
        field: fieldDef.name,
        message: `Field ${fieldDef.name} must be a number`,
      });
    }

    if (fieldDef.type === 'date' && !(value instanceof Date) && isNaN(Date.parse(value))) {
      errors.push({
        field: fieldDef.name,
        message: `Field ${fieldDef.name} must be a valid date`,
      });
    }

    // Range validation
    if (fieldDef.validation?.min !== undefined && value < fieldDef.validation.min) {
      errors.push({
        field: fieldDef.name,
        message: `Field ${fieldDef.name} must be at least ${fieldDef.validation.min}`,
      });
    }

    if (fieldDef.validation?.max !== undefined && value > fieldDef.validation.max) {
      errors.push({
        field: fieldDef.name,
        message: `Field ${fieldDef.name} must be at most ${fieldDef.validation.max}`,
      });
    }

    return { errors, warnings };
  }

  // =========================================================================
  // PROPAGATION
  // =========================================================================

  /**
   * Propagate metadata changes to search index and RAG
   */
  private async propagateMetadataChanges(
    contractId: string,
    tenantId: string
  ): Promise<void> {
    try {
      logger.info({ contractId }, 'Propagating metadata changes');

      // Update search index
      try {
        const { contractIndexingService } = await import('./contract-indexing.service');
        await contractIndexingService.indexContract(contractId);
      } catch (error) {
        logger.error({ error, contractId }, 'Failed to update search index');
      }

      // Update RAG knowledge base
      try {
        const { ragIntegrationService } = await import('./rag-integration.service');
        await ragIntegrationService.reindexContract(contractId);
      } catch (error) {
        logger.error({ error, contractId }, 'Failed to update RAG');
      }

      // Update metadata summary in contract_metadata
      await this.updateMetadataSummary(contractId);

      logger.info({ contractId }, 'Metadata changes propagated');
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to propagate metadata changes');
      // Don't throw - propagation failures shouldn't stop the update
    }
  }

  /**
   * Update artifact summary in metadata
   */
  private async updateMetadataSummary(contractId: string): Promise<void> {
    try {
      const artifacts = await dbAdaptor.getClient().artifact.findMany({
        where: { contractId },
      });

      const summary = {
        totalArtifacts: artifacts.length,
        editedArtifacts: artifacts.filter(a => a.isEdited).length,
        validationStatus: this.calculateOverallValidationStatus(artifacts),
        lastArtifactUpdate: artifacts.reduce((latest, a) => {
          return a.updatedAt > latest ? a.updatedAt : latest;
        }, new Date(0)),
      };

      await dbAdaptor.getClient().contractMetadata.update({
        where: { contractId },
        data: {
          artifactSummary: summary,
          analyticsUpdatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to update metadata summary');
    }
  }

  /**
   * Calculate overall validation status from artifacts
   */
  private calculateOverallValidationStatus(artifacts: any[]): string {
    const hasErrors = artifacts.some(a => a.validationStatus === 'error');
    const hasWarnings = artifacts.some(a => a.validationStatus === 'warning');

    if (hasErrors) return 'has_errors';
    if (hasWarnings) return 'has_warnings';
    return 'all_valid';
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get tags from similar contracts
   */
  private async getSimilarContractTags(
    tenantId: string,
    contractType?: string
  ): Promise<TagSuggestion[]> {
    try {
      if (!contractType) return [];

      // Find contracts with same type
      const similarContracts = await dbAdaptor.getClient().contract.findMany({
        where: {
          tenantId,
          contractType,
        },
        include: {
          contractMetadata: true,
        },
        take: 10,
      });

      // Count tag frequency
      const tagCounts = new Map<string, number>();
      for (const contract of similarContracts) {
        const tags = contract.contractMetadata?.tags || [];
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // Convert to suggestions
      const suggestions: TagSuggestion[] = [];
      for (const [tag, count] of tagCounts.entries()) {
        suggestions.push({
          tag,
          score: Math.min(0.7, count / similarContracts.length),
          reason: `Used in ${count} similar contracts`,
        });
      }

      return suggestions;
    } catch (error) {
      logger.error({ error }, 'Failed to get similar contract tags');
      return [];
    }
  }
}

export const metadataEditorService = MetadataEditorService.getInstance();
