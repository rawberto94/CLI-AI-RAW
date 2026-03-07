/**
 * Settings Query Hooks
 * 
 * React Query hooks for settings data fetching with caching
 * and proper loading states.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTenantId } from '@/lib/tenant';

// =====================
// Types
// =====================

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
  lastTriggeredAt?: string;
  lastStatus?: 'success' | 'failed';
  failureCount: number;
}

export interface ApiKeyConfig {
  id: string;
  name: string;
  key?: string;
  prefix?: string;
  permissions: string[];
  createdAt: string;
  isActive: boolean;
  lastUsed?: string;
}

// =====================
// Query Keys
// =====================

export const settingsQueryKeys = {
  all: ['settings'] as const,
  webhooks: () => [...settingsQueryKeys.all, 'webhooks'] as const,
  apiKeys: () => [...settingsQueryKeys.all, 'api-keys'] as const,
  integrations: () => [...settingsQueryKeys.all, 'integrations'] as const,
  preferences: () => [...settingsQueryKeys.all, 'preferences'] as const,
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
// Webhooks Hooks
// =====================

interface UseWebhooksQueryOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching webhooks list
 */
export function useWebhooksQuery(options: UseWebhooksQueryOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const response = await fetchWithTenant<{ webhooks: WebhookConfig[] }>('/api/settings/webhooks');
      return response.webhooks;
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    // Provide fallback mock data if API returns error
    placeholderData: [],
  });
}

// =====================
// API Keys Hooks
// =====================

interface UseApiKeysQueryOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching API keys list
 */
export function useApiKeysQuery(options: UseApiKeysQueryOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await fetchWithTenant<{ apiKeys: ApiKeyConfig[] }>('/api/settings/api-keys');
      return response.apiKeys;
    },
    enabled,
    staleTime: 30 * 1000,
    placeholderData: [],
  });
}

// =====================
// Prefetch Helpers
// =====================

export function usePrefetchSettings() {
  const queryClient = useQueryClient();

  return {
    prefetchWebhooks: () => {
      queryClient.prefetchQuery({
        queryKey: ['webhooks'],
        queryFn: async () => {
          const response = await fetchWithTenant<{ webhooks: WebhookConfig[] }>('/api/settings/webhooks');
          return response.webhooks;
        },
        staleTime: 30 * 1000,
      });
    },
    prefetchApiKeys: () => {
      queryClient.prefetchQuery({
        queryKey: ['api-keys'],
        queryFn: async () => {
          const response = await fetchWithTenant<{ apiKeys: ApiKeyConfig[] }>('/api/settings/api-keys');
          return response.apiKeys;
        },
        staleTime: 30 * 1000,
      });
    },
  };
}

// =====================
// Invalidation Helpers
// =====================

export function useSettingsInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
    },
    invalidateWebhooks: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    invalidateApiKeys: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  };
}
