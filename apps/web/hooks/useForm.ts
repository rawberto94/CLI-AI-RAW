"use client";

/**
 * useForm Hook
 * 
 * Lightweight form state management with validation, dirty tracking,
 * and submission handling. For complex forms, consider react-hook-form.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export type ValidationRule<T> = (value: T, formValues: Record<string, unknown>) => string | undefined;

export type FieldValidation<T> = ValidationRule<T> | ValidationRule<T>[];

export interface FieldConfig<T = unknown> {
  /** Initial value */
  initialValue: T;
  /** Validation rules */
  validate?: FieldValidation<T>;
  /** Transform value on change */
  transform?: (value: T) => T;
  /** Parse value from input */
  parse?: (value: unknown) => T;
}

export type FormConfig<T extends Record<string, unknown>> = {
  [K in keyof T]: FieldConfig<T[K]> | T[K];
};

export interface FormState<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isDirty: boolean;
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
}

export interface FieldHelpers<T> {
  value: T;
  error: string | undefined;
  touched: boolean;
  isDirty: boolean;
  onChange: (value: T | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onBlur: () => void;
  reset: () => void;
  setValue: (value: T) => void;
  setError: (error: string | undefined) => void;
}

export interface UseFormOptions<T extends Record<string, unknown>> {
  /** Form configuration */
  config: FormConfig<T>;
  /** Validate on change */
  validateOnChange?: boolean;
  /** Validate on blur */
  validateOnBlur?: boolean;
  /** Validate on submit */
  validateOnSubmit?: boolean;
  /** Submit handler */
  onSubmit?: (values: T) => void | Promise<void>;
  /** Error handler */
  onError?: (errors: Partial<Record<keyof T, string>>) => void;
}

export interface UseFormReturn<T extends Record<string, unknown>> {
  /** Current form state */
  state: FormState<T>;
  /** Get field helpers */
  getField: <K extends keyof T>(name: K) => FieldHelpers<T[K]>;
  /** Set a field value */
  setValue: <K extends keyof T>(name: K, value: T[K]) => void;
  /** Set multiple values */
  setValues: (values: Partial<T>) => void;
  /** Set a field error */
  setError: <K extends keyof T>(name: K, error: string | undefined) => void;
  /** Set multiple errors */
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  /** Touch a field */
  touch: <K extends keyof T>(name: K) => void;
  /** Validate a single field */
  validateField: <K extends keyof T>(name: K) => string | undefined;
  /** Validate all fields */
  validate: () => boolean;
  /** Reset form to initial values */
  reset: (values?: Partial<T>) => void;
  /** Submit the form */
  submit: () => Promise<void>;
  /** Handle form submission event */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  /** Register props for an input */
  register: <K extends keyof T>(name: K) => {
    name: K;
    value: T[K];
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: () => void;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function isFieldConfig<T>(value: FieldConfig<T> | T): value is FieldConfig<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "initialValue" in value
  );
}

function getInitialValue<T>(config: FieldConfig<T> | T): T {
  return isFieldConfig(config) ? config.initialValue : config;
}

function getFieldConfig<T>(config: FieldConfig<T> | T): FieldConfig<T> {
  return isFieldConfig(config) ? config : { initialValue: config };
}

function runValidation<T>(
  value: T,
  validation: FieldValidation<T> | undefined,
  formValues: Record<string, unknown>
): string | undefined {
  if (!validation) return undefined;

  const rules = Array.isArray(validation) ? validation : [validation];
  for (const rule of rules) {
    const error = rule(value, formValues);
    if (error) return error;
  }
  return undefined;
}

// ============================================================================
// Built-in Validators
// ============================================================================

export const validators = {
  required: (message = "This field is required"): ValidationRule<unknown> => 
    (value) => {
      if (value === undefined || value === null || value === "") {
        return message;
      }
      return undefined;
    },

  minLength: (min: number, message?: string): ValidationRule<string> =>
    (value) => {
      if (value.length < min) {
        return message ?? `Must be at least ${min} characters`;
      }
      return undefined;
    },

  maxLength: (max: number, message?: string): ValidationRule<string> =>
    (value) => {
      if (value.length > max) {
        return message ?? `Must be at most ${max} characters`;
      }
      return undefined;
    },

  email: (message = "Invalid email address"): ValidationRule<string> =>
    (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return message;
      }
      return undefined;
    },

  pattern: (regex: RegExp, message: string): ValidationRule<string> =>
    (value) => {
      if (value && !regex.test(value)) {
        return message;
      }
      return undefined;
    },

  min: (min: number, message?: string): ValidationRule<number> =>
    (value) => {
      if (value < min) {
        return message ?? `Must be at least ${min}`;
      }
      return undefined;
    },

  max: (max: number, message?: string): ValidationRule<number> =>
    (value) => {
      if (value > max) {
        return message ?? `Must be at most ${max}`;
      }
      return undefined;
    },

