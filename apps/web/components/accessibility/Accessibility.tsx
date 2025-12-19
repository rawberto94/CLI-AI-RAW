'use client';

/**
 * Accessibility Components
 * 
 * A collection of accessibility-focused components including:
 * - Skip to Content link
 * - Screen reader only text
 * - Focus visible utilities
 * - Live regions for announcements
 */

import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Skip to Content Link
// ============================================================================

export interface SkipToContentProps {
  /** ID of the main content element */
  contentId?: string;
  /** Custom link text */
  text?: string;
  /** Additional class */
  className?: string;
}

export function SkipToContent({
  contentId = 'main-content',
  text = 'Skip to main content',
  className,
}: SkipToContentProps) {
  return (
    <a
      href={`#${contentId}`}
      className={cn(
        // Hidden by default, visible on focus
        'sr-only focus:not-sr-only',
        'fixed top-4 left-4 z-[100]',
        'px-4 py-2 text-sm font-medium',
        'bg-indigo-600 text-white rounded-lg',
        'shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
        'transition-transform',
        className
      )}
    >
      {text}
    </a>
  );
}

// ============================================================================
// Screen Reader Only Text
// ============================================================================

export interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  /** Optional: make it a live region for announcements */
  announce?: boolean;
  /** Politeness level for announcements */
  politeness?: 'polite' | 'assertive' | 'off';
}

export function ScreenReaderOnly({
  children,
  announce = false,
  politeness = 'polite',
}: ScreenReaderOnlyProps) {
  return (
    <span
      className="sr-only"
      aria-live={announce ? politeness : undefined}
      aria-atomic={announce ? 'true' : undefined}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Live Region for Announcements
// ============================================================================

interface AnnouncerContextValue {
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function useAnnouncer() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error('useAnnouncer must be used within an AnnouncerProvider');
  }
  return context;
}

export interface AnnouncerProviderProps {
  children: React.ReactNode;
}

export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    if (politeness === 'assertive') {
      setAssertiveMessage(message);
      // Clear after a short delay to allow re-announcement of same message
      setTimeout(() => setAssertiveMessage(''), 100);
    } else {
      setPoliteMessage(message);
      setTimeout(() => setPoliteMessage(''), 100);
    }
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Live regions for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

// ============================================================================
// Focus Trap
// ============================================================================

export interface FocusTrapProps {
  children: React.ReactNode;
  /** Whether the trap is active */
  active?: boolean;
  /** Return focus to element when trap is deactivated */
  returnFocus?: boolean;
  /** Initial focus element selector */
  initialFocus?: string;
  /** Callback when escape is pressed */
  onEscape?: () => void;
}

export function FocusTrap({
  children,
  active = true,
  returnFocus = true,
  initialFocus,
  onEscape,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store previous focus
    previousFocus.current = document.activeElement as HTMLElement;

    // Set initial focus
    const focusInitial = () => {
      if (!containerRef.current) return;

      if (initialFocus) {
        const element = containerRef.current.querySelector(initialFocus) as HTMLElement;
        element?.focus();
      } else {
        // Focus first focusable element
        const focusable = containerRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        focusable?.focus();
      }
    };

    // Small delay to ensure DOM is ready
    requestAnimationFrame(focusInitial);

    return () => {
      // Return focus on cleanup
      if (returnFocus && previousFocus.current) {
        previousFocus.current.focus();
      }
    };
  }, [active, initialFocus, returnFocus]);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);

  return (
    <div ref={containerRef} className="focus-trap-container">
      {children}
    </div>
  );
}

// ============================================================================
// Focus Visible Ring
// ============================================================================

export interface FocusRingProps {
  children: React.ReactNode;
  /** Ring color */
  color?: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose';
  /** Ring offset */
  offset?: number;
  /** Whether to show on focus (not just focus-visible) */
  alwaysShow?: boolean;
  className?: string;
}

const ringColors = {
  indigo: 'focus-visible:ring-indigo-500',
  blue: 'focus-visible:ring-blue-500',
  emerald: 'focus-visible:ring-emerald-500',
  amber: 'focus-visible:ring-amber-500',
  rose: 'focus-visible:ring-rose-500',
};

export function FocusRing({
  children,
  color = 'indigo',
  offset = 2,
  alwaysShow = false,
  className,
}: FocusRingProps) {
  return (
    <div
      className={cn(
        'outline-none ring-0',
        alwaysShow
          ? 'focus:ring-2'
          : 'focus-visible:ring-2',
        ringColors[color],
        `ring-offset-${offset}`,
        className
      )}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Reduce Motion Wrapper
// ============================================================================

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
}

export interface ReducedMotionProps {
  children: React.ReactNode;
  /** Component to render when reduced motion is preferred */
  fallback?: React.ReactNode;
}

export function ReducedMotion({ children, fallback }: ReducedMotionProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// Keyboard Navigation Hint
// ============================================================================

export interface KeyboardHintProps {
  keys: string[];
  action: string;
  className?: string;
}

export function KeyboardHint({ keys, action, className }: KeyboardHintProps) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-slate-500', className)}>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            {index > 0 && <span>+</span>}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 border border-slate-200 rounded">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </div>
      <span>{action}</span>
    </div>
  );
}

// ============================================================================
// Focus Indicator (visual focus debugging)
// ============================================================================

export function FocusIndicator() {
  const [focusedElement, setFocusedElement] = useState<string>('');

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const info = [
        target.tagName.toLowerCase(),
        target.id && `#${target.id}`,
        target.className && `.${target.className.split(' ').join('.')}`,
      ].filter(Boolean).join('');
      setFocusedElement(info);
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <AnimatePresence>
      {focusedElement && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 left-4 z-50 px-3 py-2 text-xs font-mono bg-slate-900 text-slate-200 rounded-lg shadow-lg"
        >
          Focus: {focusedElement}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SkipToContent;
