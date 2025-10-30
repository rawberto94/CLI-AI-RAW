/**
 * useAccessibility Hook
 * Provides accessibility utilities and helpers
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// ============================================================================
// Focus Management
// ============================================================================

export function useFocusTrap(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    const focusableElements = document.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);
}

export function useFocusReturn() {
  const [previousFocus, setPreviousFocus] = useState<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    setPreviousFocus(document.activeElement as HTMLElement);
  }, []);

  const returnFocus = useCallback(() => {
    previousFocus?.focus();
  }, [previousFocus]);

  return { saveFocus, returnFocus };
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

export function useArrowNavigation(
  items: HTMLElement[],
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical';
  } = {}
) {
  const { loop = true, orientation = 'vertical' } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = items.findIndex(item => item === document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      const isNext = 
        (orientation === 'vertical' && e.key === 'ArrowDown') ||
        (orientation === 'horizontal' && e.key === 'ArrowRight');

      const isPrev = 
        (orientation === 'vertical' && e.key === 'ArrowUp') ||
        (orientation === 'horizontal' && e.key === 'ArrowLeft');

      if (isNext) {
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1;
        }
      } else if (isPrev) {
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0;
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = items.length - 1;
      }

      items[nextIndex]?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, loop, orientation]);
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

export function useAnnouncer() {
  const [announcer, setAnnouncer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.setAttribute('role', 'status');
    div.setAttribute('aria-live', 'polite');
    div.setAttribute('aria-atomic', 'true');
    div.className = 'sr-only';
    document.body.appendChild(div);
    setAnnouncer(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcer) return;
    
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (announcer) announcer.textContent = '';
    }, 1000);
  }, [announcer]);

  return { announce };
}

// ============================================================================
// Reduced Motion
// ============================================================================

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// High Contrast Mode
// ============================================================================

export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setPrefersHighContrast(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersHighContrast;
}

// ============================================================================
// Skip Links
// ============================================================================

export function useSkipLinks() {
  const skipToContent = useCallback(() => {
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainContent instanceof HTMLElement) {
      mainContent.focus();
      mainContent.scrollIntoView();
    }
  }, []);

  const skipToNavigation = useCallback(() => {
    const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (nav instanceof HTMLElement) {
      nav.focus();
      nav.scrollIntoView();
    }
  }, []);

  return { skipToContent, skipToNavigation };
}

// ============================================================================
// ARIA Utilities
// ============================================================================

export function useAriaExpanded(initialState = false) {
  const [isExpanded, setIsExpanded] = useState(initialState);

  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return {
    isExpanded,
    setIsExpanded,
    toggle,
    ariaProps: {
      'aria-expanded': isExpanded,
    },
  };
}

export function useAriaSelected(initialState = false) {
  const [isSelected, setIsSelected] = useState(initialState);

  const toggle = useCallback(() => {
    setIsSelected(prev => !prev);
  }, []);

  return {
    isSelected,
    setIsSelected,
    toggle,
    ariaProps: {
      'aria-selected': isSelected,
    },
  };
}

// ============================================================================
// Live Region
// ============================================================================

export function useLiveRegion(politeness: 'polite' | 'assertive' = 'polite') {
  const [message, setMessage] = useState('');

  const announce = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 1000);
  }, []);

  const liveRegionProps = {
    role: 'status',
    'aria-live': politeness,
    'aria-atomic': true,
    className: 'sr-only',
  };

  return {
    message,
    announce,
    liveRegionProps,
  };
}
