'use client';

/**
 * Enhanced Form Inputs
 * Beautiful form controls with validation, animations, and accessibility
 */

import React, { forwardRef, useState, useId, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Search,
  Calendar,
  ChevronDown,
  Loader2,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Enhanced Text Input
// ============================================

interface EnhancedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftAddon?: string;
  rightAddon?: string;
  loading?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'flushed';
}

const inputSizes = {
  sm: 'h-9 text-sm px-3',
  md: 'h-11 text-sm px-4',
  lg: 'h-12 text-base px-4',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-5 h-5',
};

export const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({
    label,
    description,
    error,
    success,
    hint,
    leftIcon,
    rightIcon,
    leftAddon,
    rightAddon,
    loading = false,
    clearable = false,
    onClear,
    size = 'md',
    variant = 'default',
    className,
    id,
    disabled,
    value,
    type,
    ...props
  }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const hasValue = value !== undefined && value !== '';

    const variantStyles = {
      default: cn(
        'border rounded-xl bg-white dark:bg-slate-900',
        error
          ? 'border-red-500 focus:ring-red-500'
          : success
          ? 'border-violet-500 focus:ring-violet-500'
          : 'border-slate-200 dark:border-slate-700 focus:border-violet-500 focus:ring-violet-500'
      ),
      filled: cn(
        'border-0 rounded-xl bg-slate-100 dark:bg-slate-800',
        'focus:bg-white dark:focus:bg-slate-900 focus:ring-2',
        error ? 'ring-red-500' : success ? 'ring-violet-500' : 'focus:ring-violet-500'
      ),
      flushed: cn(
        'border-0 border-b-2 rounded-none bg-transparent px-0',
        error
          ? 'border-red-500'
          : success
          ? 'border-violet-500'
          : 'border-slate-200 dark:border-slate-700 focus:border-violet-500'
      ),
    };

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {label}
              {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {hint && (
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                {hint}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{description}</p>
        )}

        {/* Input wrapper */}
        <div className="relative flex">
          {/* Left addon */}
          {leftAddon && (
            <div className="flex items-center px-3 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm">
              {leftAddon}
            </div>
          )}

          {/* Input container */}
          <div className="relative flex-1">
            {/* Left icon */}
            {leftIcon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <span className={iconSizes[size]}>{leftIcon}</span>
              </div>
            )}

            <input
              ref={ref}
              id={inputId}
              type={isPassword && showPassword ? 'text' : type}
              disabled={disabled || loading}
              value={value}
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : success ? `${inputId}-success` : undefined}
              className={cn(
                'w-full transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                'text-slate-900 dark:text-white',
                inputSizes[size],
                variantStyles[variant],
                leftIcon && 'pl-10',
                (rightIcon || isPassword || clearable || loading || error || success) && 'pr-10',
                leftAddon && 'rounded-l-none',
                rightAddon && 'rounded-r-none',
                className
              )}
              {...props}
            />

            {/* Right side icons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {loading && (
                <Loader2 className={cn(iconSizes[size], 'animate-spin text-slate-400')} />
              )}
              
              {!loading && clearable && hasValue && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className={iconSizes[size]} />
                </button>
              )}
              
              {!loading && isPassword && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className={iconSizes[size]} />
                  ) : (
                    <Eye className={iconSizes[size]} />
                  )}
                </button>
              )}

              {!loading && !isPassword && error && (
                <AlertCircle className={cn(iconSizes[size], 'text-red-500')} />
              )}

              {!loading && !isPassword && success && !error && (
                <CheckCircle2 className={cn(iconSizes[size], 'text-violet-500')} />
              )}

              {!loading && !isPassword && !error && !success && rightIcon && (
                <span className={cn(iconSizes[size], 'text-slate-400')}>{rightIcon}</span>
              )}
            </div>
          </div>

          {/* Right addon */}
          {rightAddon && (
            <div className="flex items-center px-3 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm">
              {rightAddon}
            </div>
          )}
        </div>

        {/* Error/Success messages */}
        <AnimatePresence>
          {error && (
            <motion.p key="error"
              id={`${inputId}-error`}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </motion.p>
          )}
          {success && !error && (
            <motion.p
              id={`${inputId}-success`}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mt-1.5 text-sm text-violet-600 dark:text-violet-400 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              {success}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
EnhancedInput.displayName = 'EnhancedInput';

// ============================================
// Search Input
// ============================================

interface SearchInputProps extends Omit<EnhancedInputProps, 'leftIcon' | 'type'> {
  onSearch?: (value: string) => void;
  debounce?: number;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, debounce = 300, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(props.value || '');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (onSearch && debounce > 0) {
        timeoutRef.current = setTimeout(() => {
          onSearch(localValue as string);
        }, debounce);

        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
      }
    }, [localValue, debounce, onSearch]);

    return (
      <EnhancedInput
        ref={ref}
        type="search"
        leftIcon={<Search />}
        clearable
        onClear={() => {
          setLocalValue('');
          onSearch?.('');
        }}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          props.onChange?.(e);
        }}
        {...props}
      />
    );
  }
);
SearchInput.displayName = 'SearchInput';

