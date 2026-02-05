/**
 * Async Hooks
 * 
 * Hooks for handling asynchronous operations with proper loading,
 * error, and success states.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface AsyncState<T> {
  /** The data returned from the async operation */
  data: T | null;
  /** Whether the operation is in progress */
  isLoading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Whether the operation has completed successfully at least once */
  isSuccess: boolean;
  /** Whether an error has occurred */
  isError: boolean;
  /** Whether the operation is idle (not started) */
  isIdle: boolean;
}

export interface UseAsyncReturn<T, Args extends unknown[] = []> extends AsyncState<T> {
  /** Execute the async operation */
  execute: (...args: Args) => Promise<T | null>;
  /** Reset to initial state */
  reset: () => void;
  /** Set data manually */
  setData: (data: T | null) => void;
  /** Set error manually */
  setError: (error: Error | null) => void;
}

export interface UseAsyncOptions<T> {
  /** Execute immediately on mount */
  immediate?: boolean;
  /** Initial data */
  initialData?: T | null;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Reset state before each execution */
  resetOnExecute?: boolean;
}

// ============================================================================
// useAsync - Core async state management
// ============================================================================

/**
 * Hook for managing async operations with loading, error, and data states
 * 
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options
 * @returns Object with state and control methods
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, execute } = useAsync(
 *   async (id: string) => {
 *     const response = await fetch(`/api/users/${id}`);
 *     return response.json();
 *   }
 * );
 * 
 * // Execute manually
 * const handleClick = () => execute('123');
 * 
 * // Or execute immediately
 * const { data, isLoading } = useAsync(fetchUsers, { immediate: true });
 * ```
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, Args> {
  const {
    immediate = false,
    initialData = null,
    onSuccess,
    onError,
    resetOnExecute = false,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    isLoading: immediate,
    error: null,
    isSuccess: false,
    isError: false,
    isIdle: !immediate,
  });

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  const asyncFunctionRef = useRef(asyncFunction);

  // Keep async function ref up to date
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction;
  }, [asyncFunction]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    if (resetOnExecute) {
      setState({
        data: initialData,
        isLoading: true,
        error: null,
        isSuccess: false,
        isError: false,
        isIdle: false,
      });
    } else {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        isIdle: false,
      }));
    }

    try {
      const result = await asyncFunctionRef.current(...args);
      
      if (mountedRef.current) {
        setState({
          data: result,
          isLoading: false,
          error: null,
          isSuccess: true,
          isError: false,
          isIdle: false,
        });
        onSuccess?.(result);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          data: prev.data,
          isLoading: false,
          error,
          isSuccess: false,
          isError: true,
          isIdle: false,
        }));
        onError?.(error);
      }
      
      return null;
    }
  }, [initialData, resetOnExecute, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isLoading: false,
      error: null,
      isSuccess: false,
      isError: false,
      isIdle: true,
    });
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    setState(prev => ({
      ...prev,
      error,
      isError: error !== null,
    }));
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as Args));
    }
    
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
    setError,
  };
}

// ============================================================================
// useAsyncCallback - Simplified version for callbacks
// ============================================================================

/**
 * Simplified hook for async callbacks, returns [execute, isLoading, error]
 * 
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options
 * @returns Tuple of [execute, isLoading, error]
 * 
 * @example
 * ```tsx
 * const [saveUser, isSaving, error] = useAsyncCallback(
 *   async (data: UserData) => {
 *     await api.saveUser(data);
 *   },
 *   { onSuccess: () => toast.success('Saved!') }
 * );
 * 
 * <Button onClick={() => saveUser(formData)} disabled={isSaving}>
 *   {isSaving ? 'Saving...' : 'Save'}
 * </Button>
 * ```
 */
export function useAsyncCallback<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: Pick<UseAsyncOptions<T>, 'onSuccess' | 'onError'> = {}
): [(...args: Args) => Promise<T | null>, boolean, Error | null] {
  const { execute, isLoading, error } = useAsync(asyncFunction, options);
  return [execute, isLoading, error];
}

// ============================================================================
// useAsyncRetry - Async with retry capability
// ============================================================================

