'use client';

/**
 * Form Components
 * Enhanced form inputs with inline validation and feedback
 */

import React, { forwardRef, useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/overlays';

// ============================================================================
// Types
// ============================================================================

type InputState = 'default' | 'error' | 'success' | 'warning';

interface BaseInputProps {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  warning?: string;
  required?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  helpText?: string;
}

// ============================================================================
// State Styles
// ============================================================================

const STATE_STYLES: Record<InputState, {
  border: string;
  ring: string;
  icon: string;
  text: string;
}> = {
  default: {
    border: 'border-slate-200 focus:border-indigo-400',
    ring: 'focus:ring-indigo-500/20',
    icon: 'text-slate-400',
    text: 'text-slate-600',
  },
  error: {
    border: 'border-red-300 focus:border-red-400',
    ring: 'focus:ring-red-500/20',
    icon: 'text-red-500',
    text: 'text-red-600',
  },
  success: {
    border: 'border-emerald-300 focus:border-emerald-400',
    ring: 'focus:ring-emerald-500/20',
    icon: 'text-emerald-500',
    text: 'text-emerald-600',
  },
  warning: {
    border: 'border-amber-300 focus:border-amber-400',
    ring: 'focus:ring-amber-500/20',
    icon: 'text-amber-500',
    text: 'text-amber-600',
  },
};

// ============================================================================
// Helper to determine state
// ============================================================================

function getInputState(error?: string, success?: string, warning?: string): InputState {
  if (error) return 'error';
  if (success) return 'success';
  if (warning) return 'warning';
  return 'default';
}

// ============================================================================
// Text Input
// ============================================================================

interface TextInputProps extends BaseInputProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({
  label,
  hint,
  error,
  success,
  warning,
  required,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  helpText,
  size = 'md',
  className,
  id: propId,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || generatedId;
  const state = getInputState(error, success, warning);
  const styles = STATE_STYLES[state];
  
  const sizeStyles = {
    sm: { input: 'h-9 text-sm', padding: LeftIcon ? 'pl-9' : 'pl-3' },
    md: { input: 'h-11 text-sm', padding: LeftIcon ? 'pl-11' : 'pl-4' },
    lg: { input: 'h-13 text-base', padding: LeftIcon ? 'pl-12' : 'pl-4' },
  };

  const message = error || success || warning;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Label */}
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {helpText && (
            <Tooltip content={helpText}>
              <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          )}
        </div>
      )}
      
      {/* Hint */}
      {hint && !message && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
      
      {/* Input */}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none',
            styles.icon
          )} />
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-lg border bg-white',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2',
            'transition-all duration-200',
            sizeStyles[size].input,
            sizeStyles[size].padding,
            LeftIcon ? '' : 'pl-4',
            (RightIcon || state !== 'default') ? 'pr-10' : 'pr-4',
            styles.border,
            styles.ring
          )}
          aria-invalid={state === 'error'}
          aria-describedby={message ? `${id}-message` : undefined}
          {...props}
        />
        
        {/* Status icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {state === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {state === 'success' && <Check className="w-5 h-5 text-emerald-500" />}
          {state === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
          {state === 'default' && RightIcon && <RightIcon className="w-5 h-5 text-slate-400" />}
        </div>
      </div>
      
      {/* Message */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.p
            id={`${id}-message`}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={cn('text-xs flex items-center gap-1', styles.text)}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

TextInput.displayName = 'TextInput';

// ============================================================================
// Password Input
// ============================================================================

interface PasswordInputProps extends Omit<TextInputProps, 'type'> {
  showStrength?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({
  showStrength = false,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);

  const calculateStrength = (value: string): number => {
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) score++;
    return score;
  };

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];

  return (
    <div className="space-y-2">
      <div className="relative">
        <TextInput
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          onChange={(e) => {
            if (showStrength) setStrength(calculateStrength(e.target.value));
            props.onChange?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-10 top-[2.1rem] p-1 text-slate-400 hover:text-slate-600 transition-colors"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Password Strength */}
      {showStrength && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i < strength ? strengthColors[strength - 1] : 'bg-slate-200'
                )}
              />
            ))}
          </div>
          {strength > 0 && (
            <p className="text-xs text-slate-500">{strengthLabels[strength - 1]}</p>
          )}
        </div>
      )}
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

// ============================================================================
// Textarea
// ============================================================================

interface TextareaProps extends BaseInputProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  hint,
  error,
  success,
  warning,
  required,
  helpText,
  maxLength,
  showCount = false,
  className,
  id: propId,
  value,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || generatedId;
  const state = getInputState(error, success, warning);
  const styles = STATE_STYLES[state];
  const message = error || success || warning;
  const charCount = typeof value === 'string' ? value.length : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Label */}
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {helpText && (
            <Tooltip content={helpText}>
              <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          )}
        </div>
      )}
      
      {hint && !message && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
      
      <div className="relative">
        <textarea
          ref={ref}
          id={id}
          value={value}
          maxLength={maxLength}
          className={cn(
            'w-full min-h-[100px] px-4 py-3 rounded-lg border bg-white',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2',
            'transition-all duration-200 resize-y',
            styles.border,
            styles.ring
          )}
          aria-invalid={state === 'error'}
          aria-describedby={message ? `${id}-message` : undefined}
          {...props}
        />
        
        {/* Character count */}
        {showCount && maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-slate-400">
            {charCount}/{maxLength}
          </div>
        )}
      </div>
      
      <AnimatePresence mode="wait">
        {message && (
          <motion.p
            id={`${id}-message`}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={cn('text-xs flex items-center gap-1', styles.text)}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

Textarea.displayName = 'Textarea';

// ============================================================================
// Select
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends BaseInputProps, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  hint,
  error,
  success,
  warning,
  required,
  helpText,
  options,
  placeholder = 'Select an option',
  size = 'md',
  className,
  id: propId,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || generatedId;
  const state = getInputState(error, success, warning);
  const styles = STATE_STYLES[state];
  const message = error || success || warning;

  const sizeStyles = {
    sm: 'h-9 text-sm',
    md: 'h-11 text-sm',
    lg: 'h-13 text-base',
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {helpText && (
            <Tooltip content={helpText}>
              <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          )}
        </div>
      )}
      
      {hint && !message && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
      
      <select
        ref={ref}
        id={id}
        className={cn(
          'w-full px-4 rounded-lg border bg-white',
          'focus:outline-none focus:ring-2',
          'transition-all duration-200',
          'appearance-none cursor-pointer',
          sizeStyles[size],
          styles.border,
          styles.ring
        )}
        aria-invalid={state === 'error'}
        {...props}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      
      <AnimatePresence mode="wait">
        {message && (
          <motion.p
            id={`${id}-message`}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={cn('text-xs flex items-center gap-1', styles.text)}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

Select.displayName = 'Select';

// ============================================================================
// Checkbox
// ============================================================================

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  description,
  error,
  className,
  id: propId,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || generatedId;

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={cn(
              'w-5 h-5 rounded border-2 appearance-none cursor-pointer',
              'transition-all duration-200',
              'checked:bg-indigo-600 checked:border-indigo-600',
              error ? 'border-red-300' : 'border-slate-300',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500/30'
            )}
            {...props}
          />
          <Check className="absolute w-3 h-3 text-white pointer-events-none opacity-0 [input:checked+&]:opacity-100" />
        </div>
        <div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </label>
      {error && (
        <p className="text-xs text-red-600 ml-8">{error}</p>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';
