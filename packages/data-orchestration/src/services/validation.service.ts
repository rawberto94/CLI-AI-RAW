/**
 * Data Validation Service
 * 
 * Provides comprehensive data validation using Zod schemas,
 * sanitization, and business rule validation.
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('validation-service');

// =========================================================================
// ZOD SCHEMAS
// =========================================================================

export const ContractUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(100 * 1024 * 1024), // 100MB max
  mimeType: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/rtf',
  ]),
  tenantId: z.string().min(1),
  uploadedBy: z.string().optional(),
});

export const ContractMetadataSchema = z.object({
  contractType: z.string().max(100).optional(),
  clientName: z.string().max(255).optional(),
  supplierName: z.string().max(255).optional(),
  totalValue: z.number().positive().optional(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/).optional(), // ISO 4217
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const FinancialDataSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/), // ISO 4217
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const DateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  }
);

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// =========================================================================
// TYPES
// =========================================================================

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trim?: boolean;
}

// =========================================================================
// VALIDATION SERVICE
// =========================================================================

export class ValidationService {
  private static instance: ValidationService;

  // ISO 4217 currency codes (common ones)
  private readonly VALID_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CNY', 'INR', 'AUD', 'CAD',
    'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
    'RON', 'BGN', 'HRK', 'RUB', 'TRY', 'BRL', 'MXN', 'ZAR', 'KRW',
  ];

  private constructor() {
    logger.info('Validation Service initialized');
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // =========================================================================
  // SCHEMA VALIDATION
  // =========================================================================

  /**
   * Validate data against a Zod schema
   */
  validate<T>(data: unknown, schema: z.ZodSchema<T>): ValidationResult<T> {
    try {
      const result = schema.safeParse(data);

      if (result.success) {
        logger.debug('Validation successful');
        return {
          success: true,
          data: result.data,
        };
      }
      
      // Type guard ensures result.error exists here
      const zodErrors = result.error.issues;
      logger.warn({ errors: zodErrors }, 'Validation failed');
      return {
        success: false,
        errors: zodErrors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Validation error');
      return {
        success: false,
        errors: [{ path: 'root', message: 'Validation error occurred' }],
      };
    }
  }

  /**
   * Validate contract upload data
   */
  validateContractUpload(data: unknown): ValidationResult<z.infer<typeof ContractUploadSchema>> {
    return this.validate(data, ContractUploadSchema);
  }

  /**
   * Validate contract metadata
   */
  validateContractMetadata(data: unknown): ValidationResult<z.infer<typeof ContractMetadataSchema>> {
    return this.validate(data, ContractMetadataSchema);
  }

  /**
   * Validate financial data
   */
  validateFinancialData(data: unknown): ValidationResult<z.infer<typeof FinancialDataSchema>> {
    return this.validate(data, FinancialDataSchema);
  }

  /**
   * Validate date range
   */
  validateDateRange(data: unknown): ValidationResult<z.infer<typeof DateRangeSchema>> {
    return this.validate(data, DateRangeSchema);
  }

  /**
   * Validate pagination parameters
   */
  validatePagination(data: unknown): ValidationResult<z.infer<typeof PaginationSchema>> {
    return this.validate(data, PaginationSchema);
  }

  // =========================================================================
  // SANITIZATION
  // =========================================================================

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html: string, options: SanitizationOptions = {}): string {
    if (!html) return '';

    let sanitized = html;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove data: protocol (can be used for XSS)
    sanitized = sanitized.replace(/data:text\/html/gi, '');

    // If HTML not allowed, strip all tags
    if (!options.allowHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Trim if requested
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Apply max length if specified
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize file name
   */
  sanitizeFileName(fileName: string): string {
    if (!fileName) return '';

    // Remove path traversal attempts
    let sanitized = fileName.replace(/\.\./g, '');

    // Remove path separators
    sanitized = sanitized.replace(/[\/\\]/g, '');

    // Replace special characters with underscore
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Remove multiple consecutive underscores
    sanitized = sanitized.replace(/_+/g, '_');

    // Trim underscores from start and end
    sanitized = sanitized.replace(/^_+|_+$/g, '');

    // Ensure not empty
    if (!sanitized) {
      sanitized = 'file';
    }

    return sanitized;
  }

  /**
   * Sanitize metadata object
   */
  sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Sanitize key
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');

      // Sanitize value based on type
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeHtml(value, { allowHtml: false, maxLength: 1000 });
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value === null || value === undefined) {
        sanitized[sanitizedKey] = null;
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map((item) =>
          typeof item === 'string' ? this.sanitizeHtml(item, { allowHtml: false }) : item
        );
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeMetadata(value);
      }
    }

    return sanitized;
  }

  // =========================================================================
  // CURRENCY VALIDATION
  // =========================================================================

  /**
   * Validate currency code (ISO 4217)
   */
  validateCurrency(currency: string): boolean {
    if (!currency) return false;
    return this.VALID_CURRENCIES.includes(currency.toUpperCase());
  }

  /**
   * Validate amount for currency
   */
  validateAmount(amount: number, currency: string): ValidationResult<{ amount: number; currency: string }> {
    const errors: Array<{ path: string; message: string }> = [];

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push({ path: 'amount', message: 'Amount must be a valid number' });
    } else if (amount <= 0) {
      errors.push({ path: 'amount', message: 'Amount must be positive' });
    } else if (amount > Number.MAX_SAFE_INTEGER) {
      errors.push({ path: 'amount', message: 'Amount is too large' });
    }

    // Validate currency
    if (!this.validateCurrency(currency)) {
      errors.push({ path: 'currency', message: `Invalid currency code: ${currency}` });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      data: { amount, currency: currency.toUpperCase() },
    };
  }

  // =========================================================================
  // DATE VALIDATION
  // =========================================================================

  /**
   * Validate and parse date
   */
  validateDate(date: string | Date): Date | null {
    try {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Normalize date to UTC
   */
  normalizeDateToUTC(date: Date): Date {
    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    );
  }

  /**
   * Validate contract dates
   */
  validateContractDates(
    startDate: Date,
    endDate: Date
  ): ValidationResult<{ startDate: Date; endDate: Date }> {
    const errors: Array<{ path: string; message: string }> = [];

    // Validate start date
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      errors.push({ path: 'startDate', message: 'Invalid start date' });
    }

    // Validate end date
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      errors.push({ path: 'endDate', message: 'Invalid end date' });
    }

    // Validate date range
    if (errors.length === 0 && endDate < startDate) {
      errors.push({ path: 'endDate', message: 'End date must be after or equal to start date' });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      data: { startDate, endDate },
    };
  }

  // =========================================================================
  // BUSINESS RULES VALIDATION
  // =========================================================================

  /**
   * Validate contract value
   */
  validateContractValue(
    value: number,
    contractType: string
  ): ValidationResult<{ value: number; contractType: string }> {
    const errors: Array<{ path: string; message: string }> = [];

    // Validate value
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({ path: 'value', message: 'Contract value must be a valid number' });
    } else if (value < 0) {
      errors.push({ path: 'value', message: 'Contract value cannot be negative' });
    } else if (value > 1000000000) {
      // 1 billion limit
      errors.push({ path: 'value', message: 'Contract value exceeds maximum allowed' });
    }

    // Validate contract type
    if (!contractType || typeof contractType !== 'string') {
      errors.push({ path: 'contractType', message: 'Contract type is required' });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      data: { value, contractType },
    };
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get list of valid currencies
   */
  getValidCurrencies(): string[] {
    return [...this.VALID_CURRENCIES];
  }

  /**
   * Check if string is valid email
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if string is valid URL
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if string is valid UUID
   */
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

export const validationService = ValidationService.getInstance();
