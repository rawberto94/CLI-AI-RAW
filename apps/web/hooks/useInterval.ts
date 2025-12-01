/**
 * Interval and Timing Hooks
 * 
 * Hooks for managing intervals, timeouts, and time-based operations.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// useInterval - Declarative setInterval
// ============================================================================

/**
 * Declarative interval hook that properly handles cleanup
 * 
 * @param callback - Function to call on each interval
 * @param delay - Interval delay in ms (null to pause)
 * 
 * @example
 * ```tsx
 * // Simple counter
 * const [count, setCount] = useState(0);
 * useInterval(() => setCount(c => c + 1), 1000);
 * 
 * // Pausable polling
 * const [isPaused, setIsPaused] = useState(false);
 * useInterval(fetchData, isPaused ? null : 5000);
 * ```
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}

// ============================================================================
// useTimeout - Declarative setTimeout
// ============================================================================

/**
 * Declarative timeout hook with proper cleanup
 * 
 * @param callback - Function to call after delay
 * @param delay - Timeout delay in ms (null to cancel)
 * 
 * @example
 * ```tsx
 * // Auto-dismiss notification
 * useTimeout(() => setVisible(false), visible ? 5000 : null);
 * 
 * // Debounced action
 * const [pendingValue, setPendingValue] = useState(null);
 * useTimeout(() => {
 *   if (pendingValue !== null) saveValue(pendingValue);
 * }, pendingValue !== null ? 500 : null);
 * ```
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => {
      savedCallback.current();
    }, delay);

    return () => clearTimeout(id);
  }, [delay]);
}

// ============================================================================
// useTimeoutFn - Timeout with manual control
// ============================================================================

export interface UseTimeoutFnReturn {
  /** Whether the timeout is currently active */
  isPending: boolean;
  /** Start/restart the timeout */
  start: () => void;
  /** Cancel the timeout */
  cancel: () => void;
}

/**
 * Timeout hook with manual control
 * 
 * @param callback - Function to call after delay
 * @param delay - Timeout delay in ms
 * @returns Object with isPending, start, and cancel
 * 
 * @example
 * ```tsx
 * const { isPending, start, cancel } = useTimeoutFn(() => {
 *   toast.info('No activity detected');
 * }, 30000);
 * 
 * // Reset on activity
 * const handleActivity = () => {
 *   cancel();
 *   start();
 * };
 * ```
 */
export function useTimeoutFn(
  callback: () => void,
  delay: number
): UseTimeoutFnReturn {
  const [isPending, setIsPending] = useState(false);
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPending(false);
  }, []);

  const start = useCallback(() => {
    cancel();
    setIsPending(true);
    timeoutRef.current = setTimeout(() => {
      setIsPending(false);
      savedCallback.current();
    }, delay);
  }, [delay, cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isPending, start, cancel };
}

// ============================================================================
// useIntervalFn - Interval with manual control
// ============================================================================

export interface UseIntervalFnReturn {
  /** Whether the interval is currently active */
  isActive: boolean;
  /** Start the interval */
  start: () => void;
  /** Stop the interval */
  stop: () => void;
  /** Toggle the interval */
  toggle: () => void;
}

/**
 * Interval hook with manual control
 * 
 * @param callback - Function to call on each interval
 * @param delay - Interval delay in ms
 * @param options - Configuration options
 * @returns Object with isActive, start, stop, toggle
 * 
 * @example
 * ```tsx
 * const { isActive, start, stop, toggle } = useIntervalFn(() => {
 *   fetchUpdates();
 * }, 5000, { immediate: true });
 * 
 * <Button onClick={toggle}>
 *   {isActive ? 'Pause' : 'Resume'} Updates
 * </Button>
 * ```
 */
export function useIntervalFn(
  callback: () => void,
  delay: number,
  options: { immediate?: boolean; autoStart?: boolean } = {}
): UseIntervalFnReturn {
  const { immediate = false, autoStart = false } = options;
  
  const [isActive, setIsActive] = useState(autoStart);
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
  }, []);

  const start = useCallback(() => {
    stop();
    
    if (immediate) {
      savedCallback.current();
    }
    
    intervalRef.current = setInterval(() => {
      savedCallback.current();
    }, delay);
    
    setIsActive(true);
  }, [delay, immediate, stop]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, start, stop]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      start();
    }
    return stop;
  }, [autoStart, start, stop]);

  return { isActive, start, stop, toggle };
}

// ============================================================================
// useCountdown - Countdown timer
// ============================================================================

export interface UseCountdownOptions {
  /** Interval between updates in ms (default: 1000) */
  interval?: number;
  /** Callback when countdown reaches zero */
  onComplete?: () => void;
  /** Auto-start the countdown */
  autoStart?: boolean;
}

export interface UseCountdownReturn {
  /** Remaining time in seconds */
  count: number;
  /** Whether countdown is running */
  isRunning: boolean;
  /** Start the countdown */
  start: () => void;
  /** Pause the countdown */
  pause: () => void;
  /** Reset to initial value */
  reset: (newInitialSeconds?: number) => void;
}

