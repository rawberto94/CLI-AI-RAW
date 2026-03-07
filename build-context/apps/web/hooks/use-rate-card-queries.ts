/**
 * Rate Card Query Hooks
 * 
 * React Query hooks for rate card data fetching with caching,
 * background refetching, and proper loading states.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { getTenantId } from '@/lib/tenant';

// =====================
// Types
// =====================

export interface EmergingTrend {
  type: 'RATE_SPIKE' | 'RATE_DROP' | 'NEW_MARKET' | 'HOT_ROLE' | 'SUPPLIER_ENTRY' | 'SUPPLIER_EXIT';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedRoles?: string[];
  affectedCountries?: string[];
  affectedSuppliers?: string[];
  changePercent?: number;
  detectedAt: Date;
  recommendation: string;
}

export interface TrackingData {
  summary: {
    totalBaselines: number;
    activeBaselines: number;
    totalRateCards: number;
    ratesWithinBaseline: number;
    ratesExceedingBaseline: number;
    achievementRate: number;
    totalSavingsIdentified: number;
    totalSavingsRealized: number;
  };
  byType: Array<{
    type: string;
    count: number;
    avgRate: number;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
  }>;
  topViolations: Array<{
    entryId: string;
    resourceType: string;
    lineOfService: string;
    actualRate: number;
    maxSavings: number;
    comparisons: unknown[];
  }>;
  recentComparisons: unknown[];
}

export interface StrategicRecommendation {
  id: string;
  category: 'COST_REDUCTION' | 'SUPPLIER_OPTIMIZATION' | 'MARKET_POSITIONING' | 'RISK_MITIGATION' | 'PROCESS_IMPROVEMENT';
  title: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
  estimatedSavings?: number;
  affectedRateCards: number;
  actionItems: string[];
}

export interface MarketBenchmark {
  role: string;
  region: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleSize: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

export interface RateCardEntry {
  id: string;
  role: string;
  level: string;
  rate: number;
  currency: string;
  region: string;
  supplier: string;
  effectiveDate: string;
  expiryDate?: string;
}

// =====================
// Query Keys Factory
// =====================

export const rateCardQueryKeys = {
  all: ['rate-cards'] as const,
  
  // Emerging Trends
  trends: () => [...rateCardQueryKeys.all, 'trends'] as const,
  
  // Baseline Tracking
  baselines: () => [...rateCardQueryKeys.all, 'baselines'] as const,
  baselineTracking: () => [...rateCardQueryKeys.baselines(), 'tracking'] as const,
  baselineById: (id: string) => [...rateCardQueryKeys.baselines(), id] as const,
  
  // Strategic Recommendations
  recommendations: (tenantId: string) => 
    [...rateCardQueryKeys.all, 'recommendations', tenantId] as const,
  
  // Market Intelligence
  marketBenchmarks: (filters?: { role?: string; region?: string }) => 
    [...rateCardQueryKeys.all, 'benchmarks', filters] as const,
  
  // Rate Card Entries
  entries: (filters?: Record<string, unknown>) => 
    [...rateCardQueryKeys.all, 'entries', filters] as const,
  entryById: (id: string) => [...rateCardQueryKeys.all, 'entry', id] as const,
  
  // Comparisons
  comparisons: () => [...rateCardQueryKeys.all, 'comparisons'] as const,
  comparisonById: (id: string) => [...rateCardQueryKeys.comparisons(), id] as const,
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
// Emerging Trends Hooks
// =====================

interface UseEmergingTrendsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching emerging market trends
 * Supports auto-refresh for real-time updates
 */
