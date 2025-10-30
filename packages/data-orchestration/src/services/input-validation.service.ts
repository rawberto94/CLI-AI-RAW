/**
 * Input Validation Service
 * 
 * Provides automatic validation for API inputs using Zod schemas
 */

import { z, ZodError, ZodSchema } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'input-validation-service' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  sanitize?: boolean;
}

// =========================================================================
// INPUT VALIDATION SERVICE
// =========================================================================

export class InputValidationService {
  private static instance: InputValidationService;

  private constructor() {
    logger.info('Input Validation Service initialized');
  }

  static getInstance(): InputValidationService {
    if (!InputValidationService.instance) {
      InputValidationService.instance = new InputValidationService();
    }
    return InputValidationService.instance;
  }

  // =========================================================================
  // VALIDATION METHODS
  // =========================================================================

  /**
   * Validate data against a Zod schema
   */
  validate<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult<T> {
    try {
      // Apply options
      let processedSchema = schema;
      
      if (options.stripUnknown) {
        processedSchema = schema as any;
      }

      // Validate
      const validated = processedSchema.parse(data);

      logger.debug({ dataKeys: Object.keys(data as any) }, 'Validation successful');

      return {
        success: true,
        data: validated,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = this.formatZodErrors(error);
        
        logger.warn(
          { errors, dataKeys: Object.keys(data as any) },
          'Validation failed'
        );

        return {
          success: false,
          errors,
        };
      }

      logger.error({ error }, 'Unexpected validation error');

      return {
        success: false,
        errors: [
          {
            field: 'unknown',
            message: 'An unexpected validation error occurred',
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): T {
    const result = this.validate(schema, data, options);

    if (!result.success) {
      throw new ValidationException(result.errors || []);
    }

    return result.data!;
  }

  /**
   * Validate request body (generic)
   */
  async validateRequestBody<T>(
    body: any,
    schema: ZodSchema<T>,
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    return this.validate(schema, body, options);
  }

  /**
   * Validate query parameters (generic)
   */
  validateQueryParams<T>(
    params: Record<string, any>,
    schema: ZodSchema<T>,
    options: ValidationOptions = {}
  ): ValidationResult<T> {
    return this.validate(schema, params, options);
  }

  /**
   * Validate path parameters
   */
  validatePathParams<T>(
    params: Record<string, string>,
    schema: ZodSchema<T>,
    options: ValidationOptions = {}
  ): ValidationResult<T> {
    return this.validate(schema, params, options);
  }

  /**
   * Validate headers (generic)
   */
  validateHeaders<T>(
    headers: Record<string, string>,
    schema: ZodSchema<T>,
    options: ValidationOptions = {}
  ): ValidationResult<T> {
    return this.validate(schema, headers, options);
  }

  // =========================================================================
  // BATCH VALIDATION
  // =========================================================================

  /**
   * Validate multiple items
   */
  validateBatch<T>(
    schema: ZodSchema<T>,
    items: unknown[],
    options: ValidationOptions = {}
  ): {
    success: boolean;
    validItems: T[];
    errors: Array<{ index: number; errors: ValidationError[] }>;
  } {
    const validItems: T[] = [];
    const errors: Array<{ index: number; errors: ValidationError[] }> = [];

    items.forEach((item, index) => {
      const result = this.validate(schema, item, options);

      if (result.success && result.data) {
        validItems.push(result.data);
      } else if (result.errors) {
        errors.push({ index, errors: result.errors });
      }
    });

    return {
      success: errors.length === 0,
      validItems,
      errors,
    };
  }

  // =========================================================================
  // PARTIAL VALIDATION
  // =========================================================================

  /**
   * Validate partial data (for updates)
   */
  validatePartial<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult<Partial<T>> {
    // Convert schema to partial
    const partialSchema = (schema as any).partial();
    return this.validate(partialSchema, data, options);
  }

  // =========================================================================
  // CUSTOM VALIDATORS
  // =========================================================================

  /**
   * Validate tenant ID
   */
  validateTenantId(tenantId: string | null | undefined): ValidationResult<string> {
    if (!tenantId) {
      return {
        success: false,
        errors: [
          {
            field: 'tenantId',
            message: 'Tenant ID is required',
            code: 'MISSING_TENANT_ID',
          },
        ],
      };
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(tenantId)) {
      return {
        success: false,
        errors: [
          {
            field: 'tenantId',
            message: 'Invalid tenant ID format',
            code: 'INVALID_TENANT_ID',
          },
        ],
      };
    }

    return {
      success: true,
      data: tenantId,
    };
  }

  /**
   * Validate file upload
   */
  validateFileUpload(
    file: File,
    options: {
      maxSize?: number;
      allowedTypes?: string[];
    } = {}
  ): ValidationResult<File> {
    const errors: ValidationError[] = [];

    // Check file size
    const maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default
    if (file.size > maxSize) {
      errors.push({
        field: 'file',
        message: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE',
      });
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: `File type ${file.type} is not allowed`,
        code: 'INVALID_FILE_TYPE',
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      data: file,
    };
  }

  // =========================================================================
  // ERROR FORMATTING
  // =========================================================================

  /**
   * Format Zod errors into a consistent structure
   */
  private formatZodErrors(error: ZodError): ValidationError[] {
    return error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  }

  /**
   * Format validation errors for API response
   */
  formatErrorResponse(errors: ValidationError[]): {
    error: string;
    message: string;
    details: ValidationError[];
  } {
    return {
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors,
    };
  }

  // =========================================================================
  // SCHEMA COMPOSITION
  // =========================================================================

  /**
   * Merge multiple schemas
   */
  mergeSchemas<T extends ZodSchema[]>(...schemas: T): ZodSchema {
    return z.object({}).merge(schemas[0] as any);
  }

  /**
   * Create conditional schema
   */
  createConditionalSchema<T>(
    condition: (data: any) => boolean,
    trueSchema: ZodSchema<T>,
    falseSchema: ZodSchema<T>
  ): ZodSchema<T> {
    return z.any().superRefine((data, ctx) => {
      const schema = condition(data) ? trueSchema : falseSchema;
      const result = schema.safeParse(data);

      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue(issue);
        });
      }
    }) as ZodSchema<T>;
  }
}

// =========================================================================
// VALIDATION EXCEPTION
// =========================================================================

export class ValidationException extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.errors = errors;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      details: this.errors,
    };
  }
}

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Validate data with schema
 */
export function validateData<T>(
  data: any,
  schema: ZodSchema<T>
): T {
  const validator = InputValidationService.getInstance();
  const result = validator.validate(schema, data);

  if (!result.success) {
    throw new ValidationException(result.errors || []);
  }

  return result.data!;
}

export const inputValidationService = InputValidationService.getInstance();
