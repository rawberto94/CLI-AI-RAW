/**
 * Event Listener Hooks
 * 
 * Hooks for safely managing DOM event listeners with proper cleanup.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// useEventListener - Generic event listener hook
// ============================================================================

type EventMap = WindowEventMap & DocumentEventMap & HTMLElementEventMap;

/**
 * Hook for adding event listeners with automatic cleanup
 * 
 * @param eventName - Name of the event to listen for
 * @param handler - Event handler function
 * @param element - Target element (defaults to window)
 * @param options - Event listener options
 * 
 * @example
 * ```tsx
 * // Window event
 * useEventListener('resize', handleResize);
 * 
 * // Document event
 * useEventListener('keydown', handleKeyDown, document);
 * 
 * // Element event
 * useEventListener('click', handleClick, buttonRef);
 * ```
 */
export function useEventListener<K extends keyof EventMap>(
  eventName: K,
  handler: (event: EventMap[K]) => void,
  element?: React.RefObject<HTMLElement | null> | HTMLElement | Window | Document | null,
  options?: boolean | AddEventListenerOptions
): void {
  // Store handler in ref to avoid re-registering on every render
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Get the target element
    let targetElement: HTMLElement | Window | Document | null = null;
    
    if (element === undefined) {
      targetElement = window;
    } else if (element && 'current' in element) {
      targetElement = element.current;
    } else {
      targetElement = element as HTMLElement | Window | Document | null;
    }

    if (!targetElement || !('addEventListener' in targetElement)) return;

    // Create event listener that calls handler from ref
    const eventListener = (event: Event) => {
      savedHandler.current(event as EventMap[K]);
    };

    targetElement.addEventListener(eventName, eventListener, options);

    return () => {
      targetElement.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

// ============================================================================
// useOnClickOutside - Click outside detection
// ============================================================================

/**
 * Hook for detecting clicks outside of an element
 * 
 * @param ref - Ref to the element to detect clicks outside of
 * @param handler - Callback when click outside is detected
 * @param enabled - Whether the listener is active (default: true)
 * 
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 * 
 * useOnClickOutside(ref, () => setIsOpen(false), isOpen);
 * 
 * return (
 *   <div ref={ref}>
 *     {isOpen && <Dropdown />}
 *   </div>
 * );
 * ```
 */
export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      
      // Do nothing if clicking ref's element or descendent elements
      if (!el || el.contains(event.target as Node)) {
        return;
      }

      savedHandler.current(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, enabled]);
}

/**
 * Hook for detecting clicks outside of multiple elements
 * 
 * @param refs - Array of refs to elements
 * @param handler - Callback when click outside all elements is detected
 * @param enabled - Whether the listener is active (default: true)
 * 
 * @example
 * ```tsx
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * const menuRef = useRef<HTMLDivElement>(null);
 * 
 * useOnClickOutsideMultiple([buttonRef, menuRef], () => setIsOpen(false), isOpen);
 * ```
 */
export function useOnClickOutsideMultiple<T extends HTMLElement = HTMLElement>(
  refs: React.RefObject<T | null>[],
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      // Check if click is inside any of the refs
      const isInside = refs.some(ref => {
        const el = ref.current;
        return el && el.contains(event.target as Node);
      });

      if (!isInside) {
        savedHandler.current(event);
      }
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs, enabled]);
}

// ============================================================================
// useWindowSize - Window dimensions
// ============================================================================

export interface WindowSize {
  width: number;
  height: number;
}

/**
 * Hook for tracking window dimensions
 * 
 * @returns Object with current width and height
 * 
 * @example
 * ```tsx
 * const { width, height } = useWindowSize();
 * 
 * return (
 *   <div>
 *     Window: {width} x {height}
 *   </div>
 * );
 * ```
 */
