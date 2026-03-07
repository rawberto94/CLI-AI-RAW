/**
 * Saved Items Query Hooks
 * 
 * React Query hooks for saved filters, comparisons, and user preferences
 * with optimistic updates for instant UI feedback.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTenantId } from '@/lib/tenant';

// =====================
// Types
// =====================

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: Record<string, unknown>;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedComparison {
  id: string;
  name: string;
  description?: string;
  comparisonType: string;
  isShared: boolean;
  createdAt: string;
  rateCardEntries: Array<{
    rateCardEntry: {
      id: string;
      supplierName: string;
      roleStandardized: string;
      dailyRateUSD: number;
    };
  }>;
}

// =====================
// Query Keys
// =====================

export const savedItemsQueryKeys = {
  all: ['saved-items'] as const,
  
  // Saved Filters
  filters: () => [...savedItemsQueryKeys.all, 'filters'] as const,
  filterById: (id: string) => [...savedItemsQueryKeys.filters(), id] as const,
  
  // Saved Comparisons
  comparisons: () => [...savedItemsQueryKeys.all, 'comparisons'] as const,
  comparisonById: (id: string) => [...savedItemsQueryKeys.comparisons(), id] as const,
};

// =====================
// Fetch Helpers
// =====================

async function fetchWithTenant<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': getTenantId(),
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// =====================
// Saved Filters Hooks
// =====================

interface UseSavedFiltersQueryOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching saved filters list
 */
export function useSavedFiltersQuery(options: UseSavedFiltersQueryOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: savedItemsQueryKeys.filters(),
    queryFn: async () => {
      const response = await fetchWithTenant<{ filters: SavedFilter[] }>('/api/rate-cards/filters');
      return response.filters;
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: [],
  });
}

/**
 * Hook for deleting a saved filter with optimistic update
 */
export function useDeleteSavedFilterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filterId: string) =>
      fetchWithTenant(`/api/rate-cards/filters/${filterId}`, { method: 'DELETE' }),
    onMutate: async (filterId) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKeys.filters() });
      const previous = queryClient.getQueryData<SavedFilter[]>(savedItemsQueryKeys.filters());
      queryClient.setQueryData<SavedFilter[]>(savedItemsQueryKeys.filters(), (old) =>
        old?.filter((f) => f.id !== filterId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(savedItemsQueryKeys.filters(), context.previous);
      }
      toast.error('Failed to delete filter');
    },
    onSuccess: () => {
      toast.success('Filter deleted successfully');
    },
  });
}

/**
 * Hook for sharing a saved filter with optimistic update
 */
export function useShareFilterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filterId: string) =>
      fetchWithTenant(`/api/rate-cards/filters/${filterId}/share`, { method: 'POST' }),
    onMutate: async (filterId) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKeys.filters() });
      const previous = queryClient.getQueryData<SavedFilter[]>(savedItemsQueryKeys.filters());
      queryClient.setQueryData<SavedFilter[]>(savedItemsQueryKeys.filters(), (old) =>
        old?.map((f) => (f.id === filterId ? { ...f, isShared: true } : f)) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(savedItemsQueryKeys.filters(), context.previous);
      }
      toast.error('Failed to share filter');
    },
    onSuccess: () => {
      toast.success('Filter shared with team');
    },
  });
}

// =====================
// Saved Comparisons Hooks
// =====================

interface UseSavedComparisonsQueryOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching saved comparisons list
 */
export function useSavedComparisonsQuery(options: UseSavedComparisonsQueryOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: savedItemsQueryKeys.comparisons(),
    queryFn: async () => {
      const response = await fetchWithTenant<{ comparisons: SavedComparison[] }>('/api/rate-cards/comparisons');
      return response.comparisons;
    },
    enabled,
    staleTime: 30 * 1000,
    placeholderData: [],
  });
}

/**
 * Hook for fetching a single comparison by ID
 */
export function useSavedComparisonQuery(comparisonId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: savedItemsQueryKeys.comparisonById(comparisonId),
    queryFn: () => fetchWithTenant<SavedComparison>(`/api/rate-cards/comparisons/${comparisonId}`),
    enabled: !!comparisonId && options?.enabled !== false,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for deleting a saved comparison with optimistic update
 */
export function useDeleteComparisonMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comparisonId: string) =>
      fetchWithTenant(`/api/rate-cards/comparisons/${comparisonId}`, { method: 'DELETE' }),
    onMutate: async (comparisonId) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKeys.comparisons() });
      const previous = queryClient.getQueryData<SavedComparison[]>(savedItemsQueryKeys.comparisons());
      queryClient.setQueryData<SavedComparison[]>(savedItemsQueryKeys.comparisons(), (old) =>
        old?.filter((c) => c.id !== comparisonId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(savedItemsQueryKeys.comparisons(), context.previous);
      }
      toast.error('Failed to delete comparison');
    },
    onSuccess: () => {
      toast.success('Comparison deleted successfully');
    },
  });
}

/**
 * Hook for sharing a comparison with optimistic update
 */
export function useShareComparisonMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comparisonId: string) => {
      const response = await fetchWithTenant<{ shareUrl: string }>(
        `/api/rate-cards/comparisons/${comparisonId}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ isShared: true }),
        }
      );
      return response;
    },
    onMutate: async (comparisonId) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKeys.comparisons() });
      const previous = queryClient.getQueryData<SavedComparison[]>(savedItemsQueryKeys.comparisons());
      queryClient.setQueryData<SavedComparison[]>(savedItemsQueryKeys.comparisons(), (old) =>
        old?.map((c) => (c.id === comparisonId ? { ...c, isShared: true } : c)) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(savedItemsQueryKeys.comparisons(), context.previous);
      }
      toast.error('Failed to share comparison');
    },
    onSuccess: (data) => {
      // Copy share URL to clipboard
      if (data.shareUrl && typeof navigator !== 'undefined') {
        navigator.clipboard.writeText(window.location.origin + data.shareUrl);
        toast.success('Share link copied to clipboard!');
      } else {
        toast.success('Comparison shared');
      }
    },
  });
}

// =====================
// Invalidation Helpers
// =====================

export function useSavedItemsInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: savedItemsQueryKeys.all });
    },
    invalidateFilters: () => {
      queryClient.invalidateQueries({ queryKey: savedItemsQueryKeys.filters() });
    },
    invalidateComparisons: () => {
      queryClient.invalidateQueries({ queryKey: savedItemsQueryKeys.comparisons() });
    },
  };
}
