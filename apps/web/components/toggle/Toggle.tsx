'use client';

/**
 * Toggle/Switch Component
 * Accessible toggle switches with labels
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'indigo' | 'emerald' | 'blue' | 'amber' | 'red';
  label?: string;
  description?: string;
  showIcons?: boolean;
  className?: string;
}

interface ToggleGroupProps {
  options: { value: string; label: string; icon?: LucideIcon }[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

const sizeConfig = {
  sm: {
    track: 'w-8 h-5',
    thumb: 'w-3.5 h-3.5',
    translate: 'translate-x-3.5',
    icon: 'w-2.5 h-2.5',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-5 h-5',
    translate: 'translate-x-5',
    icon: 'w-3 h-3',
  },
  lg: {
    track: 'w-14 h-7',
    thumb: 'w-6 h-6',
    translate: 'translate-x-7',
    icon: 'w-3.5 h-3.5',
  },
};

const colorClasses = {
  indigo: 'bg-indigo-600',
  emerald: 'bg-emerald-600',
  blue: 'bg-blue-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};

// ============================================================================
// Toggle Component
// ============================================================================

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  color = 'indigo',
  label,
  description,
  showIcons = false,
  className,
}: ToggleProps) {
  const config = sizeConfig[size];

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
          config.track,
          checked ? colorClasses[color] : 'bg-slate-200',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-white shadow-sm',
            config.thumb,
            checked ? config.translate : 'translate-x-0.5'
          )}
        >
          {showIcons && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              {checked ? (
                <Check className={cn(config.icon, 'text-emerald-600')} />
              ) : (
                <X className={cn(config.icon, 'text-slate-400')} />
              )}
            </motion.span>
          )}
        </motion.span>
      </button>

      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label
              onClick={handleClick}
              className={cn(
                'text-sm font-medium text-slate-900 cursor-pointer',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Toggle Group (Segmented Control)
// ============================================================================

export function ToggleGroup({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: ToggleGroupProps) {
  const paddingClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center bg-slate-100 rounded-xl p-1',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center gap-2 font-medium rounded-lg transition-all',
              paddingClasses[size],
              isSelected
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="toggle-active"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Toggle Card
// ============================================================================

interface ToggleCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}

export function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
  disabled = false,
  className,
}: ToggleCardProps) {
  return (
    <motion.button
      onClick={() => !disabled && onChange(!checked)}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      disabled={disabled}
      className={cn(
        'w-full text-left p-4 rounded-xl border-2 transition-all',
        checked
          ? 'border-indigo-600 bg-indigo-50'
          : 'border-slate-200 hover:border-slate-300',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              checked ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h3
              className={cn(
                'font-medium',
                checked ? 'text-indigo-900' : 'text-slate-900'
              )}
            >
              {title}
            </h3>
            <Toggle checked={checked} onChange={onChange} size="sm" disabled={disabled} />
          </div>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================================
// Theme Toggle (Light/Dark)
// ============================================================================

import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  isDark: boolean;
  onChange: (isDark: boolean) => void;
  className?: string;
}

export function ThemeToggle({ isDark, onChange, className }: ThemeToggleProps) {
  return (
    <button
      onClick={() => onChange(!isDark)}
      className={cn(
        'relative w-16 h-8 rounded-full p-1 transition-colors',
        isDark ? 'bg-slate-800' : 'bg-sky-100',
        className
      )}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          isDark ? 'bg-slate-700 translate-x-8' : 'bg-white translate-x-0'
        )}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-yellow-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
      </motion.div>
    </button>
  );
}