export function useEmergingTrends(options: UseEmergingTrendsOptions = {}) {
  const { 
    autoRefresh = false, 
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    enabled = true 
  } = options;

  return useQuery({
    queryKey: rateCardQueryKeys.trends(),
    queryFn: () => fetchWithTenant<EmergingTrend[]>('/api/rate-cards/market-intelligence/trends'),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled,
    select: (data) => ({
      trends: data,
      grouped: {
        HIGH: data.filter((t: EmergingTrend) => t.severity === 'HIGH'),
        MEDIUM: data.filter((t: EmergingTrend) => t.severity === 'MEDIUM'),
        LOW: data.filter((t: EmergingTrend) => t.severity === 'LOW'),
      },
      hasHighPriority: data.some((t: EmergingTrend) => t.severity === 'HIGH'),
    }),
  });
}

// =====================
// Baseline Tracking Hooks
// =====================

/**
 * Hook for fetching baseline tracking dashboard data
 */
export function useBaselineTracking() {
  return useQuery({
    queryKey: rateCardQueryKeys.baselineTracking(),
    queryFn: () => fetchWithTenant<TrackingData>('/api/rate-cards/baselines/tracking'),
    staleTime: 60 * 1000, // 1 minute
    select: (data) => ({
      ...data,
      // Compute derived values
      complianceRate: data.summary.totalRateCards > 0
        ? (data.summary.ratesWithinBaseline / data.summary.totalRateCards) * 100
        : 0,
      savingsProgress: data.summary.totalSavingsIdentified > 0
        ? (data.summary.totalSavingsRealized / data.summary.totalSavingsIdentified) * 100
        : 0,
    }),
  });
}

/**
 * Hook for fetching a specific baseline
 */
export function useBaseline(baselineId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rateCardQueryKeys.baselineById(baselineId),
    queryFn: () => fetchWithTenant(`/api/rate-cards/baselines/${baselineId}`),
    enabled: !!baselineId && options?.enabled !== false,
    staleTime: 30 * 1000,
  });
}

// =====================
// Strategic Recommendations Hooks
// =====================

interface UseStrategicRecommendationsOptions {
  tenantId: string;
  enabled?: boolean;
}

/**
 * Hook for fetching strategic recommendations
 */
export function useStrategicRecommendations({ 
  tenantId, 
  enabled = true 
}: UseStrategicRecommendationsOptions) {
  return useQuery({
    queryKey: rateCardQueryKeys.recommendations(tenantId),
    queryFn: async () => {
      const response = await fetchWithTenant<{ data: { recommendations: StrategicRecommendation[] } }>(
        `/api/rate-cards/strategic-recommendations?tenantId=${tenantId}`
      );
      return response.data.recommendations;
    },
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - recommendations don't change often
    select: (data) => ({
      recommendations: data,
      totalSavings: data.reduce((sum: number, rec: StrategicRecommendation) => 
        sum + (rec.estimatedSavings || 0), 0
      ),
      byCategory: data.reduce((acc: Record<string, StrategicRecommendation[]>, rec: StrategicRecommendation) => {
        if (!acc[rec.category]) acc[rec.category] = [];
        acc[rec.category]!.push(rec);
        return acc;
      }, {} as Record<string, StrategicRecommendation[]>),
      highImpact: data.filter((r: StrategicRecommendation) => r.impact === 'HIGH'),
      quickWins: data.filter((r: StrategicRecommendation) => 
        r.impact === 'HIGH' && r.effort === 'LOW'
      ),
    }),
  });
}

// =====================
// Market Benchmarks Hooks
// =====================

