/**
 * Accessibility Utilities
 * 
 * Reusable accessibility helpers and HOCs to enforce a11y best practices.
 */

import React, { forwardRef, useCallback, useRef, useEffect, ComponentType } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// ARIA Utilities
// ============================================================================

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ARIA attributes for common patterns
 */
export const ariaPatterns = {
  /**
   * Button with loading state
   */
  loadingButton: (isLoading: boolean, loadingText: string = 'Loading...') => ({
    'aria-busy': isLoading,
    'aria-disabled': isLoading,
    'aria-label': isLoading ? loadingText : undefined,
  }),

  /**
   * Expandable/collapsible content
   */
  expandable: (isExpanded: boolean, controlsId: string) => ({
    'aria-expanded': isExpanded,
    'aria-controls': controlsId,
  }),

  /**
   * Tab panel
   */
  tab: (isSelected: boolean, panelId: string) => ({
    role: 'tab' as const,
    'aria-selected': isSelected,
    'aria-controls': panelId,
    tabIndex: isSelected ? 0 : -1,
  }),

  /**
   * Tab panel content
   */
  tabPanel: (isActive: boolean, tabId: string) => ({
    role: 'tabpanel' as const,
    'aria-labelledby': tabId,
    hidden: !isActive,
    tabIndex: 0,
  }),

  /**
   * Modal dialog
   */
  modal: (titleId: string, descriptionId?: string) => ({
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': descriptionId,
  }),

  /**
   * Alert dialog
   */
  alertDialog: (titleId: string, descriptionId?: string) => ({
    role: 'alertdialog' as const,
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': descriptionId,
  }),

  /**
   * Live region for dynamic content
   */
  liveRegion: (politeness: 'polite' | 'assertive' = 'polite') => ({
    role: 'status' as const,
    'aria-live': politeness,
    'aria-atomic': true,
  }),

  /**
   * Progress indicator
   */
  progress: (value: number, max: number = 100, label?: string) => ({
    role: 'progressbar' as const,
    'aria-valuenow': value,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'aria-label': label || `${Math.round((value / max) * 100)}% complete`,
  }),

  /**
   * Search input
   */
  searchInput: (hasResults: boolean, resultCount?: number) => ({
    role: 'searchbox' as const,
    'aria-haspopup': 'listbox' as const,
    'aria-expanded': hasResults,
    'aria-autocomplete': 'list' as const,
    ...(resultCount !== undefined && {
      'aria-label': `Search, ${resultCount} results available`,
    }),
  }),

  /**
   * Combobox/autocomplete
   */
  combobox: (isOpen: boolean, listboxId: string, activeOptionId?: string) => ({
    role: 'combobox' as const,
    'aria-haspopup': 'listbox' as const,
    'aria-expanded': isOpen,
    'aria-controls': listboxId,
    'aria-activedescendant': activeOptionId,
  }),

  /**
   * Option in a listbox
   */
  option: (isSelected: boolean, isActive: boolean) => ({
    role: 'option' as const,
    'aria-selected': isSelected,
    'aria-current': isActive ? 'true' as const : undefined,
  }),

  /**
   * Navigation landmark
   */
  navigation: (label: string) => ({
    role: 'navigation' as const,
    'aria-label': label,
  }),

  /**
   * Sort button in a table
   */
  sortButton: (direction: 'ascending' | 'descending' | 'none', columnName: string) => ({
    'aria-sort': direction,
    'aria-label': `Sort by ${columnName}${direction !== 'none' ? `, currently ${direction}` : ''}`,
  }),
};

// ============================================================================
// Screen Reader Utilities
// ============================================================================

/**
 * Visually hidden but accessible to screen readers
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Announce a message to screen readers
 */
export function useAnnounce() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcer element if it doesn't exist
    let announcer = document.getElementById('sr-announcer') as HTMLDivElement | null;
    
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcer';
      announcer.className = 'sr-only';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    
    announcerRef.current = announcer;
    
    return () => {
      // Don't remove on cleanup as other components may use it
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      // Clear and re-add to ensure announcement
      announcerRef.current.textContent = '';
      requestAnimationFrame(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = message;
        }
      });
    }
  }, []);

  return announce;
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Focus trap for modals and dialogs
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isActive]);
}

/**
 * Restore focus when component unmounts
 */
export function useFocusReturn(shouldRestore: boolean = true) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (shouldRestore) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    return () => {
      if (shouldRestore && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [shouldRestore]);
}

