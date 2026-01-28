/**
 * Spinner Component
 * Loading spinner with various sizes and colors
 * Enhanced with accessibility and utility variants
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'white' | 'current';
  label?: string;
  className?: string;
  /** Use Lucide icon instead of SVG (matches rest of app) */
  variant?: 'svg' | 'icon';
}

export function Spinner({
  size = 'md',
  color = 'blue',
  label,
  className = '',
  variant = 'svg',
}: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    blue: 'text-violet-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
    white: 'text-white',
    current: 'text-current',
  };

  if (variant === 'icon') {
    return (
      <span
        className={cn('inline-flex items-center gap-2', className)}
        role="status"
        aria-label={label || 'Loading'}
      >
        <Loader2
          className={cn(sizeClasses[size], colorClasses[color], 'animate-spin')}
          aria-hidden="true"
        />
        {label && <span className="text-sm text-gray-600">{label}</span>}
        <span className="sr-only">{label || 'Loading'}</span>
      </span>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="status"
      aria-label={label || 'Loading'}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={cn(sizeClasses[size], colorClasses[color])}
      >
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </motion.div>
      
      {label && (
        <span className="text-sm text-gray-600">{label}</span>
      )}
      <span className="sr-only">{label || 'Loading'}</span>
    </div>
  );
}

/**
 * Full page spinner overlay
 */
export function FullPageSpinner({
  label = 'Loading...',
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="xl" color="blue" />
        <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

/**
 * Inline button spinner (for buttons with loading state)
 */
export function ButtonSpinner({
  className,
}: {
  className?: string;
}) {
  return (
    <Loader2
      className={cn('w-4 h-4 animate-spin', className)}
      aria-hidden="true"
    />
  );
}

/**
 * Card/section loading spinner
 */
export function CardSpinner({
  label = 'Loading...',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-12', className)}
      role="status"
      aria-label={label}
    >
      <Spinner size="lg" color="gray" />
      <p className="mt-3 text-sm text-slate-500">{label}</p>
    </div>
  );
}
