/**
 * Throttle Hook
 * 
 * Limits the rate at which a function can fire by ensuring it only
 * executes at most once within a specified time period.
 * 
 * Use throttle when you want to ensure regular updates (e.g., scroll, resize)
 * Use debounce when you want to wait for input to settle (e.g., search)
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

// ============================================================================
// useThrottle - Throttle a value
// ============================================================================

/**
 * Throttles a value, only updating it at most once per specified interval
 * 
 * @param value - The value to throttle
 * @param interval - Minimum time between value updates in milliseconds
 * @returns The throttled value
 * 
 * @example
 * ```tsx
 * const [scrollY, setScrollY] = useState(0);
 * const throttledScrollY = useThrottle(scrollY, 100);
 * 
 * useEffect(() => {
 *   // Only triggers at most every 100ms
 *   console.log('Scroll position:', throttledScrollY);
 * }, [throttledScrollY]);
 * ```
 */
export function useThrottle<T>(value: T, interval: number = 200): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdated.current;

    if (timeSinceLastUpdate >= interval) {
      // Update immediately if enough time has passed
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      // Schedule update for the remaining time
      const timeoutId = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, interval - timeSinceLastUpdate);

      return () => clearTimeout(timeoutId);
    }
  }, [value, interval]);

  return throttledValue;
}

// ============================================================================
// useThrottleCallback - Throttle a callback function
// ============================================================================

/**
 * Returns a throttled version of a callback function
 * 
 * @param callback - The function to throttle
 * @param interval - Minimum time between function calls in milliseconds
 * @param options - Optional configuration
 * @returns A throttled version of the callback
 * 
 * @example
 * ```tsx
 * const handleScroll = useThrottleCallback((e) => {
 *   console.log('Scroll event', e);
 * }, 100);
 * 
 * <div onScroll={handleScroll}>...</div>
 * ```
 */
export function useThrottleCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 200,
  options: {
    /** Execute on the leading edge (start) of the interval */
    leading?: boolean;
    /** Execute on the trailing edge (end) of the interval */
    trailing?: boolean;
  } = {}
): T {
  const { leading = true, trailing = true } = options;
  
  const lastCalled = useRef<number>(0);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const lastArgs = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCalled.current;

      // Store latest args for trailing call
      lastArgs.current = args;

      // Clear any pending trailing call
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current = null;
      }

      if (timeSinceLastCall >= interval) {
        // Enough time has passed, execute immediately if leading is enabled
        if (leading) {
          lastCalled.current = now;
          return callbackRef.current(...args);
        }
      }

      // Schedule trailing call if enabled
      if (trailing) {
        const remainingTime = interval - timeSinceLastCall;
        timeoutId.current = setTimeout(() => {
          lastCalled.current = Date.now();
          if (lastArgs.current) {
            callbackRef.current(...lastArgs.current);
          }
          timeoutId.current = null;
        }, Math.max(remainingTime, 0));
      }
    }) as T,
    [interval, leading, trailing]
  );
}

// ============================================================================
// useRafThrottle - Throttle using requestAnimationFrame
// ============================================================================

/**
 * Throttles a callback to run at most once per animation frame (~16ms at 60fps)
 * Useful for smooth animations and scroll handlers
 * 
 * @param callback - The function to throttle
 * @returns A RAF-throttled version of the callback
 * 
 * @example
 * ```tsx
 * const handleMouseMove = useRafThrottle((e) => {
 *   // Smooth position updates
 *   setPosition({ x: e.clientX, y: e.clientY });
 * });
 * ```
 */
export function useRafThrottle<T extends (...args: any[]) => any>(
  callback: T
): T {
  const rafId = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const lastArgs = useRef<Parameters<T> | null>(null);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      lastArgs.current = args;

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          if (lastArgs.current) {
            callbackRef.current(...lastArgs.current);
          }
          rafId.current = null;
        });
      }
    }) as T,
    []
  );
}

// ============================================================================
// useThrottledState - State that throttles updates
// ============================================================================

/**
 * Like useState, but throttles state updates
 * 
 * @param initialValue - Initial state value
 * @param interval - Minimum time between updates in milliseconds
 * @returns Tuple of [throttledValue, setValue, immediateValue]
 * 
 * @example
 * ```tsx
 * const [throttledSearch, setSearch, immediateSearch] = useThrottledState('', 300);
 * 
 * // immediateSearch updates immediately for input value
 * // throttledSearch only updates every 300ms for API calls
 * <input value={immediateSearch} onChange={(e) => setSearch(e.target.value)} />
 * ```
 */
export function useThrottledState<T>(
  initialValue: T,
  interval: number = 200
): [T, (value: T) => void, T] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const throttledValue = useThrottle(immediateValue, interval);

  return [throttledValue, setImmediateValue, immediateValue];
}
