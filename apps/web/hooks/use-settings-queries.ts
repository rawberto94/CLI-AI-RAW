/**
 * Settings Query Hooks
 * 
 * React Query hooks for settings data fetching with caching
 * and proper loading states.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrapApiResponseData } from '@/lib/api-fetch';
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

interface WebhookApiRecord {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
  lastDeliveryAt?: string | null;
  failureCount: number;
}

interface ApiKeyApiRecord {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at?: string | null;
  created_at: string;
}

function mapWebhook(record: WebhookApiRecord): WebhookConfig {
  return {
    id: record.id,
    name: record.name,
    url: record.url,
    events: record.events,
    isActive: record.isActive,
    secret: record.secret,
    createdAt: record.createdAt,
    lastTriggeredAt: record.lastDeliveryAt || undefined,
    lastStatus: record.lastDeliveryAt ? (record.failureCount > 0 ? 'failed' : 'success') : undefined,
    failureCount: record.failureCount,
  };
}

function mapApiKey(record: ApiKeyApiRecord): ApiKeyConfig {
  return {
    id: record.id,
    name: record.name,
    prefix: record.key_prefix,
    permissions: record.scopes,
    createdAt: record.created_at,
    isActive: record.is_active,
    lastUsed: record.last_used_at || undefined,
  };
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
  
  return unwrapApiResponseData<T>(await response.json());
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
      const response = await fetchWithTenant<WebhookApiRecord[]>('/api/webhooks');
      return response.map(mapWebhook);
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
      const response = await fetchWithTenant<{ apiKeys: ApiKeyApiRecord[] }>('/api/admin/api-keys');
      return (response.apiKeys || []).map(mapApiKey);
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
          const response = await fetchWithTenant<WebhookApiRecord[]>('/api/webhooks');
          return response.map(mapWebhook);
        },
        staleTime: 30 * 1000,
      });
    },
    prefetchApiKeys: () => {
      queryClient.prefetchQuery({
        queryKey: ['api-keys'],
        queryFn: async () => {
          const response = await fetchWithTenant<{ apiKeys: ApiKeyApiRecord[] }>('/api/admin/api-keys');
          return (response.apiKeys || []).map(mapApiKey);
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
