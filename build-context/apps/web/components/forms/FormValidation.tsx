'use client';

/**
 * Form Validation Feedback Components
 * Enhanced visual feedback for form validation states
 */

import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// ============================================================================
// Types
// ============================================================================

export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'warning';

export interface ValidationMessage {
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
}

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  warning?: string;
  success?: string;
  required?: boolean;
  validating?: boolean;
  showCounter?: boolean;
  maxLength?: number;
  value?: string;
  className?: string;
  children?: React.ReactNode;
}

// ============================================================================
// Validation Icons
// ============================================================================

const validationIcons = {
  error: { icon: AlertCircle, color: 'text-red-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  success: { icon: CheckCircle2, color: 'text-violet-500' },
  info: { icon: Info, color: 'text-violet-500' },
  validating: { icon: Loader2, color: 'text-slate-400' },
};

// ============================================================================
// Validation Message Component
// ============================================================================

interface ValidationMessageDisplayProps {
  type: keyof typeof validationIcons;
  message: string;
  className?: string;
}

export function ValidationMessageDisplay({ type, message, className }: ValidationMessageDisplayProps) {
  const { icon: Icon, color } = validationIcons[type];
  const isValidating = type === 'validating';

  return (
    <motion.div
      initial={{ opacity: 0, y: -5, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -5, height: 0 }}
      className={cn("flex items-start gap-1.5 mt-1.5", className)}
    >
      <Icon className={cn(
        "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
        color,
        isValidating && "animate-spin"
      )} />
      <span className={cn(
        "text-xs",
        type === 'error' && "text-red-600 dark:text-red-400",
        type === 'warning' && "text-amber-600 dark:text-amber-400",
        type === 'success' && "text-violet-600 dark:text-violet-400",
        type === 'info' && "text-violet-600 dark:text-violet-400",
        isValidating && "text-slate-500"
      )}>
        {message}
      </span>
    </motion.div>
  );
}

// ============================================================================
// Form Field Wrapper
// ============================================================================

export function FormField({
  label,
  hint,
  error,
  warning,
  success,
  required,
  validating,
  showCounter,
  maxLength,
  value = '',
  className,
  children,
}: FormFieldProps) {
  const charCount = value.length;
  const charRemaining = maxLength ? maxLength - charCount : null;
  const isNearLimit = charRemaining !== null && charRemaining <= 20;
  const isAtLimit = charRemaining !== null && charRemaining <= 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Label Row */}
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          {showCounter && maxLength && (
            <span className={cn(
              "text-xs transition-colors",
              isAtLimit ? "text-red-500 font-medium" :
              isNearLimit ? "text-amber-500" :
              "text-slate-400"
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}

      {/* Field Content */}
      <div className="relative">
        {children}
      </div>

      {/* Validation Messages */}
      <AnimatePresence mode="wait">
        {validating ? (
          <ValidationMessageDisplay
            key="validating"
            type="validating"
            message="Validating..."
          />
        ) : error ? (
          <ValidationMessageDisplay
            key="error"
            type="error"
            message={error}
          />
        ) : warning ? (
          <ValidationMessageDisplay
            key="warning"
            type="warning"
            message={warning}
          />
        ) : success ? (
          <ValidationMessageDisplay
            key="success"
            type="success"
            message={success}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Enhanced Input with Validation
// ============================================================================

export interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  warning?: string;
  success?: string;
  validating?: boolean;
  showPasswordToggle?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

export const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  function EnhancedInput({
    label,
    hint,
    error,
    warning,
    success,
    validating,
    showPasswordToggle,
    leftIcon,
    rightIcon,
    clearable,
    onClear,
    type = 'text',
    className,
    value,
    maxLength,
    required,
    ...props
  }, ref) {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;
    const hasValue = value && String(value).length > 0;

    const getValidationState = (): ValidationState => {
      if (validating) return 'validating';
      if (error) return 'invalid';
      if (warning) return 'warning';
      if (success) return 'valid';
      return 'idle';
    };

    const validationState = getValidationState();

    const inputClasses = cn(
      "transition-all duration-200",
      leftIcon && "pl-10",
      (rightIcon || showPasswordToggle || clearable) && "pr-10",
      validationState === 'invalid' && "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700",
      validationState === 'warning' && "border-amber-300 focus:border-amber-500 focus:ring-amber-500/20 dark:border-amber-700",
      validationState === 'valid' && "border-violet-300 focus:border-violet-500 focus:ring-violet-500/20 dark:border-violet-700",
      validationState === 'validating' && "border-slate-300 dark:border-slate-600",
      className
    );

    return (
      <FormField
        label={label}
        hint={hint}
        error={error}
        warning={warning}
        success={success}
        required={required}
        validating={validating}
        showCounter={!!maxLength}
        maxLength={maxLength}
        value={String(value || '')}
      >
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <Input
            ref={ref}
            type={inputType}
            value={value}
            maxLength={maxLength}
            className={inputClasses}
            {...props}
          />

          {/* Right Side Icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Validation State Icon */}
            {validationState !== 'idle' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  validationIcons[validationState === 'validating' ? 'validating' : validationState === 'invalid' ? 'error' : validationState === 'warning' ? 'warning' : 'success'].color
                )}
              >
                {validationState === 'validating' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : validationState === 'invalid' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : validationState === 'warning' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </motion.div>
            )}

            {/* Clear Button */}
            {clearable && hasValue && !validating && (
              <button
                type="button"
                onClick={onClear}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Password Toggle */}
            {showPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}

            {/* Custom Right Icon */}
            {rightIcon && !showPasswordToggle && !clearable && !validating && (
              <div className="text-slate-400">{rightIcon}</div>
            )}
          </div>
        </div>
      </FormField>
    );
  }
);

// ============================================================================
// Enhanced Textarea with Validation
// ============================================================================

export interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  warning?: string;
  success?: string;
  validating?: boolean;
  showCounter?: boolean;
}

export const EnhancedTextarea = forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  function EnhancedTextarea({
    label,
    hint,
    error,
    warning,
    success,
    validating,
    showCounter = true,
    className,
    value,
    maxLength,
    required,
    ...props
  }, ref) {
    const getValidationState = (): ValidationState => {
      if (validating) return 'validating';
      if (error) return 'invalid';
      if (warning) return 'warning';
      if (success) return 'valid';
      return 'idle';
    };

    const validationState = getValidationState();

    const textareaClasses = cn(
      "transition-all duration-200",
      validationState === 'invalid' && "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700",
      validationState === 'warning' && "border-amber-300 focus:border-amber-500 focus:ring-amber-500/20 dark:border-amber-700",
      validationState === 'valid' && "border-violet-300 focus:border-violet-500 focus:ring-violet-500/20 dark:border-violet-700",
      className
    );

    return (
      <FormField
        label={label}
        hint={hint}
        error={error}
        warning={warning}
        success={success}
        required={required}
        validating={validating}
        showCounter={showCounter && !!maxLength}
        maxLength={maxLength}
        value={String(value || '')}
      >
        <Textarea
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={textareaClasses}
          {...props}
        />
      </FormField>
    );
  }
);

// ============================================================================
// Form Error Summary
// ============================================================================

interface FormErrorSummaryProps {
  errors: Record<string, string>;
  title?: string;
  className?: string;
  onDismiss?: () => void;
}

export function FormErrorSummary({ 
  errors, 
  title = 'Please fix the following errors:', 
  className,
  onDismiss 
}: FormErrorSummaryProps) {
  const errorList = Object.entries(errors).filter(([_, msg]) => msg);

  if (errorList.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-red-800 dark:text-red-200 text-sm mb-2">
            {title}
          </h4>
          <ul className="space-y-1">
            {errorList.map(([field, message]) => (
              <li key={field} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
                <span className="text-red-400">•</span>
                <span>{message}</span>
              </li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Form Success Message
// ============================================================================

interface FormSuccessMessageProps {
  message: string;
  className?: string;
  onDismiss?: () => void;
}

export function FormSuccessMessage({ message, className, onDismiss }: FormSuccessMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg p-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-violet-500 flex-shrink-0" />
        <p className="text-sm text-violet-700 dark:text-violet-300 flex-1">
          {message}
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default EnhancedInput;
