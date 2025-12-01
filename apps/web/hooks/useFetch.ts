"use client";

/**
 * useFetch Hook
 * 
 * Simple data fetching hook with caching and revalidation.
 * For complex data fetching needs, use React Query instead.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseFetchOptions<T> {
  /** Skip initial fetch */
  skip?: boolean;
  /** Enable caching */
  cache?: boolean;
  /** Cache time in ms */
  cacheTime?: number;
  /** Stale time in ms (revalidate after this) */
  staleTime?: number;
  /** Refetch interval in ms */
  refetchInterval?: number;
  /** Refetch on window focus */
  refetchOnFocus?: boolean;
  /** Refetch on reconnect */
  refetchOnReconnect?: boolean;
  /** Initial data */
  initialData?: T;
  /** Transform response */
  transform?: (data: unknown) => T;
  /** Retry count */
  retry?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Dependencies to trigger refetch */
  dependencies?: unknown[];
}

export interface UseFetchReturn<T> {
  /** Fetched data */
  data: T | undefined;
  /** Error if fetch failed */
  error: Error | undefined;
  /** Whether currently fetching */
  isLoading: boolean;
  /** Whether initial fetch is loading */
  isInitialLoading: boolean;
  /** Whether a refetch is in progress */
  isRefetching: boolean;
  /** Whether data is stale */
  isStale: boolean;
  /** Whether fetch was successful */
  isSuccess: boolean;
  /** Whether fetch errored */
  isError: boolean;
  /** Refetch data */
  refetch: () => Promise<void>;
  /** Mutate cached data */
  mutate: (data: T | ((prev: T | undefined) => T)) => void;
}

// ============================================================================
// Simple in-memory cache
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(url: string): string {
  return url;
}

function getFromCache<T>(key: string, staleTime: number): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  
  const isStale = Date.now() - entry.timestamp > staleTime;
  if (isStale) {
    return undefined;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(key: string): void {
  cache.delete(key);
}

// ============================================================================
// useFetch Hook
// ============================================================================

export function useFetch<T = unknown>(
  url: string | null,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const {
    skip = false,
    cache: enableCache = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 0,
    refetchInterval,
    refetchOnFocus = false,
    refetchOnReconnect = true,
    initialData,
    transform,
    retry = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
    dependencies = [],
  } = options;

  const [data, setData] = useState<T | undefined>(() => {
    if (initialData !== undefined) return initialData;
    if (!url || !enableCache) return undefined;
    return getFromCache<T>(getCacheKey(url), staleTime);
  });
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!skip && !!url && data === undefined);
  const [isRefetching, setIsRefetching] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);

  const cacheKey = url ? getCacheKey(url) : null;

  const isInitialLoading = isLoading && fetchCount === 0;
  const isSuccess = !isLoading && !error && data !== undefined;
  const isError = !isLoading && error !== undefined;
  const isStale = useMemo(() => {
    if (!cacheKey || !enableCache) return false;
    const entry = cache.get(cacheKey);
    if (!entry) return true;
    return Date.now() - entry.timestamp > staleTime;
  }, [cacheKey, enableCache, staleTime]);

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!url || skip) return;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(undefined);

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let result = await response.json();
      
      if (transform) {
        result = transform(result);
      }

      if (mountedRef.current) {
        setData(result as T);
        setFetchCount((c) => c + 1);
        retryCountRef.current = 0;

        if (enableCache && cacheKey) {
          setCache(cacheKey, result);
        }

        onSuccess?.(result as T);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      if (mountedRef.current) {
        // Retry logic
        if (retryCountRef.current < retry) {
          retryCountRef.current++;
          setTimeout(() => fetchData(isRefetch), retryDelay * retryCountRef.current);
          return;
        }

        const error = err instanceof Error ? err : new Error("Fetch failed");
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, [url, skip, transform, enableCache, cacheKey, retry, retryDelay, onSuccess, onError]);

  const refetch = useCallback(async () => {
    retryCountRef.current = 0;
    await fetchData(true);
  }, [fetchData]);

  const mutate = useCallback((newData: T | ((prev: T | undefined) => T)) => {
    setData((prev) => {
      const result = typeof newData === "function" 
        ? (newData as (prev: T | undefined) => T)(prev)
        : newData;
      
      if (enableCache && cacheKey) {
        setCache(cacheKey, result);
      }
      
      return result;
    });
  }, [enableCache, cacheKey]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    
    if (!skip && url) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, skip, ...dependencies]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || skip || !url) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, skip, url, fetchData]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus || skip || !url) return;

    const handleFocus = () => {
      if (isStale) {
        fetchData(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnFocus, skip, url, isStale, fetchData]);

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect || skip || !url) return;

    const handleOnline = () => {
      fetchData(true);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refetchOnReconnect, skip, url, fetchData]);

  // Cache cleanup
  useEffect(() => {
    if (!enableCache) return;

    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > cacheTime) {
          cache.delete(key);
        }
      }
    }, cacheTime);

    return () => clearInterval(cleanup);
  }, [enableCache, cacheTime]);

  return {
    data,
    error,
    isLoading,
    isInitialLoading,
    isRefetching,
    isStale,
    isSuccess,
    isError,
    refetch,
    mutate,
  };
}

