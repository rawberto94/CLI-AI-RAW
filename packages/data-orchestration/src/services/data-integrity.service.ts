/**
 * Data Integrity Service
 * 
 * Provides comprehensive data validation including schema validation,
 * business rule validation, and referential integrity checks.
 * 
 * Requirements: 6.2 - THE System SHALL validate data integrity before saving to the database
 */

import { PrismaClient } from 'clients-db';
import { z } from 'zod';
import { monitoringService } from './monitoring.service';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface BusinessRule {
  name: string;
  validate: (data: any, context?: any) => Promise<boolean> | boolean;
  errorMessage: string;
  errorCode: string;
}

class DataIntegrityService {
  private db: PrismaClient;
  private businessRules: Map<string, BusinessRule[]>;

  constructor() {
    this.db = new PrismaClient();
    this.businessRules = new Map();
    this.initializeBusinessRules();
  }

  /**
   * Validate data against schema before saving
   */
  async validateSchema<T>(
    schema: z.ZodSchema<T>,
    data: any,
    context?: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate against Zod schema
      const result = schema.safeParse(data);

      if (!result.success) {
        result.error.issues.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            value: data[err.path[0]]
          });
        });
      }

      monitoringService.recordTiming(
        'data_integrity.schema_validation',
        Date.now() - startTime,
        { context: context || 'unknown', valid: errors.length === 0 ? 'true' : 'false' }
      );

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_integrity.validate_schema',
        schemaContext: context
      });

      errors.push({
        field: 'schema',
        message: 'Schema validation failed',
        code: 'SCHEMA_ERROR'
      });

      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate business rules
   */
  async validateBusinessRules(
    resourceType: string,
    data: any,
    context?: any
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const rules = this.businessRules.get(resourceType) || [];

    for (const rule of rules) {
      try {
        const isValid = await rule.validate(data, context);

        if (!isValid) {
          errors.push({
            field: rule.name,
            message: rule.errorMessage,
            code: rule.errorCode
          });
        }
      } catch (error) {
        monitoringService.logError(error as Error, {
          context: 'data_integrity.validate_business_rule',
          rule: rule.name,
          resourceType
        });

        errors.push({
          field: rule.name,
          message: `Business rule validation failed: ${(error as Error).message}`,
          code: 'BUSINESS_RULE_ERROR'
        });
      }
    }

    monitoringService.recordTiming(
      'data_integrity.business_rules_validation',
      Date.now() - startTime,
      { resourceType, rulesChecked: rules.length.toString() }
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check referential integrity
   */
  async checkReferentialIntegrity(
    resourceType: string,
    data: any
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      switch (resourceType) {
        case 'contract':
          await this.validateContractReferences(data, errors);
          break;
        case 'artifact':
          await this.validateArtifactReferences(data, errors);
          break;
        case 'rateCardEntry':
          await this.validateRateCardEntryReferences(data, errors);
          break;
        case 'rateCardBaseline':
          await this.validateRateCardBaselineReferences(data, errors);
          break;
        default:
          // No specific referential integrity checks
          break;
      }

      monitoringService.recordTiming(
        'data_integrity.referential_integrity',
        Date.now() - startTime,
        { resourceType }
      );

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      monitoringService.logError(error as Error, {
        context: 'data_integrity.check_referential_integrity',
        resourceType
      });

      errors.push({
        field: 'referential_integrity',
        message: 'Referential integrity check failed',
        code: 'REFERENTIAL_INTEGRITY_ERROR'
      });

      return { valid: false, errors, warnings };
    }
  }

  /**
   * Comprehensive validation (schema + business rules + referential integrity)
   */
  async validateComplete<T>(
    schema: z.ZodSchema<T>,
    resourceType: string,
    data: any,
    context?: any
  ): Promise<ValidationResult> {
    const results = await Promise.all([
      this.validateSchema(schema, data, resourceType),
      this.validateBusinessRules(resourceType, data, context),
      this.checkReferentialIntegrity(resourceType, data)
    ]);

    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);

    monitoringService.incrementCounter('data_integrity.complete_validation', {
      resourceType,
      valid: allErrors.length === 0 ? 'true' : 'false',
      errorCount: allErrors.length.toString()
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Register a business rule for a resource type
   */
  registerBusinessRule(resourceType: string, rule: BusinessRule): void {
    const rules = this.businessRules.get(resourceType) || [];
    rules.push(rule);
    this.businessRules.set(resourceType, rules);
  }

  /**
   * Initialize default business rules
   */
  private initializeBusinessRules(): void {
    // Contract business rules
    this.registerBusinessRule('contract', {
      name: 'validDateRange',
      validate: (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) < new Date(data.endDate);
        }
        return true;
      },
      errorMessage: 'Contract start date must be before end date',
      errorCode: 'INVALID_DATE_RANGE'
    });

    this.registerBusinessRule('contract', {
      name: 'validTotalValue',
      validate: (data) => {
        if (data.totalValue !== undefined && data.totalValue !== null) {
          return data.totalValue >= 0;
        }
        return true;
      },
      errorMessage: 'Contract total value must be non-negative',
      errorCode: 'INVALID_TOTAL_VALUE'
    });

    // Rate card entry business rules
    this.registerBusinessRule('rateCardEntry', {
      name: 'validRates',
      validate: (data) => {
        const rates = [data.dailyRate, data.dailyRateUSD, data.dailyRateCHF];
        return rates.every(rate => rate === undefined || rate === null || rate > 0);
      },
      errorMessage: 'All rates must be positive values',
      errorCode: 'INVALID_RATE_VALUE'
    });

    this.registerBusinessRule('rateCardEntry', {
      name: 'validEffectiveDates',
      validate: (data) => {
        if (data.effectiveDate && data.expiryDate) {
          return new Date(data.effectiveDate) < new Date(data.expiryDate);
        }
        return true;
      },
      errorMessage: 'Effective date must be before expiry date',
      errorCode: 'INVALID_EFFECTIVE_DATES'
    });

    // Rate card baseline business rules
    this.registerBusinessRule('rateCardBaseline', {
      name: 'validRateRange',
      validate: (data) => {
        if (data.minimumRate && data.maximumRate && data.targetRate) {
          return (
            data.minimumRate <= data.targetRate &&
            data.targetRate <= data.maximumRate
          );
        }
        return true;
      },
      errorMessage: 'Target rate must be between minimum and maximum rates',
      errorCode: 'INVALID_RATE_RANGE'
    });

    // Artifact business rules
    this.registerBusinessRule('artifact', {
      name: 'validConfidence',
      validate: (data) => {
        if (data.confidence !== undefined && data.confidence !== null) {
          return data.confidence >= 0 && data.confidence <= 1;
        }
        return true;
      },
      errorMessage: 'Confidence must be between 0 and 1',
      errorCode: 'INVALID_CONFIDENCE'
    });
  }

  /**
   * Validate contract references
   */
  private async validateContractReferences(
    data: any,
    errors: ValidationError[]
  ): Promise<void> {
    // Check tenant exists
    if (data.tenantId) {
      const tenant = await this.db.tenant.findUnique({
        where: { id: data.tenantId }
      });

      if (!tenant) {
        errors.push({
          field: 'tenantId',
          message: 'Referenced tenant does not exist',
          code: 'INVALID_TENANT_REFERENCE',
          value: data.tenantId
        });
      }
    }

    // Check client exists if provided
    if (data.clientId) {
      const client = await this.db.party.findUnique({
        where: { id: data.clientId }
      });

      if (!client) {
        errors.push({
          field: 'clientId',
          message: 'Referenced client does not exist',
          code: 'INVALID_CLIENT_REFERENCE',
          value: data.clientId
        });
      }
    }

    // Check supplier exists if provided
    if (data.supplierId) {
      const supplier = await this.db.party.findUnique({
        where: { id: data.supplierId }
      });

      if (!supplier) {
        errors.push({
          field: 'supplierId',
          message: 'Referenced supplier does not exist',
          code: 'INVALID_SUPPLIER_REFERENCE',
          value: data.supplierId
        });
      }
    }
  }

  /**
   * Validate artifact references
   */
  private async validateArtifactReferences(
    data: any,
    errors: ValidationError[]
  ): Promise<void> {
    // Check contract exists
    if (data.contractId) {
      const contract = await this.db.contract.findUnique({
        where: { id: data.contractId }
      });

      if (!contract) {
        errors.push({
          field: 'contractId',
          message: 'Referenced contract does not exist',
          code: 'INVALID_CONTRACT_REFERENCE',
          value: data.contractId
        });
      }
    }

    // Check tenant exists
    if (data.tenantId) {
      const tenant = await this.db.tenant.findUnique({
        where: { id: data.tenantId }
      });

      if (!tenant) {
        errors.push({
          field: 'tenantId',
          message: 'Referenced tenant does not exist',
          code: 'INVALID_TENANT_REFERENCE',
          value: data.tenantId
        });
      }
    }
  }

  /**
   * Validate rate card entry references
   */
  private async validateRateCardEntryReferences(
    data: any,
    errors: ValidationError[]
  ): Promise<void> {
    // Check supplier exists
    if (data.supplierId) {
      try {
        const supplier = await (this.db as any).rateCardSupplier?.findUnique({
          where: { id: data.supplierId }
        });

        if (!supplier) {
          errors.push({
            field: 'supplierId',
            message: 'Referenced supplier does not exist',
            code: 'INVALID_SUPPLIER_REFERENCE',
            value: data.supplierId
          });
        }
      } catch (error) {
        // Model may not exist, skip validation
      }
    }

    // Check contract exists if provided
    if (data.contractId) {
      const contract = await this.db.contract.findUnique({
        where: { id: data.contractId }
      });

      if (!contract) {
        errors.push({
          field: 'contractId',
          message: 'Referenced contract does not exist',
          code: 'INVALID_CONTRACT_REFERENCE',
          value: data.contractId
        });
      }
    }
  }

  /**
   * Validate rate card baseline references
   */
  private async validateRateCardBaselineReferences(
    data: any,
    errors: ValidationError[]
  ): Promise<void> {
    // Check procurement category exists if provided
    if (data.procurementCategoryId) {
      try {
        const category = await (this.db as any).procurementCategory?.findUnique({
          where: { id: data.procurementCategoryId }
        });

        if (!category) {
          errors.push({
            field: 'procurementCategoryId',
            message: 'Referenced procurement category does not exist',
            code: 'INVALID_CATEGORY_REFERENCE',
            value: data.procurementCategoryId
          });
        }
      } catch (error) {
        // Model may not exist, skip validation
      }
    }
  }

  /**
   * Validate data before save (convenience method)
   */
  async validateBeforeSave<T>(
    schema: z.ZodSchema<T>,
    resourceType: string,
    data: any,
    context?: any
  ): Promise<void> {
    const result = await this.validateComplete(schema, resourceType, data, context);

    if (!result.valid) {
      const errorMessage = result.errors
        .map(e => `${e.field}: ${e.message}`)
        .join('; ');

      throw new Error(`Validation failed: ${errorMessage}`);
    }
  }
}

export const dataIntegrityService = new DataIntegrityService();
