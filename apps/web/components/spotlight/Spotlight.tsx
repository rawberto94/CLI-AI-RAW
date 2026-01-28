'use client';

/**
 * Spotlight/Highlight Component
 * 
 * Used for onboarding, feature discovery, and guided tours.
 * Creates a spotlight effect around target elements.
 */

import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SpotlightStep {
  /** Target element selector */
  target: string;
  /** Title of the step */
  title: string;
  /** Description/content */
  content: string | React.ReactNode;
  /** Position of the tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Custom offset */
  offset?: number;
  /** Action button text */
  actionText?: string;
  /** Action callback */
  onAction?: () => void;
  /** Whether to highlight click area */
  highlightClick?: boolean;
}

export interface SpotlightTourProps {
  /** Tour steps */
  steps: SpotlightStep[];
  /** Whether the tour is active */
  isActive: boolean;
  /** Callback when tour ends */
  onEnd: () => void;
  /** Starting step index */
  startStep?: number;
  /** Show step counter */
  showStepCounter?: boolean;
  /** Allow keyboard navigation */
  keyboardNavigation?: boolean;
  /** Overlay color */
  overlayColor?: string;
  /** Skip button text */
  skipText?: string;
  /** Next button text */
  nextText?: string;
  /** Previous button text */
  prevText?: string;
  /** Done button text */
  doneText?: string;
}

// ============================================================================
// Context for programmatic control
// ============================================================================

interface SpotlightContextValue {
  start: (steps: SpotlightStep[]) => void;
  next: () => void;
  prev: () => void;
  end: () => void;
  goTo: (index: number) => void;
  currentStep: number;
  isActive: boolean;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

export function useSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error('useSpotlight must be used within a SpotlightProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export interface SpotlightProviderProps {
  children: React.ReactNode;
}

export function SpotlightProvider({ children }: SpotlightProviderProps) {
  const [steps, setSteps] = useState<SpotlightStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const start = useCallback((newSteps: SpotlightStep[]) => {
    setSteps(newSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
    }
  }, [currentStep, steps.length]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const end = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(index);
    }
  }, [steps.length]);

  return (
    <SpotlightContext.Provider value={{ start, next, prev, end, goTo, currentStep, isActive }}>
      {children}
      {isActive && steps.length > 0 && (
        <SpotlightTour
          steps={steps}
          isActive={isActive}
          onEnd={end}
          startStep={currentStep}
        />
      )}
    </SpotlightContext.Provider>
  );
}

// ============================================================================
// Spotlight Tour Component
// ============================================================================

