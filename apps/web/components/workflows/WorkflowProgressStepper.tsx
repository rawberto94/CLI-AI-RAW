'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  XCircle,
  User,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    transition?: object;
    className?: string;
  }
>;

interface WorkflowStep {
  id: string;
  name: string;
  role?: string;
  assignee?: {
    name: string;
    email?: string;
    avatar?: string;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'skipped';
  completedAt?: string;
  duration?: number; // in minutes
  comment?: string;
}

interface WorkflowProgressStepperProps {
  steps: WorkflowStep[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
  showTimeline?: boolean;
  className?: string;
}

/**
 * WorkflowProgressStepper - Visual workflow progress indicator
 * Shows all steps, current position, and completion status
 * WCAG 2.1 accessible with proper ARIA roles and labels
 */
export function WorkflowProgressStepper({
  steps,
  currentStep,
  orientation = 'horizontal',
  compact = false,
  showTimeline = false,
  className,
}: WorkflowProgressStepperProps) {
  // Calculate progress percentage for screen readers
  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const getStepStyles = (step: WorkflowStep, index: number) => {
    const isCurrent = index === currentStep;
    const isCompleted = step.status === 'completed';
    const isRejected = step.status === 'rejected';
    const isPending = step.status === 'pending';
    const isInProgress = step.status === 'in_progress';

    return {
      container: cn(
        'relative flex items-center gap-2 transition-all duration-300',
        isCurrent && 'scale-105',
        orientation === 'vertical' && 'flex-row',
        orientation === 'horizontal' && compact && 'flex-col text-center'
      ),
      circle: cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300',
        isCompleted && 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-400 text-white shadow-md shadow-green-200',
        isRejected && 'bg-gradient-to-br from-red-400 to-rose-500 border-red-400 text-white shadow-md shadow-red-200',
        isInProgress && 'bg-gradient-to-br from-indigo-400 to-purple-500 border-indigo-400 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100 animate-pulse',
        isPending && 'bg-slate-100 border-slate-300 text-slate-400'
      ),
      label: cn(
        'text-sm font-medium transition-colors',
        isCompleted && 'text-green-700',
        isRejected && 'text-red-700',
        isInProgress && 'text-indigo-700',
        isPending && 'text-slate-500'
      ),
      connector: cn(
        'flex-1 h-0.5 transition-all duration-500',
        isCompleted && 'bg-gradient-to-r from-green-400 to-green-500',
        isRejected && 'bg-gradient-to-r from-red-400 to-red-300',
        isInProgress && 'bg-gradient-to-r from-indigo-400 to-slate-200',
        isPending && 'bg-slate-200'
      ),
    };
  };

