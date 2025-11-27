'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

// Default options for React Query
const defaultQueryClientOptions = {
  queries: {
    // Data is considered fresh for 30 seconds
    staleTime: 30 * 1000,
    // Cache is garbage collected after 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry failed requests 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch on window focus for fresh data
    refetchOnWindowFocus: true,
    // Refetch on reconnect
    refetchOnReconnect: true,
  },
  mutations: {
    // Retry mutations once
    retry: 1,
  },
};

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a new QueryClient instance for each session to avoid sharing state
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: defaultQueryClientOptions })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}

// Export a singleton for server-side usage
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return new QueryClient({ defaultOptions: defaultQueryClientOptions });
  }
  // Browser: reuse the same client
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({ defaultOptions: defaultQueryClientOptions });
  }
  return browserQueryClient;
}
