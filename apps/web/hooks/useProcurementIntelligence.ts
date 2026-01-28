import { useState, useEffect } from 'react';

// DataMode type definition
export type DataMode = 'real' | 'mock' | 'auto';

interface ProcurementIntelligence {
  loading: boolean;
  error: Error | null;
  data: any;
}

export function useProcurementIntelligence() {
  const [state, setState] = useState<ProcurementIntelligence>({
    loading: false,
    error: null,
    data: null,
  });

  return state;
}

interface NegotiationPrepFilters {
  contractId?: string;
  supplierId?: string;
  category?: string;
}

export function useNegotiationPrep(filters?: NegotiationPrepFilters, mode: DataMode = 'real') {
  const [state, setState] = useState({
    loading: true,
    error: null as Error | null,
    data: null as any,
    metadata: {
      source: 'real' as const,
      lastUpdated: new Date().toISOString()
    },
    refetch: () => {}
  });

  useEffect(() => {
    async function fetchNegotiationData() {
      if (mode === 'mock') {
        // Return empty data for mock mode
        setState(prev => ({
          ...prev,
          loading: false,
          data: {
            opportunities: [],
            totalValue: 0,
            marketPosition: { supplierRank: 1, marketShare: 0, competitorCount: 0, totalSuppliers: 1 },
            benchmarks: { avgPricing: 0, yourPricing: 0, potentialSavings: 0 },
            recommendations: [],
            leveragePoints: [],
            historicalPerformance: []
          }
        }));
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // Fetch real negotiation data from API
        const params = new URLSearchParams();
        if (filters?.contractId) params.append('contractId', filters.contractId);
        if (filters?.supplierId) params.append('supplierId', filters.supplierId);
        if (filters?.category) params.append('category', filters.category);

        const response = await fetch(`/api/analytics/negotiation?${params}`, {
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch negotiation data: ${response.status}`);
        }

        const data = await response.json();
        
        setState(prev => ({
          ...prev,
          loading: false,
          data: data.data || data,
          metadata: {
            source: 'real',
            lastUpdated: new Date().toISOString()
          }
        }));
      } catch (error: unknown) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error,
          data: {
            opportunities: [],
            totalValue: 0,
            marketPosition: { supplierRank: 1, marketShare: 0, competitorCount: 0, totalSuppliers: 1 },
            benchmarks: { avgPricing: 0, yourPricing: 0, potentialSavings: 0 },
            recommendations: [],
            leveragePoints: [],
            historicalPerformance: []
          }
        }));
      }
    }

    fetchNegotiationData();
  }, [filters?.contractId, filters?.supplierId, filters?.category, mode]);

  // Add refetch function
  useEffect(() => {
    setState(prev => ({
      ...prev,
      refetch: () => {
        setState(p => ({ ...p, loading: true }));
        // Trigger re-fetch by updating a dependency
      }
    }));
  }, []);

  return state;
}

interface RenewalRadarFilters {
  daysAhead?: number;
  minValue?: number;
  timeframe?: string;
  riskLevel?: string;
}

export function useRenewalRadar(filters?: RenewalRadarFilters, mode: DataMode = 'real') {
  const [state, setState] = useState({
    loading: true,
    error: null as Error | null,
    data: null as {
      upcomingRenewals: unknown[];
      riskAnalysis: {
        totalContracts: number;
        totalValue: number;
        riskDistribution: { high: number; medium: number; low: number };
      };
      actionItems: unknown[];
    } | null,
    metadata: {
      source: 'real' as const,
      lastUpdated: new Date().toISOString()
    },
    refetch: () => {}
  });

  useEffect(() => {
    async function fetchRenewalData() {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const params = new URLSearchParams();
        if (filters?.daysAhead) params.append('daysAhead', filters.daysAhead.toString());
        if (filters?.minValue) params.append('minValue', filters.minValue.toString());
        if (filters?.timeframe) params.append('timeframe', filters.timeframe);
        if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
        params.append('mode', mode);

        const response = await fetch(`/api/analytics/renewals?${params}`);
        
        if (!response.ok) throw new Error('Failed to fetch renewal data');
        
        const result = await response.json();
        
        setState(prev => ({
          ...prev,
          loading: false,
          data: result.data || {
            upcomingRenewals: [],
            riskAnalysis: { totalContracts: 0, totalValue: 0, riskDistribution: { high: 0, medium: 0, low: 0 } },
            actionItems: []
          },
          metadata: {
            source: result.metadata?.source || 'real',
            lastUpdated: new Date().toISOString()
          }
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error,
          data: {
            upcomingRenewals: [],
            riskAnalysis: { totalContracts: 0, totalValue: 0, riskDistribution: { high: 0, medium: 0, low: 0 } },
            actionItems: []
          }
        }));
      }
    }

    fetchRenewalData();
  }, [filters?.daysAhead, filters?.minValue, filters?.timeframe, filters?.riskLevel, mode]);

  return state;
}

interface SavingsPipelineFilters {
  status?: string;
  category?: string;
  timeframe?: string;
}

export function useSavingsPipeline(filters?: SavingsPipelineFilters, mode: DataMode = 'real') {
  const [state, setState] = useState({
    loading: true,
    error: null as Error | null,
    data: null as {
      pipeline: {
        total: number;
        byStatus: { identified: number; in_progress: number; realized: number };
        byCategory: Record<string, number>;
      };
      opportunities: unknown[];
      trends: unknown[];
    } | null,
    metadata: {
      source: 'real' as const,
      lastUpdated: new Date().toISOString()
    },
    refetch: () => {}
  });

  useEffect(() => {
    async function fetchSavingsData() {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.category) params.append('category', filters.category);
        if (filters?.timeframe) params.append('timeframe', filters.timeframe);
        params.append('mode', mode);

        const response = await fetch(`/api/analytics/savings?${params}`);
        
        if (!response.ok) throw new Error('Failed to fetch savings data');
        
        const result = await response.json();
        
        setState(prev => ({
          ...prev,
          loading: false,
          data: result.data || {
            pipeline: { total: 0, byStatus: { identified: 0, in_progress: 0, realized: 0 }, byCategory: {} },
            opportunities: [],
            trends: []
          },
          metadata: {
            source: result.metadata?.source || 'real',
            lastUpdated: new Date().toISOString()
          }
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error,
          data: {
            pipeline: { total: 0, byStatus: { identified: 0, in_progress: 0, realized: 0 }, byCategory: {} },
            opportunities: [],
            trends: []
          }
        }));
      }
    }

    fetchSavingsData();
  }, [filters?.status, filters?.category, filters?.timeframe, mode]);

  return state;
}

interface SupplierAnalyticsFilters {
  supplierId?: string;
  category?: string;
  timeframe?: string;
  metrics?: string[];
}

export function useSupplierAnalytics(filters?: SupplierAnalyticsFilters, mode: DataMode = 'real') {
  const [state, setState] = useState({
    loading: true,
    error: null as Error | null,
    data: null as {
      suppliers: unknown[];
      performance: { deliveryScore: number; qualityScore: number; costEfficiency: number; riskScore: number };
      financialHealth: { creditRating: string; revenue: number; profitMargin: number; debtRatio: number };
      relationships: { contractCount: number; totalValue: number; averageContractLength: number; renewalRate: number };
      trends: unknown[];
    } | null,
    metadata: {
      source: 'real' as const,
      lastUpdated: new Date().toISOString()
    },
    refetch: () => {}
  });

  const fetchData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const params = new URLSearchParams();
      if (filters?.supplierId) params.append('supplierId', filters.supplierId);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.timeframe) params.append('timeframe', filters.timeframe);
      if (filters?.metrics?.length) params.append('metrics', filters.metrics.join(','));
      params.append('mode', mode);

      const response = await fetch(`/api/analytics/suppliers?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch supplier analytics');
      
      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        loading: false,
        data: result.data || {
          suppliers: [],
          performance: { deliveryScore: 0, qualityScore: 0, costEfficiency: 0, riskScore: 0 },
          financialHealth: { creditRating: 'N/A', revenue: 0, profitMargin: 0, debtRatio: 0 },
          relationships: { contractCount: 0, totalValue: 0, averageContractLength: 0, renewalRate: 0 },
          trends: []
        },
        metadata: {
          source: result.metadata?.source || 'real',
          lastUpdated: new Date().toISOString()
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
        data: {
          suppliers: [],
          performance: { deliveryScore: 0, qualityScore: 0, costEfficiency: 0, riskScore: 0 },
          financialHealth: { creditRating: 'N/A', revenue: 0, profitMargin: 0, debtRatio: 0 },
          relationships: { contractCount: 0, totalValue: 0, averageContractLength: 0, renewalRate: 0 },
          trends: []
        }
      }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters?.supplierId, filters?.category, filters?.timeframe, filters?.metrics?.join(','), mode]);

  return {
    ...state,
    refetch: fetchData
  };
}
