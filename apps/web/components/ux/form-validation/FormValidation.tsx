'use client';

import React, {
  memo,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  forwardRef,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'warning';

export interface ValidationRule {
  validate: (value: string) => boolean | Promise<boolean>;
  message: string;
}

export interface FieldFeedback {
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
}

// ============================================================================
// Validation Status Indicator
// ============================================================================

interface ValidationStatusProps {
  state: ValidationState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const ValidationStatus = memo(function ValidationStatus({
  state,
  size = 'md',
  className = '',
}: ValidationStatusProps) {
  const iconClass = sizeClasses[size];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <AnimatePresence mode="wait">
        {state === 'validating' && (
          <motion.div
            key="validating"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <Loader2 className={`${iconClass} text-violet-500 animate-spin`} />
          </motion.div>
        )}
        {state === 'valid' && (
          <motion.div
            key="valid"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <CheckCircle2 className={`${iconClass} text-green-500`} />
          </motion.div>
        )}
        {state === 'invalid' && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <XCircle className={`${iconClass} text-red-500`} />
          </motion.div>
        )}
        {state === 'warning' && (
          <motion.div
            key="warning"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
          >
            <AlertCircle className={`${iconClass} text-yellow-500`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================================================
// Inline Feedback Message
// ============================================================================

interface InlineFeedbackProps {
  feedback: FieldFeedback | null;
  className?: string;
}

export const InlineFeedback = memo(function InlineFeedback({
  feedback,
  className = '',
}: InlineFeedbackProps) {
  const getIcon = () => {
    switch (feedback?.type) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'info':
        return <Info className="w-4 h-4 text-violet-500 flex-shrink-0" />;
      default:
        return null;
    }
  };

  const getTextColor = () => {
    switch (feedback?.type) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'info':
        return 'text-violet-600 dark:text-violet-400';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div key="feedback"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.2 }}
          className={`flex items-start gap-1.5 mt-1.5 text-sm ${getTextColor()} ${className}`}
        >
          {getIcon()}
          <span>{feedback.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Field Wrapper with Label
// ============================================================================

interface FieldWrapperProps {
  label?: string;
  required?: boolean;
  hint?: string;
  feedback?: FieldFeedback | null;
  validationState?: ValidationState;
  children: ReactNode;
  className?: string;
}

export const FieldWrapper = memo(function FieldWrapper({
  label,
  required,
  hint,
  feedback,
  validationState = 'idle',
  children,
  className = '',
}: FieldWrapperProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          {validationState !== 'idle' && (
            <ValidationStatus state={validationState} size="sm" />
          )}
        </div>
      )}
      {hint && !feedback && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {children}
      <InlineFeedback feedback={feedback ?? null} />
    </div>
  );
});

// ============================================================================
// Validated Input
// ============================================================================

interface ValidatedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  hint?: string;
  rules?: ValidationRule[];
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
  showPasswordToggle?: boolean;
  onChange?: (value: string) => void;
  onValidationChange?: (state: ValidationState, errors: string[]) => void;
}

export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  function ValidatedInput(
    {
      label,
      hint,
      rules = [],
      validateOnBlur = true,
      validateOnChange = false,
      debounceMs = 300,
      showPasswordToggle = false,
      onChange,
      onValidationChange,
      className = '',
      type = 'text',
      required,
      ...props
    },
    ref
  ) {
    const [value, setValue] = useState((props.value as string) || '');
    const [validationState, setValidationState] = useState<ValidationState>('idle');
    const [feedback, setFeedback] = useState<FieldFeedback | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState(false);

    const validate = useCallback(async () => {
      if (!rules.length) return;

      setValidationState('validating');
      const errors: string[] = [];

      for (const rule of rules) {
        const isValid = await rule.validate(value);
        if (!isValid) {
          errors.push(rule.message);
        }
      }

      if (errors.length > 0) {
        setValidationState('invalid');
        setFeedback({ type: 'error', message: errors[0] });
        onValidationChange?.('invalid', errors);
      } else {
        setValidationState('valid');
        setFeedback({ type: 'success', message: 'Looks good!' });
        onValidationChange?.('valid', []);
      }
    }, [rules, value, onValidationChange]);

    useEffect(() => {
      if (!touched || !validateOnChange) return;

      const timeout = setTimeout(() => {
        if (value) validate();
        else {
          setValidationState('idle');
          setFeedback(null);
        }
      }, debounceMs);

      return () => clearTimeout(timeout);
    }, [value, touched, validateOnChange, debounceMs, validate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange?.(newValue);
    };

    const handleBlur = () => {
      setTouched(true);
      if (validateOnBlur && value) {
        validate();
      }
    };

    const getBorderColor = () => {
      switch (validationState) {
        case 'valid':
          return 'border-green-500 focus:ring-green-500';
        case 'invalid':
          return 'border-red-500 focus:ring-red-500';
        case 'warning':
          return 'border-yellow-500 focus:ring-yellow-500';
        default:
          return 'border-gray-300 dark:border-gray-600 focus:ring-violet-500';
      }
    };

    const inputType = type === 'password' && showPassword ? 'text' : type;

    return (
      <FieldWrapper
        label={label}
        required={required}
        hint={hint}
        feedback={touched ? feedback : null}
        validationState={touched ? validationState : 'idle'}
      >
        <div className="relative">
          <input
            ref={ref}
            type={inputType}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`
              w-full px-3 py-2 rounded-lg border
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-offset-0
              transition-colors duration-200
              ${getBorderColor()}
              ${showPasswordToggle ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {showPasswordToggle && type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          )}
        </div>
      </FieldWrapper>
    );
  }
);

// ============================================================================
// Password Strength Indicator
// ============================================================================

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export const PasswordStrength = memo(function PasswordStrength({
  password,
  className = '',
}: PasswordStrengthProps) {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;

    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score <= 5) return { score, label: 'Good', color: 'bg-violet-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const { score, label, color } = getStrength(password);
  const percentage = (score / 6) * 100;

  if (!password) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">Password strength</span>
        <span
          className={`font-medium ${
            color === 'bg-red-500'
              ? 'text-red-500'
              : color === 'bg-yellow-500'
              ? 'text-yellow-500'
              : color === 'bg-violet-500'
              ? 'text-violet-500'
              : 'text-green-500'
          }`}
        >
          {label}
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
});

// ============================================================================
// Character Counter
// ============================================================================

interface CharacterCounterProps {
  current: number;
  max: number;
  warningThreshold?: number;
  className?: string;
}

export const CharacterCounter = memo(function CharacterCounter({
  current,
  max,
  warningThreshold = 0.9,
  className = '',
}: CharacterCounterProps) {
  const percentage = current / max;
  const isWarning = percentage >= warningThreshold;
  const isOver = percentage > 1;

  return (
    <motion.div
      className={`text-xs font-medium ${className}`}
      animate={{
        color: isOver ? '#ef4444' : isWarning ? '#f59e0b' : '#6b7280',
      }}
    >
      <span className={isOver ? 'text-red-500' : ''}>{current}</span>
      <span className="text-gray-400">/</span>
      <span>{max}</span>
    </motion.div>
  );
});

// ============================================================================
// Validated Textarea
// ============================================================================

interface ValidatedTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  hint?: string;
  maxChars?: number;
  showCounter?: boolean;
  onChange?: (value: string) => void;
}

export const ValidatedTextarea = forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  function ValidatedTextarea(
    {
      label,
      hint,
      maxChars,
      showCounter = true,
      onChange,
      className = '',
      required,
      ...props
    },
    ref
  ) {
    const [value, setValue] = useState((props.value as string) || '');
    const [feedback, setFeedback] = useState<FieldFeedback | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange?.(newValue);

      if (maxChars && newValue.length > maxChars) {
        setFeedback({
          type: 'error',
          message: `Maximum ${maxChars} characters allowed`,
        });
      } else {
        setFeedback(null);
      }
    };

    const isOverLimit = maxChars ? value.length > maxChars : false;

    return (
      <FieldWrapper
        label={label}
        required={required}
        hint={hint}
        feedback={feedback}
      >
        <div className="relative">
          <textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            className={`
              w-full px-3 py-2 rounded-lg border
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-offset-0
              transition-colors duration-200
              resize-y min-h-[100px]
              ${
                isOverLimit
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-violet-500'
              }
              ${className}
            `}
            {...props}
          />
          {showCounter && maxChars && (
            <div className="absolute bottom-2 right-2">
              <CharacterCounter current={value.length} max={maxChars} />
            </div>
          )}
        </div>
      </FieldWrapper>
    );
  }
);

// ============================================================================
// Form Submission Feedback
// ============================================================================

interface SubmitFeedbackProps {
  state: 'idle' | 'submitting' | 'success' | 'error';
  successMessage?: string;
  errorMessage?: string;
  className?: string;
}

export const SubmitFeedback = memo(function SubmitFeedback({
  state,
  successMessage = 'Submitted successfully!',
  errorMessage = 'Something went wrong. Please try again.',
  className = '',
}: SubmitFeedbackProps) {
  return (
    <AnimatePresence mode="wait">
      {state === 'submitting' && (
        <motion.div
          key="submitting"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`flex items-center gap-2 text-violet-600 dark:text-violet-400 ${className}`}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Submitting...</span>
        </motion.div>
      )}
      {state === 'success' && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`flex items-center gap-2 text-green-600 dark:text-green-400 ${className}`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMessage}</span>
        </motion.div>
      )}
      {state === 'error' && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`flex items-center gap-2 text-red-600 dark:text-red-400 ${className}`}
        >
          <XCircle className="w-5 h-5" />
          <span>{errorMessage}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Form Error Summary
// ============================================================================

interface FormErrorSummaryProps {
  errors: { field: string; message: string }[];
  onFieldClick?: (field: string) => void;
  className?: string;
}

export const FormErrorSummary = memo(function FormErrorSummary({
  errors,
  onFieldClick,
  className = '',
}: FormErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
            Please fix the following errors:
          </h4>
          <ul className="mt-2 space-y-1">
            {errors.map((error, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="text-sm text-red-600 dark:text-red-400"
              >
                <button
                  type="button"
                  onClick={() => onFieldClick?.(error.field)}
                  className="hover:underline text-left"
                >
                  <span className="font-medium">{error.field}:</span> {error.message}
                </button>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Common Validation Rules
// ============================================================================

export const validationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => regex.test(value),
    message,
  }),

  phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
    validate: (value) => /^[+]?[\d\s()-]{10,}$/.test(value),
    message,
  }),

  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  match: (getValue: () => string, message = 'Values do not match'): ValidationRule => ({
    validate: (value) => value === getValue(),
    message,
  }),

  number: (message = 'Please enter a valid number'): ValidationRule => ({
    validate: (value) => !isNaN(Number(value)),
    message,
  }),

  min: (min: number, message?: string): ValidationRule => ({
    validate: (value) => Number(value) >= min,
    message: message || `Must be at least ${min}`,
  }),

  max: (max: number, message?: string): ValidationRule => ({
    validate: (value) => Number(value) <= max,
    message: message || `Must be no more than ${max}`,
  }),
};
