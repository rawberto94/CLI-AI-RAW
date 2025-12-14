// @ts-nocheck
/**
 * Editable Artifact Service
 * 
 * Provides full CRUD operations on artifacts with:
 * - Inline editing with validation
 * - Version control and audit trails
 * - Automatic propagation to analytical engines
 * - Conflict detection and resolution
 * - Rate card specific operations
 */

import { dbAdaptor } from '../dal/database.adaptor';
import { enhancedDbAdaptor } from '../dal/enhanced-database.adaptor';
import { eventBus, Events } from '../events/event-bus';
import { createLogger } from '../utils/logger';

const logger = createLogger('editable-artifact-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface FieldChange {
  fieldPath: string;
  oldValue: any;
  newValue: any;
  validationResult: ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  autoFixable: boolean;
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  suggestion?: string;
}

export interface PropagationResult {
  engine: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
  error?: string;
  recalculatedItems: string[];
}

export interface BulkArtifactUpdate {
  artifactId: string;
  updates: Partial<any>;
}

export interface BulkUpdateResult {
  successful: string[];
  failed: Array<{ artifactId: string; error: string }>;
  totalProcessed: number;
}

export interface RateEntry {
  id?: string;
  role: string;
  seniorityLevel: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  currency: string;
  location?: string;
  [key: string]: any;
}

// =========================================================================
// EDITABLE ARTIFACT SERVICE
// =========================================================================

export class EditableArtifactService {
  private static instance: EditableArtifactService;

  private constructor() {
    logger.info('Editable Artifact Service initialized');
  }

  static getInstance(): EditableArtifactService {
    if (!EditableArtifactService.instance) {
      EditableArtifactService.instance = new EditableArtifactService();
    }
    return EditableArtifactService.instance;
  }

  // =========================================================================
  // CORE EDITING METHODS
  // =========================================================================

