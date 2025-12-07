/**
 * Optimistic Mutation Hooks
 * 
 * Pre-built mutation hooks with optimistic updates for instant UI feedback.
 * These hooks update the UI immediately, then sync with the server.
 */

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTenantId } from '@/lib/tenant';
import { queryKeys } from './use-queries';
import { useCrossModuleInvalidation } from './use-queries';

// =====================
// Types
// =====================

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  updateFn: (old: unknown, variables: TVariables) => unknown;
  successMessage?: string;
  errorMessage?: string;
  onSuccessInvalidate?: QueryKey[];
  propagate?: () => void;
}

interface ApiKeyData {
  id: string;
  name: string;
  key?: string;
  prefix?: string;
  permissions: string[];
  createdAt: string;
  isActive: boolean;
  lastUsed?: string;
}

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
  lastTriggered?: string;
}

interface RiskFlag {
  id: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  contractId?: string;
  createdAt: string;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  isShared: boolean;
  createdAt: string;
}

interface SavedComparison {
  id: string;
  name: string;
  contractIds: string[];
  createdAt: string;
}

// =====================
// Helper Functions
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
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Generic optimistic mutation factory
 * Creates mutations that update UI instantly, then sync with server
 */
export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  updateFn,
  successMessage,
  errorMessage = 'Operation failed',
  onSuccessInvalidate = [],
  propagate,
}: OptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    // Optimistically update before server responds
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot current value
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update
      queryClient.setQueryData(queryKey, (old: unknown) => updateFn(old, variables));
      
      // Return context with snapshot
      return { previousData };
    },
    // Rollback on error
    onError: (err, _variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(errorMessage);
      console.error('Mutation error:', err);
    },
    // Invalidate and show success
    onSuccess: () => {
      if (successMessage) {
        toast.success(successMessage);
      }
      // Invalidate related queries
      onSuccessInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      // Trigger cross-module propagation
      if (propagate) {
        propagate();
      }
    },
    // Always refetch after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// =====================
// Settings Hooks
// =====================

/**
 * API Keys management with optimistic updates
 */
