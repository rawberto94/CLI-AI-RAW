/**
 * Focus Management Utilities
 * 
 * Production-ready focus management for:
 * - Focus trapping (modals, dialogs)
 * - Focus restoration
 * - Skip links
 * - Roving tabindex
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// =====================
// Types
// =====================

interface FocusTrapOptions {
  /** Initially focused element (selector or element) */
  initialFocus?: string | HTMLElement | null;
  /** Return focus when deactivated */
  returnFocusOnDeactivate?: boolean;
  /** Allow clicking outside to deactivate */
  clickOutsideDeactivates?: boolean;
  /** Allow escape key to deactivate */
  escapeDeactivates?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Callback when clicking outside */
  onClickOutside?: () => void;
}

interface RovingTabindexOptions {
  /** Orientation for arrow key navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Wrap around at ends */
  loop?: boolean;
  /** Selector for focusable items */
  itemSelector?: string;
}

// =====================
// Focus Trap Hook
// =====================

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 * 
 * @example
 * function Modal({ isOpen, onClose }) {
 *   const { containerRef, activate, deactivate } = useFocusTrap({
 *     onEscape: onClose,
 *     returnFocusOnDeactivate: true,
 *   });
 * 
 *   useEffect(() => {
 *     if (isOpen) activate();
 *     else deactivate();
 *   }, [isOpen]);
 * 
 *   return <div ref={containerRef}>...</div>;
 * }
 */
export function useFocusTrap(options: FocusTrapOptions = {}) {
  const {
    initialFocus,
    returnFocusOnDeactivate = true,
    clickOutsideDeactivates = false,
    escapeDeactivates = true,
    onEscape,
    onClickOutside,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Get all focusable elements within container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector)
    ).filter(el => !el.closest('[inert]'));
  }, []);

  // Handle tab key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive) return;

      if (event.key === 'Escape' && escapeDeactivates) {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      if (event.shiftKey) {
        // Shift+Tab: go to previous, or wrap to last
        if (activeElement === first || !containerRef.current?.contains(activeElement)) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        // Tab: go to next, or wrap to first
        if (activeElement === last || !containerRef.current?.contains(activeElement)) {
          event.preventDefault();
          first?.focus();
        }
      }
    },
    [isActive, escapeDeactivates, onEscape, getFocusableElements]
  );

  // Handle click outside
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!isActive || !clickOutsideDeactivates) return;
      
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClickOutside?.();
      }
    },
    [isActive, clickOutsideDeactivates, onClickOutside]
  );

  // Activate trap
  const activate = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setIsActive(true);

    // Focus initial element
    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      let elementToFocus: HTMLElement | null = null;

      if (typeof initialFocus === 'string') {
        elementToFocus = containerRef.current.querySelector(initialFocus);
      } else if (initialFocus instanceof HTMLElement) {
        elementToFocus = initialFocus;
      }

      if (!elementToFocus) {
        const focusable = getFocusableElements();
        elementToFocus = focusable[0] || containerRef.current;
      }

      elementToFocus?.focus();
    });
  }, [initialFocus, getFocusableElements]);

  // Deactivate trap
  const deactivate = useCallback(() => {
    setIsActive(false);

    if (returnFocusOnDeactivate && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [returnFocusOnDeactivate]);

  // Set up event listeners
  useEffect(() => {
    if (!isActive) return;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActive, handleKeyDown, handleClickOutside]);

  return {
    containerRef,
    isActive,
    activate,
    deactivate,
  };
}

// =====================
// Roving Tabindex Hook
// =====================

/**
 * Implement roving tabindex pattern for toolbars, menus, etc.
 * 
 * @example
 * function Toolbar() {
 *   const { containerRef, getItemProps, focusedIndex } = useRovingTabindex({
 *     orientation: 'horizontal',
 *   });
 * 
 *   return (
 *     <div ref={containerRef} role="toolbar">
 *       {items.map((item, i) => (
 *         <button key={i} {...getItemProps(i)}>
 *           {item}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 */
export function useRovingTabindex(options: RovingTabindexOptions = {}) {
  const {
    orientation = 'horizontal',
    loop = true,
    itemSelector = '[data-roving-item]',
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const getItems = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(itemSelector));
  }, [itemSelector]);

  const focusItem = useCallback((index: number) => {
    const items = getItems();
    if (items[index]) {
      items[index].focus();
      setFocusedIndex(index);
    }
  }, [getItems]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const items = getItems();
      if (items.length === 0) return;

      const currentIndex = focusedIndex;
      let nextIndex = currentIndex;

      const isHorizontal = orientation === 'horizontal' || orientation === 'both';
      const isVertical = orientation === 'vertical' || orientation === 'both';

      switch (event.key) {
        case 'ArrowRight':
          if (isHorizontal) {
            event.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= items.length) {
              nextIndex = loop ? 0 : items.length - 1;
            }
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            event.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              nextIndex = loop ? items.length - 1 : 0;
            }
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            event.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= items.length) {
              nextIndex = loop ? 0 : items.length - 1;
            }
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            event.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              nextIndex = loop ? items.length - 1 : 0;
            }
          }
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      focusItem(nextIndex);
    },
    [orientation, loop, focusedIndex, getItems, focusItem]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      'data-roving-item': true,
      tabIndex: index === focusedIndex ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
    }),
    [focusedIndex]
  );

  return {
    containerRef,
    focusedIndex,
    getItemProps,
    onKeyDown: handleKeyDown,
    focusItem,
  };
}

