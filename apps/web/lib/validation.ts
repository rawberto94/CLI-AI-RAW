/**
 * Validation Utilities
 * Type-safe validation with composable validators
 * 
 * @example
 * // Define schema
 * const userSchema = createSchema({
 *   name: [required(), minLength(2), maxLength(100)],
 *   email: [required(), email()],
 *   age: [optional(), number(), min(0), max(150)],
 * });
 * 
 * // Validate
 * const result = validate(userSchema, data);
 * if (result.isValid) {
 *   console.log('Valid:', result.data);
 * } else {
 *   console.log('Errors:', result.errors);
 * }
 */

// ============================================================================
// Types
// ============================================================================

export type Validator<T = unknown> = (
  value: unknown,
  field: string
) => ValidationResult<T>;

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  error?: string;
}

export interface SchemaValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: Record<string, string>;
}

export type Schema<T> = {
  [K in keyof T]: Validator<T[K]>[];
};

// ============================================================================
// Core Validators
// ============================================================================

/**
 * Required value validator
 */
export function required<T>(message = 'This field is required'): Validator<T> {
  return (value, _field) => {
    if (value === undefined || value === null || value === '') {
      return { isValid: false, error: message };
    }
    return { isValid: true, value: value as T };
  };
}

/**
 * Optional value validator (allows undefined/null)
 */
export function optional<T>(): Validator<T | undefined> {
  return (value, _field) => {
    if (value === undefined || value === null || value === '') {
      return { isValid: true, value: undefined };
    }
    return { isValid: true, value: value as T };
  };
}

// ============================================================================
// String Validators
// ============================================================================

/**
 * Validate string type
 */
export function string(message = 'Must be a string'): Validator<string> {
  return (value, _field) => {
    if (typeof value !== 'string') {
      return { isValid: false, error: message };
    }
    return { isValid: true, value };
  };
}

/**
 * Minimum length validator
 */
export function minLength(min: number, message?: string): Validator<string> {
  return (value, field) => {
    if (typeof value !== 'string') {
      return { isValid: true, value: value as string };
    }
    if (value.length < min) {
      return {
        isValid: false,
        error: message || `${field} must be at least ${min} characters`,
      };
    }
    return { isValid: true, value };
  };
}

/**
 * Maximum length validator
 */
export function maxLength(max: number, message?: string): Validator<string> {
  return (value, field) => {
    if (typeof value !== 'string') {
      return { isValid: true, value: value as string };
    }
    if (value.length > max) {
      return {
        isValid: false,
        error: message || `${field} must be at most ${max} characters`,
      };
    }
    return { isValid: true, value };
  };
}

/**
 * Pattern validator
 */
export function pattern(regex: RegExp, message = 'Invalid format'): Validator<string> {
  return (value, _field) => {
    if (typeof value !== 'string') {
      return { isValid: true, value: value as string };
    }
    if (!regex.test(value)) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value };
  };
}

/**
 * Email validator
 */
export function email(message = 'Invalid email address'): Validator<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern(emailRegex, message);
}

/**
 * URL validator
 */
export function url(message = 'Invalid URL'): Validator<string> {
  return (value, _field) => {
    if (typeof value !== 'string') {
      return { isValid: true, value: value as string };
    }
    try {
      new URL(value);
      return { isValid: true, value };
    } catch {
      return { isValid: false, error: message };
    }
  };
}

/**
 * UUID validator
 */
export function uuid(message = 'Invalid UUID'): Validator<string> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return pattern(uuidRegex, message);
}

/**
 * Trim whitespace
 */
export function trim(): Validator<string> {
  return (value, _field) => {
    if (typeof value !== 'string') {
      return { isValid: true, value: value as string };
    }
    return { isValid: true, value: value.trim() };
  };
}

// ============================================================================
// Number Validators
// ============================================================================

/**
 * Validate number type
 */
export function number(message = 'Must be a number'): Validator<number> {
  return (value, _field) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof num !== 'number' || isNaN(num)) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value: num };
  };
}

/**
 * Integer validator
 */
export function integer(message = 'Must be an integer'): Validator<number> {
  return (value, _field) => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (typeof num !== 'number' || !Number.isInteger(num)) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value: num };
  };
}

/**
 * Minimum value validator
 */
export function min(minVal: number, message?: string): Validator<number> {
  return (value, field) => {
    if (typeof value !== 'number') {
      return { isValid: true, value: value as number };
    }
    if (value < minVal) {
      return {
        isValid: false,
        error: message || `${field} must be at least ${minVal}`,
      };
    }
    return { isValid: true, value };
  };
}

/**
 * Maximum value validator
 */
export function max(maxVal: number, message?: string): Validator<number> {
  return (value, field) => {
    if (typeof value !== 'number') {
      return { isValid: true, value: value as number };
    }
    if (value > maxVal) {
      return {
        isValid: false,
        error: message || `${field} must be at most ${maxVal}`,
      };
    }
    return { isValid: true, value };
  };
}

/**
 * Range validator
 */
export function range(minVal: number, maxVal: number, message?: string): Validator<number> {
  return (value, field) => {
    if (typeof value !== 'number') {
      return { isValid: true, value: value as number };
    }
    if (value < minVal || value > maxVal) {
      return {
        isValid: false,
        error: message || `${field} must be between ${minVal} and ${maxVal}`,
      };
    }
    return { isValid: true, value };
  };
}

/**
 * Positive number validator
 */
export function positive(message = 'Must be a positive number'): Validator<number> {
  return min(0, message);
}

// ============================================================================
// Boolean Validators
// ============================================================================

/**
 * Validate boolean type
 */
