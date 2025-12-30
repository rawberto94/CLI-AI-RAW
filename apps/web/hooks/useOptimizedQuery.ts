/**
 * Optimized React Query hooks with proper caching and stale time
 * Improves performance by reducing unnecessary refetches
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

// Default query configuration for better performance
export const defaultQueryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for this long
  gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
  refetchOnWindowFocus: false, // Don't refetch on every tab switch
  refetchOnReconnect: true, // Do refetch when internet reconnects
  retry: 3, // Retry failed requests 3 times
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
};

// Frequently changing data (real-time updates)
export const realtimeQueryConfig = {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 2 * 60 * 1000, // 2 minutes
  refetchOnWindowFocus: true,
  refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
};

// Static data (rarely changes)
export const staticQueryConfig = {
  staleTime: 60 * 60 * 1000, // 1 hour
  gcTime: 24 * 60 * 60 * 1000, // 24 hours
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};

// Infinite query config for pagination
export const infiniteQueryConfig = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  gcTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
  getNextPageParam: (lastPage: any, pages: any[]) => lastPage.nextCursor,
  initialPageParam: undefined as string | undefined,
};

/**
 * Hook for optimized data fetching with automatic caching
 */
export function useOptimizedQuery<TData = unknown, TError = Error>(
  key: readonly unknown[],
  fetcher: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery<TData, TError>({
    queryKey: key,
    queryFn: fetcher,
    ...defaultQueryConfig,
    ...options,
  } as UseQueryOptions<TData, TError>);
}

/**
 * Hook for real-time data that needs frequent updates
 */
export function useRealtimeQuery<TData = unknown, TError = Error>(
  key: readonly unknown[],
  fetcher: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery<TData, TError>({
    queryKey: key,
    queryFn: fetcher,
    ...realtimeQueryConfig,
    ...options,
  } as UseQueryOptions<TData, TError>);
}

/**
 * Hook for static/infrequently changing data
 */
export function useStaticQuery<TData = unknown, TError = Error>(
  key: readonly unknown[],
  fetcher: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, TError>>
) {
  return useQuery<TData, TError>({
    queryKey: key,
    queryFn: fetcher,
    ...staticQueryConfig,
    ...options,
  } as UseQueryOptions<TData, TError>);
}

/**
 * Hook for optimized mutations with automatic cache invalidation
 */
export function useOptimizedMutation<TData = unknown, TError = Error, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: TError, variables: TVariables) => void;
    invalidateKeys?: readonly unknown[][];
    optimisticUpdate?: {
      queryKey: readonly unknown[];
      updater: (oldData: any, variables: TVariables) => any;
    };
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables>({
    mutationFn,
    onMutate: async (variables) => {
      // Optimistic update
      if (options?.optimisticUpdate) {
        await queryClient.cancelQueries({ queryKey: options.optimisticUpdate.queryKey });
        const previousData = queryClient.getQueryData(options.optimisticUpdate.queryKey);
        queryClient.setQueryData(
          options.optimisticUpdate.queryKey,
          (old: any) => options.optimisticUpdate!.updater(old, variables)
        );
        return { previousData };
      }
    },
    onError: (error, variables, context: any) => {
      // Rollback optimistic update on error
      if (options?.optimisticUpdate && context?.previousData) {
        queryClient.setQueryData(options.optimisticUpdate.queryKey, context.previousData);
      }
      options?.onError?.(error, variables);
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data, variables);
    },
  });
}

/**
 * Hook for prefetching data
 */
export function usePrefetch<TData = unknown>(
  key: readonly unknown[],
  fetcher: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData, Error>>
) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: fetcher,
      ...defaultQueryConfig,
      ...options,
    } as any);
  };
}

// Export types
export type { UseQueryOptions };
