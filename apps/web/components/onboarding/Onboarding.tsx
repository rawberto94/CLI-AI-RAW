'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, SkipForward } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TourStep {
  id: string;
  target?: string; // CSS selector
  title: string;
  content: string | React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  disableOverlay?: boolean;
  disableBeacon?: boolean;
  beforeShow?: () => void | Promise<void>;
  afterShow?: () => void | Promise<void>;
}

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  endTour: (completed?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

interface OnboardingProgress {
  completedSteps: string[];
  skippedSteps: string[];
  currentTour: string | null;
}

// ============================================================================
// Context
// ============================================================================

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

// ============================================================================
// Tour Provider
// ============================================================================

interface TourProviderProps {
  children: React.ReactNode;
  onComplete?: (tourId: string) => void;
  onSkip?: (tourId: string) => void;
}

export function TourProvider({ children, onComplete, onSkip }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [tourId, setTourId] = useState<string | null>(null);

  const startTour = useCallback((tourSteps: TourStep[], id?: string) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
    setTourId(id || null);
  }, []);

  const endTour = useCallback((completed = false) => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
    
    if (tourId) {
      if (completed) {
        onComplete?.(tourId);
      } else {
        onSkip?.(tourId);
      }
    }
    setTourId(null);
  }, [tourId, onComplete, onSkip]);

  const nextStep = useCallback(async () => {
    if (currentStep < steps.length - 1) {
      await steps[currentStep]?.afterShow?.();
      const nextIdx = currentStep + 1;
      await steps[nextIdx]?.beforeShow?.();
      setCurrentStep(nextIdx);
    } else {
      endTour(true);
    }
  }, [currentStep, steps, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(index);
    }
  }, [steps.length]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        startTour,
        endTour,
        nextStep,
        prevStep,
        goToStep,
      }}
    >
      {children}
      {isActive && <TourOverlay />}
    </TourContext.Provider>
  );
}

// ============================================================================
// Tour Overlay
// ============================================================================

function TourOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, endTour } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStep];

  useEffect(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  if (!isActive || !step) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = !step.target || step.placement === 'center';

  return (
    <AnimatePresence>
      <motion.div key="Onboarding-ap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
      >
        {/* Overlay with spotlight */}
        {!step.disableOverlay && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <rect
                    x={targetRect.left - (step.spotlightPadding || 8)}
                    y={targetRect.top - (step.spotlightPadding || 8)}
                    width={targetRect.width + (step.spotlightPadding || 8) * 2}
                    height={targetRect.height + (step.spotlightPadding || 8) * 2}
                    rx="8"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.7)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        )}

        {/* Tooltip/Content */}
        <TourTooltip
          step={step}
          targetRect={targetRect}
          isCentered={isCentered}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          currentStep={currentStep}
          totalSteps={steps.length}
          onNext={nextStep}
          onPrev={prevStep}
          onClose={() => endTour(false)}
        />
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Tour Tooltip
// ============================================================================

interface TourTooltipProps {
  step: TourStep;
  targetRect: DOMRect | null;
  isCentered: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function TourTooltip({
  step,
  targetRect,
  isCentered,
  isFirstStep,
  isLastStep,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onClose,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const tooltipRect = tooltip.getBoundingClientRect();

    if (isCentered || !targetRect) {
      // Center on screen
      setPosition({
        x: (window.innerWidth - tooltipRect.width) / 2,
        y: (window.innerHeight - tooltipRect.height) / 2,
      });
      return;
    }

    const placement = step.placement || 'bottom';
    const gap = 12;
    let x = 0;
    let y = 0;

    switch (placement) {
      case 'top':
        x = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        y = targetRect.top - tooltipRect.height - gap;
        break;
      case 'bottom':
        x = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        y = targetRect.bottom + gap;
        break;
      case 'left':
        x = targetRect.left - tooltipRect.width - gap;
        y = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        break;
      case 'right':
        x = targetRect.right + gap;
        y = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        break;
    }

    // Keep within viewport bounds
    x = Math.max(16, Math.min(x, window.innerWidth - tooltipRect.width - 16));
    y = Math.max(16, Math.min(y, window.innerHeight - tooltipRect.height - 16));

    setPosition({ x, y });
  }, [step, targetRect, isCentered]);