// ============================================
// Floating Label Input
// ============================================

interface FloatingLabelInputProps extends Omit<EnhancedInputProps, 'label' | 'placeholder'> {
  label: string;
}

export const FloatingLabelInput = forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ label, size = 'md', error, success, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = props.value !== undefined && props.value !== '';
    const isFloating = isFocused || hasValue;

    return (
      <div className="relative">
        <input
          ref={ref}
          placeholder=" "
          aria-invalid={!!error}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            'peer w-full pt-6 pb-2 px-4 rounded-xl border transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'placeholder:text-transparent',
            'text-slate-900 dark:text-white bg-white dark:bg-slate-900',
            error
              ? 'border-red-500 focus:ring-red-500'
              : success
              ? 'border-violet-500 focus:ring-violet-500'
              : 'border-slate-200 dark:border-slate-700 focus:border-violet-500 focus:ring-violet-500',
            inputSizes[size],
            className
          )}
          {...props}
        />
        <label
          className={cn(
            'absolute left-4 transition-all duration-200 pointer-events-none',
            'text-slate-500 dark:text-slate-400',
            isFloating
              ? 'top-2 text-xs font-medium'
              : 'top-1/2 -translate-y-1/2 text-sm',
            isFocused && 'text-violet-600 dark:text-violet-400'
          )}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {/* Status icons */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {error && <AlertCircle className="w-5 h-5 text-red-500" />}
          {success && !error && <CheckCircle2 className="w-5 h-5 text-violet-500" />}
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-1.5 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
FloatingLabelInput.displayName = 'FloatingLabelInput';

// ============================================
// Enhanced Textarea
// ============================================

interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  showCount?: boolean;
  autoResize?: boolean;
}

