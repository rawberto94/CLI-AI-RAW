'use client';

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'number' | 'date' | 'currency' | 'textarea' | 'email' | 'url';

interface InlineEditFieldProps {
  value: string | number | null | undefined;
  onSave: (value: string | number) => Promise<void>;
  fieldType?: FieldType;
  label?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  currency?: string;
  emptyText?: string;
  disabled?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  formatDisplay?: (value: string | number | null | undefined) => string;
  className?: string;
}

export const InlineEditField = memo(function InlineEditField({
  value,
  onSave,
  fieldType = 'text',
  label,
  placeholder = 'Click to edit...',
  prefix,
  suffix,
  currency = 'USD',
  emptyText = 'Not set',
  disabled = false,
  maxLength,
  minValue,
  maxValue,
  formatDisplay,
  className = '',
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Initialize edit value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(value?.toString() || '');
      setError(null);
      // Focus with slight delay for animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing, value]);

  // Handle keyboard events
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && !e.shiftKey && fieldType !== 'textarea') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editValue, fieldType]);

  const validate = useCallback((val: string): string | null => {
    if (fieldType === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return 'Invalid email address';
    }
    if (fieldType === 'url' && val && !/^https?:\/\/.+/.test(val)) {
      return 'Invalid URL (must start with http:// or https://)';
    }
    if (fieldType === 'number' || fieldType === 'currency') {
      const num = parseFloat(val);
      if (val && isNaN(num)) return 'Must be a valid number';
      if (minValue !== undefined && num < minValue) return `Minimum value is ${minValue}`;
      if (maxValue !== undefined && num > maxValue) return `Maximum value is ${maxValue}`;
    }
    if (maxLength && val.length > maxLength) {
      return `Maximum ${maxLength} characters`;
    }
    return null;
  }, [fieldType, minValue, maxValue, maxLength]);

  const handleSave = async () => {
    const validationError = validate(editValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saveValue = fieldType === 'number' || fieldType === 'currency'
        ? parseFloat(editValue) || 0
        : editValue;
      
      await onSave(saveValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  // Format the display value
  const getDisplayValue = (): string => {
    if (formatDisplay) {
      return formatDisplay(value);
    }
    
    if (value === null || value === undefined || value === '') {
      return emptyText;
    }

    if (fieldType === 'currency') {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) return emptyText;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    }

    if (fieldType === 'date') {
      try {
        return new Date(value.toString()).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return value.toString();
      }
    }

    return value.toString();
  };

  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div className={cn("relative group", className)}>
      <AnimatePresence mode="wait">
        {isEditing ? (
          // Edit Mode
          <motion.div
            key="editing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            <div className="flex items-start gap-2">
              {/* Input Field */}
              <div className="flex-1">
                {fieldType === 'textarea' ? (
                  <Textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={editValue}
                    onChange={(e) => {
                      setEditValue(e.target.value);
                      setError(null);
                    }}
                    placeholder={placeholder}
                    disabled={isSaving}
                    rows={3}
                    className={cn(
                      "text-sm resize-none",
                      error && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                ) : (
                  <div className="relative">
                    {prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        {prefix}
                      </span>
                    )}
                    <Input
                      ref={inputRef as React.RefObject<HTMLInputElement>}
                      type={fieldType === 'currency' ? 'number' : fieldType === 'number' ? 'number' : fieldType}
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        setError(null);
                      }}
                      placeholder={placeholder}
                      disabled={isSaving}
                      min={minValue}
                      max={maxValue}
                      step={fieldType === 'currency' ? '0.01' : undefined}
                      className={cn(
                        "text-sm h-9",
                        prefix && "pl-8",
                        suffix && "pr-8",
                        error && "border-red-500 focus-visible:ring-red-500"
                      )}
                    />
                    {suffix && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        {suffix}
                      </span>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500 mt-1"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-9 w-9 p-0 bg-emerald-500 hover:bg-emerald-600"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-9 w-9 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          // Display Mode
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !disabled && setIsEditing(true)}
            disabled={disabled}
            className={cn(
              "w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all",
              "hover:bg-slate-100 dark:hover:bg-slate-800",
              disabled && "cursor-not-allowed opacity-50",
              isEmpty && "italic"
            )}
          >
            <div className="flex-1 min-w-0">
              {label && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                  {label}
                </span>
              )}
              <span className={cn(
                "text-sm block truncate",
                isEmpty 
                  ? "text-slate-400 dark:text-slate-500" 
                  : "text-slate-800 dark:text-slate-200 font-medium"
              )}>
                {prefix && !isEmpty && <span className="text-slate-400">{prefix}</span>}
                {getDisplayValue()}
                {suffix && !isEmpty && <span className="text-slate-400 ml-1">{suffix}</span>}
              </span>
            </div>

            {/* Edit Icon - shows on hover */}
            {!disabled && (
              <Pencil className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

export default InlineEditField;
