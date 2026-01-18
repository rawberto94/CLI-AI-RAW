/**
 * Prefetching Utilities
 * 
 * Pre-load data on hover/focus for instant navigation.
 * This makes the app feel significantly faster.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { queryKeys } from './use-queries';
import { getTenantId } from '@/lib/tenant';

// =====================
// Types
// =====================

type PrefetchableResource = 
  | 'contract'
  | 'template'
  | 'workflow'
  | 'dashboard'
  | 'taxonomy'
  | 'rateCards'
  | 'analytics';

interface PrefetchOptions {
  staleTime?: number;
  debounce?: number;
}

// =====================
// Fetch Functions
// =====================

async function fetchWithTenant<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': getTenantId(),
      'x-data-mode': 'real',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// =====================
// Prefetch Hook
// =====================

/**
 * Hook for prefetching data on hover/focus
 * 
 * @example
 * const { prefetch, prefetchOnHover } = usePrefetch();
 * 
 * // Manually prefetch
 * prefetch('contract', 'abc123');
 * 
 * // Attach to element
 * <Link {...prefetchOnHover('contract', contractId)}>View Contract</Link>
 */
export function usePrefetch(options: PrefetchOptions = {}) {
  const queryClient = useQueryClient();
  const { staleTime = 30000, debounce = 100 } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Prefetch a specific resource
   */
  const prefetch = useCallback(
    async (resource: PrefetchableResource, id?: string) => {
      switch (resource) {
        case 'contract':
          if (id) {
            await queryClient.prefetchQuery({
              queryKey: queryKeys.contracts.detail(id),
              queryFn: () => fetchWithTenant(`/api/contracts/${id}`),
              staleTime,
            });
          }
          break;

        case 'template':
          if (id) {
            await queryClient.prefetchQuery({
              queryKey: queryKeys.templates.detail(id),
              queryFn: () => fetchWithTenant(`/api/templates/${id}`),
              staleTime,
            });
          }
          break;

        case 'workflow':
          if (id) {
            await queryClient.prefetchQuery({
              queryKey: queryKeys.workflows.detail(id),
              queryFn: () => fetchWithTenant(`/api/workflows/${id}`),
              staleTime,
            });
          }
          break;

        case 'dashboard':
          await Promise.all([
            queryClient.prefetchQuery({
              queryKey: ['dashboard-stats'],
              queryFn: () => fetchWithTenant('/api/dashboard/stats'),
              staleTime,
            }),
            queryClient.prefetchQuery({
              queryKey: ['pending-approvals'],
              queryFn: () => fetchWithTenant('/api/approvals/pending?limit=5'),
              staleTime,
            }),
          ]);
          break;

        case 'taxonomy':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.taxonomy.tree(),
            queryFn: () => fetchWithTenant('/api/taxonomy?format=tree'),
            staleTime,
          });
          break;

        case 'rateCards':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.rateCards.lists(),
            queryFn: () => fetchWithTenant('/api/rate-cards'),
            staleTime,
          });
          break;

        case 'analytics':
          await queryClient.prefetchQuery({
            queryKey: queryKeys.analytics.dashboard(),
            queryFn: () => fetchWithTenant('/api/analytics/dashboard'),
            staleTime,
          });
          break;
      }
    },
    [queryClient, staleTime]
  );

  /**
   * Debounced prefetch to avoid excessive requests
   */
  const prefetchDebounced = useCallback(
    (resource: PrefetchableResource, id?: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        prefetch(resource, id);
      }, debounce);
    },
    [prefetch, debounce]
  );

  /**
   * Cancel pending prefetch
   */
  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Returns props to attach to an element for hover prefetching
   */
  const prefetchOnHover = useCallback(
    (resource: PrefetchableResource, id?: string) => ({
      onMouseEnter: () => prefetchDebounced(resource, id),
      onFocus: () => prefetchDebounced(resource, id),
      onMouseLeave: cancelPrefetch,
      onBlur: cancelPrefetch,
    }),
    [prefetchDebounced, cancelPrefetch]
  );

  return {
    prefetch,
    prefetchDebounced,
    prefetchOnHover,
    cancelPrefetch,
  };
}

// =====================
// Route Prefetching
// =====================

/**
 * Prefetch data for common navigation patterns
 */
export function usePrefetchRoutes() {
  const { prefetch } = usePrefetch();

  const prefetchContractPage = useCallback(
    (contractId: string) => {
      prefetch('contract', contractId);
    },
    [prefetch]
  );

  const prefetchDashboard = useCallback(() => {
    prefetch('dashboard');
  }, [prefetch]);

  const prefetchSettings = useCallback(() => {
    prefetch('taxonomy');
  }, [prefetch]);

  const prefetchAnalytics = useCallback(() => {
    prefetch('analytics');
    prefetch('rateCards');
  }, [prefetch]);

  return {
    prefetchContractPage,
    prefetchDashboard,
    prefetchSettings,
    prefetchAnalytics,
  };
}

// =====================
// Prefetch Link Component Helper
// =====================

/**
 * Helper to create prefetch-enabled link props
 * 
 * @example
 * const linkProps = createPrefetchLinkProps('contract', contractId);
 * <Link href={`/contracts/${contractId}`} {...linkProps}>View</Link>
 */
export function createPrefetchLinkProps(
  resource: PrefetchableResource,
  id?: string,
  options: PrefetchOptions = {}
) {
  const { staleTime = 30000 } = options;
  let timeoutId: NodeJS.Timeout | null = null;

  return {
    onMouseEnter: () => {
      timeoutId = setTimeout(async () => {
        // This is a static version - for dynamic use, use the usePrefetch hook
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getGlobalQueryClient } = require('@/lib/query-client');
        const queryClient = getGlobalQueryClient();
        if (!queryClient) return;

        switch (resource) {
          case 'contract':
            if (id) {
              queryClient.prefetchQuery({
                queryKey: queryKeys.contracts.detail(id),
                queryFn: () => fetchWithTenant(`/api/contracts/${id}`),
                staleTime,
              });
            }
            break;
          case 'dashboard':
            queryClient.prefetchQuery({
              queryKey: ['dashboard-stats'],
              queryFn: () => fetchWithTenant('/api/dashboard/stats'),
              staleTime,
            });
            break;
        }
      }, 100);
    },
    onMouseLeave: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
