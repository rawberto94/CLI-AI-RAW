'use client';

/**
 * Progress Steps
 * Multi-step progress indicator for workflows
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Loader2, AlertCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type StepStatus = 'pending' | 'current' | 'completed' | 'error';

interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  errorStep?: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'numbered' | 'icons';
  className?: string;
  onStepClick?: (stepIndex: number) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getStepStatus(index: number, currentStep: number, errorStep?: number): StepStatus {
  if (errorStep !== undefined && index === errorStep) return 'error';
  if (index < currentStep) return 'completed';
  if (index === currentStep) return 'current';
  return 'pending';
}

// ============================================================================
// Styles
// ============================================================================

const SIZES = {
  sm: { circle: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-xs', gap: 'gap-2' },
  md: { circle: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-sm', gap: 'gap-3' },
  lg: { circle: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-base', gap: 'gap-4' },
};

const STATUS_STYLES = {
  pending: {
    circle: 'bg-slate-100 border-slate-200 text-slate-400',
    line: 'bg-slate-200',
  },
  current: {
    circle: 'bg-indigo-100 border-indigo-300 text-indigo-600 ring-4 ring-indigo-100',
    line: 'bg-slate-200',
  },
  completed: {
    circle: 'bg-indigo-600 border-indigo-600 text-white',
    line: 'bg-indigo-600',
  },
  error: {
    circle: 'bg-red-100 border-red-300 text-red-600 ring-4 ring-red-100',
    line: 'bg-slate-200',
  },
};

// ============================================================================
// Step Icon Component
// ============================================================================

interface StepIconProps {
  status: StepStatus;
  index: number;
  step: Step;
  variant: 'default' | 'numbered' | 'icons';
  size: 'sm' | 'md' | 'lg';
}

function StepIcon({ status, index, step, variant, size }: StepIconProps) {
  const sizeStyles = SIZES[size];
  const statusStyles = STATUS_STYLES[status];
  const CustomIcon = step.icon;

  const renderContent = () => {
    if (status === 'completed') {
      return <Check className={sizeStyles.icon} />;
    }
    if (status === 'current') {
      return <Loader2 className={cn(sizeStyles.icon, 'animate-spin')} />;
    }
    if (status === 'error') {
      return <AlertCircle className={sizeStyles.icon} />;
    }
    
    if (variant === 'numbered') {
      return <span className="font-semibold">{index + 1}</span>;
    }
    if (variant === 'icons' && CustomIcon) {
      return <CustomIcon className={sizeStyles.icon} />;
    }
    return <Circle className={cn(sizeStyles.icon, 'fill-current')} />;
  };

  return (
    <motion.div
      initial={false}
      animate={{
        scale: status === 'current' ? 1.1 : 1,
      }}
      className={cn(
        'flex items-center justify-center rounded-full border-2 transition-all duration-300',
        sizeStyles.circle,
        statusStyles.circle
      )}
    >
      {renderContent()}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProgressSteps({
  steps,
  currentStep,
  errorStep,
  orientation = 'horizontal',
  size = 'md',
  variant = 'default',
  className,
  onStepClick,
}: ProgressStepsProps) {
  const sizeStyles = SIZES[size];
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'flex',
        isHorizontal ? 'flex-row items-start' : 'flex-col',
        className
      )}
    >
      {steps.map((step, index) => {
        const status = getStepStatus(index, currentStep, errorStep);
        const statusStyles = STATUS_STYLES[status];
        const isLast = index === steps.length - 1;
        const isClickable = onStepClick && index < currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              'flex',
              isHorizontal ? 'flex-1 flex-col items-center' : 'flex-row items-start',
              isHorizontal && !isLast && 'relative'
            )}
          >
            {/* Step Indicator */}
            <div
              className={cn(
                'flex',
                isHorizontal ? 'flex-col items-center' : 'flex-row items-start',
                sizeStyles.gap
              )}
            >
              {/* Circle */}
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  'relative z-10 flex-shrink-0',
                  isClickable && 'cursor-pointer hover:scale-110 transition-transform'
                )}
              >
                <StepIcon
                  status={status}
                  index={index}
                  step={step}
                  variant={variant}
                  size={size}
                />
              </button>

              {/* Label & Description */}
              <div className={cn(
                isHorizontal ? 'text-center mt-3' : 'ml-4 pb-8',
                !isLast && !isHorizontal && 'border-l-2 border-slate-200 pl-8 -ml-1'
              )}>
                <p className={cn(
                  'font-medium transition-colors',
                  sizeStyles.text,
                  status === 'completed' && 'text-slate-900',
                  status === 'current' && 'text-indigo-600',
                  status === 'pending' && 'text-slate-400',
                  status === 'error' && 'text-red-600'
                )}>
                  {step.label}
                </p>
                {step.description && (
                  <p className={cn(
                    'mt-1 text-slate-500',
                    size === 'sm' ? 'text-xs' : 'text-sm'
                  )}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Horizontal Connector Line */}
            {isHorizontal && !isLast && (
              <div className="absolute top-4 left-1/2 right-0 -translate-y-1/2 w-full">
                <div className="mx-6 h-0.5 bg-slate-200 relative overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: status === 'completed' ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="absolute inset-0 bg-indigo-600 origin-left"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Compact Progress Bar Variant
// ============================================================================

interface ProgressBarStepsProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function ProgressBarSteps({ steps, currentStep, className }: ProgressBarStepsProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Labels */}
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-900">{steps[currentStep]}</span>
        <span className="text-slate-500">
          Step {currentStep + 1} of {steps.length}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
        />
      </div>
      
      {/* Step Dots */}
      <div className="flex justify-between px-1">
        {steps.map((_, index) => (
          <div
            key={index}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              index <= currentStep ? 'bg-indigo-600' : 'bg-slate-200'
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Circular Progress Variant
// ============================================================================

interface CircularProgressProps {
  current: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function CircularProgress({
  current,
  total,
  size = 80,
  strokeWidth = 6,
  className,
  showLabel = true,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (current / total) * 100;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-900">{current}/{total}</span>
          <span className="text-xs text-slate-500">steps</span>
        </div>
      )}
    </div>
  );
}