export interface UseAsyncRetryOptions<T> extends UseAsyncOptions<T> {
  /** Maximum number of retry attempts */
  retries?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Should retry on this error */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface UseAsyncRetryReturn<T, Args extends unknown[] = []> 
  extends UseAsyncReturn<T, Args> {
  /** Current retry attempt (0-indexed) */
  retryCount: number;
  /** Whether currently retrying */
  isRetrying: boolean;
  /** Cancel ongoing retries */
  cancelRetry: () => void;
}

/**
 * Hook for async operations with automatic retry
 * 
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options including retry settings
 * @returns Object with state, control methods, and retry info
 * 
 * @example
 * ```tsx
 * const { data, isLoading, retryCount, execute } = useAsyncRetry(
 *   fetchData,
 *   {
 *     retries: 3,
 *     retryDelay: 1000,
 *     backoffMultiplier: 2,
 *     onError: (err) => console.log('Attempt failed:', err)
 *   }
 * );
 * ```
 */
export function useAsyncRetry<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncRetryOptions<T> = {}
): UseAsyncRetryReturn<T, Args> {
  const {
    retries = 3,
    retryDelay = 1000,
    backoffMultiplier = 1,
    shouldRetry = () => true,
    ...asyncOptions
  } = options;

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const cancelledRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const baseAsync = useAsync(asyncFunction, {
    ...asyncOptions,
    onError: undefined, // Handle error ourselves
  });

  const cancelRetry = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRetrying(false);
  }, []);

  const executeWithRetry = useCallback(async (...args: Args): Promise<T | null> => {
    cancelledRef.current = false;
    setRetryCount(0);
    setIsRetrying(false);

    const attemptExecution = async (attempt: number): Promise<T | null> => {
      try {
        const result = await asyncFunction(...args);
        asyncOptions.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (cancelledRef.current) {
          return null;
        }

        if (attempt < retries && shouldRetry(error, attempt)) {
          setRetryCount(attempt + 1);
          setIsRetrying(true);

          const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
          
          await new Promise<void>((resolve) => {
            timeoutRef.current = setTimeout(resolve, delay);
          });

          if (cancelledRef.current) {
            return null;
          }

          return attemptExecution(attempt + 1);
        }

        asyncOptions.onError?.(error);
        setIsRetrying(false);
        throw error;
      }
    };

    return baseAsync.execute(...args).then(() => attemptExecution(0)).catch(() => null);
  }, [asyncFunction, retries, retryDelay, backoffMultiplier, shouldRetry, asyncOptions, baseAsync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRetry();
    };
  }, [cancelRetry]);

  return {
    ...baseAsync,
    execute: executeWithRetry,
    retryCount,
    isRetrying,
    cancelRetry,
  };
}

// ============================================================================
// useLatestAsync - Only uses result from latest call
// ============================================================================

/**
 * Hook that ignores results from stale async calls
 * Useful for search inputs where rapid typing can cause race conditions
 * 
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options
 * @returns Object with state and control methods
 * 
 * @example
 * ```tsx
 * const { data, isLoading, execute } = useLatestAsync(
 *   async (query: string) => {
 *     return api.search(query);
 *   }
 * );
 * 
 * // Only the latest search result will be used
 * useEffect(() => {
 *   execute(searchQuery);
 * }, [searchQuery, execute]);
 * ```
 */
export function useLatestAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, Args> {
  const callIdRef = useRef(0);
  const baseAsync = useAsync(asyncFunction, options);

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    const callId = ++callIdRef.current;

    const result = await baseAsync.execute(...args);

    // Ignore result if a newer call was made
    if (callId !== callIdRef.current) {
      return null;
    }

    return result;
  }, [baseAsync]);

  return {
    ...baseAsync,
    execute,
  };
}

// ============================================================================
// useAsyncFn - Returns a function that handles async state
// ============================================================================

export type AsyncFn<T, Args extends unknown[]> = {
  (...args: Args): Promise<T | null>;
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  reset: () => void;
};

/**
 * Creates an async function with attached state properties
 * More ergonomic than useAsync for simple cases
 * 
 * @param asyncFunction - The async function to wrap
 * @returns Function with attached state properties
 * 
 * @example
 * ```tsx
 * const deleteUser = useAsyncFn(async (id: string) => {
 *   await api.deleteUser(id);
 * });
 * 
 * <Button 
 *   onClick={() => deleteUser('123')} 
 *   disabled={deleteUser.isLoading}
 * >
 *   {deleteUser.isLoading ? 'Deleting...' : 'Delete'}
 * </Button>
 * {deleteUser.error && <Error message={deleteUser.error.message} />}
 * ```
 */
export function useAsyncFn<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>
): AsyncFn<T, Args> {
  const { execute, isLoading, error, data, reset } = useAsync(asyncFunction);

  const fn = useCallback((...args: Args) => execute(...args), [execute]);

  // Attach state to function
  Object.defineProperties(fn, {
    isLoading: { get: () => isLoading, enumerable: true },
    error: { get: () => error, enumerable: true },
    data: { get: () => data, enumerable: true },
    reset: { value: reset, enumerable: true },
  });

  return fn as AsyncFn<T, Args>;
}
