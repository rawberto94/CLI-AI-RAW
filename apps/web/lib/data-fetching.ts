/**
 * Data Fetching Utilities
 * Enhanced data fetching patterns with suspense support,
 * automatic retry, and intelligent caching
 */

'use client';

import { 
  useQuery, 
  useSuspenseQuery,
  useInfiniteQuery,
  useQueryClient,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { getTenantId } from '@/lib/tenant';

// ============================================================================
// Types
// ============================================================================

export interface FetcherOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface InfiniteQueryResult<T> {
  pages: T[][];
  allItems: T[];
  total: number;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// Enhanced Fetcher
// ============================================================================

export async function enhancedFetch<T>(
  url: string,
  options: FetcherOptions & RequestInit = {}
): Promise<T> {
  const {
    headers: customHeaders = {},
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': getTenantId(),
    'x-data-mode': 'real',
    ...customHeaders,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle wrapped responses
      if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
        return data.data as T;
      }
      
      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < retries && !controller.signal.aborted) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  clearTimeout(timeoutId);
  throw lastError || new Error('Request failed');
}

// ============================================================================
// Suspense-Ready Query Hook
// ============================================================================

interface UseSuspenseDataOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  suspense?: boolean;
}

/**
 * Hook for data fetching with optional Suspense support
 * 
 * @example
 * // With Suspense (component suspends until data loads)
 * const { data } = useData('/api/contracts', { suspense: true });
 * 
 * // Without Suspense (traditional loading state)
 * const { data, isLoading } = useData('/api/contracts');
 */
export function useData<T>(
  url: string | null,
  options: UseSuspenseDataOptions<T> = {}
) {
  const { suspense = false, ...queryOptions } = options;
  const queryKey: QueryKey = ['data', url];

  const queryFn = async () => {
    if (!url) throw new Error('No URL provided');
    return enhancedFetch<T>(url);
  };

  if (suspense) {
    // Use suspense query - will throw promise and suspend component
    return useSuspenseQuery({
      queryKey,
      queryFn,
      ...queryOptions,
    });
  }

  // Regular query with loading states
  return useQuery({
    queryKey,
    queryFn,
    enabled: !!url,
    ...queryOptions,
  });
}

// ============================================================================
// Infinite Query Hook
// ============================================================================

interface UseInfiniteDataOptions<T> {
  limit?: number;
  staleTime?: number;
  enabled?: boolean;
  getNextPageParam?: (lastPage: PaginatedData<T>) => number | undefined;
}

/**
 * Hook for infinite scrolling data
 * 
 * @example
 * const { allItems, hasNextPage, fetchNextPage } = useInfiniteData<Contract>(
 *   '/api/contracts',
 *   { limit: 20 }
 * );
 */
