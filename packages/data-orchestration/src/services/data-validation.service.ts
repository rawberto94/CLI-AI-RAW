/**
 * Data Validation Service with Zod Schemas
 * 
 * Provides comprehensive validation for all contract data types:
 * - Type-safe validation with Zod
 * - Detailed error messages with field paths
 * - Custom validators for complex types
 * - Sanitization integration
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('data-validation-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface DataValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// Type alias for backwards compatibility
type ValidationResult<T = any> = DataValidationResult<T>;

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// =========================================================================
// ZOD SCHEMAS
// =========================================================================

// Party Schema
export const PartySchema = z.object({
  name: z.string().min(1, 'Party name is required').max(200),
  role: z.enum(['client', 'supplier', 'vendor', 'partner']),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
});

// Currency Schema
export const CurrencySchema = z.enum([
  'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'
]);

// Date Schema (ISO 8601 string)
export const DateSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format. Expected ISO 8601 string.' }
);

// Money Amount Schema
export const MoneyAmountSchema = z.object({
  amount: z.number().nonnegative('Amount must be non-negative'),
  currency: CurrencySchema,
});

// Payment Terms Schema
export const PaymentTermsSchema = z.object({
  type: z.enum(['net', 'advance', 'milestone', 'recurring']),
  days: z.number().int().positive().optional(),
  description: z.string().optional(),
  amount: MoneyAmountSchema.optional(),
  dueDate: DateSchema.optional(),
});

// Contract Metadata Schema
export const ContractMetadataSchema = z.object({
  contractType: z.string().min(1, 'Contract type is required'),
  title: z.string().min(1, 'Title is required').max(500),
  parties: z.array(PartySchema).min(1, 'At least one party is required'),
  effectiveDate: DateSchema.optional(),
  expirationDate: DateSchema.optional(),
  jurisdiction: z.string().optional(),
  language: z.string().default('English'),
  tags: z.array(z.string()).optional(),
});

// Financial Data Schema
export const FinancialDataSchema = z.object({
  totalValue: MoneyAmountSchema.optional(),
  paymentTerms: z.array(PaymentTermsSchema).optional(),
  penalties: z.array(z.object({
    type: z.string(),
    amount: z.number().nonnegative().optional(),
    description: z.string(),
  })).optional(),
  costBreakdown: z.array(z.object({
    category: z.string(),
    amount: z.number().nonnegative(),
    description: z.string().optional(),
  })).optional(),
  discounts: z.array(z.object({
    type: z.enum(['percentage', 'fixed']),
    value: z.number().positive(),
    description: z.string().optional(),
  })).optional(),
});

// Clause Schema
export const ClauseSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().min(1, 'Clause title is required'),
  content: z.string().min(1, 'Clause content is required'),
  riskLevel: z.enum(['low', 'medium', 'high']),
  importance: z.enum(['low', 'medium', 'high']),
  recommendations: z.array(z.string()).optional(),
});

// Rate Card Schema
export const RateCardSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  seniorityLevel: z.enum(['junior', 'mid', 'senior', 'principal', 'partner']).optional(),
  location: z.string().optional(),
  rate: z.object({
    amount: z.number().positive('Rate must be positive'),
    currency: CurrencySchema,
    period: z.enum(['hourly', 'daily', 'monthly', 'annual']),
  }),
  effectiveDate: DateSchema.optional(),
  expirationDate: DateSchema.optional(),
});

// Risk Factor Schema
export const RiskFactorSchema = z.object({
  category: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1, 'Description is required'),
  mitigation: z.string().optional(),
  probability: z.number().min(0).max(1).optional(),
  impact: z.number().min(0).max(1).optional(),
});

// Compliance Issue Schema
export const ComplianceIssueSchema = z.object({
  regulation: z.string(),
  issue: z.string().min(1, 'Issue description is required'),
  severity: z.enum(['low', 'medium', 'high']),
  recommendation: z.string(),
  deadline: DateSchema.optional(),
});

// Contract Upload Schema
export const ContractUploadSchema = z.object({
  tenantId: z.string().uuid({ message: 'Invalid tenant ID' }),
  fileName: z.string().min(1, 'File name is required').max(255),
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, 'Invalid MIME type'),
  fileSize: z.number().positive('File size must be positive').max(1024 * 1024 * 1024, 'File size exceeds 1GB limit'),
  uploadedBy: z.string().uuid({ message: 'Invalid user ID' }).optional(),
  checksum: z.string().optional(),
});

// Artifact Schema
export const ArtifactSchema = z.object({
  contractId: z.string().uuid({ message: 'Invalid contract ID' }),
  tenantId: z.string().uuid({ message: 'Invalid tenant ID' }),
  type: z.enum(['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK', 'INGESTION', 'TEMPLATE', 'BENCHMARK', 'REPORT'] as const),
  data: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1).optional(),
  version: z.string().optional(),
});

// =========================================================================
// DATA VALIDATION SERVICE
// =========================================================================

export class DataValidationService {
  private static instance: DataValidationService;

  private constructor() {
    logger.info('Data Validation Service initialized');
  }

  static getInstance(): DataValidationService {
    if (!DataValidationService.instance) {
      DataValidationService.instance = new DataValidationService();
    }
    return DataValidationService.instance;
  }

  // =========================================================================
  // VALIDATION METHODS
  // =========================================================================

  /**
   * Validate party data
   */
  validateParty(data: unknown): ValidationResult {
    return this.validate(PartySchema, data, 'Party');
  }

  /**
   * Validate contract metadata
   */
  validateContractMetadata(data: unknown): ValidationResult {
    return this.validate(ContractMetadataSchema, data, 'Contract Metadata');
  }

  /**
   * Validate financial data
   */
  validateFinancialData(data: unknown): ValidationResult {
    const result = this.validate(FinancialDataSchema, data, 'Financial Data');
    
    // Additional business logic validation
    if (result.success && result.data) {
      const additionalErrors = this.validateFinancialBusinessRules(result.data);
      if (additionalErrors.length > 0) {
        return {
          success: false,
          errors: [...(result.errors || []), ...additionalErrors],
        };
      }
    }
    
    return result;
  }

  /**
   * Validate clause data
   */
  validateClause(data: unknown): ValidationResult {
    return this.validate(ClauseSchema, data, 'Clause');
  }

  /**
   * Validate rate card data
   */
  validateRateCard(data: unknown): ValidationResult {
    const result = this.validate(RateCardSchema, data, 'Rate Card');
    
    // Additional validation for date ranges
    if (result.success && result.data) {
      const additionalErrors = this.validateDateRange(
        result.data.effectiveDate,
        result.data.expirationDate,
        'effectiveDate',
        'expirationDate'
      );
      if (additionalErrors.length > 0) {
        return {
          success: false,
          errors: [...(result.errors || []), ...additionalErrors],
        };
      }
    }
    
    return result;
  }

  /**
   * Validate risk factor data
   */
  validateRiskFactor(data: unknown): ValidationResult {
    return this.validate(RiskFactorSchema, data, 'Risk Factor');
  }

  /**
   * Validate compliance issue data
   */
  validateComplianceIssue(data: unknown): ValidationResult {
    return this.validate(ComplianceIssueSchema, data, 'Compliance Issue');
  }

  /**
   * Validate contract upload data
   */
  validateContractUpload(data: unknown): ValidationResult {
    return this.validate(ContractUploadSchema, data, 'Contract Upload');
  }

  /**
   * Validate artifact data
   */
  validateArtifact(data: unknown): ValidationResult {
    return this.validate(ArtifactSchema, data, 'Artifact');
  }

  /**
   * Validate currency code
   */
  validateCurrency(currency: unknown): ValidationResult {
    return this.validate(CurrencySchema, currency, 'Currency');
  }

  /**
   * Validate date string
   */
  validateDate(date: unknown): ValidationResult {
    return this.validate(DateSchema, date, 'Date');
  }

  /**
   * Validate money amount
   */
  validateMoneyAmount(amount: unknown): ValidationResult {
    return this.validate(MoneyAmountSchema, amount, 'Money Amount');
  }

  // =========================================================================
  // GENERIC VALIDATION
  // =========================================================================

  /**
   * Generic validation method
   */
  private validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string
  ): ValidationResult<T> {
    try {
      const result = schema.safeParse(data);

      if (result.success) {
        logger.debug({ context }, 'Validation successful');
        return {
          success: true,
          data: result.data,
        };
      }

      const errors = this.formatZodErrors(result.error);
      
      logger.warn(
        { context, errorCount: errors.length },
        'Validation failed'
      );

      return {
        success: false,
        errors,
      };
    } catch (error) {
      logger.error({ error, context }, 'Validation threw exception');
      
      return {
        success: false,
        errors: [{
          field: 'unknown',
          message: 'Validation failed with unexpected error',
          code: 'VALIDATION_ERROR',
        }],
      };
    }
  }

  /**
   * Format Zod errors into ValidationError array
   */
  private formatZodErrors(zodError: z.ZodError): ValidationError[] {
    return zodError.issues.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      value: err.path.length > 0 ? undefined : err,
    }));
  }

  // =========================================================================
  // BUSINESS RULES VALIDATION
  // =========================================================================

  /**
   * Validate financial business rules
   */
  private validateFinancialBusinessRules(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate cost breakdown sums to total value
    if (data.totalValue && data.costBreakdown && data.costBreakdown.length > 0) {
      const breakdownSum = data.costBreakdown.reduce(
        (sum: number, item: any) => sum + (item.amount || 0),
        0
      );
      
      const totalAmount = data.totalValue.amount;
      const variance = Math.abs(totalAmount - breakdownSum) / totalAmount;
      
      // Allow 1% variance
      if (variance > 0.01) {
        errors.push({
          field: 'costBreakdown',
          message: `Cost breakdown sum (${breakdownSum}) does not match total value (${totalAmount})`,
          code: 'FINANCIAL_MISMATCH',
        });
      }
    }

    // Validate discount values
    if (data.discounts) {
      for (let i = 0; i < data.discounts.length; i++) {
        const discount = data.discounts[i];
        if (discount.type === 'percentage' && discount.value > 100) {
          errors.push({
            field: `discounts[${i}].value`,
            message: 'Percentage discount cannot exceed 100%',
            code: 'INVALID_DISCOUNT',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate date range
   */
  private validateDateRange(
    startDate: string | undefined,
    endDate: string | undefined,
    startField: string,
    endField: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        errors.push({
          field: endField,
          message: `${endField} must be after ${startField}`,
          code: 'INVALID_DATE_RANGE',
        });
      }
    }

    return errors;
  }

  // =========================================================================
  // BATCH VALIDATION
  // =========================================================================

  /**
   * Validate multiple items
   */
  async validateBatch<T>(
    schema: z.ZodSchema<T>,
    items: unknown[],
    context: string
  ): Promise<{
    success: boolean;
    results: ValidationResult<T>[];
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const results: ValidationResult<T>[] = [];

    for (const item of items) {
      const result = this.validate(schema, item, context);
      results.push(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(
      {
        context,
        total: items.length,
        successful,
        failed,
      },
      'Batch validation completed'
    );

    return {
      success: failed === 0,
      results,
      summary: {
        total: items.length,
        successful,
        failed,
      },
    };
  }

  // =========================================================================
  // CUSTOM VALIDATORS
  // =========================================================================

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  isValidPhone(phone: string): boolean {
    // Basic international phone format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Validate UUID format
   */
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate ISO 8601 date format
   */
  isValidISO8601(date: string): boolean {
    return !isNaN(Date.parse(date));
  }

  /**
   * Validate currency code (ISO 4217)
   */
  isValidCurrencyCode(code: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'];
    return validCurrencies.includes(code.toUpperCase());
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get validation error summary
   */
  getErrorSummary(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return 'No errors';
    }

    if (errors.length === 1) {
      return errors[0].message;
    }

    return `${errors.length} validation errors: ${errors.map(e => e.field).join(', ')}`;
  }

  /**
   * Check if data has validation errors
   */
  hasErrors(result: ValidationResult): boolean {
    return !result.success && (result.errors?.length || 0) > 0;
  }

  /**
   * Get errors for specific field
   */
  getFieldErrors(errors: ValidationError[], field: string): ValidationError[] {
    return errors.filter(e => e.field === field || e.field.startsWith(`${field}.`));
  }

  /**
   * Create custom schema
   */
  createCustomSchema<T>(schema: z.ZodSchema<T>): z.ZodSchema<T> {
    return schema;
  }
}

export const dataValidationService = DataValidationService.getInstance();
