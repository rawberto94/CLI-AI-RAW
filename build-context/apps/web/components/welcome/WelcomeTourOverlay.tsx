'use client';

/**
 * Welcome Tour Overlay
 * 
 * Interactive spotlight tour with step-by-step guidance.
 * Highlights UI elements and provides contextual information.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Lightbulb,
  PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWelcomeTour, TourStep } from './WelcomeTourProvider';

// ============================================================================
// Confetti Animation
// ============================================================================

interface ConfettiParticleProps {
  delay: number;
  x: number;
}

function ConfettiParticle({ delay, x }: ConfettiParticleProps) {
  const colors = ['#8B5CF6', '#3B82F6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 6;
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        left: `${x}%`,
        top: '-20px',
      }}
      initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: 400,
        x: (Math.random() - 0.5) * 100,
        rotate: Math.random() * 720,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 2.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    />
  );
}

function Confetti() {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 100,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} x={p.x} />
      ))}
    </div>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => (
        <motion.div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === currentStep
              ? 'w-6 bg-gradient-to-r from-violet-500 to-purple-500'
              : i < currentStep
              ? 'w-1.5 bg-violet-400'
              : 'w-1.5 bg-slate-300 dark:bg-slate-600'
          )}
          initial={false}
          animate={{
            scale: i === currentStep ? 1 : 0.9,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Tour Tooltip
// ============================================================================

interface TooltipProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onAction?: () => void;
}

function TourTooltip({
  step,
  currentStep,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
  onAction,
}: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const isCentered = step.position === 'center' || !targetRect;
  
  const Icon = step.icon;

  // Calculate tooltip position
  const getTooltipStyle = useCallback((): React.CSSProperties => {
    if (isCentered || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const tooltipWidth = 380;
    const tooltipHeight = 300;
    const padding = 16;
    const offset = 12;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + offset;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - offset;
        break;
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - offset;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      default:
        left = targetRect.right + offset;
        top = targetRect.top;
    }

    // Boundary checks
    if (left < padding) left = padding;
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipHeight > window.innerHeight - padding) {
      top = window.innerHeight - tooltipHeight - padding;
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
    };
  }, [targetRect, step.position, isCentered]);

  return (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={getTooltipStyle()}
      className={cn(
        'z-[110] w-[380px] max-w-[calc(100vw-2rem)]',
        'bg-white dark:bg-slate-900 rounded-2xl shadow-2xl',
        'border border-slate-200 dark:border-slate-700 overflow-hidden'
      )}
    >
      {/* Progress bar */}
      <div className="h-1 bg-slate-100 dark:bg-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30">
              <Icon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <div className="mt-0.5">
                <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />
              </div>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={onSkip}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-4">
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          {step.description}
        </p>
        
        {/* Tip */}
        {step.tip && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {step.tip}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Skip tour
          </button>
          
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            
            {step.action && onAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAction}
                className="gap-1"
              >
                {step.action.label}
              </Button>
            )}
            
            <Button
              size="sm"
              onClick={onNext}
              className="gap-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
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
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Tour Overlay Component
// ============================================================================

export function WelcomeTourOverlay() {
  const router = useRouter();
  const {
    isOpen,
    currentStep,
    steps,
    nextStep,
    prevStep,
    skipTour,
    endTour,
  } = useWelcomeTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Update spotlight position when step changes
  useEffect(() => {
    if (!isOpen || !step) return;

    const updateTarget = () => {
      if (step.target) {
        const element = document.querySelector(step.target);
        if (element) {
          const rect = element.getBoundingClientRect();
          const padding = step.spotlightPadding || 8;
          setTargetRect({
            ...rect,
            x: rect.x - padding,
            y: rect.y - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          } as DOMRect);
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget);

    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget);
    };
  }, [isOpen, step, currentStep]);

  // Show confetti on last step
  useEffect(() => {
    if (isLastStep && isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isLastStep, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          nextStep();
          break;
        case 'ArrowLeft':
          prevStep();
          break;
        case 'Escape':
          skipTour();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextStep, prevStep, skipTour]);

  const handleAction = useCallback(() => {
    if (step?.action?.onClick) {
      step.action.onClick();
    } else if (step?.action?.href) {
      router.push(step.action.href);
    }
  }, [step, router]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100]"
        >
          {/* Confetti */}
          {showConfetti && <Confetti />}

          {/* Overlay with spotlight cutout */}
          <svg className="fixed inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <motion.rect
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    x={targetRect.x}
                    y={targetRect.y}
                    width={targetRect.width}
                    height={targetRect.height}
                    rx="12"
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

          {/* Spotlight highlight ring */}
          {targetRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                boxShadow: [
                  '0 0 0 0 rgba(139, 92, 246, 0.4)',
                  '0 0 0 4px rgba(139, 92, 246, 0.2)',
                  '0 0 0 0 rgba(139, 92, 246, 0.4)',
                ],
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
              className="fixed pointer-events-none z-[105]"
              style={{
                left: targetRect.x,
                top: targetRect.y,
                width: targetRect.width,
                height: targetRect.height,
                border: '2px solid rgba(139, 92, 246, 0.8)',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(168, 85, 247, 0.05))',
              }}
            />
          )}

          {/* Tooltip */}
          <TourTooltip
            step={step}
            currentStep={currentStep}
            totalSteps={steps.length}
            targetRect={targetRect}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={skipTour}
            onAction={step.action ? handleAction : undefined}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WelcomeTourOverlay;