export function useInfiniteData<T>(
  baseUrl: string,
  options: UseInfiniteDataOptions<T> = {}
): InfiniteQueryResult<T> {
  const {
    limit = 20,
    staleTime = 30000,
    enabled = true,
    getNextPageParam = (lastPage) => 
      lastPage.hasMore ? lastPage.page + 1 : undefined,
  } = options;

  const query = useInfiniteQuery({
    queryKey: ['infinite', baseUrl, limit],
    queryFn: async ({ pageParam = 1 }) => {
      const url = `${baseUrl}?page=${pageParam}&limit=${limit}`;
      return enhancedFetch<PaginatedData<T>>(url);
    },
    initialPageParam: 1,
    getNextPageParam,
    staleTime,
    enabled,
  });

  const allItems = useMemo(() => {
    return query.data?.pages.flatMap(page => page.data) ?? [];
  }, [query.data?.pages]);

  const total = query.data?.pages[0]?.total ?? 0;

  return {
    pages: query.data?.pages.map(p => p.data) ?? [],
    allItems,
    total,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// Polling Hook
// ============================================================================

interface UsePollingOptions<T> {
  interval: number;
  enabled?: boolean;
  onUpdate?: (data: T) => void;
  stopWhen?: (data: T) => boolean;
}

/**
 * Hook for polling data at regular intervals
 * 
 * @example
 * const { data, isPolling, stopPolling } = usePolling<JobStatus>(
 *   `/api/jobs/${jobId}`,
 *   { 
 *     interval: 2000,
 *     stopWhen: (data) => data.status === 'completed'
 *   }
 * );
 */
export function usePolling<T>(
  url: string,
  options: UsePollingOptions<T>
) {
  const { interval, enabled = true, onUpdate, stopWhen } = options;
  const [isPolling, setIsPolling] = useState(enabled);
  const stopPollingRef = useRef(false);

  const query = useQuery({
    queryKey: ['polling', url],
    queryFn: () => enhancedFetch<T>(url),
    refetchInterval: isPolling ? interval : false,
    enabled: enabled && isPolling,
  });

  // Handle stop conditions
  useEffect(() => {
    if (query.data && stopWhen?.(query.data)) {
      setIsPolling(false);
      stopPollingRef.current = true;
    }
    
    if (query.data && onUpdate) {
      onUpdate(query.data);
    }
  }, [query.data, stopWhen, onUpdate]);

  const startPolling = useCallback(() => {
    if (!stopPollingRef.current) {
      setIsPolling(true);
    }
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  return {
    ...query,
    isPolling,
    startPolling,
    stopPolling,
  };
}

// ============================================================================
// Dependent Queries Hook
// ============================================================================

interface DependentQueryConfig<T, D> {
  queryKey: QueryKey;
  dependsOn: D | undefined;
  queryFn: (dependency: D) => Promise<T>;
  staleTime?: number;
}

/**
 * Hook for queries that depend on other data
 * 
 * @example
 * const { data: user } = useQuery(['user']);
 * const { data: userSettings } = useDependentQuery({
 *   queryKey: ['user-settings'],
 *   dependsOn: user?.id,
 *   queryFn: (userId) => fetch(`/api/users/${userId}/settings`)
 * });
 */
export function useDependentQuery<T, D>({
  queryKey,
  dependsOn,
  queryFn,
  staleTime = 30000,
}: DependentQueryConfig<T, D>) {
  return useQuery({
    queryKey: [...queryKey, dependsOn],
    queryFn: () => queryFn(dependsOn as D),
    enabled: dependsOn !== undefined && dependsOn !== null,
    staleTime,
  });
}

// ============================================================================
// Batch Fetching Hook
// ============================================================================

interface UseBatchFetchOptions<T> {
  maxBatchSize?: number;
  batchDelay?: number;
  staleTime?: number;
}

/**
 * Hook for batching multiple ID-based fetches into a single request
 * 
 * @example
 * const { getById, prefetchIds, isLoading } = useBatchFetch<Contract>(
 *   '/api/contracts/batch',
 *   { maxBatchSize: 20 }
 * );
 * 
 * // Individual fetches are automatically batched
 * const contract = await getById('abc123');
 */
export function useBatchFetch<T extends { id: string }>(
  batchUrl: string,
  options: UseBatchFetchOptions<T> = {}
) {
  const { maxBatchSize = 20, batchDelay = 50, staleTime = 30000 } = options;
  const queryClient = useQueryClient();
  
  const pendingIds = useRef<Set<string>>(new Set());
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const resolvers = useRef<Map<string, { resolve: (v: T) => void; reject: (e: Error) => void }>>(new Map());

  const executeBatch = useCallback(async () => {
    const ids = Array.from(pendingIds.current);
    pendingIds.current.clear();

    if (ids.length === 0) return;

    try {
      const results = await enhancedFetch<T[]>(batchUrl, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });

      // Cache individual results and resolve promises
      for (const item of results) {
        queryClient.setQueryData(['batch-item', item.id], item);
        resolvers.current.get(item.id)?.resolve(item);
        resolvers.current.delete(item.id);
      }

      // Reject any IDs not found
      for (const id of ids) {
        if (resolvers.current.has(id)) {
          resolvers.current.get(id)?.reject(new Error(`Item ${id} not found`));
          resolvers.current.delete(id);
        }
      }
    } catch (error) {
      // Reject all pending
      for (const [id, { reject }] of resolvers.current) {
        if (ids.includes(id)) {
          reject(error instanceof Error ? error : new Error('Batch fetch failed'));
        }
      }
    }
  }, [batchUrl, queryClient]);

  const getById = useCallback(async (id: string): Promise<T> => {
    // Check cache first
    const cached = queryClient.getQueryData<T>(['batch-item', id]);
    if (cached) return cached;

    // Add to pending batch
    pendingIds.current.add(id);

    // Create promise for this ID
    const promise = new Promise<T>((resolve, reject) => {
      resolvers.current.set(id, { resolve, reject });
    });

    // Schedule batch execution
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    if (pendingIds.current.size >= maxBatchSize) {
      executeBatch();
    } else {
      batchTimeout.current = setTimeout(executeBatch, batchDelay);
    }

    return promise;
  }, [queryClient, maxBatchSize, batchDelay, executeBatch]);

  const prefetchIds = useCallback((ids: string[]) => {
    for (const id of ids) {
      if (!queryClient.getQueryData(['batch-item', id])) {
        pendingIds.current.add(id);
      }
    }
    
    if (pendingIds.current.size > 0) {
      executeBatch();
    }
  }, [queryClient, executeBatch]);

  return {
    getById,
    prefetchIds,
    isLoading: pendingIds.current.size > 0,
  };
}

// ============================================================================
// Search with Debounce Hook
// ============================================================================

interface UseSearchOptions<T> {
  debounceMs?: number;
  minLength?: number;
  staleTime?: number;
}

/**
 * Hook for debounced search queries
 * 
 * @example
 * const { query, setQuery, results, isSearching } = useSearch<Contract>(
 *   '/api/contracts/search',
 *   { debounceMs: 300, minLength: 2 }
 * );
 */
export function useSearch<T>(
  searchUrl: string,
  options: UseSearchOptions<T> = {}
) {
  const { debounceMs = 300, minLength = 1, staleTime = 60000 } = options;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const searchQuery = useQuery({
    queryKey: ['search', searchUrl, debouncedQuery],
    queryFn: () => enhancedFetch<T[]>(`${searchUrl}?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= minLength,
    staleTime,
  });

  return {
    query,
    setQuery,
    results: searchQuery.data ?? [],
    isSearching: searchQuery.isFetching,
    isLoading: searchQuery.isLoading,
    error: searchQuery.error,
    clear: () => setQuery(''),
  };
}

// ============================================================================
// Optimistic List Hook
// ============================================================================

interface UseOptimisticListOptions<T> {
  queryKey: QueryKey;
  idField?: keyof T;
}

/**
 * Hook for managing lists with optimistic updates
 * 
 * @example
 * const list = useOptimisticList<Contract>({
 *   queryKey: ['contracts']
 * });
 * 
 * list.optimisticAdd({ id: 'temp', title: 'New Contract' });
 * list.optimisticRemove('contract-123');
 * list.optimisticUpdate('contract-123', { status: 'approved' });
 */
export function useOptimisticList<T extends { id: string }>({
  queryKey,
  idField = 'id' as keyof T,
}: UseOptimisticListOptions<T>) {
  const queryClient = useQueryClient();

  const optimisticAdd = useCallback((item: T) => {
    queryClient.setQueryData<T[]>(queryKey, (old = []) => [...old, item]);
    return () => {
      queryClient.setQueryData<T[]>(queryKey, (old = []) => 
        old.filter(i => i[idField] !== item[idField])
      );
    };
  }, [queryClient, queryKey, idField]);

  const optimisticRemove = useCallback((id: string) => {
    const previous = queryClient.getQueryData<T[]>(queryKey);
    queryClient.setQueryData<T[]>(queryKey, (old = []) => 
      old.filter(i => String(i[idField]) !== id)
    );
    return () => {
      queryClient.setQueryData(queryKey, previous);
    };
  }, [queryClient, queryKey, idField]);

  const optimisticUpdate = useCallback((id: string, updates: Partial<T>) => {
    const previous = queryClient.getQueryData<T[]>(queryKey);
    queryClient.setQueryData<T[]>(queryKey, (old = []) => 
      old.map(i => String(i[idField]) === id ? { ...i, ...updates } : i)
    );
    return () => {
      queryClient.setQueryData(queryKey, previous);
    };
  }, [queryClient, queryKey, idField]);

  return {
    optimisticAdd,
    optimisticRemove,
    optimisticUpdate,
  };
}
