/**
 * Artifact Management System
 * Provides consistent artifact creation, validation, and schema management
 */

import { ImportManager } from './import-manager';
import { getSharedDatabaseClient } from './database-utils';

// Artifact type enum
export enum ArtifactType {
  INGESTION = 'INGESTION',
  CLAUSES = 'CLAUSES',
  RISK = 'RISK',
  COMPLIANCE = 'COMPLIANCE',
  FINANCIAL = 'FINANCIAL',
  OVERVIEW = 'OVERVIEW',
  ENHANCED_OVERVIEW = 'ENHANCED_OVERVIEW',
  TEMPLATE = 'TEMPLATE',
  RATES = 'RATES',
  BENCHMARK = 'BENCHMARK'
}

// Artifact metadata interface
export interface ArtifactMetadata {
  docId: string;
  fileType?: string;
  totalPages?: number;
  ocrRate?: number;
  provenance: ProvenanceEntry[];
  confidence?: number;
  processingTime?: number;
  llmEnhanced?: boolean;
  version?: string;
  schemaVersion?: string;
}

// Provenance entry interface
export interface ProvenanceEntry {
  worker: string;
  timestamp: string;
  durationMs: number;
  model?: string;
  confidenceScore?: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  [key: string]: any;
}

// Artifact creation data interface
export interface ArtifactCreationData {
  contractId: string;
  type: ArtifactType;
  data: any;
  tenantId: string;
  metadata?: ArtifactMetadata;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  transformedData?: any;
}

// Artifact result interface
export interface ArtifactResult {
  success: boolean;
  artifactId?: string;
  error?: string;
  validationResult?: ValidationResult;
  processingTime: number;
}

// Schema version compatibility
export interface SchemaCompatibility {
  version: string;
  compatible: boolean;
  migrationRequired: boolean;
  migrationFunction?: (data: any) => any;
}

/**
 * Artifact Manager
 * Handles artifact creation, validation, and schema management
 */
export class ArtifactManager {
  private dbClient = getSharedDatabaseClient();
  private schemaCache: Map<string, any> = new Map();
  private migrationFunctions: Map<string, (data: any) => any> = new Map();

  constructor() {
    this.initializeMigrationFunctions();
  }

