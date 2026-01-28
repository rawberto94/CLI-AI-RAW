'use client';

/**
 * Interactive Tooltips
 * Enhanced tooltips with rich content, actions, and educational content
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  Info, 
  Lightbulb, 
  ExternalLink, 
  ChevronRight,
  X,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
type TooltipVariant = 'default' | 'info' | 'tip' | 'warning';

interface TooltipAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface InteractiveTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  title?: string;
  position?: TooltipPosition;
  variant?: TooltipVariant;
  actions?: TooltipAction[];
  learnMoreUrl?: string;
  shortcut?: string;
  showIcon?: boolean;
  delay?: number;
  maxWidth?: number;
  disabled?: boolean;
}

export function InteractiveTooltip({
  children,
  content,
  title,
  position = 'top',
  variant = 'default',
  actions = [],
  learnMoreUrl,
  shortcut,
  showIcon = false,
  delay = 300,
  maxWidth = 280,
  disabled = false,
}: InteractiveTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  }, [delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Delay hide to allow hovering to tooltip
    setTimeout(() => {
      if (!isHoveringTooltip) {
        setIsVisible(false);
      }
    }, 100);
  }, [isHoveringTooltip]);

  const forceHide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
    setIsHoveringTooltip(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const variantStyles = {
    default: 'bg-slate-900 dark:bg-slate-800 border-slate-700',
    info: 'bg-violet-900 dark:bg-violet-950 border-violet-700',
    tip: 'bg-amber-900 dark:bg-amber-950 border-amber-700',
    warning: 'bg-orange-900 dark:bg-orange-950 border-orange-700',
  };

  const variantIcons = {
    default: null,
    info: <Info className="h-4 w-4 text-violet-400" />,
    tip: <Lightbulb className="h-4 w-4 text-amber-400" />,
    warning: <Info className="h-4 w-4 text-orange-400" />,
  };

  const positionStyles: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowStyles: Record<TooltipPosition, string> = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-full border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      <div className="inline-flex items-center gap-1">
        {children}
        {showIcon && (
          <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
        )}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ maxWidth }}
            className={cn(
              "absolute z-50 rounded-lg border shadow-xl",
              positionStyles[position],
              variantStyles[variant]
            )}
            onMouseEnter={() => setIsHoveringTooltip(true)}
            onMouseLeave={() => {
              setIsHoveringTooltip(false);
              setIsVisible(false);
            }}
          >
            <div className="p-3">
              {/* Header */}
              {(title || variantIcons[variant]) && (
                <div className="flex items-center gap-2 mb-2">
                  {variantIcons[variant]}
                  {title && (
                    <span className="text-sm font-medium text-white">{title}</span>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="text-xs text-slate-300 leading-relaxed">
                {content}
              </div>

              {/* Shortcut */}
              {shortcut && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <Keyboard className="h-3 w-3" />
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 dark:bg-slate-700 text-slate-300 border border-slate-600">
                    {shortcut}
                  </kbd>
                </div>
              )}

              {/* Actions */}
              {(actions.length > 0 || learnMoreUrl) && (
                <div className="mt-3 pt-2 border-t border-slate-700 flex flex-wrap gap-2">
                  {actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        action.onClick();
                        forceHide();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {action.icon}
                      {action.label}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  ))}
                  {learnMoreUrl && (
                    <a
                      href={learnMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Learn more
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className={cn(
              "absolute w-0 h-0 border-4",
              arrowStyles[position],
              variant === 'default' && "border-slate-900 dark:border-slate-800",
              variant === 'info' && "border-violet-900 dark:border-violet-950",
              variant === 'tip' && "border-amber-900 dark:border-amber-950",
              variant === 'warning' && "border-orange-900 dark:border-orange-950"
            )} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Feature Spotlight - Highlight new features
interface FeatureSpotlightProps {
  children: React.ReactNode;
  title: string;
  description: string;
  isNew?: boolean;
  onDismiss?: () => void;
  storageKey?: string;
}

export function FeatureSpotlight({
  children,
  title,
  description,
  isNew = true,
  onDismiss,
  storageKey,
}: FeatureSpotlightProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  useEffect(() => {
    if (storageKey) {
      const wasDismissed = localStorage.getItem(`spotlight_${storageKey}`);
      if (wasDismissed) {
        setDismissed(true);
        return;
      }
    }
    // Show spotlight after a short delay
    const timer = setTimeout(() => setShowSpotlight(true), 1000);
    return () => clearTimeout(timer);
  }, [storageKey]);

  const handleDismiss = () => {
    setShowSpotlight(false);
    setDismissed(true);
    if (storageKey) {
      localStorage.setItem(`spotlight_${storageKey}`, 'true');
    }
    onDismiss?.();
  };

  if (dismissed || !isNew) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {children}
      
      <AnimatePresence>
        {showSpotlight && (
          <>
            {/* Pulse ring */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute -inset-1 rounded-lg pointer-events-none"
            >
              <div className="absolute inset-0 rounded-lg bg-purple-500/20 animate-pulse" />
              <div className="absolute inset-0 rounded-lg border-2 border-purple-500/50 animate-ping" />
            </motion.div>

            {/* Tooltip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50"
            >
              <div className="bg-gradient-to-r from-purple-600 to-purple-600 rounded-lg shadow-xl p-4 max-w-xs">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-white/20 rounded">
                      New
                    </span>
                    <h4 className="text-sm font-semibold text-white">{title}</h4>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="p-0.5 hover:bg-white/10 rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-white/70" />
                  </button>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">{description}</p>
                <button
                  onClick={handleDismiss}
                  className="mt-3 text-xs font-medium text-white/90 hover:text-white transition-colors"
                >
                  Got it →
                </button>
              </div>
              {/* Arrow */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-purple-600" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Info Badge - Small inline help
interface InfoBadgeProps {
  content: string;
  variant?: 'info' | 'tip' | 'warning';
}

export function InfoBadge({ content, variant = 'info' }: InfoBadgeProps) {
  const icons = {
    info: <Info className="h-3 w-3" />,
    tip: <Lightbulb className="h-3 w-3" />,
    warning: <Info className="h-3 w-3" />,
  };

  const colors = {
    info: 'text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30',
    tip: 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30',
    warning: 'text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30',
  };

  return (
    <InteractiveTooltip content={content} variant={variant}>
      <button className={cn(
        "inline-flex items-center p-1 rounded-full transition-colors",
        colors[variant]
      )}>
        {icons[variant]}
      </button>
    </InteractiveTooltip>
  );
}

export default InteractiveTooltip;