export function useWindowSize(): WindowSize {
  const getSize = useCallback((): WindowSize => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }), []);

  const sizeRef = useRef<WindowSize>(getSize());

  useEffect(() => {
    const handleResize = () => {
      const newSize = getSize();
      if (newSize.width !== sizeRef.current.width || newSize.height !== sizeRef.current.height) {
        sizeRef.current = newSize;
      }
    };

    // Initial size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getSize]);

  // Use state for reactivity
  const [size, setSize] = useState<WindowSize>(getSize());

  useEffect(() => {
    const handleResize = () => {
      setSize(getSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getSize]);

  return size;
}

// ============================================================================
// useScrollPosition - Scroll position tracking
// ============================================================================

export interface ScrollPosition {
  x: number;
  y: number;
}

/**
 * Hook for tracking scroll position
 * 
 * @param element - Element to track (defaults to window)
 * @param throttleMs - Throttle updates (default: 100ms)
 * @returns Object with x and y scroll position
 * 
 * @example
 * ```tsx
 * const { y } = useScrollPosition();
 * const isScrolled = y > 100;
 * 
 * return (
 *   <header className={isScrolled ? 'scrolled' : ''}>
 *     Header
 *   </header>
 * );
 * ```
 */
export function useScrollPosition(
  element?: React.RefObject<HTMLElement | null>,
  throttleMs: number = 100
): ScrollPosition {
  const [position, setPosition] = useState<ScrollPosition>({ x: 0, y: 0 });
  const lastUpdate = useRef(0);

  useEffect(() => {
    const target = element?.current || window;
    
    const getPosition = (): ScrollPosition => {
      if (element?.current) {
        return {
          x: element.current.scrollLeft,
          y: element.current.scrollTop,
        };
      }
      return {
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset,
      };
    };

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastUpdate.current >= throttleMs) {
        lastUpdate.current = now;
        setPosition(getPosition());
      }
    };

    // Initial position
    setPosition(getPosition());

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [element, throttleMs]);

  return position;
}

// ============================================================================
// useScrollDirection - Detect scroll direction
// ============================================================================

export type ScrollDirection = 'up' | 'down' | null;

/**
 * Hook for detecting scroll direction
 * 
 * @param threshold - Minimum scroll amount to trigger (default: 10)
 * @returns Current scroll direction ('up', 'down', or null)
 * 
 * @example
 * ```tsx
 * const scrollDirection = useScrollDirection();
 * 
 * return (
 *   <nav className={scrollDirection === 'down' ? 'hidden' : ''}>
 *     Navigation
 *   </nav>
 * );
 * ```
 */
export function useScrollDirection(threshold: number = 10): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollY.current;

          if (Math.abs(diff) >= threshold) {
            setDirection(diff > 0 ? 'down' : 'up');
            lastScrollY.current = currentScrollY;
          }

          ticking.current = false;
        });

        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return direction;
}

// ============================================================================
// useHover - Hover state tracking
// ============================================================================

/**
 * Hook for tracking hover state of an element
 * 
 * @param ref - Ref to the element to track
 * @returns Whether the element is being hovered
 * 
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const isHovered = useHover(ref);
 * 
 * return (
 *   <div ref={ref} className={isHovered ? 'hovered' : ''}>
 *     Hover me
 *   </div>
 * );
 * ```
 */
export function useHover<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>
): boolean {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [ref]);

  return isHovered;
}

// ============================================================================
// useFocus - Focus state tracking
// ============================================================================

/**
 * Hook for tracking focus state of an element
 * 
 * @param ref - Ref to the element to track
 * @returns Whether the element is focused
 * 
 * @example
 * ```tsx
 * const inputRef = useRef<HTMLInputElement>(null);
 * const isFocused = useFocus(inputRef);
 * 
 * return (
 *   <div className={isFocused ? 'focused' : ''}>
 *     <input ref={inputRef} />
 *   </div>
 * );
 * ```
 */
export function useFocus<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>
): boolean {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    el.addEventListener('focus', handleFocus);
    el.addEventListener('blur', handleBlur);

    // Check initial state
    if (document.activeElement === el) {
      setIsFocused(true);
    }

    return () => {
      el.removeEventListener('focus', handleFocus);
      el.removeEventListener('blur', handleBlur);
    };
  }, [ref]);

  return isFocused;
}

// ============================================================================
// useIsVisible - Intersection Observer hook
// ============================================================================

export interface UseIsVisibleOptions {
  /** Root element (default: viewport) */
  root?: Element | null;
  /** Root margin */
  rootMargin?: string;
  /** Visibility threshold (0-1) */
  threshold?: number | number[];
  /** Only trigger once */
  once?: boolean;
}

/**
 * Hook for detecting when an element is visible in the viewport
 * 
 * @param ref - Ref to the element to observe
 * @param options - IntersectionObserver options
 * @returns Whether the element is visible
 * 
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const isVisible = useIsVisible(ref, { threshold: 0.5 });
 * 
 * return (
 *   <div ref={ref} className={isVisible ? 'animate-in' : ''}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useIsVisible<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>,
  options: UseIsVisibleOptions = {}
): boolean {
  const { root = null, rootMargin = '0px', threshold = 0, once = false } = options;
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If already visible and once is true, don't observe again
    if (once && isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const visible = entry.isIntersecting;
        setIsVisible(visible);

        // Disconnect if once is true and element became visible
        if (once && visible) {
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(el);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [ref, root, rootMargin, threshold, once, isVisible]);

  return isVisible;
}

// ============================================================================
// useDebounce - Debounce a value
// ============================================================================

/**
 * Hook to debounce a value
 * 
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns The debounced value
 * 
 * @example
 * ```tsx
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * 
 * useEffect(() => {
 *   // This will only run 300ms after user stops typing
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useDebouncedCallback - Debounce a callback function
// ============================================================================

/**
 * Hook to create a debounced callback
 * 
 * @param callback - The callback to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns Debounced callback function
 * 
 * @example
 * ```tsx
 * const debouncedSave = useDebouncedCallback((value: string) => {
 *   saveToServer(value);
 * }, 500);
 * 
 * <input onChange={(e) => debouncedSave(e.target.value)} />
 * ```
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