// =====================
// Focus Restoration Hook
// =====================

/**
 * Save and restore focus when navigating
 * 
 * @example
 * function Page() {
 *   useFocusRestoration('page-key');
 *   // Focus will be restored when returning to this page
 * }
 */
export function useFocusRestoration(key: string) {
  useEffect(() => {
    // Restore focus on mount
    const savedSelector = sessionStorage.getItem(`focus-restore:${key}`);
    if (savedSelector) {
      const element = document.querySelector<HTMLElement>(savedSelector);
      if (element) {
        element.focus();
      }
      sessionStorage.removeItem(`focus-restore:${key}`);
    }

    // Save focus on unmount
    return () => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        const selector = getUniqueSelector(activeElement);
        if (selector) {
          sessionStorage.setItem(`focus-restore:${key}`, selector);
        }
      }
    };
  }, [key]);
}

/**
 * Get a unique selector for an element
 */
function getUniqueSelector(element: HTMLElement): string | null {
  if (element.id) {
    return `#${element.id}`;
  }

  if (element.dataset.focusId) {
    return `[data-focus-id="${element.dataset.focusId}"]`;
  }

  // Try to build a path
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      const currentTagName = current.tagName;
      const siblings = Array.from(parent.children).filter(
        (child: Element) => child.tagName === currentTagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.length > 0 ? path.join(' > ') : null;
}

// =====================
// Skip Link Hook
// =====================

/**
 * Create skip link functionality
 * 
 * @example
 * function Layout() {
 *   const { SkipLink, skipToMain } = useSkipLink();
 * 
 *   return (
 *     <>
 *       <SkipLink />
 *       <nav>...</nav>
 *       <main id="main-content">...</main>
 *     </>
 *   );
 * }
 */
export function useSkipLink(mainContentId = 'main-content') {
  const skipToMain = useCallback(() => {
    const main = document.getElementById(mainContentId);
    if (main) {
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView();
    }
  }, [mainContentId]);

  const SkipLink = useCallback(
    () => (
      <a
        href={`#${mainContentId}`}
        onClick={(e) => {
          e.preventDefault();
          skipToMain();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-slate-900"
      >
        Skip to main content
      </a>
    ),
    [mainContentId, skipToMain]
  );

  return { SkipLink, skipToMain };
}
