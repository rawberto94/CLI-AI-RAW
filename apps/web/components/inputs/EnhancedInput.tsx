'use client';

/**
 * Enhanced Input Components
 * 
 * Form inputs with:
 * - Real-time validation feedback
 * - Character counters
 * - Clear buttons
 * - Password visibility toggle
 * - Loading states
 * - Prefix/suffix support
 */

import React, { useState, forwardRef, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  X, 
  Check, 
  AlertCircle,
  Loader2,
  Search,
  Mail,
  Lock,
  User,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Enhanced Text Input
// ============================================================================

export interface EnhancedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label for the input */
  label?: string;
  /** Helper text below the input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Success message */
  success?: string;
  /** Whether to show character count */
  showCount?: boolean;
  /** Maximum characters */
  maxLength?: number;
  /** Icon to show at the start */
  startIcon?: LucideIcon;
  /** Icon to show at the end */
  endIcon?: LucideIcon;
  /** Show clear button */
  clearable?: boolean;
  /** Callback when cleared */
  onClear?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Show validation indicator */
  showValidation?: boolean;
  /** Is valid */
  isValid?: boolean;
}

const sizeClasses = {
  sm: 'h-8 text-sm px-2.5',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-base px-4',
};

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      showCount = false,
      maxLength,
      startIcon: StartIcon,
      endIcon: EndIcon,
      clearable = false,
      onClear,
      loading = false,
      size = 'md',
      fullWidth = false,
      showValidation = false,
      isValid,
      className,
      id,
      disabled,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [internalValue, setInternalValue] = useState('');
    const currentValue = value !== undefined ? String(value) : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleClear = () => {
      if (value === undefined) {
        setInternalValue('');
      }
      onClear?.();
    };

    const hasError = !!error;
    const hasSuccess = !!success;
    const showClear = clearable && currentValue && !disabled && !loading;
    const charCount = currentValue.length;
    const showCharCount = showCount && maxLength;

    return (
      <div className={cn('space-y-1.5', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Start Icon */}
          {StartIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <StartIcon className={iconSizeClasses[size]} />
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            value={value}
            onChange={handleChange}
            disabled={disabled || loading}
            maxLength={maxLength}
            className={cn(
              'w-full rounded-lg border transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              sizeClasses[size],
              StartIcon && 'pl-10',
              (showClear || EndIcon || loading || showValidation) && 'pr-10',
              hasError
                ? 'border-red-300 focus:border-red-400 focus:ring-red-200 bg-red-50/50'
                : hasSuccess
                ? 'border-violet-300 focus:border-violet-400 focus:ring-violet-200 bg-violet-50/50'
                : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-200',
              disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
              className
            )}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {/* End elements */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && (
              <Loader2 className={cn(iconSizeClasses[size], 'text-slate-400 animate-spin')} />
            )}
            
            {showValidation && !loading && isValid !== undefined && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'rounded-full p-0.5',
                  isValid ? 'text-violet-500' : 'text-red-500'
                )}
              >
                {isValid ? (
                  <Check className={iconSizeClasses[size]} />
                ) : (
                  <AlertCircle className={iconSizeClasses[size]} />
                )}
              </motion.div>
            )}

            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                aria-label="Clear input"
              >
                <X className={iconSizeClasses[size]} />
              </button>
            )}

            {EndIcon && !showClear && !loading && !showValidation && (
              <EndIcon className={cn(iconSizeClasses[size], 'text-slate-400')} />
            )}
          </div>
        </div>

        {/* Helper text / Error / Success / Character count */}
        <div className="flex items-center justify-between gap-2">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                id={`${inputId}-error`}
                className="text-sm text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </motion.p>
            ) : success ? (
              <motion.p
                key="success"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-sm text-violet-600 flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                {success}
              </motion.p>
            ) : helperText ? (
              <motion.p
                key="helper"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                id={`${inputId}-helper`}
                className="text-sm text-slate-500"
              >
                {helperText}
              </motion.p>
            ) : (
              <span />
            )}
          </AnimatePresence>

          {showCharCount && (
            <span
              className={cn(
                'text-xs',
                charCount >= maxLength ? 'text-red-500' : 'text-slate-400'
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

EnhancedInput.displayName = 'EnhancedInput';

// ============================================================================
// Password Input
// ============================================================================

export interface PasswordInputProps extends Omit<EnhancedInputProps, 'type'> {
  /** Show password strength indicator */
  showStrength?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showStrength = false, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [strength, setStrength] = useState(0);

    const calculateStrength = useCallback((value: string) => {
      let score = 0;
      if (value.length >= 8) score += 1;
      if (value.length >= 12) score += 1;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
      if (/\d/.test(value)) score += 1;
      if (/[^a-zA-Z0-9]/.test(value)) score += 1;
      return Math.min(score, 4);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showStrength) {
        setStrength(calculateStrength(e.target.value));
      }
      props.onChange?.(e);
    };

    const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-violet-500'];

    return (
      <div className="space-y-2">
        <div className="relative">
          <EnhancedInput
            ref={ref}
            {...props}
            type={showPassword ? 'text' : 'password'}
            startIcon={Lock}
            onChange={handleChange}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {showStrength && props.value && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    level < strength ? strengthColors[strength - 1] : 'bg-slate-200'
                  )}
                />
              ))}
            </div>
            {strength > 0 && (
              <p className="text-xs text-slate-500">
                Password strength: {strengthLabels[strength - 1]}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

// ============================================================================
// Search Input
// ============================================================================

export interface SearchInputProps extends Omit<EnhancedInputProps, 'startIcon'> {
  /** Callback on search submit */
  onSearch?: (value: string) => void;
  /** Show search on enter */
  searchOnEnter?: boolean;
  /** Debounce delay in ms */
  debounceDelay?: number;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, searchOnEnter = true, debounceDelay, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (searchOnEnter && e.key === 'Enter' && onSearch) {
        onSearch((e.target as HTMLInputElement).value);
      }
      props.onKeyDown?.(e);
    };

    return (
      <EnhancedInput
        ref={ref}
        {...props}
        startIcon={Search}
        clearable
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder || 'Search...'}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

// ============================================================================
// Email Input
// ============================================================================

export interface EmailInputProps extends Omit<EnhancedInputProps, 'type' | 'startIcon'> {
  /** Validate on blur */
  validateOnBlur?: boolean;
}

export const EmailInput = forwardRef<HTMLInputElement, EmailInputProps>(
  ({ validateOnBlur = true, ...props }, ref) => {
    const [isValid, setIsValid] = useState<boolean | undefined>(undefined);

    const validateEmail = (email: string) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (validateOnBlur && e.target.value) {
        setIsValid(validateEmail(e.target.value));
      } else {
        setIsValid(undefined);
      }
      props.onBlur?.(e);
    };

    return (
      <EnhancedInput
        ref={ref}
        {...props}
        type="email"
        startIcon={Mail}
        showValidation={validateOnBlur}
        isValid={isValid}
        onBlur={handleBlur}
        placeholder={props.placeholder || 'email@example.com'}
      />
    );
  }
);

EmailInput.displayName = 'EmailInput';

// ============================================================================
// Username Input
// ============================================================================

export const UsernameInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  (props, ref) => {
    return (
      <EnhancedInput
        ref={ref}
        {...props}
        startIcon={User}
        placeholder={props.placeholder || 'Username'}
      />
    );
  }
);

UsernameInput.displayName = 'UsernameInput';

export default EnhancedInput;
