'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiDataOptions<T> {
  initialData?: T;
  refreshInterval?: number; // in ms, 0 = no auto-refresh
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
  lastFetched: Date | null;
}

/**
 * Generic hook for fetching data from APIs with caching, refresh, and error handling
 */
export function useApiData<T>(
  url: string,
  options: UseApiDataOptions<T> = {}
): UseApiDataResult<T> {
  const { initialData, refreshInterval = 0, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const json = await response.json();
      
      if (json.success === false) {
        throw new Error(json.error || 'API request failed');
      }
      
      const resultData = json.data ?? json;
      setData(resultData);
      setLastFetched(new Date());
      setIsStale(false);
      onSuccess?.(resultData);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
        onError?.(err);
      }
    } finally {
      setLoading(false);
    }
  }, [url, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        setIsStale(true);
        fetchData();
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isStale,
    lastFetched,
  };
}

/**
 * Hook for mutations (POST, PUT, DELETE)
 */
interface UseMutationOptions<T, V> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseMutationResult<T, V> {
  mutate: (variables: V) => Promise<T | null>;
  data: T | null;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMutation<T, V = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options: UseMutationOptions<T, V> = {}
): UseMutationResult<T, V> {
  const { onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: V): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(variables),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const json = await response.json();
      
      if (json.success === false) {
        throw new Error(json.error || 'API request failed');
      }
      
      const resultData = json.data ?? json;
      setData(resultData);
      onSuccess?.(resultData);
      return resultData;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, method, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    data,
    loading,
    error,
    reset,
  };
}

/**
 * Hook specifically for dashboard stats with real-time updates
 */
export function useDashboardStats(refreshInterval = 30000) {
  return useApiData<{
    overview: {
      totalContracts: number;
      activeContracts: number;
      portfolioValue: number;
      recentlyAdded: number;
    };
    renewals: {
      expiringIn30Days: number;
      expiringIn90Days: number;
      urgentCount: number;
    };
    breakdown: {
      byStatus: Array<{ status: string; count: number }>;
      byType: Array<{ type: string; count: number }>;
    };
    riskScore: number;
    complianceScore: number;
  }>('/api/dashboard/stats', { refreshInterval });
}

/**
 * Hook for approvals data
 */
export function useApprovals(filters?: { status?: string; priority?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  
  const url = `/api/approvals${params.toString() ? `?${params}` : ''}`;
  
  return useApiData<{
    approvals: any[];
    stats: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      critical: number;
      overdue: number;
    };
  }>(url, { refreshInterval: 60000 });
}

/**
 * Hook for renewals data
 */
export function useRenewals(filters?: { status?: string; daysUntilExpiry?: number }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.daysUntilExpiry) params.set('daysUntilExpiry', String(filters.daysUntilExpiry));
  
  const url = `/api/renewals${params.toString() ? `?${params}` : ''}`;
  
  return useApiData<{
    renewals: any[];
    stats: {
      total: number;
      urgent: number;
      inNegotiation: number;
      autoRenewal: number;
      totalValue: number;
    };
  }>(url, { refreshInterval: 60000 });
}

/**
 * Hook for governance data
 */
export function useGovernance() {
  return useApiData<{
    policies: any[];
    flags: any[];
    stats: {
      activePolicies: number;
      openFlags: number;
      criticalFlags: number;
      totalViolations: number;
    };
  }>('/api/governance', { refreshInterval: 120000 });
}

/**
 * Hook for contract health data
 */
export function useContractHealth(contractId?: string) {
  const url = contractId 
    ? `/api/intelligence/health?contractId=${contractId}` 
    : '/api/intelligence/health';
    
  return useApiData<{
    contracts: any[];
    stats: {
      averageScore: number;
      healthy: number;
      atRisk: number;
      critical: number;
    };
  }>(url, { refreshInterval: 300000 });
}

/**
 * Hook for forecast data
 */
export function useForecast(type?: 'cost' | 'renewal' | 'risk' | 'savings' | 'insights') {
  const url = type ? `/api/forecast?type=${type}` : '/api/forecast';
  
  return useApiData<{
    summary: {
      totalContractValue: number;
      projectedAnnualSpend: number;
      potentialSavings: number;
      riskScore: number;
      upcomingRenewals: number;
    };
    [key: string]: any;
  }>(url, { refreshInterval: 300000 });
}