export const EnhancedTextarea = forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({
    label,
    description,
    error,
    success,
    showCount = false,
    autoResize = false,
    maxLength,
    className,
    id,
    value,
    onChange,
    ...props
  }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const charCount = typeof value === 'string' ? value.length : 0;

    useEffect(() => {
      if (autoResize && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [value, autoResize, textareaRef]);

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{description}</p>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            id={textareaId}
            value={value}
            maxLength={maxLength}
            onChange={(e) => {
              onChange?.(e);
            }}
            aria-invalid={!!error}
            className={cn(
              'w-full min-h-[100px] px-4 py-3 rounded-xl border transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'text-slate-900 dark:text-white bg-white dark:bg-slate-900',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'resize-y',
              error
                ? 'border-red-500 focus:ring-red-500'
                : success
                ? 'border-violet-500 focus:ring-violet-500'
                : 'border-slate-200 dark:border-slate-700 focus:border-violet-500 focus:ring-violet-500',
              autoResize && 'resize-none overflow-hidden',
              className
            )}
            {...props}
          />

          {/* Status indicator */}
          {(error || success) && (
            <div className="absolute right-3 top-3">
              {error && <AlertCircle className="w-5 h-5 text-red-500" />}
              {success && !error && <CheckCircle2 className="w-5 h-5 text-violet-500" />}
            </div>
          )}
        </div>

        {/* Footer with count and error */}
        <div className="flex items-center justify-between mt-1.5">
          <AnimatePresence>
            {error && (
              <motion.p key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </motion.p>
            )}
            {success && !error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-violet-600 dark:text-violet-400"
              >
                {success}
              </motion.p>
            )}
          </AnimatePresence>
          
          {showCount && maxLength && (
            <span
              className={cn(
                'text-xs ml-auto',
                charCount >= maxLength
                  ? 'text-red-500'
                  : charCount >= maxLength * 0.9
                  ? 'text-amber-500'
                  : 'text-slate-400'
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
EnhancedTextarea.displayName = 'EnhancedTextarea';

// ============================================
// Enhanced Checkbox
// ============================================

interface EnhancedCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card';
}

const checkboxSizes = {
  sm: { box: 'w-4 h-4', icon: 'w-3 h-3', text: 'text-sm' },
  md: { box: 'w-5 h-5', icon: 'w-3.5 h-3.5', text: 'text-sm' },
  lg: { box: 'w-6 h-6', icon: 'w-4 h-4', text: 'text-base' },
};

export const EnhancedCheckbox = forwardRef<HTMLInputElement, EnhancedCheckboxProps>(
  ({ label, description, size = 'md', variant = 'default', className, id, checked, disabled, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;
    const sizeConfig = checkboxSizes[size];

    if (variant === 'card') {
      return (
        <label
          htmlFor={checkboxId}
          className={cn(
            'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
            checked
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            className="sr-only"
            {...props}
          />
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-md border-2 transition-all',
              sizeConfig.box,
              checked
                ? 'bg-violet-500 border-violet-500 text-white'
                : 'border-slate-300 dark:border-slate-600'
            )}
          >
            <AnimatePresence>
              {checked && (
                <motion.div key="checked"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Check className={sizeConfig.icon} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1">
            {label && (
              <span className={cn('font-medium text-slate-900 dark:text-white', sizeConfig.text)}>
                {label}
              </span>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
        </label>
      );
    }

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-start gap-2 cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          checked={checked}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-md border-2 transition-all mt-0.5',
            sizeConfig.box,
            checked
              ? 'bg-violet-500 border-violet-500 text-white'
              : 'border-slate-300 dark:border-slate-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2'
          )}
        >
          <AnimatePresence>
            {checked && (
              <motion.div key="checked"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className={sizeConfig.icon} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className={cn('text-slate-900 dark:text-white', sizeConfig.text)}>{label}</span>
            )}
            {description && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  }
);
EnhancedCheckbox.displayName = 'EnhancedCheckbox';

// ============================================
// Enhanced Radio
// ============================================

interface EnhancedRadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card';
}

export const EnhancedRadio = forwardRef<HTMLInputElement, EnhancedRadioProps>(
  ({ label, description, size = 'md', variant = 'default', className, id, checked, disabled, ...props }, ref) => {
    const generatedId = useId();
    const radioId = id || generatedId;
    const sizeConfig = checkboxSizes[size];

    if (variant === 'card') {
      return (
        <label
          htmlFor={radioId}
          className={cn(
            'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
            checked
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <input
            ref={ref}
            type="radio"
            id={radioId}
            checked={checked}
            disabled={disabled}
            className="sr-only"
            {...props}
          />
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-all',
              sizeConfig.box,
              checked ? 'border-violet-500' : 'border-slate-300 dark:border-slate-600'
            )}
          >
            <AnimatePresence>
              {checked && (
                <motion.div key="checked"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="w-2.5 h-2.5 rounded-full bg-violet-500"
                />
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1">
            {label && (
              <span className={cn('font-medium text-slate-900 dark:text-white', sizeConfig.text)}>
                {label}
              </span>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
        </label>
      );
    }

    return (
      <label
        htmlFor={radioId}
        className={cn(
          'inline-flex items-start gap-2 cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <input
          ref={ref}
          type="radio"
          id={radioId}
          checked={checked}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-all mt-0.5',
            sizeConfig.box,
            checked
              ? 'border-violet-500'
              : 'border-slate-300 dark:border-slate-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2'
          )}
        >
          <AnimatePresence>
            {checked && (
              <motion.div key="checked"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="w-2.5 h-2.5 rounded-full bg-violet-500"
              />
            )}
          </AnimatePresence>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className={cn('text-slate-900 dark:text-white', sizeConfig.text)}>{label}</span>
            )}
            {description && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  }
);
EnhancedRadio.displayName = 'EnhancedRadio';

// ============================================
// Pin Input
// ============================================

interface PinInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  type?: 'text' | 'number';
  mask?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const pinSizes = {
  sm: 'w-10 h-10 text-lg',
  md: 'w-12 h-12 text-xl',
  lg: 'w-14 h-14 text-2xl',
};

export function PinInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  type = 'number',
  mask = false,
  error,
  size = 'md',
  disabled = false,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    if (type === 'number' && !/^\d*$/.test(char)) return;

    const newValue = value.split('');
    newValue[index] = char;
    const result = newValue.join('').slice(0, length);
    onChange?.(result);

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (result.length === length) {
      onComplete?.(result);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, length);
    if (type === 'number' && !/^\d*$/.test(pasted)) return;
    onChange?.(pasted);
    if (pasted.length === length) {
      onComplete?.(pasted);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type={mask ? 'password' : 'text'}
            inputMode={type === 'number' ? 'numeric' : 'text'}
            maxLength={1}
            value={value[index] || ''}
            disabled={disabled}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={cn(
              'text-center font-bold rounded-xl border transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'text-slate-900 dark:text-white bg-white dark:bg-slate-900',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-slate-200 dark:border-slate-700',
              pinSizes[size]
            )}
          />
        ))}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

export default {
  EnhancedInput,
  SearchInput,
  FloatingLabelInput,
  EnhancedTextarea,
  EnhancedCheckbox,
  EnhancedRadio,
  PinInput,
};
