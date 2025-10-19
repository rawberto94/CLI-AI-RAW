'use client';

import { useState, useEffect, useCallback } from 'react';

export type DataMode = 'real' | 'mock';
export type ProviderType = 
  | 'rate-benchmarking'
  | 'supplier-analytics'
  | 'negotiation-prep'
  | 'savings-pipeline'
  | 'renewal-radar';

interface UseProcurementIntelligenceOptions {
  module: ProviderType;
  params?: Record<string, any>;
  initialMode?: DataMode;
  autoFetch?: boolean;
}

interface ProcurementIntelligenceResponse<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  mode: DataMode;
  metadata: {
    source: string;
    mode: string;
    lastUpdated: string;
    recordCount?: number;
    confidence?: number;
    description?: string;
  } | null;
  refetch: () => Promise<void>;
  setMode: (mode: DataMode) => void;
  setParams: (params: Record<string, any>) => void;
}

/**
 * Custom hook for fetching procurement intelligence data
 * Supports automatic mode switching and parameter updates
 */
export function useProcurementIntelligence<T = any>({
  module,
  params = {},
  initialMode = 'real',
  autoFetch = true
}: UseProcurementIntelligenceOptions): ProcurementIntelligenceResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DataMode>(initialMode);
  const [currentParams, setCurrentParams] = useState(params);
  const [metadata, setMetadata] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query string
      const queryParams = new URLSearchParams({
        module,
        mode,
        ...currentParams
      });

      const response = await fetch(`/api/analytics/procurement-intelligence?${queryParams}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      setData(result.data);
      setMetadata(result.metadata);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to fetch procurement intelligence data:', err);
    } finally {
      setLoading(false);
    }
  }, [module, mode, currentParams]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [fetchData, autoFetch]);

  const handleSetMode = useCallback((newMode: DataMode) => {
    setMode(newMode);
  }, []);

  const handleSetParams = useCallback((newParams: Record<string, any>) => {
    setCurrentParams(newParams);
  }, []);

  return {
    data,
    loading,
    error,
    mode,
    metadata,
    refetch: fetchData,
    setMode: handleSetMode,
    setParams: handleSetParams
  };
}

/**
 * Hook for checking provider health
 */
export function useProviderHealth() {
  const [health, setHealth] = useState<Record<string, { real: boolean; mock: boolean }> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/procurement-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health-check' })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to check health');
      }

      setHealth(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to check provider health:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    health,
    loading,
    error,
    refetch: checkHealth
  };
}

/**
 * Hook for rate benchmarking data
 */
export function useRateBenchmarking(params?: Record<string, any>, mode: DataMode = 'real') {
  return useProcurementIntelligence({
    module: 'rate-benchmarking',
    params,
    initialMode: mode
  });
}

/**
 * Hook for supplier analytics data
 */
export function useSupplierAnalytics(params?: Record<string, any>, mode: DataMode = 'real') {
  return useProcurementIntelligence({
    module: 'supplier-analytics',
    params,
    initialMode: mode
  });
}

/**
 * Hook for negotiation prep data
 */
export function useNegotiationPrep(params?: Record<string, any>, mode: DataMode = 'real') {
  return useProcurementIntelligence({
    module: 'negotiation-prep',
    params,
    initialMode: mode
  });
}

/**
 * Hook for savings pipeline data
 */
export function useSavingsPipeline(params?: Record<string, any>, mode: DataMode = 'real') {
  return useProcurementIntelligence({
    module: 'savings-pipeline',
    params,
    initialMode: mode
  });
}

/**
 * Hook for renewal radar data
 */
export function useRenewalRadar(params?: Record<string, any>, mode: DataMode = 'real') {
  return useProcurementIntelligence({
    module: 'renewal-radar',
    params,
    initialMode: mode
  });
}