export function SpotlightTour({
  steps,
  isActive,
  onEnd,
  startStep = 0,
  showStepCounter = true,
  keyboardNavigation = true,
  overlayColor = 'rgba(0, 0, 0, 0.75)',
  skipText = 'Skip tour',
  nextText = 'Next',
  prevText = 'Previous',
  doneText = 'Done',
}: SpotlightTourProps) {
  const [currentIndex, setCurrentIndex] = useState(startStep);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentIndex];
  const isLastStep = currentIndex === steps.length - 1;
  const isFirstStep = currentIndex === 0;

  // Find and highlight target element
  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const findTarget = () => {
      const target = document.querySelector(currentStepData.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll target into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // Initial find
    findTarget();

    // Re-find on resize/scroll
    const handleResize = () => findTarget();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isActive, currentStepData, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!keyboardNavigation || !isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          if (!isLastStep) {
            setCurrentIndex(prev => prev + 1);
          } else {
            onEnd();
          }
          break;
        case 'ArrowLeft':
          if (!isFirstStep) {
            setCurrentIndex(prev => prev - 1);
          }
          break;
        case 'Escape':
          onEnd();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardNavigation, isActive, isLastStep, isFirstStep, onEnd]);

  // Calculate tooltip position
  const getTooltipPosition = useCallback(() => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const position = currentStepData?.position || 'auto';
    const offset = currentStepData?.offset || 16;
    const padding = 8;

    let top = 0;
    let left = 0;

    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;

    switch (position) {
      case 'top':
        top = targetRect.top - offset;
        left = centerX;
        return { bottom: `calc(100% - ${top}px)`, left: `${left}px`, transform: 'translateX(-50%)' };
      case 'bottom':
        top = targetRect.bottom + offset;
        left = centerX;
        return { top: `${top}px`, left: `${left}px`, transform: 'translateX(-50%)' };
      case 'left':
        top = centerY;
        left = targetRect.left - offset;
        return { top: `${top}px`, right: `calc(100% - ${left}px)`, transform: 'translateY(-50%)' };
      case 'right':
        top = centerY;
        left = targetRect.right + offset;
        return { top: `${top}px`, left: `${left}px`, transform: 'translateY(-50%)' };
      default: // auto
        // Prefer bottom, then right, then left, then top
        if (targetRect.bottom + 200 < window.innerHeight) {
          return { top: `${targetRect.bottom + offset}px`, left: `${centerX}px`, transform: 'translateX(-50%)' };
        } else if (targetRect.top - 200 > 0) {
          return { bottom: `calc(100% - ${targetRect.top - offset}px)`, left: `${centerX}px`, transform: 'translateX(-50%)' };
        } else {
          return { top: `${centerY}px`, left: `${targetRect.right + offset}px`, transform: 'translateY(-50%)' };
        }
    }
  }, [targetRect, currentStepData]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200]">
        {/* Overlay with spotlight cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-auto"
          style={{
            background: targetRect
              ? `radial-gradient(ellipse ${targetRect.width + 40}px ${targetRect.height + 40}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0%, ${overlayColor} 100%)`
              : overlayColor,
          }}
          onClick={onEnd}
        />

        {/* Highlight ring around target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              borderRadius: 12,
              border: '2px dashed rgba(255, 255, 255, 0.5)',
              boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.3)',
            }}
          />
        )}

        {/* Tooltip */}
        {currentStepData && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-10 w-80 max-w-[calc(100vw-2rem)] pointer-events-auto"
            style={getTooltipPosition()}
          >
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{currentStepData.title}</h3>
                  <button
                    onClick={onEnd}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    aria-label="Close tour"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {showStepCounter && (
                  <p className="text-xs text-white/80 mt-0.5">
                    Step {currentIndex + 1} of {steps.length}
                  </p>
                )}
              </div>

              {/* Content */}
              <div className="px-4 py-3 text-sm text-slate-600">
                {currentStepData.content}
              </div>

              {/* Actions */}
              {currentStepData.actionText && currentStepData.onAction && (
                <div className="px-4 pb-3">
                  <button
                    onClick={currentStepData.onAction}
                    className="text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    {currentStepData.actionText} →
                  </button>
                </div>
              )}

              {/* Navigation */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={onEnd}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {skipText}
                </button>
                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <button
                      onClick={() => setCurrentIndex(prev => prev - 1)}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {prevText}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (isLastStep) {
                        onEnd();
                      } else {
                        setCurrentIndex(prev => prev + 1);
                      }
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {isLastStep ? (
                      <>
                        <Check className="h-4 w-4" />
                        {doneText}
                      </>
                    ) : (
                      <>
                        {nextText}
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step indicators */}
              <div className="px-4 py-2 flex items-center justify-center gap-1.5">
                {steps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      index === currentIndex
                        ? 'bg-purple-600 w-6'
                        : index < currentIndex
                        ? 'bg-purple-300'
                        : 'bg-slate-200'
                    )}
                    aria-label={`Go to step ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}

// ============================================================================
// Pulse Highlight (for single element attention)
// ============================================================================

export interface PulseHighlightProps {
  /** Target element selector */
  target: string;
  /** Whether active */
  active?: boolean;
  /** Color of the pulse */
  color?: string;
  /** Size of the pulse ring */
  size?: 'sm' | 'md' | 'lg';
}

export function PulseHighlight({
  target,
  active = true,
  color = 'rgb(99, 102, 241)',
  size = 'md',
}: PulseHighlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!active) return;

    const element = document.querySelector(target);
    if (element) {
      const updateRect = () => setRect(element.getBoundingClientRect());
      updateRect();

      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);

      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    }
  }, [target, active]);

  if (!active || !rect) return null;

  const sizeValues = { sm: 20, md: 40, lg: 60 };
  const padding = sizeValues[size];

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        top: rect.top - padding / 2,
        left: rect.left - padding / 2,
        width: rect.width + padding,
        height: rect.height + padding,
      }}
    >
      <span
        className="absolute inset-0 animate-ping rounded-lg opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="absolute inset-0 rounded-lg opacity-25"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export default SpotlightTour;