// ============================================================================
// useMutation Hook
// ============================================================================

export interface UseMutationOptions<TData, TVariables> {
  /** Callback on success */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback on error */
  onError?: (error: Error, variables: TVariables) => void;
  /** Callback on settled (success or error) */
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables) => void;
  /** Retry count */
  retry?: number;
}

export interface UseMutationReturn<TData, TVariables> {
  /** Mutation result data */
  data: TData | undefined;
  /** Error if mutation failed */
  error: Error | undefined;
  /** Whether mutation is in progress */
  isLoading: boolean;
  /** Whether mutation was successful */
  isSuccess: boolean;
  /** Whether mutation errored */
  isError: boolean;
  /** Execute the mutation */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation and return a promise */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Reset mutation state */
  reset: () => void;
}

export function useMutation<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationReturn<TData, TVariables> {
  const { onSuccess, onError, onSettled, retry = 0 } = options;

  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const isSuccess = !isLoading && !error && data !== undefined;
  const isError = !isLoading && error !== undefined;

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(undefined);

    let retryCount = 0;
    let lastError: Error | undefined;

    while (retryCount <= retry) {
      try {
        const result = await mutationFn(variables);
        setData(result);
        setIsLoading(false);
        onSuccess?.(result, variables);
        onSettled?.(result, undefined, variables);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Mutation failed");
        retryCount++;
        
        if (retryCount > retry) {
          setError(lastError);
          setIsLoading(false);
          onError?.(lastError, variables);
          onSettled?.(undefined, lastError, variables);
          throw lastError;
        }
      }
    }

    throw lastError;
  }, [mutationFn, retry, onSuccess, onError, onSettled]);

  const mutate = useCallback((variables: TVariables) => {
    mutateAsync(variables).catch(() => {
      // Error is already handled in mutateAsync
    });
  }, [mutateAsync]);

  const reset = useCallback(() => {
    setData(undefined);
    setError(undefined);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    isSuccess,
    isError,
    mutate,
    mutateAsync,
    reset,
  };
}

// ============================================================================
// useInfiniteScroll Hook
// ============================================================================

export interface UseInfiniteScrollOptions<T> {
  /** Function to get URL for page */
  getUrl: (page: number) => string;
  /** Initial page */
  initialPage?: number;
  /** Items per page */
  pageSize?: number;
  /** Transform response to get items */
  getItems?: (data: unknown) => T[];
  /** Transform response to check if has more */
  getHasMore?: (data: unknown, items: T[]) => boolean;
  /** Callback on success */
  onSuccess?: (items: T[], page: number) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseInfiniteScrollReturn<T> {
  /** All loaded items */
  items: T[];
  /** Whether loading */
  isLoading: boolean;
  /** Whether loading more */
  isLoadingMore: boolean;
  /** Whether has more pages */
  hasMore: boolean;
  /** Error if any */
  error: Error | undefined;
  /** Current page */
  page: number;
  /** Load more items */
  loadMore: () => Promise<void>;
  /** Refresh from beginning */
  refresh: () => Promise<void>;
  /** Reset state */
  reset: () => void;
}

export function useInfiniteScroll<T>(
  options: UseInfiniteScrollOptions<T>
): UseInfiniteScrollReturn<T> {
  const {
    getUrl,
    initialPage = 1,
    pageSize = 20,
    getItems = (data) => (data as { items: T[] }).items ?? (data as T[]),
    getHasMore = (data, items) => items.length >= pageSize,
    onSuccess,
    onError,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(undefined);

      const response = await fetch(getUrl(pageNum));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const newItems = getItems(data);
      const hasMoreItems = getHasMore(data, newItems);

      setItems((prev) => (append ? [...prev, ...newItems] : newItems));
      setHasMore(hasMoreItems);
      setPage(pageNum);
      onSuccess?.(newItems, pageNum);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load");
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [getUrl, getItems, getHasMore, onSuccess, onError]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current) return;
    await fetchPage(page + 1, true);
  }, [hasMore, page, fetchPage]);

  const refresh = useCallback(async () => {
    setItems([]);
    setHasMore(true);
    await fetchPage(initialPage, false);
  }, [initialPage, fetchPage]);

  const reset = useCallback(() => {
    setItems([]);
    setPage(initialPage);
    setHasMore(true);
    setError(undefined);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [initialPage]);

  // Initial load
  useEffect(() => {
    fetchPage(initialPage, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    page,
    loadMore,
    refresh,
    reset,
  };
}

// ============================================================================
// Utility: Clear all cache
// ============================================================================

export function clearFetchCache(): void {
  cache.clear();
}

export function invalidateFetchCache(url: string): void {
  invalidateCache(getCacheKey(url));
}

// ============================================================================
// Exports
// ============================================================================

export default useFetch;
