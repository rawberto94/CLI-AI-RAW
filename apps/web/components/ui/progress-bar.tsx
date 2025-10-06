/**
 * Progress Bar Component
 * Animated progress indicator with percentage and labels
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'orange' | 'red';
  estimatedTime?: number; // seconds
  className?: string;
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  color = 'blue',
  estimatedTime,
  className = '',
}: ProgressBarProps) {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    orange: 'bg-orange-600',
    red: 'bg-red-600',
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <p className="text-sm font-medium text-gray-700">{label}</p>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-600">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}

      <div className={`bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <motion.div
          className={`h-full rounded-full ${colorClasses[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {estimatedTime && (
        <p className="text-xs text-gray-500 mt-1">
          Estimated time: {formatTime(estimatedTime)}
        </p>
      )}
    </div>
  );
}
