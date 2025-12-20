/**
 * Validation Utilities
 * 
 * Helper functions for validating data with Zod schemas.
 */

import { z, ZodError, ZodSchema } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate data against a Zod schema and return a result object.
 * 
 * @example
 * ```ts
 * const result = validate(loginSchema, { email: 'test@example.com', password: '123' });
 * if (!result.success) {
 *   console.log(result.errors);
 * }
 * ```
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    throw error;
  }
}

/**
 * Validate data and throw if invalid (for use in try-catch blocks)
 */
export function validateOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data);
}

/**
 * Safe parse that returns the data or undefined
 */
export function safeParse<T>(
  schema: ZodSchema<T>,
  data: unknown
): T | undefined {
  const result = schema.safeParse(data);
  return result.success ? result.data : undefined;
}

/**
 * Format Zod errors into a simpler structure
 */
export function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Get error message for a specific field from validation errors
 */
export function getFieldError(
  errors: ValidationError[] | undefined,
  field: string
): string | undefined {
  return errors?.find((e) => e.field === field)?.message;
}

/**
 * Check if a field has an error
 */
export function hasFieldError(
  errors: ValidationError[] | undefined,
  field: string
): boolean {
  return errors?.some((e) => e.field === field) ?? false;
}

/**
 * Convert validation errors to a field-keyed object
 */
export function errorsToObject(
  errors: ValidationError[] | undefined
): Record<string, string> {
  if (!errors) return {};
  return errors.reduce((acc, error) => {
    acc[error.field] = error.message;
    return acc;
  }, {} as Record<string, string>);
}

// ============================================================================
// ASYNC VALIDATION
// ============================================================================

/**
 * Validate data asynchronously (for schemas with async refinements)
 */
export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  try {
    const validData = await schema.parseAsync(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    throw error;
  }
}

// ============================================================================
// FORM HELPERS
// ============================================================================

/**
 * Create a form validator for React Hook Form or similar libraries
 */
export function createFormValidator<T>(schema: ZodSchema<T>) {
  return {
    validate: (data: unknown) => validate(schema, data),
    validateField: (field: keyof T, value: unknown) => {
      // For simple validation, just validate the full data
      // Field-level validation requires more complex schema introspection
      return validate(schema, { [field]: value } as unknown);
    },
  };
}

/**
 * Transform form data to the correct types before validation
 */
export function transformFormData(data: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  data.forEach((value, key) => {
    // Handle file inputs
    if (value instanceof File) {
      result[key] = value;
      return;
    }
    
    // Handle arrays (e.g., name="tags[]")
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!result[arrayKey]) {
        result[arrayKey] = [];
      }
      (result[arrayKey] as unknown[]).push(value);
      return;
    }
    
    // Handle nested objects (e.g., name="address.city")
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]!] = value;
      return;
    }
    
    // Handle booleans
    if (value === 'true' || value === 'false') {
      result[key] = value === 'true';
      return;
    }
    
    // Handle numbers
    if (!isNaN(Number(value)) && value !== '') {
      result[key] = Number(value);
      return;
    }
    
    result[key] = value;
  });
  
  return result;
}

// ============================================================================
// CUSTOM VALIDATORS
// ============================================================================

/**
 * Create a custom validator with error message
 */
export function createValidator<T>(
  validate: (value: T) => boolean,
  message: string
) {
  return z.custom<T>((val) => validate(val as T), { message });
}

/**
 * Validate that a value is not empty (after trimming)
 */
export function nonEmpty(message = 'This field cannot be empty') {
  return z.string().trim().min(1, message);
}

/**
 * Validate that an array has at least N items
 */
export function minItems<T>(min: number, message?: string) {
  return z.array(z.any()).min(min, message || `At least ${min} item(s) required`) as unknown as z.ZodArray<z.ZodType<T>>;
}

/**
 * Validate that a value matches one of the allowed values
 */
export function oneOf<T extends string>(values: readonly T[], message?: string) {
  return z.enum(values as [T, ...T[]], {
    errorMap: () => ({ message: message || `Must be one of: ${values.join(', ')}` }),
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export * from './schemas';
