/**
 * Accessibility Utilities
 * Helpers for skip links, focus management, and ARIA
 * 
 * @example
 * import { SkipLinks, useFocusManager, useAnnounce } from '@/lib/accessibility';
 * 
 * // In layout
 * <SkipLinks />
 * 
 * // In components
 * const { trapFocus, restoreFocus } = useFocusManager();
 * const announce = useAnnounce();
 */

'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  ReactNode,
} from 'react';

// ============================================================================
// Skip Links Component
// ============================================================================

export interface SkipLink {
  id: string;
  label: string;
  href: string;
}

export interface SkipLinksProps {
  links?: SkipLink[];
  className?: string;
}

const defaultSkipLinks: SkipLink[] = [
  { id: 'main-content', label: 'Skip to main content', href: '#main-content' },
  { id: 'navigation', label: 'Skip to navigation', href: '#main-nav' },
  { id: 'search', label: 'Skip to search', href: '#search' },
];

export function SkipLinks({ 
  links = defaultSkipLinks,
  className = '',
}: SkipLinksProps) {
  return (
    <div className={`skip-links ${className}`}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.href}
          className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

// ============================================================================
// Focus Management Hook
// ============================================================================

export interface FocusManagerOptions {
  /**
   * Restore focus to previously focused element on unmount
   */
  restoreOnUnmount?: boolean;
  /**
   * Auto-focus the first focusable element
   */
  autoFocus?: boolean;
}

export interface FocusManagerReturn {
  /**
   * Ref to attach to the container element
   */
  containerRef: React.RefObject<HTMLElement | null>;
  /**
   * Trap focus within the container
   */
  trapFocus: () => void;
  /**
   * Release focus trap
   */
  releaseFocus: () => void;
  /**
   * Focus the first focusable element
   */
  focusFirst: () => void;
  /**
   * Focus the last focusable element
   */
  focusLast: () => void;
  /**
   * Focus a specific element by selector
   */
  focusElement: (selector: string) => void;
  /**
   * Restore focus to previously focused element
   */
  restoreFocus: () => void;
  /**
   * Whether focus is currently trapped
   */
  isTrapped: boolean;
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export function useFocusManager(options: FocusManagerOptions = {}): FocusManagerReturn {
  const { restoreOnUnmount = true, autoFocus = false } = options;
  
  const containerRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const [isTrapped, setIsTrapped] = useState(false);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS)) as HTMLElement[];
  }, []);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    elements[0]?.focus();
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    elements[elements.length - 1]?.focus();
  }, [getFocusableElements]);

  const focusElement = useCallback((selector: string) => {
    if (!containerRef.current) return;
    const element = containerRef.current.querySelector(selector) as HTMLElement | null;
    element?.focus();
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const first = elements[0];
    const last = elements[elements.length - 1];

    if (!first || !last) return;

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, [getFocusableElements]);

  const trapFocus = useCallback(() => {
    previouslyFocusedRef.current = document.activeElement;
    document.addEventListener('keydown', handleKeyDown);
    setIsTrapped(true);
    
    if (autoFocus) {
      focusFirst();
    }
  }, [handleKeyDown, autoFocus, focusFirst]);

  const releaseFocus = useCallback(() => {
    document.removeEventListener('keydown', handleKeyDown);
    setIsTrapped(false);
  }, [handleKeyDown]);

  const restoreFocus = useCallback(() => {
    if (previouslyFocusedRef.current instanceof HTMLElement) {
      previouslyFocusedRef.current.focus();
    }
  }, []);

  useEffect(() => {
    return () => {
      releaseFocus();
      if (restoreOnUnmount) {
        restoreFocus();
      }
    };
  }, [releaseFocus, restoreFocus, restoreOnUnmount]);

  return {
    containerRef,
    trapFocus,
    releaseFocus,
    focusFirst,
    focusLast,
    focusElement,
    restoreFocus,
    isTrapped,
  };
}

// ============================================================================
// Live Region Announcer
// ============================================================================

type AnnouncePoliteMode = 'polite' | 'assertive';

interface AnnounceContextValue {
  announce: (message: string, mode?: AnnouncePoliteMode) => void;
}

const AnnounceContext = createContext<AnnounceContextValue | null>(null);

export interface AnnounceProviderProps {
  children: ReactNode;
}