  const renderStepIcon = (step: WorkflowStep, index: number) => {
    const isInProgress = step.status === 'in_progress';
    
    if (step.status === 'completed') {
      return <CheckCircle2 className="w-4 h-4" />;
    }
    if (step.status === 'rejected') {
      return <XCircle className="w-4 h-4" />;
    }
    if (isInProgress) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    return <span className="text-xs font-bold">{index + 1}</span>;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  // Horizontal layout
  if (orientation === 'horizontal') {
    return (
      <div 
        className={cn('w-full', className)}
        role="group"
        aria-label={`Workflow progress: Step ${currentStep + 1} of ${steps.length}, ${progressPercent}% complete`}
      >
        <div className="flex items-center justify-between" role="list">
          {steps.map((step, index) => {
            const styles = getStepStyles(step, index);
            const isLast = index === steps.length - 1;
            const stepStatus = step.status === 'completed' ? 'Completed' 
              : step.status === 'rejected' ? 'Rejected'
              : step.status === 'in_progress' ? 'In progress'
              : 'Pending';

            return (
              <React.Fragment key={step.id}>
                <MotionDiv
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={styles.container}
                  role="listitem"
                  aria-label={`Step ${index + 1}: ${step.name} - ${stepStatus}`}
                  aria-current={index === currentStep ? 'step' : undefined}
                >
                  <div className={styles.circle} aria-hidden="true">
                    {renderStepIcon(step, index)}
                  </div>
                  {!compact && (
                    <div className="min-w-0">
                      <div className={styles.label}>{step.name}</div>
                      {step.role && (
                        <div className="text-xs text-slate-400">{step.role}</div>
                      )}
                      {step.completedAt && (
                        <div className="text-xs text-slate-400">
                          {formatDuration(step.duration)}
                        </div>
                      )}
                    </div>
                  )}
                </MotionDiv>
                
                {!isLast && (
                  <MotionDiv
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: index * 0.1 + 0.05, duration: 0.3 }}
                    className={cn(styles.connector, 'origin-left mx-2 min-w-[24px]')}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Progress percentage */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-indigo-600 font-medium" aria-hidden="true">
            {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
          </span>
        </div>
      </div>
    );
  }

  // Vertical layout with timeline
  return (
    <div 
      className={cn('relative', className)}
      role="group"
      aria-label={`Workflow progress: Step ${currentStep + 1} of ${steps.length}, ${progressPercent}% complete`}
    >
      {/* Timeline line */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" aria-hidden="true" />
      
      <div className="space-y-4" role="list">
        {steps.map((step, index) => {
          const styles = getStepStyles(step, index);
          const isLast = index === steps.length - 1;
          const stepStatus = step.status === 'completed' ? 'Completed' 
            : step.status === 'rejected' ? 'Rejected'
            : step.status === 'in_progress' ? 'In progress'
            : 'Pending';

          return (
            <MotionDiv
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex items-start gap-4 pl-0"
              role="listitem"
              aria-label={`Step ${index + 1}: ${step.name} - ${stepStatus}`}
              aria-current={index === currentStep ? 'step' : undefined}
            >
              {/* Step circle (overlays the timeline) */}
              <div className={cn(styles.circle, 'relative z-10')} aria-hidden="true">
                {renderStepIcon(step, index)}
              </div>
              
              {/* Step content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={styles.label}>{step.name}</div>
                    {step.role && (
                      <div className="text-xs text-slate-400">{step.role}</div>
                    )}
                  </div>
                  
                  {step.status === 'completed' && step.completedAt && (
                    <div className="text-xs text-slate-400 text-right">
                      <div>{new Date(step.completedAt).toLocaleDateString()}</div>
                      {step.duration && <div>{formatDuration(step.duration)}</div>}
                    </div>
                  )}
                </div>
                
                {/* Assignee info */}
                {step.assignee && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                      {step.assignee.avatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={step.assignee.avatar} alt={`${step.assignee.name}'s avatar`} className="w-full h-full rounded-full" />
                      ) : (
                        step.assignee.name.charAt(0)
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{step.assignee.name}</span>
                  </div>
                )}
                
                {/* Comment if any */}
                {step.comment && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs text-slate-600 italic">
                    &ldquo;{step.comment}&rdquo;
                  </div>
                )}
                
                {/* Connector to next step */}
                {!isLast && showTimeline && (
                  <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-gradient-to-b from-slate-300 to-slate-200" />
                )}
              </div>
            </MotionDiv>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact inline workflow progress bar
 */
interface WorkflowProgressBarProps {
  currentStep: number;
  totalSteps: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected';
  className?: string;
}

export function WorkflowProgressBar({
  currentStep,
  totalSteps,
  status = 'in_progress',
  className,
}: WorkflowProgressBarProps) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const statusLabel = status === 'completed' ? 'Completed'
    : status === 'rejected' ? 'Rejected'
    : status === 'in_progress' ? 'In progress'
    : 'Pending';
  
  const statusColors = {
    pending: 'from-amber-400 to-amber-500',
    in_progress: 'from-indigo-400 to-purple-500',
    completed: 'from-green-400 to-emerald-500',
    rejected: 'from-red-400 to-rose-500',
  };
  
  const bgColors = {
    pending: 'bg-amber-100',
    in_progress: 'bg-indigo-100',
    completed: 'bg-green-100',
    rejected: 'bg-red-100',
  };

  return (
    <div 
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Workflow ${statusLabel}: Step ${currentStep} of ${totalSteps}, ${progress}% complete`}
    >
      <div className="flex items-center justify-between mb-1" aria-hidden="true">
        <span className="text-xs font-medium text-slate-600">
          Step {currentStep} of {totalSteps}
        </span>
        <span className={cn(
          'text-xs font-bold',
          status === 'completed' && 'text-green-600',
          status === 'rejected' && 'text-red-600',
          status === 'in_progress' && 'text-indigo-600',
          status === 'pending' && 'text-amber-600'
        )}>
          {progress}%
        </span>
      </div>
      <div className={cn('h-2 rounded-full overflow-hidden', bgColors[status])} aria-hidden="true">
        <MotionDiv
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full bg-gradient-to-r', statusColors[status])}
        />
      </div>
    </div>
  );
}

/**
 * SLA Indicator - Shows time remaining vs SLA target
 */
interface SLAIndicatorProps {
  startTime: Date;
  targetTime: Date;
  currentTime?: Date;
  label?: string;
  className?: string;
}

export function SLAIndicator({
  startTime,
  targetTime,
  currentTime = new Date(),
  label = 'SLA',
  className,
}: SLAIndicatorProps) {
  const totalDuration = targetTime.getTime() - startTime.getTime();
  const elapsed = currentTime.getTime() - startTime.getTime();
  const remaining = targetTime.getTime() - currentTime.getTime();
  
  const percentageUsed = Math.min(100, Math.round((elapsed / totalDuration) * 100));
  const isOverdue = remaining < 0;
  const isWarning = percentageUsed >= 75 && percentageUsed < 100;
  const isCritical = percentageUsed >= 90 || isOverdue;
  
  const formatRemaining = () => {
    const absRemaining = Math.abs(remaining);
    const hours = Math.floor(absRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((absRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (isOverdue) {
      if (hours > 24) return `${Math.floor(hours / 24)}d overdue`;
      return hours > 0 ? `${hours}h ${minutes}m overdue` : `${minutes}m overdue`;
    }
    if (hours > 24) return `${Math.floor(hours / 24)}d left`;
    return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
  };

  const barColor = isOverdue
    ? 'from-red-500 to-red-600'
    : isCritical
    ? 'from-red-400 to-orange-500'
    : isWarning
    ? 'from-amber-400 to-orange-400'
    : 'from-green-400 to-emerald-500';

  const bgColor = isOverdue
    ? 'bg-red-100'
    : isCritical
    ? 'bg-red-50'
    : isWarning
    ? 'bg-amber-50'
    : 'bg-green-50';

  const timeRemainingText = formatRemaining();
  const urgencyLevel = isOverdue ? 'Overdue' : isCritical ? 'Critical' : isWarning ? 'Warning' : 'On track';

  return (
    <div 
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={percentageUsed}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${timeRemainingText}, ${urgencyLevel}`}
    >
      <div className="flex items-center justify-between mb-1" aria-hidden="true">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={cn(
          'text-xs font-bold flex items-center gap-1',
          isOverdue && 'text-red-600',
          isCritical && !isOverdue && 'text-orange-600',
          isWarning && !isCritical && 'text-amber-600',
          !isWarning && !isCritical && 'text-green-600'
        )}>
          {(isCritical || isOverdue) && <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
          {timeRemainingText}
        </span>
      </div>
      <div className={cn('h-1.5 rounded-full overflow-hidden', bgColor)} aria-hidden="true">
        <MotionDiv
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percentageUsed)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full bg-gradient-to-r', barColor)}
        />
      </div>
    </div>
  );
}

export default WorkflowProgressStepper;
