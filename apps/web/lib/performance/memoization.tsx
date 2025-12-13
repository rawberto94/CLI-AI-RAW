/**
 * Memoization Utilities
 * Provides hooks and utilities for optimizing React component performance
 */

'use client';

import React, { 
  memo, 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect,
  type ComponentType,
  type PropsWithChildren,
} from 'react';

// ============================================================================
// Deep Comparison Utilities
// ============================================================================

/**
 * Deep equality comparison for props
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    
    if (aKeys.length !== bKeys.length) return false;
    
    return aKeys.every(key => 
      deepEqual(
        (a as Record<string, unknown>)[key], 
        (b as Record<string, unknown>)[key]
      )
    );
  }
  
  return false;
}

/**
 * Shallow comparison with specific keys to check
 */
export function shallowEqual<T extends Record<string, unknown>>(
  a: T, 
  b: T, 
  keys?: (keyof T)[]
): boolean {
  const keysToCheck = keys ?? (Object.keys(a) as (keyof T)[]);
  return keysToCheck.every(key => a[key] === b[key]);
}

// ============================================================================
// Memoization HOCs
// ============================================================================

/**
 * Memo wrapper with deep comparison
 */
export function deepMemo<P extends Record<string, unknown>>(
  Component: ComponentType<P>
): ComponentType<P> {
  return memo(Component, deepEqual);
}

/**
 * Memo wrapper that only re-renders when specific props change
 */
export function selectiveMemo<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  propsToWatch: (keyof P)[]
): ComponentType<P> {
  return memo(Component, (prevProps, nextProps) => 
    shallowEqual(prevProps, nextProps, propsToWatch)
  );
}

/**
 * Memo wrapper with custom comparison function
 */
export function customMemo<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  areEqual: (prevProps: P, nextProps: P) => boolean
): ComponentType<P> {
  return memo(Component, areEqual);
}

// ============================================================================
// Performance Hooks
// ============================================================================

/**
 * Hook that returns a stable reference for an object
 * Only updates if the object content actually changes
 */
export function useStableObject<T extends Record<string, unknown>>(obj: T): T {
  const ref = useRef<T>(obj);
  
  if (!deepEqual(ref.current, obj)) {
    ref.current = obj;
  }
  
  return ref.current;
}

/**
 * Hook that returns a stable reference for an array
 */
export function useStableArray<T>(arr: T[]): T[] {
  const ref = useRef<T[]>(arr);
  
  if (!deepEqual(ref.current, arr)) {
    ref.current = arr;
  }
  
  return ref.current;
}

/**
 * Hook that debounces a value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Hook that returns a debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);
  
  // Update the callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Hook that throttles a callback
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [delay]
  );
}

/**
 * Hook that tracks previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * Hook that returns true if value changed
 */
export function useValueChanged<T>(value: T): boolean {
  const previous = usePrevious(value);
  return previous !== undefined && previous !== value;
}

// ============================================================================
// Event Handler Optimization
// ============================================================================

/**
 * Hook that provides a stable callback reference
 * The callback always has access to latest props/state
 */
export function useEventCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}

/**
 * Hook that creates a stable handler for form events
 */
export function useFormHandler<T>(
  setter: (value: T) => void
) {
  return useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setter(e.target.value as T);
    },
    [setter]
  );
}

// ============================================================================
// Render Optimization Components
// ============================================================================

interface RenderIfProps extends PropsWithChildren {
  condition: boolean;
  fallback?: React.ReactNode;
}

/**
 * Conditional rendering component that doesn't create new function references
 */
export const RenderIf = memo(function RenderIf({ 
  condition, 
  children, 
  fallback = null 
}: RenderIfProps) {
  return condition ? <>{children}</> : <>{fallback}</>;
});

interface RenderListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  emptyComponent?: React.ReactNode;
}

/**
 * Optimized list rendering component
 */
export function RenderList<T>({ 
  items, 
  renderItem, 
  keyExtractor, 
  emptyComponent 
}: RenderListProps<T>) {
  const stableItems = useStableArray(items);
  
  if (stableItems.length === 0) {
    return <>{emptyComponent}</>;
  }
  
  return (
    <>
      {stableItems.map((item, index) => (
        <React.Fragment key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </React.Fragment>
      ))}
    </>
  );
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Hook to measure component render time
 */
export function useRenderTime(componentName: string) {
  const startTime = useRef(performance.now());
  
  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;
    
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
    
    // Reset for next render
    startTime.current = performance.now();
  });
}

/**
 * Hook to log when a component re-renders and why
 */
export function useWhyDidYouRender<P extends Record<string, unknown>>(
  componentName: string,
  props: P
) {
  const previousProps = useRef<P>();
  
  useEffect(() => {
    if (previousProps.current && process.env.NODE_ENV === 'development') {
      const changedProps = Object.entries(props).filter(
        ([key, value]) => (previousProps.current as P)[key] !== value
      );
      
      if (changedProps.length > 0) {
        console.group(`[Why Re-render] ${componentName}`);
        changedProps.forEach(([key, value]) => {
          console.log(`  ${key}:`, (previousProps.current as P)[key], '→', value);
        });
        console.groupEnd();
      }
    }
    
    previousProps.current = props;
  });
}

// ============================================================================
// Batch Updates
// ============================================================================

/**
 * Hook that batches multiple state updates
 */
export function useBatchedUpdates<T extends Record<string, unknown>>(
  initialState: T
): [T, (updates: Partial<T>) => void, (key: keyof T, value: T[keyof T]) => void] {
  const [state, setState] = React.useState(initialState);
  
  const batchUpdate = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const updateField = useCallback((key: keyof T, value: T[keyof T]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);
  
  return [state, batchUpdate, updateField];
}

// ============================================================================
// Intersection Observer Hook
// ============================================================================

interface UseIntersectionOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

/**
 * Hook for lazy loading content when visible
 */
export function useIntersection(
  options: UseIntersectionOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const { threshold = 0.1, rootMargin = '0px', root = null } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold, rootMargin, root }
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [threshold, rootMargin, root]);
  
  return [ref, isIntersecting];
}

/**
 * Lazy component that only renders when visible
 */
export function LazyRender({ 
  children, 
  placeholder = null 
}: PropsWithChildren<{ placeholder?: React.ReactNode }>) {
  const [ref, isVisible] = useIntersection();
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false);
  
  useEffect(() => {
    if (isVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [isVisible, hasBeenVisible]);
  
  return (
    <div ref={ref}>
      {hasBeenVisible ? children : placeholder}
    </div>
  );
}
