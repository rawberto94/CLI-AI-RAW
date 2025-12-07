/**
 * Monitoring & Activity Query Hooks
 * 
 * React Query hooks for activity feeds, audit logs, and system monitoring
 * with real-time updates support.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { getTenantId } from '@/lib/tenant';

// =====================
// Types
// =====================

export type ActivityType = 
  | 'contract_created'
  | 'contract_updated'
  | 'contract_deleted'
  | 'contract_viewed'
  | 'contract_downloaded'
  | 'contract_approved'
  | 'contract_rejected'
  | 'comment_added'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'user_login'
  | 'settings_changed'
  | 'import_completed'
  | 'export_completed';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  metadata?: Record<string, unknown>;
  timestamp: Date;
  contractId?: string;
  contractName?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  category: 'user' | 'contract' | 'system' | 'security' | 'data' | 'integration';
  actor: {
    id: string;
    name: string;
    email: string;
    type: 'user' | 'system' | 'api';
  };
  resource?: {
    type: string;
    id: string;
    name?: string;
  };
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    latency?: number;
    lastCheck: Date;
  }>;
  metrics: {
    cpu: number;
    memory: number;
    storage: number;
    requestsPerSecond: number;
    activeConnections: number;
  };
}

// =====================
// Query Keys
// =====================

export const monitoringQueryKeys = {
  all: ['monitoring'] as const,
  
  // Activity Feed
  activities: () => [...monitoringQueryKeys.all, 'activities'] as const,
  activitiesByContract: (contractId: string) => 
    [...monitoringQueryKeys.activities(), 'contract', contractId] as const,
  activitiesFiltered: (filters: { type?: string; userId?: string }) => 
    [...monitoringQueryKeys.activities(), 'filtered', filters] as const,
  
  // Audit Logs
  auditLogs: () => [...monitoringQueryKeys.all, 'audit-logs'] as const,
  auditLogsFiltered: (filters: AuditLogFilters) => 
    [...monitoringQueryKeys.auditLogs(), 'filtered', filters] as const,
  
  // System Health
  health: () => [...monitoringQueryKeys.all, 'health'] as const,
  
  // Notifications
  notifications: () => [...monitoringQueryKeys.all, 'notifications'] as const,
  unreadCount: () => [...monitoringQueryKeys.notifications(), 'unread-count'] as const,
};

// =====================
// Filter Types
// =====================

interface AuditLogFilters {
  category?: string;
  success?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
}

interface ActivityFilters {
  type?: ActivityType;
  contractId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

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
// Activity Feed Hooks
// =====================

interface UseActivityFeedOptions {
  contractId?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching activity feed with optional auto-refresh
 */
export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { 
    contractId, 
    maxItems = 50, 
    autoRefresh = false, 
    refreshInterval = 30000,
    enabled = true,
  } = options;

  const queryKey = contractId 
    ? monitoringQueryKeys.activitiesByContract(contractId)
    : monitoringQueryKeys.activities();

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (contractId) params.set('contractId', contractId);
      if (maxItems) params.set('limit', String(maxItems));
      
      const response = await fetchWithTenant<{ activities: ActivityEvent[] }>(
        `/api/activity${params.toString() ? `?${params}` : ''}`
      );
      
      return response.activities.map(a => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    },
    enabled,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10 * 1000, // 10 seconds - activity is dynamic
    select: (data) => ({
      activities: data.slice(0, maxItems),
      total: data.length,
      hasNew: false, // Can be used for "new activity" indicators
    }),
  });
}

/**
 * Hook for infinite scrolling activity feed
 */
export function useInfiniteActivityFeed(options: { contractId?: string; pageSize?: number } = {}) {
  const { contractId, pageSize = 20 } = options;

  return useInfiniteQuery({
    queryKey: [...monitoringQueryKeys.activities(), 'infinite', { contractId }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      if (contractId) params.set('contractId', contractId);
      params.set('page', String(pageParam));
      params.set('pageSize', String(pageSize));
      
      const response = await fetchWithTenant<{ 
        activities: ActivityEvent[]; 
        hasMore: boolean;
        nextPage: number | null;
      }>(`/api/activity?${params}`);
      
      return {
        ...response,
        activities: response.activities.map(a => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })),
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 10 * 1000,
  });
}

// =====================
// Audit Log Hooks
// =====================

interface UseAuditLogsOptions {
  filters?: AuditLogFilters;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching audit logs with filtering
 */
export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { filters = {}, pageSize = 100, enabled = true } = options;

