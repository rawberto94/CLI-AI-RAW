'use client';

import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ProgressStatus = 'pending' | 'active' | 'completed' | 'error' | 'skipped';

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  status: ProgressStatus;
  progress?: number; // 0-100 for granular progress within step
  duration?: number; // estimated duration in seconds
  error?: string;
}

// ============================================================================
// Linear Progress Bar
// ============================================================================

interface LinearProgressProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'striped' | 'indeterminate';
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';
  showLabel?: boolean;
  label?: string;
  className?: string;
  animate?: boolean;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
};

const gradientClasses = {
  blue: 'bg-gradient-to-r from-blue-400 to-blue-600',
  green: 'bg-gradient-to-r from-green-400 to-green-600',
  amber: 'bg-gradient-to-r from-amber-400 to-amber-600',
  red: 'bg-gradient-to-r from-red-400 to-red-600',
  violet: 'bg-gradient-to-r from-violet-400 to-violet-600',
  cyan: 'bg-gradient-to-r from-cyan-400 to-cyan-600',
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const LinearProgress = memo(function LinearProgress({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  color = 'blue',
  showLabel = false,
  label,
  className = '',
  animate = true,
}: LinearProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const barClasses =
    variant === 'gradient'
      ? gradientClasses[color]
      : colorClasses[color];

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
          {showLabel && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`relative overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700 ${sizeClasses[size]}`}
      >
        {variant === 'indeterminate' ? (
          <motion.div
            className={`absolute inset-y-0 w-1/3 rounded-full ${barClasses}`}
            animate={{ left: ['-33%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className={`h-full rounded-full ${barClasses} ${
              variant === 'striped'
                ? 'bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]'
                : ''
            }`}
            initial={animate ? { width: 0 } : { width: `${percentage}%` }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Circular Progress
// ============================================================================

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';
  showValue?: boolean;
  label?: string;
  className?: string;
}

const circularSizes = {
  sm: 40,
  md: 64,
  lg: 96,
  xl: 128,
};

const strokeColors = {
  blue: 'stroke-blue-500',
  green: 'stroke-green-500',
  amber: 'stroke-amber-500',
  red: 'stroke-red-500',
  violet: 'stroke-violet-500',
  cyan: 'stroke-cyan-500',
};

export const CircularProgress = memo(function CircularProgress({
  value,
  max = 100,
  size = 'md',
  strokeWidth = 4,
  color = 'blue',
  showValue = true,
  label,
  className = '',
}: CircularProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const sizeValue = circularSizes[size];
  const radius = (sizeValue - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: sizeValue, height: sizeValue }}>
        {/* Background circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={sizeValue}
          height={sizeValue}
        >
          <circle
            cx={sizeValue / 2}
            cy={sizeValue / 2}
            r={radius}
            fill="none"
            className="stroke-zinc-200 dark:stroke-zinc-700"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={sizeValue / 2}
            cy={sizeValue / 2}
            r={radius}
            fill="none"
            className={strokeColors[color]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>

        {/* Value */}
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`font-bold text-zinc-900 dark:text-white ${
                size === 'sm'
                  ? 'text-xs'
                  : size === 'md'
                  ? 'text-sm'
                  : size === 'lg'
                  ? 'text-xl'
                  : 'text-2xl'
              }`}
            >
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// Step Progress
// ============================================================================

interface StepProgressProps {
  steps: ProgressStep[];
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  showDescriptions?: boolean;
  collapsible?: boolean;
  className?: string;
}

const statusIcons = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle2,
  error: AlertCircle,
  skipped: X,
};

const statusColors = {
  pending: 'text-zinc-400 dark:text-zinc-500',
  active: 'text-blue-500',
  completed: 'text-green-500',
  error: 'text-red-500',
  skipped: 'text-zinc-400 dark:text-zinc-500',
};

export const StepProgress = memo(function StepProgress({
  steps,
  currentStep,
  orientation = 'horizontal',
  showDescriptions = true,
  collapsible = false,
  className = '',
}: StepProgressProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  if (orientation === 'horizontal') {
    return (
      <div className={className}>
        {collapsible && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 mb-3 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {completedSteps} of {steps.length} completed
          </button>
        )}

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="flex items-center">
                {steps.map((step, index) => {
                  const Icon = statusIcons[step.status];
                  const isLast = index === steps.length - 1;

                  return (
                    <React.Fragment key={step.id}>
                      <div className="flex flex-col items-center">
                        <div
                          className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                            step.status === 'completed'
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : step.status === 'active'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : step.status === 'error'
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${statusColors[step.status]} ${
                              step.status === 'active' ? 'animate-spin' : ''
                            }`}
                          />
                        </div>
                        {showDescriptions && (
                          <div className="mt-2 text-center max-w-[100px]">
                            <p
                              className={`text-xs font-medium ${
                                step.status === 'active'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : step.status === 'completed'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              {step.label}
                            </p>
                          </div>
                        )}
                      </div>
                      {!isLast && (
                        <div className="flex-1 h-0.5 mx-2 bg-zinc-200 dark:bg-zinc-700 relative overflow-hidden">
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-green-500"
                            initial={{ width: 0 }}
                            animate={{
                              width:
                                step.status === 'completed'
                                  ? '100%'
                                  : step.status === 'active'
                                  ? `${step.progress || 50}%`
                                  : 0,
                            }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className={className}>
      {steps.map((step, index) => {
        const Icon = statusIcons[step.status];
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex">
            {/* Icon and line */}
            <div className="flex flex-col items-center mr-4">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  step.status === 'completed'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : step.status === 'active'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : step.status === 'error'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${statusColors[step.status]} ${
                    step.status === 'active' ? 'animate-spin' : ''
                  }`}
                />
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 min-h-[40px] bg-zinc-200 dark:bg-zinc-700 my-1 relative overflow-hidden">
                  <motion.div
                    className="absolute inset-x-0 top-0 bg-green-500"
                    initial={{ height: 0 }}
                    animate={{
                      height: step.status === 'completed' ? '100%' : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
              <p
                className={`font-medium ${
                  step.status === 'active'
                    ? 'text-blue-600 dark:text-blue-400'
                    : step.status === 'completed'
                    ? 'text-green-600 dark:text-green-400'
                    : step.status === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {step.label}
              </p>
              {showDescriptions && step.description && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {step.description}
                </p>
              )}
              {step.status === 'error' && step.error && (
                <p className="text-sm text-red-500 mt-1">{step.error}</p>
              )}
              {step.status === 'active' && step.progress !== undefined && (
                <div className="mt-2 w-48">
                  <LinearProgress value={step.progress} size="sm" color="blue" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ============================================================================
// Upload Progress
// ============================================================================

interface UploadProgressProps {
  fileName: string;
  fileSize?: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const UploadProgress = memo(function UploadProgress({
  fileName,
  fileSize,
  progress,
  status,
  error,
  onCancel,
  onRetry,
  className = '',
}: UploadProgressProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            status === 'completed'
              ? 'bg-green-100 dark:bg-green-900/30'
              : status === 'error'
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}
        >
          {status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : status === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : status === 'processing' ? (
            <Zap className="w-5 h-5 text-blue-500 animate-pulse" />
          ) : (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-medium text-zinc-900 dark:text-white truncate">
              {fileName}
            </p>
            {(status === 'uploading' || status === 'processing') && onCancel && (
              <button
                onClick={onCancel}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            {fileSize && <span>{formatBytes(fileSize)}</span>}
            <span>•</span>
            <span>
              {status === 'uploading'
                ? `Uploading... ${progress}%`
                : status === 'processing'
                ? 'Processing...'
                : status === 'completed'
                ? 'Completed'
                : 'Failed'}
            </span>
          </div>

          {(status === 'uploading' || status === 'processing') && (
            <LinearProgress
              value={status === 'processing' ? 100 : progress}
              size="sm"
              variant={status === 'processing' ? 'indeterminate' : 'default'}
              color="blue"
            />
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-red-500">{error || 'Upload failed'}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Processing Timeline
// ============================================================================

interface ProcessingTimelineProps {
  stages: {
    id: string;
    label: string;
    status: ProgressStatus;
    duration?: number;
  }[];
  className?: string;
}

export const ProcessingTimeline = memo(function ProcessingTimeline({
  stages,
  className = '',
}: ProcessingTimelineProps) {
  const activeStage = stages.find((s) => s.status === 'active');
  const completedCount = stages.filter((s) => s.status === 'completed').length;

  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-zinc-900 dark:text-white">Processing</h4>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {completedCount}/{stages.length} complete
        </span>
      </div>

      <div className="space-y-3">
        {stages.map((stage) => {
          const Icon = statusIcons[stage.status];
          return (
            <div key={stage.id} className="flex items-center gap-3">
              <Icon
                className={`w-5 h-5 ${statusColors[stage.status]} ${
                  stage.status === 'active' ? 'animate-spin' : ''
                }`}
              />
              <span
                className={`flex-1 text-sm ${
                  stage.status === 'active'
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : stage.status === 'completed'
                    ? 'text-zinc-600 dark:text-zinc-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {stage.label}
              </span>
              {stage.status === 'completed' && stage.duration && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {stage.duration}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
