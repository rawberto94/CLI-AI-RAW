/**
 * ProgressBar Component
 * Enhanced progress bar with file upload tracking support
 * Requirements: 2.2
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  estimatedTime?: number; // seconds
  fileName?: string;
  fileSize?: string;
  className?: string;
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  variant = 'default',
  estimatedTime,
  fileName,
  fileSize,
  className,
}: ProgressBarProps) {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    default: 'bg-violet-600',
    success: 'bg-green-600',
    warning: 'bg-orange-600',
    error: 'bg-red-600',
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {/* File info header */}
      {fileName && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{fileName}</p>
            {fileSize && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{fileSize}</p>
            )}
          </div>
          {showPercentage && (
            <span className="ml-2 text-sm font-semibold text-violet-700 dark:text-violet-400">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Label and percentage (when no file info) */}
      {!fileName && (label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
          )}
          {showPercentage && (
            <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className={cn(
        'bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden',
        sizeClasses[size]
      )}>
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors',
            variantClasses[variant]
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Estimated time */}
      {estimatedTime && estimatedTime > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          Estimated time remaining: {formatTime(estimatedTime)}
        </p>
      )}
    </div>
  );
}
