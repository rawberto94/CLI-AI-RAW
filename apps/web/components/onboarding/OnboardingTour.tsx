/**
 * Onboarding Tour Component
 * Interactive walkthrough for new users
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
  Upload,
  BarChart3,
  Search,
  Zap,
  Check,
  Rocket
} from 'lucide-react';

interface TourStep {
  id: string;
  target?: string; // CSS selector for element to highlight
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const defaultTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Contract AI! 🎉',
    description: 'Let\'s take a quick tour of the key features that will help you manage your contracts more efficiently.',
    icon: Sparkles,
    position: 'center'
  },
  {
    id: 'dashboard',
    target: '[data-testid="nav-dashboard-link"]',
    title: 'Your Dashboard',
    description: 'Get a complete overview of your contract portfolio, including key metrics, upcoming renewals, and AI-powered insights.',
    icon: BarChart3,
    position: 'right'
  },
  {
    id: 'contracts',
    target: '[data-testid="nav-contracts-link"]',
    title: 'Contract Management',
    description: 'View, search, and manage all your contracts in one place. Filter by status, date, or value to find what you need.',
    icon: FileText,
    position: 'right'
  },
  {
    id: 'upload',
    target: '[data-testid="nav-upload-link"]',
    title: 'Upload & Analyze',
    description: 'Upload contracts in PDF, DOCX, or other formats. Our AI will automatically extract key information and provide insights.',
    icon: Upload,
    position: 'right'
  },
  {
    id: 'search',
    title: 'Quick Search',
    description: 'Use Cmd+K (or Ctrl+K) anytime to quickly search and navigate. It\'s the fastest way to find contracts and run commands.',
    icon: Search,
    position: 'center'
  },
  {
    id: 'ai-features',
    title: 'AI-Powered Features',
    description: 'Our AI analyzes contracts for risks, extracts key terms, and provides actionable recommendations to save you time.',
    icon: Zap,
    position: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'You\'re ready to start using Contract AI. If you need help, click the Help button or use Cmd+K to search for commands.',
    icon: Rocket,
    position: 'center'
  }
];

interface OnboardingTourProps {
  steps?: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTour({
  steps = defaultTourSteps,
  isOpen,
  onComplete,
  onSkip
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightPosition, setSpotlightPosition] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Update spotlight position
  const updateSpotlight = useCallback(() => {
    if (!step) return;
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = step.spotlightPadding || 8;
        setSpotlightPosition({
          ...rect,
          x: rect.x - padding,
          y: rect.y - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2
        } as DOMRect);
      } else {
        setSpotlightPosition(null);
      }
    } else {
      setSpotlightPosition(null);
    }
  }, [step]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight);
    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight);
    };
  }, [updateSpotlight]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'Escape') {
      onSkip();
    }
  }, [isOpen, handleNext, handlePrev, onSkip]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !step) return null;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightPosition || step.position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const margin = 16;
    
    switch (step.position) {
      case 'right':
        return {
          position: 'fixed',
          top: spotlightPosition.top + spotlightPosition.height / 2,
          left: spotlightPosition.right + margin,
          transform: 'translateY(-50%)'
        };
      case 'left':
        return {
          position: 'fixed',
          top: spotlightPosition.top + spotlightPosition.height / 2,
          right: window.innerWidth - spotlightPosition.left + margin,
          transform: 'translateY(-50%)'
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: spotlightPosition.bottom + margin,
          left: spotlightPosition.left + spotlightPosition.width / 2,
          transform: 'translateX(-50%)'
        };
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - spotlightPosition.top + margin,
          left: spotlightPosition.left + spotlightPosition.width / 2,
          transform: 'translateX(-50%)'
        };
      default:
        return {};
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100]">
        {/* Overlay with spotlight cutout */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ pointerEvents: 'auto' }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlightPosition && (
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  x={spotlightPosition.x}
                  y={spotlightPosition.y}
                  width={spotlightPosition.width}
                  height={spotlightPosition.height}
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
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight border */}
        {spotlightPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              left: spotlightPosition.x,
              top: spotlightPosition.y,
              width: spotlightPosition.width,
              height: spotlightPosition.height,
              border: '2px solid rgba(59, 130, 246, 0.8)',
              borderRadius: '8px',
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)'
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          key={step.id}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          style={getTooltipStyle()}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[360px] overflow-hidden"
        >
          {/* Progress bar */}
          <div className="h-1 bg-gray-100 dark:bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-start gap-4">
              {step.icon && (
                <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                  <step.icon className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Custom action */}
            {step.action && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={step.action.onClick}
                  className="w-full"
                >
                  {step.action.label}
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {currentStep + 1} of {steps.length}
              </span>
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === currentStep
                        ? 'w-4 bg-blue-500'
                        : i < currentStep
                          ? 'w-1.5 bg-blue-300'
                          : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isLastStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Skip
                </Button>
              )}
              {!isFirstStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                {isLastStep ? (
                  <>
                    Get Started
                    <Check className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Hook to manage onboarding tour state
 */
export function useOnboardingTour(storageKey = 'onboarding-completed') {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      setHasCompleted(false);
      // Show tour after a brief delay for new users
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const complete = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setHasCompleted(true);
    setIsOpen(false);
  }, [storageKey]);

  const skip = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setHasCompleted(true);
    setIsOpen(false);
  }, [storageKey]);

  const restart = useCallback(() => {
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    hasCompleted,
    complete,
    skip,
    restart,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false)
  };
}

export default OnboardingTour;
