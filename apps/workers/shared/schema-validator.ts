/**
 * Schema Validation System
 * Provides comprehensive schema validation with detailed error reporting
 */

import { ArtifactType } from './artifact-manager';
import { ImportManager } from './import-manager';

// Validation error interface
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
  expected?: any;
  received?: any;
}

// Validation result interface
export interface SchemaValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  data?: any;
  schemaVersion?: string;
}

// Schema information interface
export interface SchemaInfo {
  name: string;
  version: string;
  description: string;
  required: string[];
  optional: string[];
  deprecated: string[];
}

// Field validation rule interface
export interface FieldValidationRule {
  field: string;
  type: string;
  required: boolean;
  validator?: (value: any) => { isValid: boolean; error?: string };
  transformer?: (value: any) => any;
}

/**
 * Schema Validator
 * Handles schema validation with detailed error reporting and suggestions
 */
export class SchemaValidator {
  private schemaCache: Map<string, any> = new Map();
  private validationRules: Map<ArtifactType, FieldValidationRule[]> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  /**
   * Validate data against schema with detailed error reporting
   */
  async validateWithSchema<T>(
    data: T,
    artifactType: ArtifactType,
    schemaVersion: string = '1.0'
  ): Promise<SchemaValidationResult> {
    try {
      // Get schema for artifact type
      const schema = await this.getSchema(artifactType);
      
      if (!schema) {
        return {
          isValid: false,
          errors: [{
            path: [],
            message: `No schema available for artifact type: ${artifactType}`,
            code: 'SCHEMA_NOT_FOUND'
          }],
          warnings: []
        };
      }

      // Validate with schema
      try {
        const validatedData = schema.parse(data);
        
        // Additional custom validation
        const customValidation = await this.performCustomValidation(data, artifactType);
        
        return {
          isValid: customValidation.errors.length === 0,
          errors: customValidation.errors,
          warnings: customValidation.warnings,
          data: validatedData,
          schemaVersion
        };
      } catch (schemaError) {
        const errors = this.parseSchemaErrors(schemaError);
        const suggestions = this.generateSuggestions(errors, artifactType);
        
        return {
          isValid: false,
          errors,
          warnings: suggestions,
          schemaVersion
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          path: [],
          message: `Validation process failed: ${error}`,
          code: 'VALIDATION_FAILED'
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate specific field with custom rules
   */
  validateField(
    value: any,
    fieldName: string,
    artifactType: ArtifactType
  ): { isValid: boolean; error?: string; transformedValue?: any } {
    const rules = this.validationRules.get(artifactType) || [];
    const rule = rules.find(r => r.field === fieldName);
    
    if (!rule) {
      return { isValid: true };
    }

    // Check if required field is present
    if (rule.required && (value === undefined || value === null)) {
      return {
        isValid: false,
        error: `Required field '${fieldName}' is missing`
      };
    }

    // Type validation
    if (value !== undefined && value !== null) {
      const typeValid = this.validateType(value, rule.type);
      if (!typeValid.isValid) {
        return {
          isValid: false,
          error: `Field '${fieldName}' ${typeValid.error}`
        };
      }
    }

    // Custom validation
    if (rule.validator && value !== undefined && value !== null) {
      const customResult = rule.validator(value);
      if (!customResult.isValid) {
        return {
          isValid: false,
          error: customResult.error || `Field '${fieldName}' failed custom validation`
        };
      }
    }

    // Transform value if transformer is provided
    let transformedValue = value;
    if (rule.transformer && value !== undefined && value !== null) {
      try {
        transformedValue = rule.transformer(value);
      } catch (error) {
        return {
          isValid: false,
          error: `Field '${fieldName}' transformation failed: ${error}`
        };
      }
    }

    return {
      isValid: true,
      transformedValue
    };
  }

  /**
   * Get schema information
   */
  async getSchemaInfo(artifactType: ArtifactType): Promise<SchemaInfo | null> {
    try {
      const schema = await this.getSchema(artifactType);
      if (!schema) return null;

      // Extract schema information (this would depend on the schema library used)
      return {
        name: `${artifactType}ArtifactV1Schema`,
        version: '1.0',
        description: `Schema for ${artifactType} artifacts`,
        required: this.extractRequiredFields(schema),
        optional: this.extractOptionalFields(schema),
        deprecated: []
      };
    } catch (error) {
      console.warn(`Failed to get schema info for ${artifactType}:`, error);
      return null;
    }
  }

  /**
   * Generate default values for missing fields
   */
  generateDefaultValues(artifactType: ArtifactType): Record<string, any> {
    const defaults: Record<string, any> = {};

    switch (artifactType) {
      case ArtifactType.INGESTION:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        defaults.content = '';
        break;

      case ArtifactType.CLAUSES:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        defaults.clauses = [];
        break;

      case ArtifactType.RISK:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        defaults.risks = [];
        defaults.overallRiskScore = 0;
        break;

      case ArtifactType.COMPLIANCE:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        defaults.compliance = [];
        defaults.overallScore = 0;
        break;

      case ArtifactType.FINANCIAL:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        break;

      case ArtifactType.OVERVIEW:
      case ArtifactType.ENHANCED_OVERVIEW:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        defaults.summary = '';
        defaults.parties = [];
        defaults.keyTerms = [];
        defaults.contractType = '';
        defaults.insights = [];
        break;

      case ArtifactType.TEMPLATE:
        defaults.metadata = {
          docId: '',
          fileType: 'pdf',
          totalPages: 1,
          ocrRate: 0,
          provenance: []
        };
        defaults.templates = [];
        break;
    }

    return defaults;
  }

  /**
   * Get schema for artifact type
   */
  private async getSchema(artifactType: ArtifactType): Promise<any> {
    const cacheKey = artifactType.toString();
    
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }

    try {
      const schemasResult = await ImportManager.importSchemas();
      
      if (schemasResult.success && schemasResult.module) {
        const schemas = schemasResult.module;
        let schema: any;

        switch (artifactType) {
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
            return null;
        }

        if (schema) {
          this.schemaCache.set(cacheKey, schema);
        }

        return schema;
      }
    } catch (error) {
      console.warn(`Failed to load schema for ${artifactType}:`, error);
    }

    return null;
  }

  /**
   * Parse schema errors into structured format
   */
  private parseSchemaErrors(error: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (error && typeof error === 'object' && 'issues' in error) {
      // Zod-style errors
      const issues = error.issues;
      for (const issue of issues) {
        errors.push({
          path: issue.path || [],
          message: issue.message,
          code: issue.code || 'VALIDATION_ERROR',
          expected: issue.expected,
          received: issue.received
        });
      }
    } else if (error && typeof error === 'object' && 'errors' in error) {
      // Other schema library errors
      const schemaErrors = error.errors;
      for (const schemaError of schemaErrors) {
        errors.push({
          path: schemaError.path || [],
          message: schemaError.message,
          code: 'VALIDATION_ERROR'
        });
      }
    } else {
      // Generic error
      errors.push({
        path: [],
        message: String(error),
        code: 'UNKNOWN_ERROR'
      });
    }

    return errors;
  }

  /**
   * Generate suggestions based on validation errors
   */
  private generateSuggestions(errors: ValidationError[], artifactType: ArtifactType): string[] {
    const suggestions: string[] = [];

    for (const error of errors) {
      const fieldPath = error.path.join('.');
      
      if (error.code === 'invalid_type') {
        suggestions.push(`Field '${fieldPath}' should be of type ${error.expected}, but received ${error.received}`);
      } else if (error.code === 'required') {
        suggestions.push(`Required field '${fieldPath}' is missing. Consider adding a default value.`);
      } else if (error.message.includes('required')) {
        suggestions.push(`Missing required field. Check the schema for ${artifactType} to see all required fields.`);
      } else if (error.message.includes('array')) {
        suggestions.push(`Field '${fieldPath}' should be an array. Make sure to wrap single items in brackets.`);
      } else if (error.message.includes('object')) {
        suggestions.push(`Field '${fieldPath}' should be an object. Check the structure of nested data.`);
      }
    }

    // Add general suggestions
    if (errors.length > 0) {
      suggestions.push(`Use generateDefaultValues() to get a template for ${artifactType} artifacts`);
      suggestions.push('Check the artifact type matches the data structure you are trying to validate');
    }

    return suggestions;
  }

  /**
   * Perform custom validation beyond schema
   */
  private async performCustomValidation(
    data: any,
    artifactType: ArtifactType
  ): Promise<{ errors: ValidationError[]; warnings: string[] }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Common validations
    if (data.metadata) {
      if (!data.metadata.docId) {
        errors.push({
          path: ['metadata', 'docId'],
          message: 'Document ID is required in metadata',
          code: 'REQUIRED_FIELD'
        });
      }

      if (!data.metadata.provenance || !Array.isArray(data.metadata.provenance)) {
        warnings.push('Provenance information is missing or invalid');
      }
    }

    // Type-specific validations
    switch (artifactType) {
      case ArtifactType.RISK:
        if (data.overallRiskScore !== undefined) {
          if (data.overallRiskScore < 0 || data.overallRiskScore > 100) {
            errors.push({
              path: ['overallRiskScore'],
              message: 'Overall risk score must be between 0 and 100',
              code: 'INVALID_RANGE'
            });
          }
        }
        break;

      case ArtifactType.COMPLIANCE:
        if (data.overallScore !== undefined) {
          if (data.overallScore < 0 || data.overallScore > 100) {
            errors.push({
              path: ['overallScore'],
              message: 'Overall compliance score must be between 0 and 100',
              code: 'INVALID_RANGE'
            });
          }
        }
        break;

      case ArtifactType.INGESTION:
        if (data.content && data.content.length < 10) {
          warnings.push('Content appears to be very short, this might indicate extraction issues');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Validate type
   */
  private validateType(value: any, expectedType: string): { isValid: boolean; error?: string } {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return { isValid: false, error: `expected string, got ${typeof value}` };
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { isValid: false, error: `expected number, got ${typeof value}` };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { isValid: false, error: `expected boolean, got ${typeof value}` };
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return { isValid: false, error: `expected array, got ${typeof value}` };
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return { isValid: false, error: `expected object, got ${typeof value}` };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Extract required fields from schema (placeholder)
   */
  private extractRequiredFields(schema: any): string[] {
    // This would depend on the schema library being used
    return ['metadata'];
  }

  /**
   * Extract optional fields from schema (placeholder)
   */
  private extractOptionalFields(schema: any): string[] {
    // This would depend on the schema library being used
    return [];
  }

  /**
   * Initialize validation rules for each artifact type
   */
  private initializeValidationRules(): void {
    // Common metadata rules
    const metadataRules: FieldValidationRule[] = [
      {
        field: 'metadata.docId',
        type: 'string',
        required: true,
        validator: (value) => ({
          isValid: typeof value === 'string' && value.length > 0,
          error: 'Document ID must be a non-empty string'
        })
      },
      {
        field: 'metadata.provenance',
        type: 'array',
        required: true,
        validator: (value) => ({
          isValid: Array.isArray(value),
          error: 'Provenance must be an array'
        })
      }
    ];

    // Ingestion-specific rules
    this.validationRules.set(ArtifactType.INGESTION, [
      ...metadataRules,
      {
        field: 'content',
        type: 'string',
        required: true,
        validator: (value) => ({
          isValid: typeof value === 'string' && value.length > 0,
          error: 'Content must be a non-empty string'
        })
      }
    ]);

    // Risk-specific rules
    this.validationRules.set(ArtifactType.RISK, [
      ...metadataRules,
      {
        field: 'risks',
        type: 'array',
        required: true
      },
      {
        field: 'overallRiskScore',
        type: 'number',
        required: false,
        validator: (value) => ({
          isValid: value >= 0 && value <= 100,
          error: 'Overall risk score must be between 0 and 100'
        })
      }
    ]);

    // Add rules for other artifact types as needed
  }
}

/**
 * Singleton instance
 */
let schemaValidator: SchemaValidator | null = null;

/**
 * Get shared schema validator instance
 */
export function getSchemaValidator(): SchemaValidator {
  if (!schemaValidator) {
    schemaValidator = new SchemaValidator();
  }
  return schemaValidator;
}

/**
 * Convenience functions
 */
export const validateWithSchema = <T>(
  data: T,
  artifactType: ArtifactType,
  schemaVersion?: string
) => getSchemaValidator().validateWithSchema(data, artifactType, schemaVersion);

export const validateField = (
  value: any,
  fieldName: string,
  artifactType: ArtifactType
) => getSchemaValidator().validateField(value, fieldName, artifactType);

export const generateDefaultValues = (artifactType: ArtifactType) =>
  getSchemaValidator().generateDefaultValues(artifactType);