  return useQuery({
    queryKey: monitoringQueryKeys.auditLogsFiltered(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.success !== undefined) params.set('success', String(filters.success));
      if (filters.search) params.set('search', filters.search);
      if (filters.startDate) params.set('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.set('endDate', filters.endDate.toISOString());
      if (filters.actorId) params.set('actorId', filters.actorId);
      params.set('limit', String(pageSize));

      const response = await fetchWithTenant<{ logs: AuditLogEntry[] }>(
        `/api/audit/logs?${params}`
      );
      
      return response.logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp),
      }));
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => ({
      logs: data,
      total: data.length,
      byCategory: data.reduce((acc, log) => {
        acc[log.category] = (acc[log.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      successRate: data.length > 0 
        ? (data.filter(l => l.success).length / data.length) * 100 
        : 100,
    }),
  });
}

/**
 * Hook for infinite scrolling audit logs
 */
export function useInfiniteAuditLogs(options: { filters?: AuditLogFilters; pageSize?: number } = {}) {
  const { filters = {}, pageSize = 50 } = options;

  return useInfiniteQuery({
    queryKey: [...monitoringQueryKeys.auditLogs(), 'infinite', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.success !== undefined) params.set('success', String(filters.success));
      if (filters.search) params.set('search', filters.search);
      params.set('page', String(pageParam));
      params.set('pageSize', String(pageSize));

      const response = await fetchWithTenant<{ 
        logs: AuditLogEntry[]; 
        hasMore: boolean;
        nextPage: number | null;
        total: number;
      }>(`/api/audit/logs?${params}`);
      
      return {
        ...response,
        logs: response.logs.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp),
        })),
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for exporting audit logs
 */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.startDate) params.set('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.set('endDate', filters.endDate.toISOString());
      
      const response = await fetch(`/api/audit/logs/export?${params}`, {
        headers: { 'x-tenant-id': getTenantId() },
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      return { success: true };
    },
  });
}

// =====================
// System Health Hooks
// =====================

interface UseSystemHealthOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Hook for monitoring system health
 */
export function useSystemHealth(options: UseSystemHealthOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  return useQuery({
    queryKey: monitoringQueryKeys.health(),
    queryFn: () => fetchWithTenant<SystemHealth>('/api/health'),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10 * 1000,
    select: (data) => ({
      ...data,
      isHealthy: data.status === 'healthy',
      unhealthyServices: data.services.filter(s => s.status !== 'healthy'),
      avgLatency: data.services.reduce((sum, s) => sum + (s.latency || 0), 0) / data.services.length,
    }),
  });
}

// =====================
// Notification Hooks (for activity-related notifications)
// =====================

export interface ActivityNotification {
  id: string;
  type: 'activity' | 'alert' | 'reminder' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  activityId?: string;
  link?: string;
}

/**
 * Hook for fetching notifications
 */
export function useActivityNotifications() {
  return useQuery({
    queryKey: monitoringQueryKeys.notifications(),
    queryFn: async () => {
      const response = await fetchWithTenant<{ notifications: ActivityNotification[] }>(
        '/api/notifications'
      );
      return response.notifications.map(n => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000, // Check for new notifications every 30s
  });
}

/**
 * Hook for getting unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: monitoringQueryKeys.unreadCount(),
    queryFn: async () => {
      const response = await fetchWithTenant<{ count: number }>('/api/notifications/unread-count');
      return response.count;
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Hook for marking notifications as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      fetchWithTenant(`/api/notifications/${notificationId}/read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.unreadCount() });
    },
  });
}

/**
 * Hook for marking all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchWithTenant('/api/notifications/read-all', { method: 'POST' }),
    onMutate: async () => {
      // Optimistically update
      await queryClient.cancelQueries({ queryKey: monitoringQueryKeys.notifications() });
      queryClient.setQueryData(monitoringQueryKeys.unreadCount(), 0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.notifications() });
    },
  });
}

// =====================
// Prefetching & Invalidation
// =====================

export function usePrefetchMonitoring() {
  const queryClient = useQueryClient();

  return {
    prefetchActivities: () => {
      queryClient.prefetchQuery({
        queryKey: monitoringQueryKeys.activities(),
        queryFn: async () => {
          const response = await fetchWithTenant<{ activities: ActivityEvent[] }>('/api/activity');
          return response.activities.map(a => ({ ...a, timestamp: new Date(a.timestamp) }));
        },
        staleTime: 10 * 1000,
      });
    },
    prefetchAuditLogs: () => {
      queryClient.prefetchQuery({
        queryKey: monitoringQueryKeys.auditLogsFiltered({}),
        queryFn: async () => {
          const response = await fetchWithTenant<{ logs: AuditLogEntry[] }>('/api/audit/logs');
          return response.logs.map(log => ({ ...log, timestamp: new Date(log.timestamp) }));
        },
        staleTime: 30 * 1000,
      });
    },
    prefetchHealth: () => {
      queryClient.prefetchQuery({
        queryKey: monitoringQueryKeys.health(),
        queryFn: () => fetchWithTenant<SystemHealth>('/api/health'),
        staleTime: 10 * 1000,
      });
    },
  };
}

export function useMonitoringInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.all });
    },
    invalidateActivities: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.activities() });
    },
    invalidateAuditLogs: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.auditLogs() });
    },
    invalidateHealth: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.health() });
    },
    invalidateNotifications: () => {
      queryClient.invalidateQueries({ queryKey: monitoringQueryKeys.notifications() });
    },
  };
}
