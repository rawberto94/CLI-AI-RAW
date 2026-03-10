'use client';

import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { setGlobalQueryClient } from './propagation';
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner';

// Lazy load devtools to reduce initial memory footprint
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then(mod => ({ default: mod.ReactQueryDevtools }))
);

// =====================
// Query Client Configuration
// =====================

// Define stale time presets for different data types
export const STALE_TIMES = {
  // Static data that rarely changes
  static: 10 * 60 * 1000,      // 10 minutes
  // Semi-dynamic data (templates, workflows)
  semiDynamic: 60 * 1000,      // 1 minute
  // Dynamic data (contracts, approvals)
  dynamic: 30 * 1000,          // 30 seconds
  // Real-time data (dashboard, notifications)
  realtime: 10 * 1000,         // 10 seconds
  // Never stale (force refetch every time)
  never: 0,
  // Infinite - never refetch automatically
  infinite: Infinity,
};

// Query key prefixes for categorization
export const QUERY_CATEGORIES = {
  // Data that should be prefetched on app load
  prefetch: ['dashboard-summary', 'user-preferences', 'notifications'],
  // Data that should persist across sessions
  persist: ['user-preferences', 'recent-contracts', 'saved-filters'],
  // Data that should sync in real-time
  realtime: ['notifications', 'approvals', 'processing-jobs'],
};

// Default options for React Query
const defaultQueryClientOptions = {
  queries: {
    // Data is considered fresh for 30 seconds by default
    staleTime: STALE_TIMES.dynamic,
    // Cache is garbage collected after 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry failed requests 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Only refetch on window focus if data is stale (avoids burst of requests on every alt-tab)
    refetchOnWindowFocus: true,
    // Refetch on reconnect
    refetchOnReconnect: true,
    // Don't refetch on mount if data is fresh
    refetchOnMount: true,
    // Don't throw errors on failed queries (handle in UI)
    throwOnError: false,
    // Enable network mode for better offline support
    networkMode: 'offlineFirst' as const,
    // Use structural sharing for better performance
    structuralSharing: true,
  },
  mutations: {
    // Retry mutations once
    retry: 1,
    // Network mode for mutations - only run when online
    networkMode: 'online' as const,
    // Optimistic updates should not throw
    throwOnError: false,
  },
};

// =====================
// Query Client Singleton
// =====================

let browserQueryClient: QueryClient | undefined;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: defaultQueryClientOptions,
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Skip if the individual mutation has its own onError handler
        if (mutation.options.onError) return;

        const message =
          (error as { status?: number }).status === 401
            ? 'Session expired — please sign in again'
            : error.message || 'Something went wrong';
        toast.error(message);
      },
    }),
  });
}

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return createQueryClient();
  }
  // Browser: reuse the same client
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}

// =====================
// Query Provider Component
// =====================

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a new QueryClient instance for each session to avoid sharing state
  const [queryClient] = useState(() => createQueryClient());
  
  // Set the global query client for the propagation utility
  useEffect(() => {
    setGlobalQueryClient(queryClient);
  }, [queryClient]);
  
  // Prefetch critical data on app mount
  useEffect(() => {
    const prefetchCriticalData = async () => {
      // Prefetch dashboard summary
      queryClient.prefetchQuery({
        queryKey: ['dashboard-summary'],
        queryFn: async () => {
          const tenantId = getTenantId();
          // Skip prefetch if no tenant (user needs to authenticate)
          if (!tenantId || tenantId === 'unknown') {
            return { contracts: [], summary: null };
          }
          const res = await fetch('/api/contracts/summary', {
            headers: { 'x-tenant-id': tenantId },
          });
          // Handle non-JSON responses gracefully
          if (!res.ok) {
            console.warn('[QueryProvider] Dashboard prefetch failed:', res.status);
            return { contracts: [], summary: null };
          }
          return res.json();
        },
        staleTime: STALE_TIMES.realtime,
      });
    };
    
    // Only prefetch if not already in cache
    if (!queryClient.getQueryData(['dashboard-summary'])) {
      prefetchCriticalData();
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

// =====================
// Utility Functions
// =====================

/**
 * Helper to determine if a query should be persisted across sessions
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const keyString = queryKey[0];
  return typeof keyString === 'string' && QUERY_CATEGORIES.persist.includes(keyString);
}

/**
 * Helper to get appropriate stale time for a query key
 */
export function getStaleTimeForQuery(queryKey: readonly unknown[]): number {
  const keyString = queryKey[0];
  
  if (typeof keyString !== 'string') {
    return STALE_TIMES.dynamic;
  }
  
  // Real-time data
  if (QUERY_CATEGORIES.realtime.includes(keyString)) {
    return STALE_TIMES.realtime;
  }
  
  // Static data patterns
  if (keyString.includes('template') || keyString.includes('config')) {
    return STALE_TIMES.semiDynamic;
  }
  
  // Default to dynamic
  return STALE_TIMES.dynamic;
}
