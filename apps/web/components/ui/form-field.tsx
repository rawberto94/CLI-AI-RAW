/**
 * Form Field Component
 * Smart form field with validation and animations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';
import { animationConfig } from '@/lib/animations/config';

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  success?: boolean;
  helpText?: string;
  icon?: React.ReactNode;
  showValidation?: boolean;
  onValidate?: (value: string) => string | null; // Returns error message or null
  fieldSize?: 'sm' | 'md' | 'lg';
}

export function FormField({
  label,
  error,
  success,
  helpText,
  icon,
  showValidation = true,
  onValidate,
  fieldSize = 'md',
  type = 'text',
  className = '',
  ...props
}: FormFieldProps) {
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const displayError = error || internalError;
  const isPassword = type === 'password';
  const actualType = isPassword && showPassword ? 'text' : type;

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg',
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setHasInteracted(true);
    
    if (onValidate && e.target.value) {
      const validationError = onValidate(e.target.value);
      setInternalError(validationError);
    }
    
    props.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasInteracted && onValidate) {
      const validationError = onValidate(e.target.value);
      setInternalError(validationError);
    }
    
    props.onChange?.(e);
  };

  // Shake animation for errors
  const shakeVariants = {
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <motion.label
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </motion.label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Leading Icon */}
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        {/* Input Field */}
        <motion.input
          variants={displayError ? shakeVariants : {}}
          animate={displayError && hasInteracted ? 'shake' : ''}
          type={actualType}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`
            w-full rounded-lg border transition-all
            ${sizeClasses[fieldSize]}
            ${icon ? 'pl-10' : ''}
            ${isPassword ? 'pr-10' : ''}
            ${showValidation && success ? 'pr-10' : ''}
            ${displayError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : success
              ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />

        {/* Password Toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}

        {/* Validation Icon */}
        {showValidation && !isPassword && (
          <AnimatePresence>
            {displayError && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500"
              >
                <AlertCircle className="w-5 h-5" />
              </motion.div>
            )}
            {success && !displayError && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
              >
                <Check className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Focus Ring Animation */}
        {isFocused && (
          <motion.div
            layoutId="focus-ring"
            className="absolute inset-0 rounded-lg border-2 border-blue-500 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {displayError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-600 mt-1 flex items-center gap-1"
          >
            <AlertCircle className="w-4 h-4" />
            {displayError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Help Text */}
      {helpText && !displayError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500 mt-1 flex items-center gap-1"
        >
          <Info className="w-4 h-4" />
          {helpText}
        </motion.p>
      )}
    </div>
  );
}

/**
 * Textarea Field - for multi-line input
 */
export function TextareaField({
  label,
  error,
  helpText,
  rows = 4,
  className = '',
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
  label?: string;
  error?: string;
  helpText?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <textarea
          rows={rows}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            w-full px-4 py-2 rounded-lg border transition-all
            ${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />

        {isFocused && (
          <motion.div
            layoutId="focus-ring-textarea"
            className="absolute inset-0 rounded-lg border-2 border-blue-500 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-red-600 mt-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {helpText && !error && (
        <p className="text-sm text-gray-500 mt-1">{helpText}</p>
      )}
    </div>
  );
}

/**
 * Select Field - for dropdown selection
 */
export function SelectField({
  label,
  error,
  helpText,
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helpText?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        className={`
          w-full px-4 py-2 rounded-lg border transition-all
          ${error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      >
        {children}
      </select>

      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}

      {helpText && !error && (
        <p className="text-sm text-gray-500 mt-1">{helpText}</p>
      )}
    </div>
  );
}