export function boolean(message = 'Must be a boolean'): Validator<boolean> {
  return (value, _field) => {
    if (typeof value === 'boolean') {
      return { isValid: true, value };
    }
    if (value === 'true' || value === '1') {
      return { isValid: true, value: true };
    }
    if (value === 'false' || value === '0') {
      return { isValid: true, value: false };
    }
    return { isValid: false, error: message };
  };
}

// ============================================================================
// Date Validators
// ============================================================================

/**
 * Validate date
 */
export function date(message = 'Invalid date'): Validator<Date> {
  return (value, _field) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return { isValid: true, value };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return { isValid: true, value: parsed };
      }
    }
    return { isValid: false, error: message };
  };
}

/**
 * Validate date is in the past
 */
export function pastDate(message = 'Date must be in the past'): Validator<Date> {
  return (value, _field) => {
    if (!(value instanceof Date)) {
      return { isValid: true, value: value as Date };
    }
    if (value >= new Date()) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value };
  };
}

/**
 * Validate date is in the future
 */
export function futureDate(message = 'Date must be in the future'): Validator<Date> {
  return (value, _field) => {
    if (!(value instanceof Date)) {
      return { isValid: true, value: value as Date };
    }
    if (value <= new Date()) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value };
  };
}

// ============================================================================
// Array Validators
// ============================================================================

/**
 * Validate array type
 */
export function array<T>(message = 'Must be an array'): Validator<T[]> {
  return (value, _field) => {
    if (!Array.isArray(value)) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value: value as T[] };
  };
}

/**
 * Validate array length
 */
export function arrayLength<T>(
  min: number,
  max?: number,
  message?: string
): Validator<T[]> {
  return (value, field) => {
    if (!Array.isArray(value)) {
      return { isValid: true, value: value as T[] };
    }
    if (value.length < min) {
      return {
        isValid: false,
        error: message || `${field} must have at least ${min} items`,
      };
    }
    if (max !== undefined && value.length > max) {
      return {
        isValid: false,
        error: message || `${field} must have at most ${max} items`,
      };
    }
    return { isValid: true, value };
  };
}

/**
 * Validate each item in array
 */
export function arrayOf<T>(validators: Validator<T>[]): Validator<T[]> {
  return (value, field) => {
    if (!Array.isArray(value)) {
      return { isValid: true, value: value as T[] };
    }

    const results: T[] = [];
    for (let i = 0; i < value.length; i++) {
      let currentValue: unknown = value[i];
      for (const validator of validators) {
        const result = validator(currentValue, `${field}[${i}]`);
        if (!result.isValid) {
          return result as ValidationResult<T[]>;
        }
        currentValue = result.value;
      }
      results.push(currentValue as T);
    }

    return { isValid: true, value: results };
  };
}

// ============================================================================
// Enum Validators
// ============================================================================

/**
 * Validate value is one of allowed values
 */
export function oneOf<T extends string | number>(
  values: readonly T[],
  message?: string
): Validator<T> {
  return (value, field) => {
    if (!values.includes(value as T)) {
      return {
        isValid: false,
        error: message || `${field} must be one of: ${values.join(', ')}`,
      };
    }
    return { isValid: true, value: value as T };
  };
}

// ============================================================================
// Custom Validators
// ============================================================================

/**
 * Create a custom validator
 */
export function custom<T>(
  fn: (value: unknown) => boolean,
  message: string
): Validator<T> {
  return (value, _field) => {
    if (!fn(value)) {
      return { isValid: false, error: message };
    }
    return { isValid: true, value: value as T };
  };
}

/**
 * Transform value
 */
export function transform<T, U>(fn: (value: T) => U): Validator<U> {
  return (value, _field) => {
    return { isValid: true, value: fn(value as T) };
  };
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Create a validation schema
 */
export function createSchema<T extends Record<string, unknown>>(
  schema: Schema<T>
): Schema<T> {
  return schema;
}

/**
 * Validate data against a schema
 */
export function validate<T extends Record<string, unknown>>(
  schema: Schema<T>,
  data: unknown
): SchemaValidationResult<T> {
  if (typeof data !== 'object' || data === null) {
    return {
      isValid: false,
      errors: { _root: 'Data must be an object' },
    };
  }

  const result: Partial<T> = {};
  const errors: Record<string, string> = {};

  for (const [field, validators] of Object.entries(schema) as [
    keyof T,
    Validator<T[keyof T]>[]
  ][]) {
    let value: unknown = (data as Record<string, unknown>)[field as string];

    for (const validator of validators) {
      const validationResult = validator(value, String(field));
      if (!validationResult.isValid) {
        errors[field as string] = validationResult.error!;
        break;
      }
      value = validationResult.value;
    }

    if (!errors[field as string]) {
      result[field] = value as T[keyof T];
    }
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    data: isValid ? (result as T) : undefined,
    errors,
  };
}

/**
 * Validate a single field
 */
export function validateField<T>(
  validators: Validator<T>[],
  value: unknown,
  field: string
): ValidationResult<T> {
  let currentValue = value;

  for (const validator of validators) {
    const result = validator(currentValue, field);
    if (!result.isValid) {
      return result;
    }
    currentValue = result.value;
  }

  return { isValid: true, value: currentValue as T };
}

// ============================================================================
// Export preset schemas
// ============================================================================

export const schemas = {
  email: [required<string>(), trim(), email()],
  password: [required<string>(), minLength(8), maxLength(128)],
  name: [required<string>(), trim(), minLength(2), maxLength(100)],
  url: [required<string>(), trim(), url()],
  uuid: [required<string>(), uuid()],
  positiveNumber: [required<number>(), number(), positive()],
  optionalString: [optional<string>(), trim()],
  optionalNumber: [optional<number>(), number()],
} as const;
