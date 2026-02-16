'use client';

import React, { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Circle, AlertCircle, Loader2, LockKeyhole } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type StepStatus = 'complete' | 'current' | 'upcoming' | 'error' | 'locked';

interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
}

interface StepperContextValue {
  currentStep: number;
  steps: Step[];
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

// ============================================================================
// Context
// ============================================================================

const StepperContext = createContext<StepperContextValue | null>(null);

export function useStepper() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error('useStepper must be used within StepperProvider');
  }
  return context;
}

// ============================================================================
// Stepper Provider
// ============================================================================

interface StepperProviderProps {
  children: React.ReactNode;
  steps: Step[];
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export function StepperProvider({
  children,
  steps,
  initialStep = 0,
  onStepChange,
}: StepperProviderProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(index);
      onStepChange?.(index);
    }
  };

  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => goToStep(currentStep - 1);

  return (
    <StepperContext.Provider
      value={{
        currentStep,
        steps,
        goToStep,
        nextStep,
        prevStep,
        isFirstStep: currentStep === 0,
        isLastStep: currentStep === steps.length - 1,
      }}
    >
      {children}
    </StepperContext.Provider>
  );
}

// ============================================================================
// Horizontal Stepper
// ============================================================================

interface HorizontalStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  completedSteps?: number[];
  errorSteps?: number[];
  lockedSteps?: number[];
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function HorizontalStepper({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
  errorSteps = [],
  lockedSteps = [],
  showLabels = true,
  size = 'md',
  className = '',
}: HorizontalStepperProps) {
  const getStepStatus = (index: number): StepStatus => {
    if (lockedSteps.includes(index)) return 'locked';
    if (errorSteps.includes(index)) return 'error';
    if (completedSteps.includes(index)) return 'complete';
    if (index === currentStep) return 'current';
    return 'upcoming';
  };

  const sizeClasses = {
    sm: { icon: 'w-8 h-8', text: 'text-xs' },
    md: { icon: 'w-10 h-10', text: 'text-sm' },
    lg: { icon: 'w-12 h-12', text: 'text-base' },
  };

  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isClickable = onStepClick && status !== 'locked';

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center relative">
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`
                  ${sizeClasses[size].icon} rounded-full flex items-center justify-center
                  font-semibold transition-all
                  ${status === 'complete' ? 'bg-green-500 text-white' : ''}
                  ${status === 'current' ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white ring-4 ring-violet-100 dark:ring-violet-900 shadow-lg shadow-violet-500/30' : ''}
                  ${status === 'upcoming' ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : ''}
                  ${status === 'error' ? 'bg-red-500 text-white' : ''}
                  ${status === 'locked' ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : ''}
                  ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                `}
              >
                {status === 'complete' && <Check className="w-5 h-5" />}
                {status === 'current' && (step.icon || index + 1)}
                {status === 'upcoming' && (step.icon || index + 1)}
                {status === 'error' && <AlertCircle className="w-5 h-5" />}
                {status === 'locked' && <LockKeyhole className="w-4 h-4" />}
              </button>

              {showLabels && (
                <div className="mt-2 text-center">
                  <p className={`font-medium ${sizeClasses[size].text} ${
                    status === 'current' 
                      ? 'text-violet-600 dark:text-violet-400' 
                      : status === 'complete'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-400 mt-0.5 max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                  {step.optional && (
                    <p className="text-xs text-gray-400 italic">Optional</p>
                  )}
                </div>
              )}
            </div>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4 h-1 relative">
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-violet-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: completedSteps.includes(index) || index < currentStep ? '100%' : '0%' 
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
// Vertical Stepper
// ============================================================================

interface VerticalStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  completedSteps?: number[];
  errorSteps?: number[];
  children?: React.ReactNode[];
  className?: string;
}

export function VerticalStepper({
  steps,
  currentStep,
  onStepClick,
  completedSteps = [],
  errorSteps = [],
  children,
  className = '',
}: VerticalStepperProps) {
  const getStepStatus = (index: number): StepStatus => {
    if (errorSteps.includes(index)) return 'error';
    if (completedSteps.includes(index)) return 'complete';
    if (index === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className={`space-y-0 ${className}`}>
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isClickable = onStepClick && (status === 'complete' || status === 'current');

        return (
          <div key={step.id} className="relative">
            <div className="flex gap-4">
              {/* Icon Column */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center z-10
                    font-semibold transition-all
                    ${status === 'complete' ? 'bg-green-500 text-white' : ''}
                    ${status === 'current' ? 'bg-violet-600 text-white' : ''}
                    ${status === 'upcoming' ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : ''}
                    ${status === 'error' ? 'bg-red-500 text-white' : ''}
                    ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                  `}
                >
                  {status === 'complete' && <Check className="w-5 h-5" />}
                  {status === 'current' && (step.icon || index + 1)}
                  {status === 'upcoming' && (step.icon || index + 1)}
                  {status === 'error' && <AlertCircle className="w-5 h-5" />}
                </button>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-2">
                    <motion.div
                      className="w-full bg-violet-600"
                      initial={{ height: '0%' }}
                      animate={{ 
                        height: completedSteps.includes(index) ? '100%' : '0%' 
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>

              {/* Content Column */}
              <div className="flex-1 pb-8">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${
                    status === 'current' 
                      ? 'text-violet-600 dark:text-violet-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {step.label}
                  </h3>
                  {step.optional && (
                    <span className="text-xs text-gray-400 italic">Optional</span>
                  )}
                </div>
                {step.description && (
                  <p className="text-sm text-gray-500 mt-1">{step.description}</p>
                )}

                {/* Step Content */}
                <AnimatePresence mode="wait">
                  {children && index === currentStep && (
                    <motion.div key="children"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      {children[index]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Progress Steps (Dot style)
// ============================================================================

interface ProgressStepsProps {
  total: number;
  current: number;
  onStepClick?: (index: number) => void;
  variant?: 'dots' | 'bars' | 'numbers';
  className?: string;
}

export function ProgressSteps({
  total,
  current,
  onStepClick,
  variant = 'dots',
  className = '',
}: ProgressStepsProps) {
  if (variant === 'bars') {
    return (
      <div className={`flex gap-1 ${className}`}>
        {Array.from({ length: total }).map((_, index) => (
          <motion.div
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index <= current 
                ? 'bg-violet-600' 
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: index * 0.1 }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'numbers') {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        <span className="text-2xl font-bold text-violet-600">{current + 1}</span>
        <span className="text-gray-400">/</span>
        <span className="text-lg text-gray-500">{total}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onStepClick?.(index)}
          disabled={!onStepClick}
          className={`
            transition-all
            ${index === current 
              ? 'w-8 h-2 bg-violet-600 rounded-full' 
              : index < current 
              ? 'w-2 h-2 bg-violet-400 rounded-full hover:bg-violet-500'
              : 'w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full'
            }
            ${onStepClick ? 'cursor-pointer' : 'cursor-default'}
          `}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Breadcrumb Stepper
// ============================================================================

interface BreadcrumbStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function BreadcrumbStepper({
  steps,
  currentStep,
  onStepClick,
  className = '',
}: BreadcrumbStepperProps) {
  return (
    <nav className={`flex items-center ${className}`}>
      {steps.map((step, index) => {
        const isPast = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <ChevronRight className="w-4 h-4 mx-2 text-gray-400 flex-shrink-0" />
            )}
            <button
              onClick={() => isPast && onStepClick?.(index)}
              disabled={!isPast || !onStepClick}
              className={`
                flex items-center gap-2 text-sm whitespace-nowrap
                ${isCurrent 
                  ? 'text-violet-600 dark:text-violet-400 font-semibold' 
                  : isPast 
                  ? 'text-gray-600 dark:text-gray-400 hover:text-violet-600 cursor-pointer'
                  : 'text-gray-400'
                }
              `}
            >
              {isPast && <Check className="w-4 h-4 text-green-500" />}
              {isCurrent && <Circle className="w-3 h-3 fill-current" />}
              {step.label}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Step Navigation Buttons
// ============================================================================

interface StepNavigationProps {
  onPrev?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  isLoading?: boolean;
  canProceed?: boolean;
  className?: string;
}

export function StepNavigation({
  onPrev,
  onNext,
  onComplete,
  prevLabel = 'Previous',
  nextLabel = 'Continue',
  completeLabel = 'Complete',
  isFirstStep = false,
  isLastStep = false,
  isLoading = false,
  canProceed = true,
  className = '',
}: StepNavigationProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <button
        onClick={onPrev}
        disabled={isFirstStep || isLoading}
        className={`
          px-6 py-2.5 rounded-lg font-medium transition-colors
          ${isFirstStep || isLoading
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
        `}
      >
        {prevLabel}
      </button>

      <button
        onClick={isLastStep ? onComplete : onNext}
        disabled={!canProceed || isLoading}
        className={`
          px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
          ${!canProceed || isLoading
            ? 'bg-violet-400 text-white cursor-not-allowed'
            : 'bg-violet-600 hover:bg-violet-700 text-white'
          }
        `}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLastStep ? completeLabel : nextLabel}
        {!isLastStep && !isLoading && <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  );
}