/**
 * Skip link component for keyboard navigation
 */
export function SkipLink({ 
  href = '#main-content',
  children = 'Skip to main content'
}: { 
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only',
        'focus:absolute focus:top-4 focus:left-4 focus:z-50',
        'focus:px-4 focus:py-2 focus:bg-white focus:rounded-lg focus:shadow-lg',
        'focus:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500'
      )}
    >
      {children}
    </a>
  );
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

/**
 * Handle arrow key navigation in a list
 */
export function useArrowNavigation(
  itemCount: number,
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  options: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical' | 'both';
    onSelect?: (index: number) => void;
  } = {}
) {
  const { loop = true, orientation = 'vertical', onSelect } = options;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';

    let newIndex = activeIndex;

    switch (e.key) {
      case 'ArrowUp':
        if (isVertical) {
          e.preventDefault();
          newIndex = activeIndex - 1;
        }
        break;
      case 'ArrowDown':
        if (isVertical) {
          e.preventDefault();
          newIndex = activeIndex + 1;
        }
        break;
      case 'ArrowLeft':
        if (isHorizontal) {
          e.preventDefault();
          newIndex = activeIndex - 1;
        }
        break;
      case 'ArrowRight':
        if (isHorizontal) {
          e.preventDefault();
          newIndex = activeIndex + 1;
        }
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = itemCount - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect?.(activeIndex);
        return;
      default:
        return;
    }

    // Handle boundaries
    if (loop) {
      if (newIndex < 0) newIndex = itemCount - 1;
      if (newIndex >= itemCount) newIndex = 0;
    } else {
      newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
    }

    setActiveIndex(newIndex);
  }, [activeIndex, itemCount, loop, orientation, onSelect, setActiveIndex]);

  return handleKeyDown;
}

// ============================================================================
// HOCs for Accessibility
// ============================================================================

/**
 * Wrap a component to ensure it has accessible button behavior
 */
export function withAccessibleClick<P extends object>(
  Component: ComponentType<P & { 
    onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    role?: string;
    tabIndex?: number;
  }>
) {
  return forwardRef<HTMLElement, P & { onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void }>(
    function AccessibleClickWrapper(props, ref) {
      const { onClick, ...rest } = props;

      const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }, [onClick]);

      return (
        <Component
          {...(rest as P)}
          ref={ref}
          onClick={onClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
        />
      );
    }
  );
}

// ============================================================================
// Accessible Interactive Elements
// ============================================================================

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Loading state */
  isLoading?: boolean;
  /** Loading text for screen readers */
  loadingText?: string;
}

/**
 * Accessible button with loading state
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  function AccessibleButton({ isLoading, loadingText = 'Loading...', children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        {...ariaPatterns.loadingButton(Boolean(isLoading), loadingText)}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="sr-only">{loadingText}</span>
            <span aria-hidden="true">{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

interface AccessibleLinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** If true, opens in new tab with security attributes */
  external?: boolean;
}

/**
 * Accessible link that looks/acts like a button
 */
export const AccessibleLinkButton = forwardRef<HTMLAnchorElement, AccessibleLinkButtonProps>(
  function AccessibleLinkButton({ external, children, ...props }, ref) {
    return (
      <a
        ref={ref}
        role="button"
        {...(external && {
          target: '_blank',
          rel: 'noopener noreferrer',
        })}
        {...props}
      >
        {children}
        {external && (
          <span className="sr-only"> (opens in new tab)</span>
        )}
      </a>
    );
  }
);

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if an element has required accessibility attributes
 */
export function validateAccessibility(
  element: HTMLElement,
  requirements: {
    requireLabel?: boolean;
    requireRole?: boolean;
    requireFocusable?: boolean;
  } = {}
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (requirements.requireLabel) {
    const hasLabel = 
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.getAttribute('title') ||
      (element as HTMLInputElement).labels?.length;
    
    if (!hasLabel) {
      issues.push('Missing accessible label (aria-label, aria-labelledby, or associated label element)');
    }
  }
  
  if (requirements.requireRole && !element.getAttribute('role')) {
    issues.push('Missing role attribute');
  }
  
  if (requirements.requireFocusable) {
    const tabIndex = element.getAttribute('tabindex');
    const isFocusable = 
      element.matches('button, a[href], input, select, textarea, [tabindex]') &&
      tabIndex !== '-1';
    
    if (!isFocusable) {
      issues.push('Element is not keyboard focusable');
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type AriaPattern = keyof typeof ariaPatterns;
