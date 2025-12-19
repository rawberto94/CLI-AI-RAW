'use client';

/**
 * Inline Edit Components
 * Click-to-edit functionality for seamless inline editing
 */

import React, { useState, useRef, useEffect, useCallback, KeyboardEvent, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Check, 
  X, 
  Pencil,
  Loader2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface InlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  validate?: (value: string) => string | null;
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  showEditIcon?: boolean;
  autoSelect?: boolean;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
}

// ============================================================================
// Inline Edit Component
// ============================================================================

export function InlineEdit({
  value,
  onSave,
  placeholder = 'Click to edit',
  label,
  disabled = false,
  required = false,
  validate,
  className,
  inputClassName,
  displayClassName,
  showEditIcon = true,
  autoSelect = true,
  maxLength,
  multiline = false,
  rows = 3,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync with external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (autoSelect && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, autoSelect]);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  }, [disabled, value]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  const saveEdit = useCallback(async () => {
    // Validate
    if (required && !editValue.trim()) {
      setError('This field is required');
      return;
    }

    if (validate) {
      const validationError = validate(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Skip save if unchanged
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  }, [editValue, value, required, validate, onSave]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }, [saveEdit, cancelEditing, multiline]);

  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className={cn('group', className)}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-start gap-2">
              <InputComponent
                ref={inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Small delay to allow button clicks
                  setTimeout(() => {
                    if (!isLoading) cancelEditing();
                  }, 150);
                }}
                disabled={isLoading}
                maxLength={maxLength}
                rows={multiline ? rows : undefined}
                className={cn(
                  'flex-1 px-3 py-2 text-sm border rounded-lg transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  error ? 'border-red-300 bg-red-50' : 'border-slate-300',
                  isLoading && 'opacity-50',
                  inputClassName
                )}
              />
              
              <div className="flex items-center gap-1">
                <button
                  onClick={saveEdit}
                  disabled={isLoading}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    isLoading
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={isLoading}
                  className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Character counter */}
            {maxLength && (
              <div className="flex justify-between text-xs">
                <span className={cn(error ? 'text-red-500' : 'text-transparent')}>
                  {error}
                </span>
                <span className={cn(
                  editValue.length > maxLength * 0.9 ? 'text-amber-500' : 'text-slate-400'
                )}>
                  {editValue.length}/{maxLength}
                </span>
              </div>
            )}

            {/* Error (when no maxLength) */}
            {error && !maxLength && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={startEditing}
            disabled={disabled}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-slate-100 cursor-pointer',
              displayClassName
            )}
          >
            <span className={cn(
              'flex-1',
              !value && 'text-slate-400 italic'
            )}>
              {value || placeholder}
            </span>
            {showEditIcon && !disabled && (
              <Pencil className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Inline Edit Number
// ============================================================================

interface InlineEditNumberProps extends Omit<InlineEditProps, 'value' | 'onSave' | 'validate'> {
  value: number;
  onSave: (value: number) => Promise<void> | void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  formatDisplay?: (value: number) => string;
}

export function InlineEditNumber({
  value,
  onSave,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  formatDisplay,
  ...props
}: InlineEditNumberProps) {
  const validate = useCallback((strValue: string) => {
    const num = parseFloat(strValue);
    if (isNaN(num)) return 'Please enter a valid number';
    if (min !== undefined && num < min) return `Minimum value is ${min}`;
    if (max !== undefined && num > max) return `Maximum value is ${max}`;
    return null;
  }, [min, max]);

  const handleSave = useCallback(async (strValue: string) => {
    const num = parseFloat(strValue);
    await onSave(num);
  }, [onSave]);

  const displayValue = formatDisplay ? formatDisplay(value) : String(value);
  const fullDisplay = `${prefix || ''}${displayValue}${suffix || ''}`;

  return (
    <InlineEdit
      {...props}
      value={String(value)}
      onSave={handleSave}
      validate={validate}
      placeholder={props.placeholder || `${prefix || ''}0${suffix || ''}`}
    />
  );
}

// ============================================================================
// Inline Edit Select
// ============================================================================

interface InlineEditSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => Promise<void> | void;
  label?: string;
  disabled?: boolean;
  className?: string;
  showEditIcon?: boolean;
}

export function InlineEditSelect({
  value,
  options,
  onSave,
  label,
  disabled = false,
  className,
  showEditIcon = true,
}: InlineEditSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={cn('group', className)}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {label}
        </label>
      )}

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <select
              ref={selectRef}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              disabled={isLoading}
              className={cn(
                'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                isLoading && 'opacity-50'
              )}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </motion.div>
        ) : (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !disabled && setIsEditing(true)}
            disabled={disabled}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-slate-100 cursor-pointer'
            )}
          >
            <span className="flex-1">{selectedOption?.label || value}</span>
            {showEditIcon && !disabled && (
              <Pencil className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Inline Edit Tags
// ============================================================================

interface InlineEditTagsProps {
  value: string[];
  onSave: (value: string[]) => Promise<void> | void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  className?: string;
}

export function InlineEditTags({
  value,
  onSave,
  label,
  placeholder = 'Add tags...',
  disabled = false,
  maxTags = 10,
  className,
}: InlineEditTagsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string[]>(value);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !editValue.includes(trimmed) && editValue.length < maxTags) {
      setEditValue([...editValue, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    setEditValue(editValue.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && editValue.length > 0) {
      const lastTag = editValue[editValue.length - 1];
      if (lastTag) removeTag(lastTag);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  const saveChanges = async () => {
    if (JSON.stringify(editValue) !== JSON.stringify(value)) {
      setIsLoading(true);
      try {
        await onSave(editValue);
      } finally {
        setIsLoading(false);
      }
    }
    setIsEditing(false);
  };

  return (
    <div className={cn('group', className)}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {label}
        </label>
      )}

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg bg-white min-h-[44px]">
              {editValue.map((tag) => (
                <motion.span
                  key={tag}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-md"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-indigo-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.span>
              ))}
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (inputValue) addTag(inputValue);
                  setTimeout(saveChanges, 100);
                }}
                placeholder={editValue.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[100px] outline-none text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">
              Press Enter or comma to add. {editValue.length}/{maxTags} tags.
            </p>
          </motion.div>
        ) : (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !disabled && setIsEditing(true)}
            disabled={disabled}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg transition-all',
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-slate-100 cursor-pointer'
            )}
          >
            {value.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {value.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-slate-100 text-slate-600 text-sm rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">{placeholder}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
