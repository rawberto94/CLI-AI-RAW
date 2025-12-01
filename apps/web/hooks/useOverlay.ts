"use client";

/**
 * useBodyScroll Hook
 * 
 * Manages body scroll locking for modals, drawers, and overlays.
 */

import { useCallback, useEffect, useRef } from "react";

// ============================================================================
// useBodyScroll Hook
// ============================================================================

let scrollLockCount = 0;
let originalOverflow: string | null = null;
let originalPaddingRight: string | null = null;

function getScrollbarWidth(): number {
  const scrollDiv = document.createElement("div");
  scrollDiv.style.cssText = "width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;";
  document.body.appendChild(scrollDiv);
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  document.body.removeChild(scrollDiv);
  return scrollbarWidth;
}

function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;
    
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  scrollLockCount++;
}

function unlockBodyScroll(): void {
  scrollLockCount--;
  if (scrollLockCount <= 0) {
    scrollLockCount = 0;
    document.body.style.overflow = originalOverflow || "";
    document.body.style.paddingRight = originalPaddingRight || "";
    originalOverflow = null;
    originalPaddingRight = null;
  }
}

/**
 * Hook to lock/unlock body scroll for overlays
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen }) {
 *   useBodyScroll(isOpen);
 *   // ...
 * }
 * ```
 */
export function useBodyScroll(locked: boolean = false): void {
  useEffect(() => {
    if (locked) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
  }, [locked]);
}

/**
 * Manual scroll lock control
 */
export function useScrollLock() {
  const isLocked = useRef(false);

  const lock = useCallback(() => {
    if (!isLocked.current) {
      lockBodyScroll();
      isLocked.current = true;
    }
  }, []);

  const unlock = useCallback(() => {
    if (isLocked.current) {
      unlockBodyScroll();
      isLocked.current = false;
    }
  }, []);

  const toggle = useCallback(() => {
    if (isLocked.current) {
      unlock();
    } else {
      lock();
    }
  }, [lock, unlock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isLocked.current) {
        unlockBodyScroll();
      }
    };
  }, []);

  return { lock, unlock, toggle, isLocked: isLocked.current };
}

// ============================================================================
// useFocusTrap Hook
// ============================================================================

const FOCUSABLE_SELECTORS = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  enabled?: boolean;
  /** Return focus to trigger element on deactivation */
  returnFocus?: boolean;
  /** Initial element to focus (selector or ref) */
  initialFocus?: string | HTMLElement | null;
}

/**
 * Trap focus within a container element
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen }) {
 *   const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
 *   return <div ref={containerRef}>...</div>;
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, returnFocus = true, initialFocus = null } = options;
  const containerRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    
    // Store the currently focused element
    triggerRef.current = document.activeElement as HTMLElement;

    // Focus initial element or first focusable
    const focusInitial = () => {
      let elementToFocus: HTMLElement | null = null;

      if (typeof initialFocus === "string") {
        elementToFocus = container.querySelector(initialFocus);
      } else if (initialFocus instanceof HTMLElement) {
        elementToFocus = initialFocus;
      }

      if (!elementToFocus) {
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
        elementToFocus = focusable[0] || container;
      }

      elementToFocus?.focus();
    };

    // Small delay to ensure DOM is ready
    requestAnimationFrame(focusInitial);

    // Handle tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (!firstFocusable) return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      
      // Return focus to trigger element
      if (returnFocus && triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [enabled, returnFocus, initialFocus]);

  return containerRef;
}

// ============================================================================
// useEscapeKey Hook
// ============================================================================

/**
 * Trigger callback when Escape key is pressed
 */
export function useEscapeKey(
  callback: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        callback();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [callback, enabled]);
}

// ============================================================================
// useOverlay Hook - Combined utility
// ============================================================================

interface UseOverlayOptions {
  /** Whether the overlay is open */
  isOpen: boolean;
  /** Callback when overlay should close */
  onClose?: () => void;
  /** Lock body scroll when open */
  lockScroll?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
  /** Enable focus trap */
  trapFocus?: boolean;
  /** Initial element to focus */
  initialFocus?: string | HTMLElement | null;
}

/**
 * Combined hook for overlay components (modals, drawers, dialogs)
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose, children }) {
 *   const { containerRef } = useOverlay({
 *     isOpen,
 *     onClose,
 *     lockScroll: true,
 *     closeOnEscape: true,
 *     trapFocus: true,
 *   });
 *   
 *   return isOpen ? <div ref={containerRef}>{children}</div> : null;
 * }
 * ```
 */
export function useOverlay<T extends HTMLElement = HTMLDivElement>(
  options: UseOverlayOptions
) {
  const {
    isOpen,
    onClose,
    lockScroll = true,
    closeOnEscape = true,
    trapFocus = true,
    initialFocus = null,
  } = options;

  // Body scroll lock
  useBodyScroll(lockScroll && isOpen);

  // Escape key handler
  useEscapeKey(() => {
    if (closeOnEscape && onClose) {
      onClose();
    }
  }, isOpen);

  // Focus trap
  const containerRef = useFocusTrap<T>({
    enabled: trapFocus && isOpen,
    returnFocus: true,
    initialFocus,
  });

  return { containerRef };
}

// ============================================================================
// useClickOutside Hook (if not already in useEventListener)
// ============================================================================

export function useClickAway<T extends HTMLElement = HTMLDivElement>(
  callback: () => void,
  enabled: boolean = true
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    // Use mousedown for immediate response
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callback, enabled]);

  return ref;
}