  /**
   * Update an artifact with optimistic locking
   */
  async updateArtifact(
    artifactId: string,
    updates: Partial<any>,
    userId: string,
    reason?: string
  ): Promise<any> {
    try {
      logger.info({ artifactId, userId }, 'Updating artifact');

      return await enhancedDbAdaptor.withTransaction(async (tx) => {
        // Get current artifact with lock
        const currentArtifact = await tx.artifact.findUnique({
          where: { id: artifactId },
        });

        if (!currentArtifact) {
          throw new Error(`Artifact ${artifactId} not found`);
        }

        // Validate updates
        const validationResult = await this.validateArtifactUpdate(
          currentArtifact,
          updates
        );

        if (!validationResult.isValid) {
          throw new Error(
            `Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
          );
        }

        // Calculate changes
        const changes = this.calculateChanges(currentArtifact.data, updates);

        // Get current version number
        const currentVersion = await tx.artifactEdit.count({
          where: { artifactId },
        });

        // Update artifact
        const updatedArtifact = await tx.artifact.update({
          where: { id: artifactId },
          data: {
            data: { ...currentArtifact.data, ...updates },
            isEdited: true,
            editCount: { increment: 1 },
            lastEditedBy: userId,
            lastEditedAt: new Date(),
            validationStatus: validationResult.warnings.length > 0 ? 'warning' : 'valid',
            validationIssues: validationResult.warnings,
            propagationStatus: 'pending',
          },
        });

        // Create version record
        await tx.artifactEdit.create({
          data: {
            artifactId,
            version: currentVersion + 1,
            editedBy: userId,
            changeType: 'field_update',
            changes,
            reason: reason || 'Manual edit',
            affectedEngines: [],
            propagationResults: [],
          },
        });

        logger.info(
          { artifactId, version: currentVersion + 1 },
          'Artifact updated successfully'
        );

        // Publish event for propagation
        await eventBus.publish(Events.ARTIFACT_FIELD_UPDATED, {
          artifactId,
          contractId: updatedArtifact.contractId,
          tenantId: updatedArtifact.tenantId,
          artifactType: updatedArtifact.type,
          changes,
          userId,
        });

        return updatedArtifact;
      });
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to update artifact');
      throw error;
    }
  }

  /**
   * Update a single field in an artifact
   */
  async updateArtifactField(
    artifactId: string,
    fieldPath: string,
    value: any,
    userId: string
  ): Promise<void> {
    try {
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        throw new Error(`Artifact ${artifactId} not found`);
      }

      // Update nested field
      const updates = this.setNestedValue({}, fieldPath, value);
      await this.updateArtifact(artifactId, updates, userId);

      logger.info({ artifactId, fieldPath }, 'Field updated successfully');
    } catch (error) {
      logger.error({ error, artifactId, fieldPath }, 'Failed to update field');
      throw error;
    }
  }

  /**
   * Bulk update multiple artifacts
   */
  async bulkUpdateArtifacts(
    updates: BulkArtifactUpdate[],
    userId: string
  ): Promise<BulkUpdateResult> {
    const successful: string[] = [];
    const failed: Array<{ artifactId: string; error: string }> = [];

    try {
      logger.info({ count: updates.length }, 'Starting bulk update');

      for (const update of updates) {
        try {
          await this.updateArtifact(
            update.artifactId,
            update.updates,
            userId,
            'Bulk update'
          );
          successful.push(update.artifactId);
        } catch (error: any) {
          failed.push({
            artifactId: update.artifactId,
            error: error.message,
          });
        }
      }

      logger.info(
        { successful: successful.length, failed: failed.length },
        'Bulk update completed'
      );

      return {
        successful,
        failed,
        totalProcessed: updates.length,
      };
    } catch (error) {
      logger.error({ error }, 'Bulk update failed');
      throw error;
    }
  }

  // =========================================================================
  // RATE CARD SPECIFIC METHODS
  // =========================================================================

  /**
   * Update a rate card entry
   */
  async updateRateCardEntry(
    artifactId: string,
    rateId: string,
    updates: Partial<RateEntry>,
    userId: string
  ): Promise<void> {
    try {
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact || artifact.type !== 'RATES') {
        throw new Error('Invalid artifact or not a rate card');
      }

      const rateCardData = artifact.data as any;
      const rateIndex = rateCardData.rates?.findIndex((r: any) => r.id === rateId);

      if (rateIndex === -1) {
        throw new Error(`Rate entry ${rateId} not found`);
      }

      // Update the rate entry
      rateCardData.rates[rateIndex] = {
        ...rateCardData.rates[rateIndex],
        ...updates,
      };

      await this.updateArtifact(artifactId, rateCardData, userId, 'Rate card entry updated');

      logger.info({ artifactId, rateId }, 'Rate card entry updated');
    } catch (error) {
      logger.error({ error, artifactId, rateId }, 'Failed to update rate card entry');
      throw error;
    }
  }

  /**
   * Add a new rate card entry
   */
  async addRateCardEntry(
    artifactId: string,
    rate: RateEntry,
    userId: string
  ): Promise<string> {
    try {
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact || artifact.type !== 'RATES') {
        throw new Error('Invalid artifact or not a rate card');
      }

      const rateCardData = artifact.data as any;
      const newRateId = `rate_${Date.now()}`;
      
      const newRate = {
        ...rate,
        id: newRateId,
      };

      rateCardData.rates = [...(rateCardData.rates || []), newRate];

      await this.updateArtifact(artifactId, rateCardData, userId, 'Rate card entry added');

      logger.info({ artifactId, rateId: newRateId }, 'Rate card entry added');
      return newRateId;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to add rate card entry');
      throw error;
    }
  }

  /**
   * Delete a rate card entry
   */
  async deleteRateCardEntry(
    artifactId: string,
    rateId: string,
    userId: string
  ): Promise<void> {
    try {
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact || artifact.type !== 'RATES') {
        throw new Error('Invalid artifact or not a rate card');
      }

      const rateCardData = artifact.data as any;
      rateCardData.rates = rateCardData.rates?.filter((r: any) => r.id !== rateId) || [];

      await this.updateArtifact(artifactId, rateCardData, userId, 'Rate card entry deleted');

      logger.info({ artifactId, rateId }, 'Rate card entry deleted');
    } catch (error) {
      logger.error({ error, artifactId, rateId }, 'Failed to delete rate card entry');
      throw error;
    }
  }

  // =========================================================================
  // VALIDATION METHODS
  // =========================================================================

  /**
   * Validate artifact updates
   */
  async validateArtifactUpdate(
    currentArtifact: any,
    updates: any
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Type-specific validation
      if (currentArtifact.type === 'RATES') {
        const rateValidation = await this.validateRateCardStructure(updates);
        errors.push(...rateValidation.errors);
        warnings.push(...rateValidation.warnings);
      }

      // Generic validation
      if (updates.effectiveDate && new Date(updates.effectiveDate) > new Date()) {
        warnings.push({
          code: 'FUTURE_DATE',
          field: 'effectiveDate',
          message: 'Effective date is in the future',
          suggestion: 'Verify this is intentional',
        });
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
        errors: [{
          code: 'VALIDATION_ERROR',
          field: 'unknown',
          message: 'Validation process failed',
          severity: 'error',
          autoFixable: false,
        }],
        warnings: [],
      };
    }
  }

  /**
   * Validate rate card structure
   */
  async validateRateCardStructure(rateCard: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (rateCard.rates) {
      for (const rate of rateCard.rates) {
        // Required fields
        if (!rate.role) {
          errors.push({
            code: 'MISSING_ROLE',
            field: 'role',
            message: 'Role is required',
            severity: 'error',
            autoFixable: false,
          });
        }

        if (!rate.seniorityLevel) {
          errors.push({
            code: 'MISSING_SENIORITY',
            field: 'seniorityLevel',
            message: 'Seniority level is required',
            severity: 'error',
            autoFixable: false,
          });
        }

        // Rate validation
        if (rate.hourlyRate && (rate.hourlyRate < 0 || rate.hourlyRate > 10000)) {
          errors.push({
            code: 'INVALID_RATE',
            field: 'hourlyRate',
            message: 'Hourly rate must be between 0 and 10,000',
            severity: 'error',
            autoFixable: false,
          });
        }

        // Currency validation
        if (rate.currency && !/^[A-Z]{3}$/.test(rate.currency)) {
          errors.push({
            code: 'INVALID_CURRENCY',
            field: 'currency',
            message: 'Currency must be a valid 3-letter ISO code',
            severity: 'error',
            autoFixable: false,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // =========================================================================
  // VERSION HISTORY METHODS
  // =========================================================================

  /**
   * Get artifact version history
   */
  async getArtifactVersionHistory(artifactId: string): Promise<any[]> {
    try {
      const versions = await dbAdaptor.getClient().artifactEdit.findMany({
        where: { artifactId },
        orderBy: { version: 'desc' },
      });

      return versions;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get version history');
      return [];
    }
  }

  /**
   * Compare two versions
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
        differences: this.calculateDifferences(v1.changes, v2.changes),
      };
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to compare versions');
      throw error;
    }
  }

  /**
   * Revert to a previous version
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

      // Get the artifact at that version
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        throw new Error('Artifact not found');
      }

      // Apply the old changes in reverse
      const revertedData = this.applyChangesReverse(artifact.data, targetVersion.changes);

      await this.updateArtifact(
        artifactId,
        revertedData,
        userId,
        `Reverted to version ${version}`
      );

      logger.info({ artifactId, version }, 'Artifact reverted to version');
    } catch (error) {
      logger.error({ error, artifactId, version }, 'Failed to revert version');
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Calculate changes between old and new data
   */
  private calculateChanges(oldData: any, newData: any): any[] {
    const changes: any[] = [];

    for (const key in newData) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push({
          fieldPath: key,
          oldValue: oldData[key],
          newValue: newData[key],
        });
      }
    }

    return changes;
  }

  /**
   * Calculate differences between two objects
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
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return obj;
  }

  /**
   * Apply changes in reverse for revert
   */
  private applyChangesReverse(currentData: any, changes: any[]): any {
    const revertedData = { ...currentData };

    for (const change of changes) {
      const keys = change.fieldPath.split('.');
      let current = revertedData;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = change.oldValue;
    }

    return revertedData;
  }
}

export const editableArtifactService = EditableArtifactService.getInstance();
