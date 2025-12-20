'use client';

/**
 * useFormValidation Hook
 * 
 * A React hook for form validation with Zod schemas.
 * Provides real-time validation, field-level errors, and form state management.
 */

import { useState, useCallback, useMemo } from 'react';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError, formatZodErrors, getFieldError } from '@/lib/validation';

// ============================================================================
// TYPES
// ============================================================================

export interface UseFormValidationOptions<T> {
  /** Initial form values */
  initialValues?: Partial<T>;
  /** Validate on change (default: false) */
  validateOnChange?: boolean;
  /** Validate on blur (default: true) */
  validateOnBlur?: boolean;
  /** Validate all fields initially (default: false) */
  validateOnMount?: boolean;
  /** Custom transform function before validation */
  transform?: (values: Partial<T>) => Partial<T>;
}

export interface UseFormValidationReturn<T> {
  /** Current form values */
  values: Partial<T>;
  /** Validation errors by field */
  errors: Record<string, string>;
  /** Whether the form has been touched */
  touched: Record<string, boolean>;
  /** Whether the form is currently valid */
  isValid: boolean;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Whether the form has been modified */
  isDirty: boolean;
  /** Set a single field value */
  setValue: (field: keyof T, value: unknown) => void;
  /** Set multiple field values */
  setValues: (values: Partial<T>) => void;
  /** Set a field as touched */
  setTouched: (field: keyof T) => void;
  /** Set an error for a field */
  setError: (field: keyof T, message: string) => void;
  /** Clear error for a field */
  clearError: (field: keyof T) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Validate a single field */
  validateField: (field: keyof T) => boolean;
  /** Validate all fields */
  validate: () => boolean;
  /** Reset form to initial values */
  reset: () => void;
  /** Get props for an input field */
  getFieldProps: (field: keyof T) => {
    value: unknown;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
  /** Get error message for a field */
  getFieldError: (field: keyof T) => string | undefined;
  /** Check if a field has an error */
  hasError: (field: keyof T) => boolean;
  /** Handle form submission */
  handleSubmit: (onSubmit: (data: T) => void | Promise<void>) => (e?: React.FormEvent) => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useFormValidation<T extends Record<string, unknown>>(
  schema: ZodSchema<T>,
  options: UseFormValidationOptions<T> = {}
): UseFormValidationReturn<T> {
  const {
    initialValues = {} as Partial<T>,
    validateOnChange = false,
    validateOnBlur = true,
    transform,
  } = options;

  // State
  const [values, setValuesState] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Computed values
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Validation functions
  const validateSingleField = useCallback((field: keyof T, value: unknown): string | undefined => {
    try {
      const partialSchema = schema as unknown as { shape?: Record<string, ZodSchema> };
      if (partialSchema.shape && partialSchema.shape[field as string]) {
        partialSchema.shape[field as string].parse(value);
      }
      return undefined;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = formatZodErrors(error);
        return fieldErrors[0]?.message;
      }
      return 'Validation error';
    }
  }, [schema]);

  const validateField = useCallback((field: keyof T): boolean => {
    const value = values[field];
    const error = validateSingleField(field, value);
    
    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }));
      return false;
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
      return true;
    }
  }, [values, validateSingleField]);

  const validate = useCallback((): boolean => {
    setIsValidating(true);
    
    try {
      const dataToValidate = transform ? transform(values) : values;
      schema.parse(dataToValidate);
      setErrors({});
      setIsValidating(false);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = formatZodErrors(error);
        const errorMap: Record<string, string> = {};
        fieldErrors.forEach((err) => {
          errorMap[err.field] = err.message;
        });
        setErrors(errorMap);
      }
      setIsValidating(false);
      return false;
    }
  }, [schema, values, transform]);

  // Value setters
  const setValue = useCallback((field: keyof T, value: unknown) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
    
    if (validateOnChange) {
      const error = validateSingleField(field, value);
      if (error) {
        setErrors((prev) => ({ ...prev, [field]: error }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field as string];
          return newErrors;
        });
      }
    }
  }, [validateOnChange, validateSingleField]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  // Touch handling
  const setTouched = useCallback((field: keyof T) => {
    setTouchedState((prev) => ({ ...prev, [field]: true }));
    
    if (validateOnBlur) {
      validateField(field);
    }
  }, [validateOnBlur, validateField]);

  // Error handling
  const setError = useCallback((field: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Reset
  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrors({});
    setTouchedState({});
  }, [initialValues]);

  // Field props helper
  const getFieldProps = useCallback((field: keyof T) => {
    const fieldId = `field-${String(field)}`;
    const errorId = `${fieldId}-error`;
    const hasFieldError = !!errors[field as string];

    return {
      value: values[field] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' 
          ? (e.target as HTMLInputElement).checked 
          : e.target.value;
        setValue(field, value);
      },
      onBlur: () => setTouched(field),
      'aria-invalid': hasFieldError,
      'aria-describedby': hasFieldError ? errorId : undefined,
    };
  }, [values, errors, setValue, setTouched]);

  // Error helpers
  const getFieldErrorFn = useCallback((field: keyof T): string | undefined => {
    return errors[field as string];
  }, [errors]);

  const hasError = useCallback((field: keyof T): boolean => {
    return !!errors[field as string];
  }, [errors]);

  // Submit handler
  const handleSubmit = useCallback(
    (onSubmit: (data: T) => void | Promise<void>) => {
      return async (e?: React.FormEvent) => {
        e?.preventDefault();
        
        if (validate()) {
          const dataToSubmit = transform ? transform(values) : values;
          await onSubmit(dataToSubmit as T);
        }
      };
    },
    [validate, values, transform]
  );

  return {
    values,
    errors,
    touched,
    isValid,
    isValidating,
    isDirty,
    setValue,
    setValues,
    setTouched,
    setError,
    clearError,
    clearErrors,
    validateField,
    validate,
    reset,
    getFieldProps,
    getFieldError: getFieldErrorFn,
    hasError,
    handleSubmit,
  };
}

export default useFormValidation;