export function useApiKeys() {
  return {
    delete: useDeleteApiKey(),
    toggle: useToggleApiKey(),
    create: useCreateApiKey(),
  };
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();

  return useMutation({
    mutationFn: (keyId: string) => 
      fetchWithTenant(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' }),
    onMutate: async (keyId) => {
      await queryClient.cancelQueries({ queryKey: ['api-keys'] });
      const previous = queryClient.getQueryData<ApiKeyData[]>(['api-keys']);
      queryClient.setQueryData<ApiKeyData[]>(['api-keys'], (old) => 
        old?.filter(k => k.id !== keyId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['api-keys'], context.previous);
      }
      toast.error('Failed to delete API key');
    },
    onSuccess: () => {
      toast.success('API key deleted');
      crossModule.onIntegrationChange();
    },
  });
}

export function useToggleApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ keyId, isActive }: { keyId: string; isActive: boolean }) => 
      fetchWithTenant(`/api/settings/api-keys/${keyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onMutate: async ({ keyId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['api-keys'] });
      const previous = queryClient.getQueryData<ApiKeyData[]>(['api-keys']);
      queryClient.setQueryData<ApiKeyData[]>(['api-keys'], (old) => 
        old?.map(k => k.id === keyId ? { ...k, isActive } : k) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['api-keys'], context.previous);
      }
      toast.error('Failed to update API key');
    },
    onSuccess: (_, { isActive }) => {
      toast.success(`API key ${isActive ? 'activated' : 'deactivated'}`);
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; permissions: string[] }) => 
      fetchWithTenant<{ apiKey: ApiKeyData }>('/api/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key created');
      return response.apiKey;
    },
    onError: () => {
      toast.error('Failed to create API key');
    },
  });
}

/**
 * Webhooks management with optimistic updates
 */
export function useWebhooks() {
  return {
    delete: useDeleteWebhook(),
    toggle: useToggleWebhook(),
    create: useCreateWebhook(),
    test: useTestWebhook(),
  };
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();

  return useMutation({
    mutationFn: (webhookId: string) => 
      fetchWithTenant(`/api/settings/webhooks/${webhookId}`, { method: 'DELETE' }),
    onMutate: async (webhookId) => {
      await queryClient.cancelQueries({ queryKey: ['webhooks'] });
      const previous = queryClient.getQueryData<WebhookData[]>(['webhooks']);
      queryClient.setQueryData<WebhookData[]>(['webhooks'], (old) => 
        old?.filter(w => w.id !== webhookId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['webhooks'], context.previous);
      }
      toast.error('Failed to delete webhook');
    },
    onSuccess: () => {
      toast.success('Webhook deleted');
      crossModule.onIntegrationChange();
    },
  });
}

export function useToggleWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) => 
      fetchWithTenant(`/api/settings/webhooks/${webhookId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onMutate: async ({ webhookId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['webhooks'] });
      const previous = queryClient.getQueryData<WebhookData[]>(['webhooks']);
      queryClient.setQueryData<WebhookData[]>(['webhooks'], (old) => 
        old?.map(w => w.id === webhookId ? { ...w, isActive } : w) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['webhooks'], context.previous);
      }
      toast.error('Failed to update webhook');
    },
    onSuccess: (_, { isActive }) => {
      toast.success(`Webhook ${isActive ? 'enabled' : 'disabled'}`);
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<WebhookData>) => 
      fetchWithTenant<{ webhook: WebhookData }>('/api/settings/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook created');
    },
    onError: () => {
      toast.error('Failed to create webhook');
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ webhookId, ...data }: { webhookId: string } & Partial<WebhookData>) => 
      fetchWithTenant<{ webhook: WebhookData }>(`/api/settings/webhooks/${webhookId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onMutate: async ({ webhookId, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ['webhooks'] });
      const previous = queryClient.getQueryData<WebhookData[]>(['webhooks']);
      queryClient.setQueryData<WebhookData[]>(['webhooks'], (old) => 
        old?.map(w => w.id === webhookId ? { ...w, ...data } : w) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['webhooks'], context.previous);
      }
      toast.error('Failed to update webhook');
    },
    onSuccess: () => {
      toast.success('Webhook updated');
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (webhookId: string) => 
      fetchWithTenant(`/api/settings/webhooks/${webhookId}/test`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Test webhook sent');
    },
    onError: () => {
      toast.error('Webhook test failed');
    },
  });
}

// =====================
// Governance Hooks
// =====================

/**
 * Risk flags management with optimistic updates
 */
export function useRiskFlags() {
  return {
    resolve: useResolveRiskFlag(),
    dismiss: useDismissRiskFlag(),
    bulkResolve: useBulkResolveFlags(),
  };
}

export function useResolveRiskFlag() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();

  return useMutation({
    mutationFn: (flagId: string) => 
      fetchWithTenant(`/api/governance/flags/${flagId}/resolve`, { method: 'POST' }),
    onMutate: async (flagId) => {
      await queryClient.cancelQueries({ queryKey: ['risk-flags'] });
      const previous = queryClient.getQueryData<RiskFlag[]>(['risk-flags']);
      queryClient.setQueryData<RiskFlag[]>(['risk-flags'], (old) => 
        old?.map(f => f.id === flagId ? { ...f, status: 'resolved' } : f) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['risk-flags'], context.previous);
      }
      toast.error('Failed to resolve flag');
    },
    onSuccess: () => {
      toast.success('Flag resolved');
      crossModule.onDashboardChange();
    },
  });
}

export function useDismissRiskFlag() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();

  return useMutation({
    mutationFn: (flagId: string) => 
      fetchWithTenant(`/api/governance/flags/${flagId}/dismiss`, { method: 'POST' }),
    onMutate: async (flagId) => {
      await queryClient.cancelQueries({ queryKey: ['risk-flags'] });
      const previous = queryClient.getQueryData<RiskFlag[]>(['risk-flags']);
      queryClient.setQueryData<RiskFlag[]>(['risk-flags'], (old) => 
        old?.filter(f => f.id !== flagId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['risk-flags'], context.previous);
      }
      toast.error('Failed to dismiss flag');
    },
    onSuccess: () => {
      toast.success('Flag dismissed');
      crossModule.onDashboardChange();
    },
  });
}

export function useBulkResolveFlags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (flagIds: string[]) => 
      fetchWithTenant('/api/governance/flags/bulk-resolve', {
        method: 'POST',
        body: JSON.stringify({ flagIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-flags'] });
      toast.success('Flags resolved');
    },
    onError: () => {
      toast.error('Failed to resolve flags');
    },
  });
}

// =====================
// Rate Cards Hooks
// =====================

/**
 * Saved filters management with optimistic updates
 */
export function useSavedFilters() {
  return {
    delete: useDeleteSavedFilter(),
    share: useShareFilter(),
    create: useCreateFilter(),
  };
}

export function useDeleteSavedFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filterId: string) => 
      fetchWithTenant(`/api/rate-cards/filters/${filterId}`, { method: 'DELETE' }),
    onMutate: async (filterId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-filters'] });
      const previous = queryClient.getQueryData<SavedFilter[]>(['saved-filters']);
      queryClient.setQueryData<SavedFilter[]>(['saved-filters'], (old) => 
        old?.filter(f => f.id !== filterId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['saved-filters'], context.previous);
      }
      toast.error('Failed to delete filter');
    },
    onSuccess: () => {
      toast.success('Filter deleted');
    },
  });
}

export function useShareFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filterId: string) => 
      fetchWithTenant(`/api/rate-cards/filters/${filterId}/share`, { method: 'POST' }),
    onMutate: async (filterId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-filters'] });
      const previous = queryClient.getQueryData<SavedFilter[]>(['saved-filters']);
      queryClient.setQueryData<SavedFilter[]>(['saved-filters'], (old) => 
        old?.map(f => f.id === filterId ? { ...f, isShared: true } : f) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['saved-filters'], context.previous);
      }
      toast.error('Failed to share filter');
    },
    onSuccess: () => {
      toast.success('Filter shared with team');
    },
  });
}

export function useCreateFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; filters: Record<string, unknown> }) => 
      fetchWithTenant<{ filter: SavedFilter }>('/api/rate-cards/filters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
      toast.success('Filter saved');
    },
    onError: () => {
      toast.error('Failed to save filter');
    },
  });
}

/**
 * Saved comparisons management with optimistic updates
 */
export function useSavedComparisons() {
  return {
    delete: useDeleteComparison(),
    create: useCreateComparison(),
  };
}

export function useDeleteComparison() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comparisonId: string) => 
      fetchWithTenant(`/api/rate-cards/comparisons/${comparisonId}`, { method: 'DELETE' }),
    onMutate: async (comparisonId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-comparisons'] });
      const previous = queryClient.getQueryData<SavedComparison[]>(['saved-comparisons']);
      queryClient.setQueryData<SavedComparison[]>(['saved-comparisons'], (old) => 
        old?.filter(c => c.id !== comparisonId) || []
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['saved-comparisons'], context.previous);
      }
      toast.error('Failed to delete comparison');
    },
    onSuccess: () => {
      toast.success('Comparison deleted');
    },
  });
}

export function useCreateComparison() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; contractIds: string[] }) => 
      fetchWithTenant<{ comparison: SavedComparison }>('/api/rate-cards/comparisons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-comparisons'] });
      toast.success('Comparison saved');
    },
    onError: () => {
      toast.error('Failed to save comparison');
    },
  });
}

// =====================
// Contract Health Hooks
// =====================

export function useContractHealth() {
  return {
    refresh: useRefreshHealth(),
    reassess: useReassessContract(),
  };
}

export function useRefreshHealth() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();

  return useMutation({
    mutationFn: () => 
      fetchWithTenant('/api/intelligence/health/refresh', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-health'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      crossModule.onDashboardChange();
      toast.success('Health scores refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh health scores');
    },
  });
}

export function useReassessContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractId: string) => 
      fetchWithTenant(`/api/intelligence/health/${contractId}/reassess`, { method: 'POST' }),
    onSuccess: (_, contractId) => {
      queryClient.invalidateQueries({ queryKey: ['contract-health', contractId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      toast.success('Contract reassessed');
    },
    onError: () => {
      toast.error('Failed to reassess contract');
    },
  });
}
