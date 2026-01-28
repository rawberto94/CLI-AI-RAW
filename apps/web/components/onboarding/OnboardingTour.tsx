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
  Rocket,
  MessageSquare,
  ArrowLeftRight,
  Lightbulb,
  Target,
  Keyboard,
  Star,
  PartyPopper
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
    description: "We're excited to have you! This quick 2-minute tour will show you everything you need to get started managing contracts like a pro.",
    icon: Sparkles,
    position: 'center'
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard"]',
    title: 'Your Command Center',
    description: 'Your dashboard gives you a bird\'s eye view of your entire contract portfolio. See active contracts, upcoming renewals, total value, and AI-powered risk alerts at a glance.',
    icon: Target,
    position: 'right',
    spotlightPadding: 12
  },
  {
    id: 'contracts',
    target: '[data-tour="contracts"]',
    title: 'Contract Library',
    description: 'All your contracts in one secure place. Filter by status, party, date, or value. Click any contract to dive deep into its details, amendments, and AI analysis.',
    icon: FileText,
    position: 'right',
    spotlightPadding: 12
  },
  {
    id: 'upload',
    target: '[data-tour="upload"]',
    title: 'Smart Upload',
    description: 'Drag and drop PDFs, Word docs, or scanned images. Our AI automatically extracts parties, dates, values, key terms, and even flags potential risks.',
    icon: Upload,
    position: 'right',
    spotlightPadding: 12
  },
  {
    id: 'ai-assistant',
    target: '[data-tour="ai-assistant"]',
    title: 'AI Assistant ✨',
    description: 'Ask questions in plain English! "What contracts expire this quarter?" "Find all NDAs with tech companies." "Summarize the payment terms." Your AI assistant knows your contracts inside and out.',
    icon: MessageSquare,
    position: 'right',
    spotlightPadding: 12
  },
  {
    id: 'search',
    target: '[data-tour="smart-search"]',
    title: 'Smart Search',
    description: 'Semantic search that understands context. Search for "liability caps over $1M" or "auto-renewal clauses" - it finds what you mean, not just keyword matches.',
    icon: Search,
    position: 'right',
    spotlightPadding: 12
  },
  {
    id: 'compare',
    target: '[data-tour="compare"]',
    title: 'Contract Comparison',
    description: 'Compare two contracts side-by-side. Perfect for spotting differences between versions, comparing vendor terms, or reviewing amendments against originals.',
    icon: ArrowLeftRight,
    position: 'right',
    spotlightPadding: 12
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Pro Tip: Keyboard Shortcuts ⌨️',
    description: 'Power users love these! Press ⌘K (or Ctrl+K) for the command palette. Press / to focus search. Press ⌘/ (or Ctrl+/) to open the AI Assistant. Press ? to see all shortcuts.',
    icon: Keyboard,
    position: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re Ready! 🚀',
    description: 'That\'s everything you need to get started! Explore at your own pace. Need help later? Click the ? icon or restart this tour anytime from Settings.',
    icon: PartyPopper,
    position: 'center'
  }
];

interface OnboardingTourProps {
  steps?: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

// Confetti particle component
const ConfettiParticle = ({ delay, x }: { delay: number; x: number }) => {
  const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 6;
  const rotation = Math.random() * 360;
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        left: `${x}%`,
        top: '-20px'
      }}
      initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: [0, window.innerHeight + 100],
        x: [0, (Math.random() - 0.5) * 200],
        rotate: [rotation, rotation + 720],
        opacity: [1, 1, 0]
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        delay: delay,
        ease: 'easeOut'
      }}
    />
  );
};

// Confetti burst component
const ConfettiBurst = () => {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.3,
    x: 20 + Math.random() * 60
  }));
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[110]">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} x={p.x} />
      ))}
    </div>
  );
};

export function OnboardingTour({
  steps = defaultTourSteps,
  isOpen,
  onComplete,
  onSkip
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightPosition, setSpotlightPosition] = useState<DOMRect | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Show confetti on last step
  useEffect(() => {
    if (isLastStep && isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isLastStep, isOpen]);

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

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

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
      {/* Confetti effect on completion */}
      {showConfetti && <ConfettiBurst />}
      
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

        {/* Spotlight border with pulsing animation */}
        {spotlightPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              boxShadow: [
                '0 0 0 4px rgba(59, 130, 246, 0.2)',
                '0 0 0 8px rgba(59, 130, 246, 0.1)',
                '0 0 0 4px rgba(59, 130, 246, 0.2)'
              ]
            }}
            transition={{
              boxShadow: {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }
            }}
            className="absolute pointer-events-none"
            style={{
              left: spotlightPosition.x,
              top: spotlightPosition.y,
              width: spotlightPosition.width,
              height: spotlightPosition.height,
              border: '2px solid rgba(59, 130, 246, 0.8)',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05))'
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
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-start gap-4">
              {step.icon && (
                <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg">
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
                        ? 'w-4 bg-violet-500'
                        : i < currentStep
                          ? 'w-1.5 bg-violet-300'
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
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
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