  /**
   * Create artifact with comprehensive validation
   */
  async createArtifact<T>(
    type: ArtifactType,
    data: T,
    metadata: ArtifactMetadata,
    contractId: string,
    tenantId: string
  ): Promise<ArtifactResult> {
    const startTime = Date.now();

    try {
      // Validate artifact data
      const validationResult = await this.validateArtifact(data, type);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validationResult.errors.join(', ')}`,
          validationResult,
          processingTime: Date.now() - startTime
        };
      }

      // Use transformed data if available
      const finalData = validationResult.transformedData || data;

      // Create enhanced metadata
      const enhancedMetadata = this.enhanceMetadata(metadata, type);

      // Create artifact in database
      const dbResult = this.dbClient.createArtifactWithValidation ? 
        await this.dbClient.createArtifactWithValidation({
          contractId,
          type: type.toString(),
          data: {
            metadata: enhancedMetadata,
          ...finalData
        },
        tenantId,
        metadata: {
          artifactType: type,
          schemaVersion: enhancedMetadata.schemaVersion,
          createdAt: new Date().toISOString()
        }
      }) : { success: false, error: 'createArtifactWithValidation not available' };

      if (!dbResult.success) {
        return {
          success: false,
          error: `Database creation failed: ${dbResult.error}`,
          processingTime: Date.now() - startTime
        };
      }

      return {
        success: true,
        artifactId: dbResult.data?.id,
        validationResult,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Artifact creation failed: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate artifact against schema
   */
  async validateArtifact<T>(data: T, type: ArtifactType): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let transformedData: any = data;

    try {
      // Get schema for artifact type
      const schema = await this.getSchema(type);
      
      if (schema) {
        try {
          // Validate with schema
          const validatedData = schema.parse(data);
          transformedData = validatedData;
        } catch (schemaError) {
          // Try to extract meaningful error messages
          if (schemaError && typeof schemaError === 'object' && 'issues' in schemaError) {
            const issues = (schemaError as any).issues;
            for (const issue of issues) {
              errors.push(`${issue.path?.join('.') || 'root'}: ${issue.message}`);
            }
          } else {
            errors.push(`Schema validation failed: ${schemaError}`);
          }
        }
      } else {
        warnings.push(`No schema available for artifact type: ${type}`);
      }

      // Basic data validation
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        errors.push('Artifact data is empty or null');
      }

      // Type-specific validation
      const typeValidation = this.validateByType(data, type);
      errors.push(...typeValidation.errors);
      warnings.push(...typeValidation.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        transformedData: errors.length === 0 ? transformedData : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation process failed: ${error}`],
        warnings
      };
    }
  }

  /**
   * Generate standardized provenance entry
   */
  generateProvenance(
    worker: string,
    metrics: {
      processingTime: number;
      confidence?: number;
      model?: string;
      tokens?: { prompt: number; completion: number; total: number };
    },
    additionalData?: Record<string, any>
  ): ProvenanceEntry {
    return {
      worker,
      timestamp: new Date().toISOString(),
      durationMs: metrics.processingTime,
      model: metrics.model,
      confidenceScore: metrics.confidence,
      tokens: metrics.tokens,
      ...additionalData
    };
  }

  /**
   * Handle schema version compatibility
   */
  handleSchemaVersions(data: any, targetVersion: string, currentVersion?: string): any {
    if (!currentVersion || currentVersion === targetVersion) {
      return data;
    }

    const migrationKey = `${currentVersion}_to_${targetVersion}`;
    const migrationFunction = this.migrationFunctions.get(migrationKey);

    if (migrationFunction) {
      console.log(`Migrating data from version ${currentVersion} to ${targetVersion}`);
      return migrationFunction(data);
    }

    console.warn(`No migration function found for ${migrationKey}, returning data as-is`);
    return data;
  }

  /**
   * Get schema compatibility information
   */
  getSchemaCompatibility(artifactType: ArtifactType, version: string): SchemaCompatibility {
    const currentVersion = '1.0'; // This would come from schema definitions
    
    return {
      version,
      compatible: version === currentVersion,
      migrationRequired: version !== currentVersion,
      migrationFunction: this.migrationFunctions.get(`${version}_to_${currentVersion}`)
    };
  }

  /**
   * Get schema for artifact type
   */
  private async getSchema(type: ArtifactType): Promise<any> {
    const cacheKey = type.toString();
    
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }

    try {
      const schemasResult = await ImportManager.importSchemas();
      
      if (schemasResult.success && schemasResult.module) {
        const schemas = schemasResult.module;
        let schema: any;

        switch (type) {
          case ArtifactType.INGESTION:
            schema = schemas.IngestionArtifactV1Schema;
            break;
          case ArtifactType.CLAUSES:
            schema = schemas.ClausesArtifactV1Schema;
            break;
          case ArtifactType.RISK:
            schema = schemas.RiskArtifactV1Schema;
            break;
          case ArtifactType.COMPLIANCE:
            schema = schemas.ComplianceArtifactV1Schema;
            break;
          case ArtifactType.FINANCIAL:
            schema = schemas.FinancialArtifactV1Schema;
            break;
          case ArtifactType.OVERVIEW:
          case ArtifactType.ENHANCED_OVERVIEW:
            schema = schemas.OverviewArtifactV1Schema;
            break;
          case ArtifactType.TEMPLATE:
            schema = schemas.TemplateArtifactV1Schema;
            break;
          default:
            console.warn(`No schema defined for artifact type: ${type}`);
            return null;
        }

        if (schema) {
          this.schemaCache.set(cacheKey, schema);
        }

        return schema;
      }
    } catch (error) {
      console.warn(`Failed to load schema for ${type}:`, error);
    }

    return null;
  }

  /**
   * Enhance metadata with defaults and computed values
   */
  private enhanceMetadata(metadata: ArtifactMetadata, type: ArtifactType): ArtifactMetadata {
    return {
      ...metadata,
      version: metadata.version || '1.0',
      schemaVersion: metadata.schemaVersion || '1.0',
      confidence: metadata.confidence || 0.8,
      processingTime: metadata.processingTime || 0,
      llmEnhanced: metadata.llmEnhanced || false,
      provenance: metadata.provenance || []
    };
  }

  /**
   * Type-specific validation
   */
  private validateByType(data: any, type: ArtifactType): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (type) {
      case ArtifactType.INGESTION:
        if (!data.content || typeof data.content !== 'string') {
          errors.push('Ingestion artifact must have content field');
        }
        if (data.content && data.content.length < 10) {
          warnings.push('Content appears to be very short');
        }
        break;

      case ArtifactType.CLAUSES:
        if (!data.clauses || !Array.isArray(data.clauses)) {
          errors.push('Clauses artifact must have clauses array');
        }
        if (data.clauses && data.clauses.length === 0) {
          warnings.push('No clauses found in document');
        }
        break;

      case ArtifactType.RISK:
        if (!data.risks || !Array.isArray(data.risks)) {
          errors.push('Risk artifact must have risks array');
        }
        if (data.overallRiskScore !== undefined && (data.overallRiskScore < 0 || data.overallRiskScore > 100)) {
          errors.push('Overall risk score must be between 0 and 100');
        }
        break;

      case ArtifactType.COMPLIANCE:
        if (!data.compliance || !Array.isArray(data.compliance)) {
          errors.push('Compliance artifact must have compliance array');
        }
        if (data.overallScore !== undefined && (data.overallScore < 0 || data.overallScore > 100)) {
          errors.push('Overall compliance score must be between 0 and 100');
        }
        break;

      case ArtifactType.FINANCIAL:
        // Financial artifacts can have various structures, so we're more lenient
        if (data.totalValue && typeof data.totalValue !== 'object') {
          warnings.push('Total value should be an object with amount and currency');
        }
        break;

      case ArtifactType.OVERVIEW:
      case ArtifactType.ENHANCED_OVERVIEW:
        if (!data.summary || typeof data.summary !== 'string') {
          errors.push('Overview artifact must have summary field');
        }
        if (!data.parties || !Array.isArray(data.parties)) {
          warnings.push('Overview should include parties array');
        }
        break;

      case ArtifactType.TEMPLATE:
        if (!data.templates || !Array.isArray(data.templates)) {
          errors.push('Template artifact must have templates array');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Initialize migration functions for schema versions
   */
  private initializeMigrationFunctions(): void {
    // Example migration from version 0.9 to 1.0
    this.migrationFunctions.set('0.9_to_1.0', (data: any) => {
      return {
        ...data,
        metadata: {
          ...data.metadata,
          version: '1.0',
          migrated: true,
          migratedAt: new Date().toISOString()
        }
      };
    });

    // Add more migration functions as needed
    // this.migrationFunctions.set('1.0_to_1.1', (data: any) => { ... });
  }
}

/**
 * Singleton instance
 */
let artifactManager: ArtifactManager | null = null;

/**
 * Get shared artifact manager instance
 */
export function getArtifactManager(): ArtifactManager {
  if (!artifactManager) {
    artifactManager = new ArtifactManager();
  }
  return artifactManager;
}

/**
 * Convenience functions
 */
export const createArtifact = <T>(
  type: ArtifactType,
  data: T,
  metadata: ArtifactMetadata,
  contractId: string,
  tenantId: string
) => getArtifactManager().createArtifact(type, data, metadata, contractId, tenantId);

export const validateArtifact = <T>(data: T, type: ArtifactType) =>
  getArtifactManager().validateArtifact(data, type);

export const generateProvenance = (
  worker: string,
  metrics: {
    processingTime: number;
    confidence?: number;
    model?: string;
    tokens?: { prompt: number; completion: number; total: number };
  },
  additionalData?: Record<string, any>
) => getArtifactManager().generateProvenance(worker, metrics, additionalData);