  return (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[10000] w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {step.title}
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {step.content}
        </div>
      </div>

      {/* Progress Dots */}
      <div className="flex justify-center gap-1 pb-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep
                ? 'bg-violet-500'
                : i < currentStep
                ? 'bg-violet-300'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <SkipForward className="w-4 h-4" />
          Skip tour
        </button>
        
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-300"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg"
          >
            {isLastStep ? (
              <>
                <Check className="w-4 h-4" />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Feature Beacon
// ============================================================================

interface FeatureBeaconProps {
  isVisible?: boolean;
  onClick?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  pulse?: boolean;
  className?: string;
}

export function FeatureBeacon({
  isVisible = true,
  onClick,
  position = 'top-right',
  pulse = true,
  className = '',
}: FeatureBeaconProps) {
  if (!isVisible) return null;

  const positionClasses = {
    'top-right': 'top-0 right-0 -translate-y-1/2 translate-x-1/2',
    'top-left': 'top-0 left-0 -translate-y-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-0 right-0 translate-y-1/2 translate-x-1/2',
    'bottom-left': 'bottom-0 left-0 translate-y-1/2 -translate-x-1/2',
  };

  return (
    <button
      onClick={onClick}
      className={`absolute ${positionClasses[position]} ${className}`}
    >
      <span className="relative flex h-4 w-4">
        {pulse && (
          <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-75" />
        )}
        <span className="relative inline-flex rounded-full h-4 w-4 bg-violet-500" />
      </span>
    </button>
  );
}

// ============================================================================
// Checklist Component
// ============================================================================

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

interface OnboardingChecklistProps {
  title?: string;
  items: ChecklistItem[];
  onDismiss?: () => void;
  className?: string;
}

export function OnboardingChecklist({
  title = 'Getting Started',
  items,
  onDismiss,
  className = '',
}: OnboardingChecklistProps) {
  const completedCount = items.filter(i => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-green-500 rounded-full"
            />
          </div>
          <span className="text-sm text-gray-500">
            {completedCount}/{items.length}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 flex items-start gap-3 ${
              item.completed ? 'bg-green-50 dark:bg-green-950/20' : ''
            }`}
          >
            <div className={`
              flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
              ${item.completed
                ? 'bg-green-500 text-white'
                : 'border-2 border-gray-300 dark:border-gray-600'
              }
            `}>
              {item.completed && <Check className="w-4 h-4" />}
            </div>

            <div className="flex-1">
              <p className={`font-medium ${
                item.completed
                  ? 'text-green-700 dark:text-green-400 line-through'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {item.title}
              </p>
              {item.description && (
                <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
              )}
            </div>

            {!item.completed && item.action && (
              <button
                onClick={item.action}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                {item.actionLabel || 'Start'}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Welcome Modal
// ============================================================================

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
  title?: string;
  subtitle?: string;
  features?: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
  }>;
}

export function WelcomeModal({
  isOpen,
  onClose,
  onStartTour,
  title = 'Welcome!',
  subtitle = 'Let us show you around',
  features = [],
}: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div key="Onboarding-ap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Decorative Header */}
          <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />

          <div className="p-6">
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900 mb-4"
              >
                <span className="text-3xl">👋</span>
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            </div>

            {features.length > 0 && (
              <div className="space-y-4 mb-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-gray-500">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {onStartTour && (
                <button
                  onClick={() => { onStartTour(); onClose(); }}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors"
                >
                  Take a Quick Tour
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
              >
                I&apos;ll explore on my own
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Coachmark / Spotlight
// ============================================================================

interface CoachmarkProps {
  target: string; // CSS selector
  title: string;
  content: string;
  isVisible: boolean;
  onDismiss: () => void;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Coachmark({
  target,
  title,
  content,
  isVisible,
  onDismiss,
  placement = 'bottom',
}: CoachmarkProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [arrowPosition, setArrowPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isVisible) return;

    const element = document.querySelector(target);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const gap = 12;

    let x = 0;
    let y = 0;
    let arrowX = 0;
    let arrowY = 0;

    switch (placement) {
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - gap;
        arrowY = 1;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + gap;
        arrowY = -1;
        break;
      case 'left':
        x = rect.left - gap;
        y = rect.top + rect.height / 2;
        arrowX = 1;
        break;
      case 'right':
        x = rect.right + gap;
        y = rect.top + rect.height / 2;
        arrowX = -1;
        break;
    }

    setPosition({ x, y });
    setArrowPosition({ x: arrowX, y: arrowY });
  }, [isVisible, target, placement]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div key="Onboarding-ap-3"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          left: position.x,
          top: position.y,
          transform: `translate(${placement === 'left' || placement === 'right' ? (placement === 'left' ? '-100%' : '0') : '-50%'}, ${placement === 'top' ? '-100%' : placement === 'bottom' ? '0' : '-50%'})`,
        }}
        className="fixed z-50 w-64 bg-gray-900 text-white rounded-lg shadow-xl p-4"
      >
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        <h4 className="font-medium mb-1">{title}</h4>
        <p className="text-sm text-gray-300">{content}</p>
        <button
          onClick={onDismiss}
          className="mt-3 text-sm text-violet-400 hover:text-violet-300"
        >
          Got it
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