/**
 * Countdown timer hook
 * 
 * @param initialSeconds - Starting countdown value in seconds
 * @param options - Configuration options
 * @returns Object with count and control methods
 * 
 * @example
 * ```tsx
 * const { count, isRunning, start, pause, reset } = useCountdown(60, {
 *   onComplete: () => toast.info('Time\'s up!'),
 *   autoStart: true
 * });
 * 
 * return (
 *   <div>
 *     <span>{count}s remaining</span>
 *     <Button onClick={pause}>{isRunning ? 'Pause' : 'Resume'}</Button>
 *     <Button onClick={() => reset(60)}>Reset</Button>
 *   </div>
 * );
 * ```
 */
export function useCountdown(
  initialSeconds: number,
  options: UseCountdownOptions = {}
): UseCountdownReturn {
  const { interval = 1000, onComplete, autoStart = false } = options;
  
  const [count, setCount] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useInterval(() => {
    setCount(c => {
      const newCount = c - 1;
      if (newCount <= 0) {
        setIsRunning(false);
        onCompleteRef.current?.();
        return 0;
      }
      return newCount;
    });
  }, isRunning && count > 0 ? interval : null);

  const start = useCallback(() => {
    if (count > 0) {
      setIsRunning(true);
    }
  }, [count]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((newInitialSeconds?: number) => {
    setCount(newInitialSeconds ?? initialSeconds);
    setIsRunning(false);
  }, [initialSeconds]);

  return { count, isRunning, start, pause, reset };
}

// ============================================================================
// useStopwatch - Stopwatch/timer
// ============================================================================

export interface UseStopwatchReturn {
  /** Elapsed time in seconds */
  seconds: number;
  /** Whether stopwatch is running */
  isRunning: boolean;
  /** Start the stopwatch */
  start: () => void;
  /** Pause the stopwatch */
  pause: () => void;
  /** Reset to zero */
  reset: () => void;
  /** Formatted time string (MM:SS) */
  formatted: string;
}

/**
 * Stopwatch/timer hook
 * 
 * @returns Object with seconds, control methods, and formatted time
 * 
 * @example
 * ```tsx
 * const { formatted, isRunning, start, pause, reset } = useStopwatch();
 * 
 * return (
 *   <div>
 *     <span>{formatted}</span>
 *     <Button onClick={isRunning ? pause : start}>
 *       {isRunning ? 'Pause' : 'Start'}
 *     </Button>
 *     <Button onClick={reset}>Reset</Button>
 *   </div>
 * );
 * ```
 */
export function useStopwatch(): UseStopwatchReturn {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useInterval(() => {
    setSeconds(s => s + 1);
  }, isRunning ? 1000 : null);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setSeconds(0);
    setIsRunning(false);
  }, []);

  const formatted = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return { seconds, isRunning, start, pause, reset, formatted };
}

// ============================================================================
// useNow - Current time that updates
// ============================================================================

/**
 * Hook that returns current time, updating at specified interval
 * 
 * @param interval - Update interval in ms (default: 1000)
 * @returns Current Date object
 * 
 * @example
 * ```tsx
 * const now = useNow(1000);
 * return <div>Current time: {now.toLocaleTimeString()}</div>;
 * ```
 */
export function useNow(interval: number = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useInterval(() => {
    setNow(new Date());
  }, interval);

  return now;
}

// ============================================================================
// useIdleTimeout - Detect user inactivity
// ============================================================================

export interface UseIdleTimeoutOptions {
  /** Events to consider as user activity */
  events?: (keyof WindowEventMap)[];
  /** Callback when user becomes idle */
  onIdle?: () => void;
  /** Callback when user becomes active again */
  onActive?: () => void;
}

export interface UseIdleTimeoutReturn {
  /** Whether user is currently idle */
  isIdle: boolean;
  /** Reset the idle timer */
  reset: () => void;
}

/**
 * Hook for detecting user inactivity
 * 
 * @param timeout - Idle timeout in ms
 * @param options - Configuration options
 * @returns Object with isIdle and reset
 * 
 * @example
 * ```tsx
 * const { isIdle, reset } = useIdleTimeout(5 * 60 * 1000, {
 *   onIdle: () => showSessionWarning(),
 *   onActive: () => hideSessionWarning()
 * });
 * 
 * // Show warning modal when idle
 * {isIdle && <SessionWarningModal onDismiss={reset} />}
 * ```
 */
export function useIdleTimeout(
  timeout: number,
  options: UseIdleTimeoutOptions = {}
): UseIdleTimeoutReturn {
  const {
    events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'],
    onIdle,
    onActive,
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onIdleRef = useRef(onIdle);
  const onActiveRef = useRef(onActive);

  useEffect(() => {
    onIdleRef.current = onIdle;
    onActiveRef.current = onActive;
  }, [onIdle, onActive]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isIdle) {
      setIsIdle(false);
      onActiveRef.current?.();
    }

    timeoutRef.current = setTimeout(() => {
      setIsIdle(true);
      onIdleRef.current?.();
    }, timeout);
  }, [timeout, isIdle]);

  useEffect(() => {
    // Start the timer
    reset();

    // Add activity listeners
    const handleActivity = () => reset();
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [events, reset]);

  return { isIdle, reset };
}