export function AnnounceProvider({ children }: AnnounceProviderProps) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, mode: AnnouncePoliteMode = 'polite') => {
    const ref = mode === 'assertive' ? assertiveRef : politeRef;
    if (ref.current) {
      // Clear and set to trigger announcement
      ref.current.textContent = '';
      // Small delay to ensure the clear is processed
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.textContent = message;
        }
      });
    }
  }, []);

  return (
    <AnnounceContext.Provider value={{ announce }}>
      {children}
      {/* Screen reader live regions */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): (message: string, mode?: AnnouncePoliteMode) => void {
  const context = useContext(AnnounceContext);
  
  if (!context) {
    // Return a no-op function if not within provider
    return () => {
      console.warn('useAnnounce must be used within AnnounceProvider');
    };
  }
  
  return context.announce;
}

// ============================================================================
// Keyboard Navigation Hook
// ============================================================================

export interface KeyboardNavigationOptions {
  /**
   * Orientation of the navigation
   */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /**
   * Loop navigation at ends
   */
  loop?: boolean;
  /**
   * Handle Home/End keys
   */
  homeEnd?: boolean;
  /**
   * Callback when item is activated (Enter/Space)
   */
  onActivate?: (index: number) => void;
  /**
   * Callback when focus changes
   */
  onFocusChange?: (index: number) => void;
}

export function useKeyboardNavigation(
  itemCount: number,
  options: KeyboardNavigationOptions = {}
) {
  const {
    orientation = 'vertical',
    loop = true,
    homeEnd = true,
    onActivate,
    onFocusChange,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let nextIndex = focusedIndex;
      let handled = false;

      const prevKeys = orientation === 'horizontal' 
        ? ['ArrowLeft'] 
        : orientation === 'vertical' 
          ? ['ArrowUp'] 
          : ['ArrowLeft', 'ArrowUp'];
      
      const nextKeys = orientation === 'horizontal' 
        ? ['ArrowRight'] 
        : orientation === 'vertical' 
          ? ['ArrowDown'] 
          : ['ArrowRight', 'ArrowDown'];

      if (prevKeys.includes(event.key)) {
        nextIndex = focusedIndex - 1;
        if (nextIndex < 0) {
          nextIndex = loop ? itemCount - 1 : 0;
        }
        handled = true;
      } else if (nextKeys.includes(event.key)) {
        nextIndex = focusedIndex + 1;
        if (nextIndex >= itemCount) {
          nextIndex = loop ? 0 : itemCount - 1;
        }
        handled = true;
      } else if (homeEnd && event.key === 'Home') {
        nextIndex = 0;
        handled = true;
      } else if (homeEnd && event.key === 'End') {
        nextIndex = itemCount - 1;
        handled = true;
      } else if (event.key === 'Enter' || event.key === ' ') {
        onActivate?.(focusedIndex);
        handled = true;
      }

      if (handled) {
        event.preventDefault();
        if (nextIndex !== focusedIndex) {
          setFocusedIndex(nextIndex);
          onFocusChange?.(nextIndex);
        }
      }
    },
    [focusedIndex, itemCount, loop, homeEnd, orientation, onActivate, onFocusChange]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === focusedIndex ? 0 : -1,
      'aria-selected': index === focusedIndex,
      onKeyDown: handleKeyDown,
      onFocus: () => setFocusedIndex(index),
    }),
    [focusedIndex, handleKeyDown]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    getItemProps,
    handleKeyDown,
  };
}

// ============================================================================
// Roving Tabindex Hook
// ============================================================================

export function useRovingTabIndex(initialIndex = 0) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const itemsRef = useRef<Map<number, HTMLElement>>(new Map());

  const registerItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      itemsRef.current.set(index, element);
    } else {
      itemsRef.current.delete(index);
    }
  }, []);

  const focusItem = useCallback((index: number) => {
    const element = itemsRef.current.get(index);
    if (element) {
      setActiveIndex(index);
      element.focus();
    }
  }, []);

  const getItemProps = useCallback(
    (index: number) => ({
      ref: (el: HTMLElement | null) => registerItem(index, el),
      tabIndex: index === activeIndex ? 0 : -1,
    }),
    [activeIndex, registerItem]
  );

  return {
    activeIndex,
    setActiveIndex,
    focusItem,
    getItemProps,
    registerItem,
  };
}

// ============================================================================
// Reduced Motion Hook
// ============================================================================

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// Color Scheme Hook
// ============================================================================

export function usePrefersColorScheme(): 'light' | 'dark' {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    const handler = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return colorScheme;
}

// ============================================================================
// Visible Focus Hook
// ============================================================================

/**
 * Hook to show focus ring only for keyboard navigation
 */
export function useVisibleFocus() {
  const [hadKeyboardEvent, setHadKeyboardEvent] = useState(false);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setHadKeyboardEvent(true);
      }
    };

    const onPointerDown = () => {
      setHadKeyboardEvent(false);
    };

    const onFocusIn = () => {
      if (hadKeyboardEvent) {
        setIsKeyboardUser(true);
      }
    };

    const onFocusOut = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [hadKeyboardEvent]);

  return isKeyboardUser;
}

// ============================================================================
// ARIA ID Generator
// ============================================================================

let idCounter = 0;

export function useId(prefix = 'aria'): string {
  const [id] = useState(() => `${prefix}-${++idCounter}`);
  return id;
}

export function generateId(prefix = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

// ============================================================================
// Screen Reader Only Styles
// ============================================================================

export const srOnlyStyles: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
};

// ============================================================================
// Visually Hidden Component
// ============================================================================

export function VisuallyHidden({ 
  children,
  as = 'span',
}: { 
  children: ReactNode;
  as?: React.ElementType;
}) {
  const Component = as;
  return (
    <Component style={srOnlyStyles}>
      {children}
    </Component>
  );
}