  match: <T>(fieldName: string, message?: string): ValidationRule<T> =>
    (value, formValues) => {
      if (value !== formValues[fieldName]) {
        return message ?? `Must match ${fieldName}`;
      }
      return undefined;
    },

  custom: <T>(validator: (value: T) => boolean, message: string): ValidationRule<T> =>
    (value) => {
      if (!validator(value)) {
        return message;
      }
      return undefined;
    },
};

// ============================================================================
// useForm Hook
// ============================================================================

export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    config,
    validateOnChange = true,
    validateOnBlur = true,
    validateOnSubmit = true,
    onSubmit,
    onError,
  } = options;

  // Extract initial values from config
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const [key, fieldConfig] of Object.entries(config)) {
      values[key] = getInitialValue(fieldConfig);
    }
    return values as T;
  }, [config]);

  // Form state
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  const initialValuesRef = useRef(initialValues);

  // Computed state
  const isDirty = useMemo(() => {
    return Object.keys(values).some(
      (key) => values[key as keyof T] !== initialValuesRef.current[key as keyof T]
    );
  }, [values]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // State object
  const state: FormState<T> = useMemo(() => ({
    values,
    errors,
    touched,
    isDirty,
    isValid,
    isSubmitting,
    submitCount,
  }), [values, errors, touched, isDirty, isValid, isSubmitting, submitCount]);

  // Validate a single field
  const validateField = useCallback(<K extends keyof T>(name: K): string | undefined => {
    const fieldConfig = getFieldConfig(config[name]);
    const value = values[name];
    return runValidation(value, fieldConfig.validate as FieldValidation<T[K]>, values as Record<string, unknown>);
  }, [config, values]);

  // Validate all fields
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let hasErrors = false;

    for (const key of Object.keys(config) as (keyof T)[]) {
      const error = validateField(key);
      if (error) {
        newErrors[key] = error;
        hasErrors = true;
      }
    }

    setErrors(newErrors);
    if (hasErrors && onError) {
      onError(newErrors);
    }
    return !hasErrors;
  }, [config, validateField, onError]);

  // Set a single value
  const setValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    const configValue = config[name] as FieldConfig<T[K]> | T[K] | undefined;
    if (configValue === undefined) return;
    const fieldConfig = getFieldConfig<T[K]>(configValue as FieldConfig<T[K]> | T[K]);
    const transformedValue = fieldConfig.transform
      ? fieldConfig.transform(value)
      : value;

    setValues((prev) => ({ ...prev, [name]: transformedValue }));

    if (validateOnChange) {
      const error = runValidation(
        transformedValue,
        fieldConfig.validate as FieldValidation<T[K]>,
        { ...values, [name]: transformedValue } as Record<string, unknown>
      );
      setErrors((prev) => {
        if (error) {
          return { ...prev, [name]: error };
        }
        const { [name]: _, ...rest } = prev;
        return rest as Partial<Record<keyof T, string>>;
      });
    }
  }, [config, validateOnChange, values]);

  // Set multiple values
  const setValuesMultiple = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  // Set a single error
  const setError = useCallback(<K extends keyof T>(name: K, error: string | undefined) => {
    setErrors((prev) => {
      if (error) {
        return { ...prev, [name]: error };
      }
      const { [name]: _, ...rest } = prev;
      return rest as Partial<Record<keyof T, string>>;
    });
  }, []);

  // Set multiple errors
  const setErrorsMultiple = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setErrors(newErrors);
  }, []);

  // Touch a field
  const touch = useCallback(<K extends keyof T>(name: K) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    
    if (validateOnBlur) {
      const error = validateField(name);
      setErrors((prev) => {
        if (error) {
          return { ...prev, [name]: error };
        }
        const { [name]: _, ...rest } = prev;
        return rest as Partial<Record<keyof T, string>>;
      });
    }
  }, [validateOnBlur, validateField]);

  // Reset form
  const reset = useCallback((newValues?: Partial<T>) => {
    const resetValues = newValues
      ? { ...initialValuesRef.current, ...newValues }
      : initialValuesRef.current;
    
    setValues(resetValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, []);

  // Submit form
  const submit = useCallback(async () => {
    setSubmitCount((c) => c + 1);

    if (validateOnSubmit) {
      const isFormValid = validate();
      if (!isFormValid) {
        return;
      }
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [validateOnSubmit, validate, onSubmit, values]);

  // Handle form submission event
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    await submit();
  }, [submit]);

  // Get field helpers
  const getField = useCallback(<K extends keyof T>(name: K): FieldHelpers<T[K]> => {
    const fieldConfig = getFieldConfig(config[name]);
    const value = values[name];
    const error = errors[name];
    const isTouched = touched[name] ?? false;
    const fieldIsDirty = value !== initialValuesRef.current[name];

    const onChange = (
      valueOrEvent: T[K] | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
      let newValue: T[K];
      if (
        valueOrEvent &&
        typeof valueOrEvent === "object" &&
        "target" in valueOrEvent
      ) {
        const target = valueOrEvent.target;
        if (target.type === "checkbox") {
          newValue = (target as HTMLInputElement).checked as T[K];
        } else if (target.type === "number") {
          newValue = (parseFloat(target.value) || 0) as T[K];
        } else {
          newValue = (fieldConfig.parse
            ? fieldConfig.parse(target.value)
            : target.value) as T[K];
        }
      } else {
        newValue = valueOrEvent as T[K];
      }
      setValue(name, newValue);
    };

    const onBlur = () => {
      touch(name);
    };

    const fieldReset = () => {
      setValue(name, initialValuesRef.current[name]);
      setTouched((prev) => {
        const { [name]: _, ...rest } = prev;
        return rest as Partial<Record<keyof T, boolean>>;
      });
    };

    const fieldSetValue = (newValue: T[K]) => {
      setValue(name, newValue);
    };

    const fieldSetError = (newError: string | undefined) => {
      setError(name, newError);
    };

    return {
      value,
      error,
      touched: isTouched,
      isDirty: fieldIsDirty,
      onChange,
      onBlur,
      reset: fieldReset,
      setValue: fieldSetValue,
      setError: fieldSetError,
    };
  }, [config, values, errors, touched, setValue, touch, setError]);

  // Register props for an input
  const register = useCallback(<K extends keyof T>(name: K) => {
    const field = getField(name);
    return {
      name,
      value: field.value,
      onChange: field.onChange as (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
      onBlur: field.onBlur,
    };
  }, [getField]);

  return {
    state,
    getField,
    setValue,
    setValues: setValuesMultiple,
    setError,
    setErrors: setErrorsMultiple,
    touch,
    validateField,
    validate,
    reset,
    submit,
    handleSubmit,
    register,
  };
}

// ============================================================================
// useFieldArray Hook
// ============================================================================

export interface UseFieldArrayOptions<T> {
  /** Initial items */
  initialItems?: T[];
  /** Maximum items */
  max?: number;
  /** Minimum items */
  min?: number;
}

export interface UseFieldArrayReturn<T> {
  /** Current items */
  items: T[];
  /** Add an item */
  append: (item: T) => void;
  /** Insert at index */
  insert: (index: number, item: T) => void;
  /** Remove at index */
  remove: (index: number) => void;
  /** Move item from one index to another */
  move: (from: number, to: number) => void;
  /** Swap two items */
  swap: (indexA: number, indexB: number) => void;
  /** Update item at index */
  update: (index: number, item: T) => void;
  /** Replace all items */
  replace: (items: T[]) => void;
  /** Clear all items */
  clear: () => void;
  /** Check if can add more items */
  canAdd: boolean;
  /** Check if can remove items */
  canRemove: boolean;
}

export function useFieldArray<T>(
  options: UseFieldArrayOptions<T> = {}
): UseFieldArrayReturn<T> {
  const { initialItems = [], max, min = 0 } = options;
  const [items, setItems] = useState<T[]>(initialItems);

  const canAdd = max === undefined || items.length < max;
  const canRemove = items.length > min;

  const append = useCallback((item: T) => {
    if (max === undefined || items.length < max) {
      setItems((prev) => [...prev, item]);
    }
  }, [items.length, max]);

  const insert = useCallback((index: number, item: T) => {
    if (max === undefined || items.length < max) {
      setItems((prev) => [
        ...prev.slice(0, index),
        item,
        ...prev.slice(index),
      ]);
    }
  }, [items.length, max]);

  const remove = useCallback((index: number) => {
    if (items.length > min) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  }, [items.length, min]);

  const move = useCallback((from: number, to: number) => {
    setItems((prev) => {
      const newItems = [...prev];
      const [item] = newItems.splice(from, 1);
      if (item !== undefined) {
        newItems.splice(to, 0, item);
      }
      return newItems;
    });
  }, []);

  const swap = useCallback((indexA: number, indexB: number) => {
    setItems((prev) => {
      const newItems = [...prev];
      const itemA = newItems[indexA];
      const itemB = newItems[indexB];
      if (itemA !== undefined && itemB !== undefined) {
        newItems[indexA] = itemB;
        newItems[indexB] = itemA;
      }
      return newItems;
    });
  }, []);

  const update = useCallback((index: number, item: T) => {
    setItems((prev) => prev.map((existing, i) => (i === index ? item : existing)));
  }, []);

  const replace = useCallback((newItems: T[]) => {
    setItems(newItems);
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    append,
    insert,
    remove,
    move,
    swap,
    update,
    replace,
    clear,
    canAdd,
    canRemove,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useForm;