interface UseBenchmarksOptions {
  role?: string;
  region?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching market benchmarks
 */
export function useMarketBenchmarks(options: UseBenchmarksOptions = {}) {
  const { role, region, enabled = true } = options;
  const filters = { role, region };

  return useQuery({
    queryKey: rateCardQueryKeys.marketBenchmarks(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (role) params.set('role', role);
      if (region) params.set('region', region);
      const queryString = params.toString();
      return fetchWithTenant<MarketBenchmark[]>(
        `/api/rate-cards/benchmarks${queryString ? `?${queryString}` : ''}`
      );
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - benchmarks are relatively stable
  });
}

// =====================
// Rate Card Entries Hooks
// =====================

interface UseRateCardEntriesOptions {
  supplier?: string;
  role?: string;
  region?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching rate card entries with filtering and pagination
 */
export function useRateCardEntries(options: UseRateCardEntriesOptions = {}) {
  const { supplier, role, region, page = 1, pageSize = 50, enabled = true } = options;
  const filters = { supplier, role, region, page, pageSize };

  return useQuery({
    queryKey: rateCardQueryKeys.entries(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (supplier) params.set('supplier', supplier);
      if (role) params.set('role', role);
      if (region) params.set('region', region);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      return fetchWithTenant<{ entries: RateCardEntry[]; total: number; page: number }>(
        `/api/rate-cards/entries?${params.toString()}`
      );
    },
    enabled,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });
}

// =====================
// Mutations
// =====================

/**
 * Hook for dismissing/acknowledging a trend
 */
export function useDismissTrend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trendId: string) =>
      fetchWithTenant(`/api/rate-cards/market-intelligence/trends/${trendId}/dismiss`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.trends() });
    },
  });
}

/**
 * Hook for creating a baseline
 */
export function useCreateBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      type: string;
      rates: Array<{ role: string; maxRate: number }>;
    }) =>
      fetchWithTenant('/api/rate-cards/baselines', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.baselines() });
    },
  });
}

/**
 * Hook for updating a baseline
 */
export function useUpdateBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; rates?: unknown[] }) =>
      fetchWithTenant(`/api/rate-cards/baselines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.baselineById(id) });
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.baselineTracking() });
    },
  });
}

/**
 * Hook for acting on a recommendation
 */
export function useActOnRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      recommendationId, 
      action,
      tenantId,
    }: { 
      recommendationId: string; 
      action: 'implement' | 'dismiss' | 'defer';
      tenantId: string;
    }) =>
      fetchWithTenant(`/api/rate-cards/strategic-recommendations/${recommendationId}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ 
        queryKey: rateCardQueryKeys.recommendations(tenantId) 
      });
    },
  });
}

// =====================
// Prefetching Helpers
// =====================

/**
 * Prefetch rate card data for faster navigation
 */
export function usePrefetchRateCards() {
  const queryClient = useQueryClient();

  return {
    prefetchTrends: () => {
      queryClient.prefetchQuery({
        queryKey: rateCardQueryKeys.trends(),
        queryFn: () => fetchWithTenant<EmergingTrend[]>('/api/rate-cards/market-intelligence/trends'),
        staleTime: 2 * 60 * 1000,
      });
    },
    prefetchTracking: () => {
      queryClient.prefetchQuery({
        queryKey: rateCardQueryKeys.baselineTracking(),
        queryFn: () => fetchWithTenant<TrackingData>('/api/rate-cards/baselines/tracking'),
        staleTime: 60 * 1000,
      });
    },
    prefetchRecommendations: (tenantId: string) => {
      queryClient.prefetchQuery({
        queryKey: rateCardQueryKeys.recommendations(tenantId),
        queryFn: async () => {
          const response = await fetchWithTenant<{ data: { recommendations: StrategicRecommendation[] } }>(
            `/api/rate-cards/strategic-recommendations?tenantId=${tenantId}`
          );
          return response.data.recommendations;
        },
        staleTime: 5 * 60 * 1000,
      });
    },
  };
}

// =====================
// Invalidation Helpers
// =====================

/**
 * Hook for cross-module rate card invalidation
 */
export function useRateCardInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.all });
    },
    invalidateTrends: () => {
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.trends() });
    },
    invalidateBaselines: () => {
      queryClient.invalidateQueries({ queryKey: rateCardQueryKeys.baselines() });
    },
    invalidateRecommendations: (tenantId: string) => {
      queryClient.invalidateQueries({ 
        queryKey: rateCardQueryKeys.recommendations(tenantId) 
      });
    },
  };
}
