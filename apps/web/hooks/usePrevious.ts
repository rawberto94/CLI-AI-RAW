/**
 * usePrevious Hook
 * 
 * Tracks the previous value of a variable across renders.
 * Useful for comparing current and previous values, detecting changes,
 * and implementing animations/transitions.
 */

'use client';

import { useRef, useEffect } from 'react';

// ============================================================================
// usePrevious - Basic previous value tracking
// ============================================================================

/**
 * Returns the previous value of a variable
 * 
 * @param value - The value to track
 * @returns The previous value (undefined on first render)
 * 
 * @example
 * ```tsx
 * const [count, setCount] = useState(0);
 * const prevCount = usePrevious(count);
 * 
 * console.log(`Count changed from ${prevCount} to ${count}`);
 * ```
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

// ============================================================================
// usePreviousDistinct - Only track distinct changes
// ============================================================================

/**
 * Like usePrevious, but only updates when the value actually changes
 * (using shallow comparison by default)
 * 
 * @param value - The value to track
 * @param compare - Optional custom comparison function
 * @returns The previous distinct value
 * 
 * @example
 * ```tsx
 * const [data, setData] = useState({ id: 1 });
 * const prevData = usePreviousDistinct(data, (a, b) => a?.id === b?.id);
 * ```
 */
export function usePreviousDistinct<T>(
  value: T,
  compare: (prev: T | undefined, next: T) => boolean = (a, b) => a === b
): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  const prevValue = ref.current;
  
  const hasChanged = !compare(prevValue, value);
  
  useEffect(() => {
    if (hasChanged) {
      ref.current = value;
    }
  });
  
  return hasChanged ? prevValue : ref.current;
}

// ============================================================================
// useHasChanged - Detect if a value has changed
// ============================================================================

/**
 * Returns true if the value has changed since the last render
 * 
 * @param value - The value to track
 * @returns boolean indicating if the value changed
 * 
 * @example
 * ```tsx
 * const hasIdChanged = useHasChanged(user.id);
 * 
 * useEffect(() => {
 *   if (hasIdChanged) {
 *     // User changed, reload data
 *     loadUserData(user.id);
 *   }
 * }, [hasIdChanged, user.id]);
 * ```
 */
export function useHasChanged<T>(value: T): boolean {
  const prevValue = usePrevious(value);
  return prevValue !== value;
}

// ============================================================================
// useChangeCount - Count how many times a value has changed
// ============================================================================

/**
 * Tracks how many times a value has changed
 * 
 * @param value - The value to track
 * @returns The number of times the value has changed
 * 
 * @example
 * ```tsx
 * const changeCount = useChangeCount(searchQuery);
 * console.log(`Search changed ${changeCount} times`);
 * ```
 */
export function useChangeCount<T>(value: T): number {
  const countRef = useRef(0);
  const prevValue = usePrevious(value);
  
  if (prevValue !== value && prevValue !== undefined) {
    countRef.current += 1;
  }
  
  return countRef.current;
}

// ============================================================================
// useDiff - Get detailed diff between current and previous values
// ============================================================================

export interface ValueDiff<T> {
  /** Previous value */
  previous: T | undefined;
  /** Current value */
  current: T;
  /** Whether the value has changed */
  hasChanged: boolean;
  /** Direction of change (for numbers) */
  direction?: 'up' | 'down' | 'same';
  /** Delta value (for numbers) */
  delta?: number;
}

/**
 * Returns detailed information about value changes
 * 
 * @param value - The value to track
 * @returns Object with previous, current, and change info
 * 
 * @example
 * ```tsx
 * const diff = useDiff(price);
 * 
 * if (diff.hasChanged) {
 *   console.log(`Price ${diff.direction}: ${diff.delta}`);
 * }
 * ```
 */
export function useDiff<T>(value: T): ValueDiff<T> {
  const previous = usePrevious(value);
  const hasChanged = previous !== value;
  
  const diff: ValueDiff<T> = {
    previous,
    current: value,
    hasChanged,
  };
  
  // Add numeric analysis for numbers
  if (typeof value === 'number' && typeof previous === 'number') {
    diff.delta = value - previous;
    diff.direction = value > previous ? 'up' : value < previous ? 'down' : 'same';
  }
  
  return diff;
}

// ============================================================================
// useValueHistory - Track history of value changes
// ============================================================================

/**
 * Tracks a history of value changes
 * 
 * @param value - The value to track
 * @param maxHistory - Maximum number of historical values to keep
 * @returns Array of historical values (most recent first)
 * 
 * @example
 * ```tsx
 * const history = useValueHistory(searchQuery, 5);
 * 
 * // Show recent searches
 * <ul>
 *   {history.map((query, i) => <li key={i}>{query}</li>)}
 * </ul>
 * ```
 */
export function useValueHistory<T>(value: T, maxHistory: number = 10): T[] {
  const historyRef = useRef<T[]>([]);
  const prevValue = usePrevious(value);
  
  // Add to history when value changes (and previous value exists)
  if (prevValue !== undefined && prevValue !== value) {
    historyRef.current = [
      prevValue,
      ...historyRef.current.slice(0, maxHistory - 1),
    ];
  }
  
  return historyRef.current;
}

// ============================================================================
// useFirstRender - Detect first render
// ============================================================================

/**
 * Returns true only on the first render
 * 
 * @returns boolean indicating if this is the first render
 * 
 * @example
 * ```tsx
 * const isFirstRender = useFirstRender();
 * 
 * useEffect(() => {
 *   if (!isFirstRender) {
 *     // Skip initial animation
 *     animateChange();
 *   }
 * }, [value, isFirstRender]);
 * ```
 */
export function useFirstRender(): boolean {
  const firstRenderRef = useRef(true);
  
  useEffect(() => {
    firstRenderRef.current = false;
  }, []);
  
  return firstRenderRef.current;
}

// ============================================================================
// useUpdateEffect - Effect that skips first render
// ============================================================================

/**
 * Like useEffect, but skips execution on the first render
 * Useful for "on change" effects
 * 
 * @param effect - Effect function to run
 * @param deps - Dependency array
 * 
 * @example
 * ```tsx
 * useUpdateEffect(() => {
 *   // Only runs when dependencies change, not on mount
 *   toast.success('Settings saved!');
 * }, [settings]);
 * ```
 */
export function useUpdateEffect(
  effect: React.EffectCallback,
  deps?: React.DependencyList
): void {
  const isFirstRender = useRef(true);
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
