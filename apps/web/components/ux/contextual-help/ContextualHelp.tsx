'use client';

/**
 * Contextual Help Tooltips
 * Smart tooltips with tutorials, tips, and contextual guidance
 */

import React, { useState, useCallback, useEffect, memo, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  ExternalLink,
  Play,
  BookOpen,
  Video,
  Keyboard,
  Info,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface HelpTip {
  id: string;
  title: string;
  content: string;
  learnMoreUrl?: string;
  videoUrl?: string;
  steps?: string[];
  shortcut?: string[];
  category?: string;
}

export interface TooltipPosition {
  placement: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
}

interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: TooltipPosition['placement'];
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// Context for managing help state
// ============================================================================

interface HelpContextType {
  showHelp: boolean;
  toggleHelp: () => void;
  activeHint: string | null;
  setActiveHint: (id: string | null) => void;
  completedTips: Set<string>;
  markTipComplete: (id: string) => void;
  startTour: (tourId: string) => void;
  endTour: () => void;
  activeTour: string | null;
  tourStep: number;
  nextTourStep: () => void;
  prevTourStep: () => void;
}

const HelpContext = createContext<HelpContextType | null>(null);

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    return {
      showHelp: false,
      toggleHelp: () => {},
      activeHint: null,
      setActiveHint: () => {},
      completedTips: new Set<string>(),
      markTipComplete: () => {},
      startTour: () => {},
      endTour: () => {},
      activeTour: null,
      tourStep: 0,
      nextTourStep: () => {},
      prevTourStep: () => {},
    };
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface HelpProviderProps {
  children: React.ReactNode;
}

export function HelpProvider({ children }: HelpProviderProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [completedTips, setCompletedTips] = useState<Set<string>>(new Set());
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0);

  // Load completed tips from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('completed-help-tips');
      if (stored) {
        setCompletedTips(new Set(JSON.parse(stored)));
      }
    } catch {
      // Failed to load completed tips - use defaults
    }
  }, []);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const markTipComplete = useCallback((id: string) => {
    setCompletedTips(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('completed-help-tips', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const startTour = useCallback((tourId: string) => {
    setActiveTour(tourId);
    setTourStep(0);
  }, []);

  const endTour = useCallback(() => {
    setActiveTour(null);
    setTourStep(0);
  }, []);

  const nextTourStep = useCallback(() => {
    setTourStep(prev => prev + 1);
  }, []);

  const prevTourStep = useCallback(() => {
    setTourStep(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <HelpContext.Provider
      value={{
        showHelp,
        toggleHelp,
        activeHint,
        setActiveHint,
        completedTips,
        markTipComplete,
        startTour,
        endTour,
        activeTour,
        tourStep,
        nextTourStep,
        prevTourStep,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}

// ============================================================================
// Help Icon Button
// ============================================================================

interface HelpIconProps {
  tipId: string;
  tip: HelpTip;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'subtle' | 'default' | 'prominent';
  className?: string;
}

export const HelpIcon = memo(({
  tipId,
  tip,
  size = 'sm',
  variant = 'subtle',
  className,
}: HelpIconProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { completedTips, markTipComplete } = useHelp();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isCompleted = completedTips.has(tipId);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const variantClasses = {
    subtle: 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
    default: 'text-violet-500 hover:text-violet-600',
    prominent: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 p-1 rounded-full',
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  // Mark as read when opened
  useEffect(() => {
    if (isOpen && !isCompleted) {
      markTipComplete(tipId);
    }
  }, [isOpen, isCompleted, tipId, markTipComplete]);

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "transition-colors",
          variantClasses[variant],
          !isCompleted && variant !== 'prominent' && "animate-pulse"
        )}
        title="Help"
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            ref={tooltipRef}
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500">
              <div className="flex items-center gap-2 text-white">
                <Lightbulb className="h-4 w-4" />
                <span className="font-medium text-sm">{tip.title}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {tip.content}
              </p>

              {/* Steps */}
              {tip.steps && (
                <ol className="mt-3 space-y-2">
                  {tip.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-indigo-400 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {/* Shortcut */}
              {tip.shortcut && (
                <div className="mt-3 flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-slate-400" />
                  <div className="flex items-center gap-1">
                    {tip.shortcut.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-600"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              {(tip.learnMoreUrl || tip.videoUrl) && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  {tip.learnMoreUrl && (
                    <a
                      href={tip.learnMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Learn more
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {tip.videoUrl && (
                    <a
                      href={tip.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Watch video
                    </a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

HelpIcon.displayName = 'HelpIcon';

// ============================================================================
// Feature Spotlight
// ============================================================================

interface FeatureSpotlightProps {
  title: string;
  description: string;
  isNew?: boolean;
  onDismiss: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

export const FeatureSpotlight = memo(({
  title,
  description,
  isNew = true,
  onDismiss,
  action,
  position = 'bottom',
  children,
  className,
}: FeatureSpotlightProps) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return <>{children}</>;

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div className={cn("relative", className)}>
      {/* Highlight ring */}
      <div className="absolute -inset-2 rounded-xl border-2 border-violet-500 animate-pulse pointer-events-none" />
      
      {children}

      {/* Spotlight card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "absolute z-50 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden",
          positionClasses[position]
        )}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {isNew && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-violet-500 to-purple-500 rounded">
                  New
                </span>
              )}
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>

          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>

          {action && (
            <button
              onClick={action.onClick}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
});

FeatureSpotlight.displayName = 'FeatureSpotlight';

// ============================================================================
// Guided Tour Overlay
// ============================================================================

interface GuidedTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete: () => void;
}

export const GuidedTour = memo(({
  tourId,
  steps,
  onComplete,
}: GuidedTourProps) => {
  const { activeTour, tourStep, nextTourStep, prevTourStep, endTour } = useHelp();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isActive = activeTour === tourId;
  const currentStep = steps[tourStep];
  const isLastStep = tourStep === steps.length - 1;

  // Find and highlight target element
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const target = document.querySelector(currentStep.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll into view if needed
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive, currentStep, tourStep]);

  if (!isActive || !currentStep || !targetRect) return null;

  const handleNext = () => {
    if (isLastStep) {
      endTour();
      onComplete();
    } else {
      nextTourStep();
    }
  };

  // Calculate tooltip position
  const placement = currentStep.placement || 'bottom';
  const tooltipStyle: React.CSSProperties = {};
  
  switch (placement) {
    case 'bottom':
      tooltipStyle.top = targetRect.bottom + 12;
      tooltipStyle.left = targetRect.left + targetRect.width / 2;
      tooltipStyle.transform = 'translateX(-50%)';
      break;
    case 'top':
      tooltipStyle.bottom = window.innerHeight - targetRect.top + 12;
      tooltipStyle.left = targetRect.left + targetRect.width / 2;
      tooltipStyle.transform = 'translateX(-50%)';
      break;
    case 'left':
      tooltipStyle.right = window.innerWidth - targetRect.left + 12;
      tooltipStyle.top = targetRect.top + targetRect.height / 2;
      tooltipStyle.transform = 'translateY(-50%)';
      break;
    case 'right':
      tooltipStyle.left = targetRect.right + 12;
      tooltipStyle.top = targetRect.top + targetRect.height / 2;
      tooltipStyle.transform = 'translateY(-50%)';
      break;
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop with cutout */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{
          clipPath: `polygon(
            0 0, 100% 0, 100% 100%, 0 100%,
            0 0,
            ${targetRect.left - 8}px ${targetRect.top - 8}px,
            ${targetRect.left - 8}px ${targetRect.bottom + 8}px,
            ${targetRect.right + 8}px ${targetRect.bottom + 8}px,
            ${targetRect.right + 8}px ${targetRect.top - 8}px,
            ${targetRect.left - 8}px ${targetRect.top - 8}px
          )`,
        }}
      />

      {/* Highlight box */}
      <div
        className="absolute border-2 border-violet-500 rounded-lg pointer-events-none"
        style={{
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[201]"
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500">
          <div className="flex items-center gap-2 text-white">
            <Target className="h-4 w-4" />
            <span className="font-medium text-sm">
              Step {tourStep + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={endTour}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
            {currentStep.title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {currentStep.content}
          </p>

          {currentStep.action && (
            <button
              onClick={currentStep.action.onClick}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              <Play className="h-3.5 w-3.5" />
              {currentStep.action.label}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={prevTourStep}
            disabled={tourStep === 0}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === tourStep
                    ? "bg-violet-600"
                    : i < tourStep
                    ? "bg-violet-300"
                    : "bg-slate-300 dark:bg-slate-600"
                )}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            {isLastStep ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
});

GuidedTour.displayName = 'GuidedTour';

// ============================================================================
// Inline Tip Component
// ============================================================================

interface InlineTipProps {
  type?: 'info' | 'tip' | 'warning';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const InlineTip = memo(({
  type = 'tip',
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
}: InlineTipProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const typeStyles = {
    info: {
      bg: 'bg-violet-50 dark:bg-violet-900/20',
      border: 'border-violet-200 dark:border-violet-800',
      icon: Info,
      iconColor: 'text-violet-600',
    },
    tip: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: Lightbulb,
      iconColor: 'text-amber-600',
    },
    warning: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      icon: Info,
      iconColor: 'text-orange-600',
    },
  };

  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg border",
      style.bg,
      style.border,
      className
    )}>
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconColor)} />
      <div className="flex-1 min-w-0">
        {title && (
          <h5 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
            {title}
          </h5>
        )}
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {children}
        </div>
      </div>
      {dismissible && (
        <button
          onClick={() => {
            setIsDismissed(true);
            onDismiss?.();
          }}
          className="p-1 hover:bg-white/50 dark:hover:bg-black/20 rounded shrink-0"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      )}
    </div>
  );
});

InlineTip.displayName = 'InlineTip';

export default HelpProvider;
