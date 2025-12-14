/**
 * Artifact Versioning Service
 * 
 * Manages artifact versions with:
 * - Version creation and tracking
 * - Version history retrieval
 * - Version comparison and diff generation
 * - Version revert capability
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';
import { dbAdaptor } from '../dal/database.adaptor';
import { eventBus, Events } from '../events/event-bus';

const logger = createLogger('artifact-versioning-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  contractId: string;
  tenantId: string;
  versionNumber: number;
  type: string;
  data: any;
  schemaVersion: string;
  hash?: string;
  confidence?: number;
  processingTime?: number;
  size?: number;
  
  // Version metadata
  parentVersionId?: string;
  changeSummary?: string;
  changeReason?: string;
  changedFields?: string[];
  
  // Audit fields
  createdBy?: string;
  createdAt: Date;
  isActive: boolean;
  supersededAt?: Date;
  supersededBy?: string;
}

export interface VersionDiff {
  versionA: number;
  versionB: number;
  addedFields: string[];
  removedFields: string[];
  modifiedFields: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'value' | 'type' | 'structure';
  }>;
  summary: string;
}

export interface CreateVersionOptions {
  changeSummary?: string;
  changeReason?: string;
  createdBy?: string;
  makeActive?: boolean;
}

// =========================================================================
// ARTIFACT VERSIONING SERVICE
// =========================================================================

export class ArtifactVersioningService {
  private static instance: ArtifactVersioningService;

  private constructor() {
    logger.info('Artifact Versioning Service initialized');
  }

  static getInstance(): ArtifactVersioningService {
    if (!ArtifactVersioningService.instance) {
      ArtifactVersioningService.instance = new ArtifactVersioningService();
    }
    return ArtifactVersioningService.instance;
  }

  // =========================================================================
  // VERSION CREATION
  // =========================================================================

  /**
   * Create a new version of an artifact
   */
  async createVersion(
    artifactId: string,
    options: CreateVersionOptions = {}
  ): Promise<{ success: boolean; version?: ArtifactVersion; error?: string }> {
    try {
      // Get current artifact
      const artifact = await dbAdaptor.getClient().artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        return {
          success: false,
          error: 'Artifact not found',
        };
      }

      // Get latest version number
      const latestVersion = await this.getLatestVersionNumber(artifactId);
      const newVersionNumber = latestVersion + 1;

      // Detect changed fields if there's a previous version
      let changedFields: string[] = [];
      if (latestVersion > 0) {
        const previousVersion = await this.getVersion(artifactId, latestVersion);
        if (previousVersion) {
          changedFields = this.detectChangedFields(previousVersion.data, artifact.data);
        }
      }

      // Create version record
      const version: ArtifactVersion = {
        id: randomUUID(),
        artifactId: artifact.id,
        contractId: artifact.contractId,
        tenantId: artifact.tenantId,
        versionNumber: newVersionNumber,
        type: artifact.type,
        data: artifact.data,
        schemaVersion: artifact.schemaVersion,
        hash: artifact.hash || undefined,
        confidence: artifact.confidence ? Number(artifact.confidence) : undefined,
        processingTime: artifact.processingTime || undefined,
        size: artifact.size || undefined,
        parentVersionId: latestVersion > 0 ? undefined : undefined, // Will be set if needed
        changeSummary: options.changeSummary,
        changeReason: options.changeReason,
        changedFields,
        createdBy: options.createdBy,
        createdAt: new Date(),
        isActive: options.makeActive !== false,
        supersededAt: undefined,
        supersededBy: undefined,
      };

      // Store version in database
      await dbAdaptor.getClient().$executeRaw`
        INSERT INTO artifact_versions (
          id, artifact_id, contract_id, tenant_id, version_number,
          type, data, schema_version, hash, confidence, processing_time, size,
          parent_version_id, change_summary, change_reason, changed_fields,
          created_by, created_at, is_active, superseded_at, superseded_by
        ) VALUES (
          ${version.id}, ${version.artifactId}, ${version.contractId}, ${version.tenantId}, ${version.versionNumber},
          ${version.type}, ${JSON.stringify(version.data)}::jsonb, ${version.schemaVersion}, 
          ${version.hash}, ${version.confidence}, ${version.processingTime}, ${version.size},
          ${version.parentVersionId}, ${version.changeSummary}, ${version.changeReason}, 
          ${JSON.stringify(version.changedFields)}::jsonb,
          ${version.createdBy}, ${version.createdAt}, ${version.isActive}, 
          ${version.supersededAt}, ${version.supersededBy}
        )
      `;

      // Update artifact timestamp
      await dbAdaptor.getClient().artifact.update({
        where: { id: artifactId },
        data: {
          updatedAt: new Date(),
        },
      });

      // If making this version active, deactivate previous versions
      if (options.makeActive !== false) {
        await this.deactivatePreviousVersions(artifactId, version.id);
      }

      // Event publishing would go here if Events.ARTIFACT_VERSIONED was defined
      logger.debug({ artifactId, versionNumber: newVersionNumber }, 'Artifact version created');

      logger.info(
        {
          artifactId,
          versionNumber: newVersionNumber,
          changedFields: changedFields.length,
        },
        'Artifact version created'
      );

      return {
        success: true,
        version,
      };
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to create artifact version');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create version from artifact update
   */
  async createVersionFromUpdate(
    artifactId: string,
    newData: any,
    options: CreateVersionOptions = {}
  ): Promise<{ success: boolean; version?: ArtifactVersion; error?: string }> {
    try {
      // Update artifact first
      const artifact = await dbAdaptor.getClient().artifact.update({
        where: { id: artifactId },
        data: {
          data: newData,
          updatedAt: new Date(),
        },
      });

      // Create version
      return await this.createVersion(artifactId, options);
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to create version from update');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // VERSION RETRIEVAL
  // =========================================================================

  /**
   * Get specific version of an artifact
   */
  async getVersion(
    artifactId: string,
    versionNumber: number
  ): Promise<ArtifactVersion | null> {
    try {
      const result = await dbAdaptor.getClient().$queryRaw<ArtifactVersion[]>`
        SELECT * FROM artifact_versions
        WHERE artifact_id = ${artifactId} AND version_number = ${versionNumber}
        LIMIT 1
      `;

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error({ error, artifactId, versionNumber }, 'Failed to get version');
      return null;
    }
  }

  /**
   * Get all versions for an artifact
   */
  async getVersionHistory(
    artifactId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ArtifactVersion[]> {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const versions = await dbAdaptor.getClient().$queryRaw<ArtifactVersion[]>`
        SELECT * FROM artifact_versions
        WHERE artifact_id = ${artifactId}
        ORDER BY version_number DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return versions;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get version history');
      return [];
    }
  }

  /**
   * Get active version for an artifact
   */
  async getActiveVersion(artifactId: string): Promise<ArtifactVersion | null> {
    try {
      const result = await dbAdaptor.getClient().$queryRaw<ArtifactVersion[]>`
        SELECT * FROM artifact_versions
        WHERE artifact_id = ${artifactId} AND is_active = true
        ORDER BY version_number DESC
        LIMIT 1
      `;

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get active version');
      return null;
    }
  }

  /**
   * Get latest version number for an artifact
   */
  async getLatestVersionNumber(artifactId: string): Promise<number> {
    try {
      const result = await dbAdaptor.getClient().$queryRaw<Array<{ max: number }>>`
        SELECT COALESCE(MAX(version_number), 0) as max
        FROM artifact_versions
        WHERE artifact_id = ${artifactId}
      `;

      return result[0]?.max || 0;
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get latest version number');
      return 0;
    }
  }

  // =========================================================================
  // VERSION COMPARISON
  // =========================================================================

  /**
   * Compare two versions of an artifact
   */
  async compareVersions(
    artifactId: string,
    versionA: number,
    versionB: number
  ): Promise<VersionDiff | null> {
    try {
      const [vA, vB] = await Promise.all([
        this.getVersion(artifactId, versionA),
        this.getVersion(artifactId, versionB),
      ]);

      if (!vA || !vB) {
        return null;
      }

      const diff = this.generateDiff(vA.data, vB.data);

      return {
        versionA,
        versionB,
        addedFields: diff.added,
        removedFields: diff.removed,
        modifiedFields: diff.modified,
        summary: this.generateDiffSummary(diff),
      };
    } catch (error) {
      logger.error({ error, artifactId, versionA, versionB }, 'Failed to compare versions');
      return null;
    }
  }

  /**
   * Generate diff between two data objects
   */
  private generateDiff(
    oldData: any,
    newData: any,
    path: string = ''
  ): {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      changeType: 'value' | 'type' | 'structure';
    }>;
  } {
    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      changeType: 'value' | 'type' | 'structure';
    }> = [];

    // Check for added and modified fields
    for (const key in newData) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in oldData)) {
        added.push(currentPath);
      } else if (typeof newData[key] !== typeof oldData[key]) {
        modified.push({
          field: currentPath,
          oldValue: oldData[key],
          newValue: newData[key],
          changeType: 'type',
        });
      } else if (typeof newData[key] === 'object' && newData[key] !== null) {
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          const nestedDiff = this.generateDiff(oldData[key], newData[key], currentPath);
          added.push(...nestedDiff.added);
          removed.push(...nestedDiff.removed);
          modified.push(...nestedDiff.modified);
        }
      } else if (oldData[key] !== newData[key]) {
        modified.push({
          field: currentPath,
          oldValue: oldData[key],
          newValue: newData[key],
          changeType: 'value',
        });
      }
    }

    // Check for removed fields
    for (const key in oldData) {
      if (!(key in newData)) {
        const currentPath = path ? `${path}.${key}` : key;
        removed.push(currentPath);
      }
    }

    return { added, removed, modified };
  }

  /**
   * Generate human-readable diff summary
   */
  private generateDiffSummary(diff: {
    added: string[];
    removed: string[];
    modified: any[];
  }): string {
    const parts: string[] = [];

    if (diff.added.length > 0) {
      parts.push(`${diff.added.length} field(s) added`);
    }
    if (diff.removed.length > 0) {
      parts.push(`${diff.removed.length} field(s) removed`);
    }
    if (diff.modified.length > 0) {
      parts.push(`${diff.modified.length} field(s) modified`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes detected';
  }

  /**
   * Detect changed fields between two data objects
   */
  private detectChangedFields(oldData: any, newData: any): string[] {
    const diff = this.generateDiff(oldData, newData);
    return [...diff.added, ...diff.removed, ...diff.modified.map(m => m.field)];
  }

  // =========================================================================
  // VERSION MANAGEMENT
  // =========================================================================

  /**
   * Revert artifact to a specific version
   */
  async revertToVersion(
    artifactId: string,
    versionNumber: number,
    options: CreateVersionOptions = {}
  ): Promise<{ success: boolean; newVersion?: ArtifactVersion; error?: string }> {
    try {
      // Get the version to revert to
      const targetVersion = await this.getVersion(artifactId, versionNumber);

      if (!targetVersion) {
        return {
          success: false,
          error: `Version ${versionNumber} not found`,
        };
      }

      // Update artifact with version data
      await dbAdaptor.getClient().artifact.update({
        where: { id: artifactId },
        data: {
          data: targetVersion.data,
          updatedAt: new Date(),
        },
      });

      // Create new version for the revert
      const result = await this.createVersion(artifactId, {
        ...options,
        changeSummary: options.changeSummary || `Reverted to version ${versionNumber}`,
        changeReason: options.changeReason || 'revert',
      });

      if (result.success) {
        logger.info(
          { artifactId, targetVersion: versionNumber, newVersion: result.version?.versionNumber },
          'Artifact reverted to previous version'
        );
      }

      return result;
    } catch (error) {
      logger.error({ error, artifactId, versionNumber }, 'Failed to revert to version');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deactivate all previous versions
   */
  private async deactivatePreviousVersions(
    artifactId: string,
    currentVersionId: string
  ): Promise<void> {
    try {
      await dbAdaptor.getClient().$executeRaw`
        UPDATE artifact_versions
        SET is_active = false, superseded_at = NOW(), superseded_by = ${currentVersionId}
        WHERE artifact_id = ${artifactId} AND id != ${currentVersionId} AND is_active = true
      `;
    } catch (error) {
      logger.warn({ error, artifactId }, 'Failed to deactivate previous versions');
    }
  }

  /**
   * Delete old versions (keep last N versions)
   */
  async pruneOldVersions(
    artifactId: string,
    keepCount: number = 10
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      // Get versions to delete
      const versionsToDelete = await dbAdaptor.getClient().$queryRaw<Array<{ id: string }>>`
        SELECT id FROM artifact_versions
        WHERE artifact_id = ${artifactId}
        ORDER BY version_number DESC
        OFFSET ${keepCount}
      `;

      if (versionsToDelete.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      const idsToDelete = versionsToDelete.map(v => v.id);

      // Delete old versions
      await dbAdaptor.getClient().$executeRaw`
        DELETE FROM artifact_versions
        WHERE id = ANY(${idsToDelete}::text[])
      `;

      logger.info(
        { artifactId, deletedCount: idsToDelete.length },
        'Pruned old artifact versions'
      );

      return {
        success: true,
        deletedCount: idsToDelete.length,
      };
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to prune old versions');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const artifactVersioningService = ArtifactVersioningService.getInstance();
