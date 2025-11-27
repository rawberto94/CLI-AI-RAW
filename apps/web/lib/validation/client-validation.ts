/**
 * Client-Side Validation Utilities
 * 
 * Provides validation helpers for React forms and components
 */

import { z, ZodSchema, ZodError } from 'zod';

// =========================================================================
// TYPES
// =========================================================================

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export interface FieldValidationResult {
  valid: boolean;
  error?: string;
}

// =========================================================================
// VALIDATION FUNCTIONS
// =========================================================================

/**
 * Validate data against a Zod schema
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string> = {};
      
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });

      return {
        success: false,
        errors,
      };
    }

    return {
      success: false,
      errors: { _form: 'Validation failed' },
    };
  }
}

/**
 * Validate a single field
 */
export function validateField<T>(
  schema: ZodSchema<T>,
  value: unknown
): FieldValidationResult {
  try {
    schema.parse(value);
    return { valid: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        valid: false,
        error: error.errors[0]?.message || 'Invalid value',
      };
    }

    return {
      valid: false,
      error: 'Validation failed',
    };
  }
}

/**
 * Validate form data
 */
export function validateForm<T>(
  schema: ZodSchema<T>,
  formData: FormData
): ValidationResult<T> {
  const data: Record<string, any> = {};

  formData.forEach((value, key) => {
    // Handle multiple values for same key
    if (data[key]) {
      if (Array.isArray(data[key])) {
        data[key].push(value);
      } else {
        data[key] = [data[key], value];
      }
    } else {
      data[key] = value;
    }
  });

  return validate(schema, data);
}

// =========================================================================
// COMMON VALIDATORS
// =========================================================================

/**
 * Email validator
 */
export const emailValidator = z.string().email('Invalid email address');

/**
 * Password validator
 */
export const passwordValidator = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * URL validator
 */
export const urlValidator = z.string().url('Invalid URL');

/**
 * Phone validator
 */
export const phoneValidator = z
  .string()
  .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format');

/**
 * Date validator
 */
export const dateValidator = z.string().datetime('Invalid date format');

/**
 * UUID validator
 */
export const uuidValidator = z.string().uuid('Invalid ID format');

/**
 * Required string validator
 */
export const requiredStringValidator = z
  .string()
  .min(1, 'This field is required');

/**
 * Optional string validator
 */
export const optionalStringValidator = z.string().optional();

/**
 * Positive number validator
 */
export const positiveNumberValidator = z
  .number()
  .positive('Must be a positive number');

/**
 * Non-negative number validator
 */
export const nonNegativeNumberValidator = z
  .number()
  .nonnegative('Must be non-negative');

// =========================================================================
// SANITIZATION HELPERS
// =========================================================================

/**
 * Sanitize string input
 */
export function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '');
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d\+\-\(\)\s]/g, '');
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  let sanitized = url.trim();
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/^javascript:/gi, '');
  
  // Ensure https:// prefix
  if (!/^https?:\/\//i.test(sanitized)) {
    sanitized = 'https://' + sanitized;
  }
  
  return sanitized;
}

// =========================================================================
// REACT HOOK FORM HELPERS
// =========================================================================

/**
 * Convert Zod schema to React Hook Form resolver
 */
export function zodResolver<T>(schema: ZodSchema<T>) {
  return async (data: any) => {
    try {
      const validated = schema.parse(data);
      return {
        values: validated,
        errors: {},
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, any> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          errors[path] = {
            type: err.code,
            message: err.message,
          };
        });

        return {
          values: {},
          errors,
        };
      }

      return {
        values: {},
        errors: {
          _form: {
            type: 'validation',
            message: 'Validation failed',
          },
        },
      };
    }
  };
}

// =========================================================================
// VALIDATION MESSAGES
// =========================================================================

export const validationMessages = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  url: 'Please enter a valid URL',
  phone: 'Please enter a valid phone number',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`,
  min: (min: number) => `Must be at least ${min}`,
  max: (max: number) => `Must be no more than ${max}`,
  positive: 'Must be a positive number',
  nonNegative: 'Must be non-negative',
  integer: 'Must be a whole number',
  uuid: 'Invalid ID format',
  date: 'Invalid date format',
  dateRange: 'End date must be after start date',
};

// =========================================================================
// VALIDATION UTILITIES
// =========================================================================

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Get first error message from validation result
 */
export function getFirstError(errors?: Record<string, string>): string | undefined {
  if (!errors) return undefined;
  const keys = Object.keys(errors);
  const firstKey = keys[0];
  return keys.length > 0 && firstKey ? errors[firstKey] : undefined;
}

/**
 * Check if validation result has errors
 */
export function hasErrors(result: ValidationResult): boolean {
  return !result.success && !!result.errors && Object.keys(result.errors).length > 0;
}

/**
 * Format validation errors for display
 */
export function formatErrors(errors: Record<string, string>): string[] {
  return Object.entries(errors).map(([field, message]) => {
    const fieldName = field.replace(/([A-Z])/g, ' $1').trim();
    return `${fieldName}: ${message}`;
  });
}
