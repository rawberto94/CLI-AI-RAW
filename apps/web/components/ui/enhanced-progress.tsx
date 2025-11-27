/**
 * Enhanced Progress Indicators
 * Animated progress bars, upload progress, and step indicators
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showValue = false,
  animated = true,
  className
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variants = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    gradient: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={cn('w-full', className)}>
      {showValue && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className={cn(
        'w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden',
        sizes[size]
      )}>
        <motion.div
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full transition-all',
            variants[variant]
          )}
        />
      </div>
    </div>
  );
}

/**
 * Upload Progress with file info
 */
interface UploadProgressProps {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  fileSize?: string;
  onCancel?: () => void;
}

export function UploadProgress({
  fileName,
  progress,
  status,
  fileSize,
  onCancel
}: UploadProgressProps) {
  const statusConfigs = {
    uploading: {
      color: 'blue',
      label: 'Uploading...',
      icon: <Loader2 className="h-4 w-4 animate-spin" />
    },
    processing: {
      color: 'indigo',
      label: 'Processing with AI...',
      icon: <Loader2 className="h-4 w-4 animate-spin" />
    },
    completed: {
      color: 'green',
      label: 'Complete',
      icon: <Check className="h-4 w-4" />
    },
    error: {
      color: 'red',
      label: 'Failed',
      icon: null
    }
  };

  const config = statusConfigs[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            status === 'completed' ? 'bg-green-100 text-green-600' :
            status === 'error' ? 'bg-red-100 text-red-600' :
            'bg-blue-100 text-blue-600'
          )}>
            {config.icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
              {fileName}
            </p>
            <p className="text-xs text-gray-500">
              {fileSize && `${fileSize} • `}{config.label}
            </p>
          </div>
        </div>
        {status === 'uploading' && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        )}
      </div>

      <ProgressBar
        value={progress}
        variant={status === 'completed' ? 'success' : status === 'error' ? 'error' : 'gradient'}
        size="sm"
        animated={status !== 'completed'}
      />
    </motion.div>
  );
}

/**
 * Step Indicator for multi-step processes
 */
interface Step {
  id: string | number;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  orientation = 'horizontal',
  className
}: StepIndicatorProps) {
  return (
    <div className={cn(
      orientation === 'horizontal' 
        ? 'flex items-center justify-between' 
        : 'flex flex-col gap-4',
      className
    )}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className={cn(
              'flex items-center gap-3',
              orientation === 'horizontal' && 'flex-col'
            )}>
              {/* Step Circle */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted 
                    ? '#22c55e' 
                    : isCurrent 
                      ? '#3b82f6' 
                      : '#e5e7eb'
                }}
                className={cn(
                  'relative flex items-center justify-center rounded-full transition-colors',
                  orientation === 'horizontal' ? 'h-10 w-10' : 'h-8 w-8',
                  isCompleted && 'bg-green-500',
                  isCurrent && 'bg-blue-500 ring-4 ring-blue-100',
                  !isCompleted && !isCurrent && 'bg-gray-200'
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <span className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-white' : 'text-gray-500'
                  )}>
                    {index + 1}
                  </span>
                )}

                {/* Pulse animation for current step */}
                {isCurrent && (
                  <motion.span
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-blue-500"
                  />
                )}
              </motion.div>

              {/* Step Label */}
              <div className={cn(
                orientation === 'horizontal' ? 'text-center' : 'flex-1'
              )}>
                <p className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-blue-600' : 
                  isCompleted ? 'text-gray-900' : 'text-gray-500'
                )}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector Line */}
            {!isLast && (
              <div className={cn(
                orientation === 'horizontal' 
                  ? 'flex-1 h-0.5 mx-2' 
                  : 'w-0.5 h-8 ml-4',
                isCompleted ? 'bg-green-500' : 'bg-gray-200'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Circular Progress for compact display
 */
interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
  className?: string;
}

export function CircularProgress({
  value,
  size = 48,
  strokeWidth = 4,
  color = '#3b82f6',
  showValue = true,
  className
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(100, Math.max(0, value));
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {showValue && (
        <span className="absolute text-xs font-medium text-gray-700 dark:text-gray-300">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

/**
 * AI Processing Indicator
 */
export function AIProcessingIndicator({ 
  stage = 'Analyzing',
  className 
}: { 
  stage?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.2, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500"
        />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          AI {stage}
        </p>
        <p className="text-xs text-gray-500">This may take a moment...</p>
      </div>
    </div>
  );
}

export default ProgressBar;
