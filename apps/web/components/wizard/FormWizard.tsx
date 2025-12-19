'use client';

/**
 * Form Wizard Component
 * Multi-step form with progress tracking, validation, and beautiful animations
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Loader2,
  Sparkles,
  type LucideIcon 
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  optional?: boolean;
  validate?: () => Promise<boolean> | boolean;
}

export interface WizardContextValue {
  currentStep: number;
  steps: WizardStep[];
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitting: boolean;
  direction: 'forward' | 'backward';
  goToStep: (step: number) => void;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  setStepValidation: (stepId: string, validate: () => Promise<boolean> | boolean) => void;
}

// ============================================================================
// Context
// ============================================================================

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

// ============================================================================
// Wizard Provider
// ============================================================================

interface WizardProviderProps {
  children: ReactNode;
  steps: WizardStep[];
  onComplete: () => Promise<void> | void;
  initialStep?: number;
}

export function WizardProvider({ 
  children, 
  steps, 
  onComplete, 
  initialStep = 0 
}: WizardProviderProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [validations, setValidations] = useState<Record<string, () => Promise<boolean> | boolean>>({});

  const setStepValidation = useCallback((stepId: string, validate: () => Promise<boolean> | boolean) => {
    setValidations((prev) => ({ ...prev, [stepId]: validate }));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step < 0 || step >= steps.length) return;
    setDirection(step > currentStep ? 'forward' : 'backward');
    setCurrentStep(step);
  }, [currentStep, steps.length]);

  const nextStep = useCallback(async () => {
    const currentStepData = steps[currentStep];
    if (!currentStepData) return;
    
    const validate = validations[currentStepData.id] || currentStepData.validate;
    
    if (validate) {
      setIsSubmitting(true);
      try {
        const isValid = await validate();
        if (!isValid) {
          setIsSubmitting(false);
          return;
        }
      } catch {
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    if (currentStep === steps.length - 1) {
      setIsSubmitting(true);
      await onComplete();
      setIsSubmitting(false);
    } else {
      setDirection('forward');
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [currentStep, steps, validations, onComplete]);

  const prevStep = useCallback(() => {
    setDirection('backward');
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const value = useMemo(() => ({
    currentStep,
    steps,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    isSubmitting,
    direction,
    goToStep,
    nextStep,
    prevStep,
    setStepValidation,
  }), [currentStep, steps, isSubmitting, direction, goToStep, nextStep, prevStep, setStepValidation]);

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// ============================================================================
// Wizard Progress Indicators
// ============================================================================

interface WizardProgressProps {
  variant?: 'dots' | 'steps' | 'bar';
  className?: string;
}

export function WizardProgress({ variant = 'steps', className }: WizardProgressProps) {
  const { currentStep, steps } = useWizard();

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {steps.map((_, index) => (
          <motion.div
            key={index}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              index === currentStep
                ? 'bg-indigo-600'
                : index < currentStep
                ? 'bg-indigo-400'
                : 'bg-slate-200'
            )}
            animate={{
              scale: index === currentStep ? 1.2 : 1,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'bar') {
    const progress = ((currentStep + 1) / steps.length) * 100;
    return (
      <div className={cn('w-full', className)}>
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  // Default: steps variant
  return (
    <nav className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <motion.div
              className="flex items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.button
                onClick={() => index < currentStep && useWizard().goToStep(index)}
                disabled={index > currentStep}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                  isCompleted
                    ? 'bg-indigo-600 border-indigo-600 text-white cursor-pointer'
                    : isCurrent
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                    : 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                )}
                whileHover={isCompleted ? { scale: 1.05 } : undefined}
                whileTap={isCompleted ? { scale: 0.95 } : undefined}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : Icon ? (
                  <Icon className="w-5 h-5" />
                ) : (
                  <span className="font-medium">{index + 1}</span>
                )}
              </motion.button>
              <div className="ml-3 hidden sm:block">
                <p className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-slate-900' : 'text-slate-500'
                )}>
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-slate-400">{step.description}</p>
                )}
              </div>
            </motion.div>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4">
                <div className={cn(
                  'h-0.5 transition-colors',
                  index < currentStep ? 'bg-indigo-600' : 'bg-slate-200'
                )} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Wizard Step Content Container
// ============================================================================

interface WizardContentProps {
  children: ReactNode;
  className?: string;
}

export function WizardContent({ children, className }: WizardContentProps) {
  const { currentStep, direction } = useWizard();

  const variants = {
    enter: (dir: 'forward' | 'backward') => ({
      x: dir === 'forward' ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: 'forward' | 'backward') => ({
      x: dir === 'forward' ? -100 : 100,
      opacity: 0,
    }),
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Individual Step Component
// ============================================================================

interface WizardStepProps {
  step: number;
  children: ReactNode;
  className?: string;
}

export function WizardStep({ step, children, className }: WizardStepProps) {
  const { currentStep } = useWizard();
  
  if (step !== currentStep) return null;
  
  return (
    <div className={cn('space-y-6', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Wizard Navigation
// ============================================================================

interface WizardNavigationProps {
  className?: string;
  nextLabel?: string;
  prevLabel?: string;
  completeLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
}

export function WizardNavigation({
  className,
  nextLabel = 'Continue',
  prevLabel = 'Back',
  completeLabel = 'Complete',
  showSkip,
  onSkip,
}: WizardNavigationProps) {
  const { isFirstStep, isLastStep, isSubmitting, nextStep, prevStep, steps, currentStep } = useWizard();
  const currentStepData = steps[currentStep];
  const isOptional = currentStepData?.optional;

  return (
    <div className={cn('flex items-center justify-between pt-6 border-t border-slate-200', className)}>
      <motion.button
        onClick={prevStep}
        disabled={isFirstStep || isSubmitting}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
          isFirstStep || isSubmitting
            ? 'text-slate-300 cursor-not-allowed'
            : 'text-slate-600 hover:bg-slate-100'
        )}
        whileHover={!isFirstStep && !isSubmitting ? { x: -3 } : undefined}
      >
        <ChevronLeft className="w-4 h-4" />
        {prevLabel}
      </motion.button>

      <div className="flex items-center gap-3">
        {showSkip && isOptional && onSkip && (
          <button
            onClick={onSkip}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip for now
          </button>
        )}

        <motion.button
          onClick={nextStep}
          disabled={isSubmitting}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-all',
            isSubmitting
              ? 'bg-indigo-400 cursor-not-allowed'
              : isLastStep
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25'
              : 'bg-indigo-600 hover:bg-indigo-700'
          )}
          whileHover={!isSubmitting ? { scale: 1.02 } : undefined}
          whileTap={!isSubmitting ? { scale: 0.98 } : undefined}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : isLastStep ? (
            <>
              <Sparkles className="w-4 h-4" />
              {completeLabel}
            </>
          ) : (
            <>
              {nextLabel}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ============================================================================
// Wizard Error Display
// ============================================================================

interface WizardErrorProps {
  error?: string | null;
  className?: string;
}

export function WizardError({ error, className }: WizardErrorProps) {
  if (!error) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg',
        className
      )}
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700">{error}</p>
    </motion.div>
  );
}

// ============================================================================
// Complete Wizard Component
// ============================================================================

interface FormWizardProps {
  steps: WizardStep[];
  children: ReactNode;
  onComplete: () => Promise<void> | void;
  initialStep?: number;
  progressVariant?: 'dots' | 'steps' | 'bar';
  className?: string;
  title?: string;
  description?: string;
}

export function FormWizard({
  steps,
  children,
  onComplete,
  initialStep = 0,
  progressVariant = 'steps',
  className,
  title,
  description,
}: FormWizardProps) {
  return (
    <WizardProvider steps={steps} onComplete={onComplete} initialStep={initialStep}>
      <div className={cn('bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden', className)}>
        {/* Header */}
        {(title || description) && (
          <div className="px-8 pt-8 pb-4">
            {title && (
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-slate-500">{description}</p>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="px-8 py-6 bg-slate-50 border-y border-slate-100">
          <WizardProgress variant={progressVariant} />
        </div>

        {/* Content */}
        <div className="p-8">
          <WizardContent>
            {children}
          </WizardContent>
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8">
          <WizardNavigation />
        </div>
      </div>
    </WizardProvider>
  );
}

// ============================================================================
// Success Screen
// ============================================================================

interface WizardSuccessProps {
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function WizardSuccess({ title, message, action, className }: WizardSuccessProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('text-center py-8', className)}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center"
      >
        <Check className="w-10 h-10 text-white" />
      </motion.div>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-slate-900 mb-2"
      >
        {title}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-slate-600 mb-8 max-w-md mx-auto"
      >
        {message}
      </motion.p>

      {action && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={action.onClick}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
