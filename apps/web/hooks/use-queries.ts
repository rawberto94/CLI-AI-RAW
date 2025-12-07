import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { STALE_TIMES } from '@/lib/query-client';
import { getTenantId } from '@/lib/tenant';

// =====================
// Types
// =====================

export interface Contract {
  id: string;
  title: string;
  filename?: string;
  originalName?: string;
  status: string;
  parties?: {
    client?: string;
    supplier?: string;
  };
  value?: number;
  effectiveDate?: string;
  expirationDate?: string;
  riskScore?: number;
  uploadedAt?: string;
  error?: string;
  processing?: {
    progress: number;
    currentStage: string;
  };
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
    path: string;
  } | null;
  type?: string;
  createdAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  type?: string;
  steps?: Array<{ type: string; [key: string]: unknown }>;
  executions?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  content?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

// =====================
// Query Key Factories
// =====================

export const queryKeys = {
  // Contracts
  contracts: {
    all: ['contracts'] as const,
    lists: () => [...queryKeys.contracts.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.contracts.lists(), filters] as const,
    details: () => [...queryKeys.contracts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contracts.details(), id] as const,
    signatures: (id: string) => [...queryKeys.contracts.detail(id), 'signatures'] as const,
    versions: (id: string) => [...queryKeys.contracts.detail(id), 'versions'] as const,
  },
  
  // Templates
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.templates.lists(), filters] as const,
    details: () => [...queryKeys.templates.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.templates.details(), id] as const,
    variables: (id: string) => [...queryKeys.templates.detail(id), 'variables'] as const,
  },
  
  // Workflows
  workflows: {
    all: ['workflows'] as const,
    lists: () => [...queryKeys.workflows.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.workflows.lists(), filters] as const,
    details: () => [...queryKeys.workflows.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workflows.details(), id] as const,
    executions: (id: string) => [...queryKeys.workflows.detail(id), 'executions'] as const,
  },
  
  // Integrations
  integrations: {
    all: ['integrations'] as const,
    lists: () => [...queryKeys.integrations.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.integrations.lists(), filters] as const,
    details: () => [...queryKeys.integrations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.integrations.details(), id] as const,
    syncLogs: (id: string) => [...queryKeys.integrations.detail(id), 'syncLogs'] as const,
  },
  
  // Clauses
  clauses: {
    all: ['clauses'] as const,
    lists: () => [...queryKeys.clauses.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.clauses.lists(), filters] as const,
    library: () => [...queryKeys.clauses.all, 'library'] as const,
    detail: (id: string) => [...queryKeys.clauses.all, 'detail', id] as const,
  },
  
  // Rate Cards
  rateCards: {
    all: ['rateCards'] as const,
    lists: () => [...queryKeys.rateCards.all, 'list'] as const,
    entries: () => [...queryKeys.rateCards.all, 'entries'] as const,
    detail: (id: string) => [...queryKeys.rateCards.all, 'detail', id] as const,
  },
  
  // Analytics
  analytics: {
    all: ['analytics'] as const,
    forecasting: () => [...queryKeys.analytics.all, 'forecasting'] as const,
    dashboard: () => [...queryKeys.analytics.all, 'dashboard'] as const,
    health: (contractId: string) => [...queryKeys.analytics.all, 'health', contractId] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
  },
  
  // Taxonomy / Categories
  taxonomy: {
    all: ['taxonomy'] as const,
    categories: () => [...queryKeys.taxonomy.all, 'categories'] as const,
    flat: () => [...queryKeys.taxonomy.all, 'flat'] as const,
    tree: () => [...queryKeys.taxonomy.all, 'tree'] as const,
    presets: () => [...queryKeys.taxonomy.all, 'presets'] as const,
    detail: (id: string) => [...queryKeys.taxonomy.all, 'detail', id] as const,
  },
};

// =====================
// Helper Functions
// =====================

function getDataMode(): string {
  // PRODUCTION: Always use real data mode
  // The mock mode was causing issues - disabled for reliability
  return 'real';
}

// getTenantId is imported from @/lib/tenant to respect "View as Client" context

// =====================
// Generic Fetch Function
// =====================

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-data-mode': 'real',
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

// =====================
// Contract Hooks
// =====================

export function useContracts(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.contracts.list(filters || {}),
    queryFn: async () => {
      // Build clean query params - filter out undefined/null values
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
          }
        });
      }
      
      // Direct fetch with tenant-aware headers
      const response = await fetch(`/api/contracts?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-data-mode': 'real',
          'x-tenant-id': getTenantId(),
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contracts: ${response.status}`);
      }
      
      const json = await response.json();
      
      // Extract contracts from API response
      return { 
        contracts: json.data?.contracts || [], 
        total: json.data?.pagination?.total || 0 
      };
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => fetchAPI<{ contract: Contract }>(`/api/contracts/${id}`),
    enabled: !!id,
  });
}

export function useContractSignatures(contractId: string) {
  return useQuery({
    queryKey: queryKeys.contracts.signatures(contractId),
    queryFn: () => fetchAPI<{ workflows: unknown[] }>(`/api/contracts/${contractId}/signatures`),
    enabled: !!contractId,
  });
}

// =====================
// Template Hooks
// =====================

export function useTemplates(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.templates.list(filters),
    queryFn: () => fetchAPI<{ templates: unknown[] }>('/api/templates'),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.templates.detail(id),
    queryFn: () => fetchAPI<{ template: unknown }>(`/api/templates/${id}`),
    enabled: !!id,
  });
}

export function useTemplateVariables(templateId: string) {
  return useQuery({
    queryKey: queryKeys.templates.variables(templateId),
    queryFn: () => fetchAPI<{ variables: unknown[] }>(`/api/templates/${templateId}/variables`),
    enabled: !!templateId,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => 
      fetchAPI<{ template: unknown }>('/api/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => 
      fetchAPI<{ template: unknown }>(`/api/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.lists() });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      fetchAPI<{ success: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    },
  });
}

// =====================
// Workflow Hooks
// =====================

export function useWorkflows(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.workflows.list(filters),
    queryFn: () => fetchAPI<{ workflows: Workflow[] }>('/api/workflows'),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.workflows.detail(id),
    queryFn: () => fetchAPI<{ workflow: Workflow }>(`/api/workflows/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => 
      fetchAPI<{ workflow: Workflow }>('/api/workflows', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      fetchAPI<{ success: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => 
      fetchAPI<{ workflow: unknown }>(`/api/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.lists() });
    },
  });
}

// =====================
// Integration Hooks
// =====================

export function useIntegrations(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.integrations.list(filters),
    queryFn: () => fetchAPI<{ integrations: unknown[] }>('/api/integrations'),
  });
}

export function useIntegrationSyncLogs(integrationId: string) {
  return useQuery({
    queryKey: queryKeys.integrations.syncLogs(integrationId),
    queryFn: () => fetchAPI<{ logs: unknown[] }>(`/api/integrations/${integrationId}/sync-logs`),
    enabled: !!integrationId,
  });
}

// =====================
// Clauses Hooks
// =====================

export function useClauses(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.clauses.list(filters),
    queryFn: () => {
      const params = new URLSearchParams(filters as Record<string, string>);
      return fetchAPI<{ clauses: unknown[] }>(`/api/clauses?${params}`);
    },
  });
}

export function useClauseLibrary() {
  return useQuery({
    queryKey: queryKeys.clauses.library(),
    queryFn: () => fetchAPI<{ clauses: unknown[] }>('/api/clauses/library'),
  });
}

// =====================
// Rate Cards Hooks
// =====================

export function useRateCards(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.rateCards.lists(),
    queryFn: () => fetchAPI<{ rateCards: unknown[] }>('/api/rate-cards'),
  });
}

export function useRateCardEntries() {
  return useQuery({
    queryKey: queryKeys.rateCards.entries(),
    queryFn: () => fetchAPI<{ entries: unknown[] }>('/api/rate-cards/entries'),
  });
}

export function useRateCardDashboardMetrics() {
  return useQuery({
    queryKey: [...queryKeys.rateCards.all, 'dashboard-metrics'],
    queryFn: async () => {
      const [clientRes, baselineRes, negotiationRes] = await Promise.all([
        fetch('/api/rate-cards/dashboard/client-metrics'),
        fetch('/api/rate-cards/dashboard/baseline-metrics'),
        fetch('/api/rate-cards/dashboard/negotiation-metrics'),
      ]);
      
      const [clientData, baselineData, negotiationData] = await Promise.all([
        clientRes.json(),
        baselineRes.json(),
        negotiationRes.json(),
      ]);
      
      return {
        clientMetrics: clientData,
        baselineMetrics: baselineData,
        negotiationMetrics: negotiationData,
      };
    },
    staleTime: 30 * 1000, // Dashboard can be stale for 30 seconds
  });
}

// =====================
// Analytics Hooks
// =====================

export function useForecastingData() {
  return useQuery({
    queryKey: queryKeys.analytics.forecasting(),
    queryFn: () => fetchAPI<{ forecast: unknown }>('/api/analytics/forecasting'),
    staleTime: 60 * 1000, // Forecasting data can be stale for 1 minute
  });
}

// =====================
// Cross-Module Integration Hooks
// =====================

/**
 * Unified contract intelligence - combines contract data with rate cards and analytics
 */
export function useContractIntelligence(contractId: string) {
  const contract = useContract(contractId);
  
  const rateCards = useQuery({
    queryKey: ['contract-rate-cards', contractId],
    queryFn: async () => {
      const response = await fetch(`/api/rate-cards?contractId=${contractId}`, {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) return { entries: [], total: 0 };
      const json = await response.json();
      return { entries: json.data?.entries || [], total: json.data?.total || 0 };
    },
    enabled: !!contractId,
  });

  const artifacts = useQuery({
    queryKey: ['contract-artifacts', contractId],
    queryFn: async () => {
      const response = await fetch(`/api/contracts/${contractId}/artifacts`, {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) return [];
      const json = await response.json();
      return json.data?.artifacts || json.artifacts || [];
    },
    enabled: !!contractId,
  });

  const healthScore = useQuery({
    queryKey: ['contract-health', contractId],
    queryFn: async () => {
      const response = await fetch(`/api/intelligence/health?contractId=${contractId}`, {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) return null;
      const json = await response.json();
      return json.data?.score || null;
    },
    enabled: !!contractId,
  });

  return {
    contract: contract.data,
    rateCards: rateCards.data,
    artifacts: artifacts.data,
    healthScore: healthScore.data,
    isLoading: contract.isLoading || rateCards.isLoading || artifacts.isLoading,
    error: contract.error || rateCards.error || artifacts.error,
  };
}

/**
 * Dashboard summary - aggregates data across all modules
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const tenantId = getTenantId();
      const [contracts, rateCards, analytics] = await Promise.all([
        fetch('/api/contracts?limit=100', { headers: { 'x-tenant-id': tenantId, 'x-data-mode': 'real' } })
          .then(r => r.json()).catch(() => ({ data: { contracts: [], pagination: { total: 0 } } })),
        fetch('/api/rate-cards/entries?limit=1', { headers: { 'x-tenant-id': tenantId } })
          .then(r => r.json()).catch(() => ({ data: { total: 0 } })),
        fetch('/api/analytics/dashboard', { headers: { 'x-tenant-id': tenantId } })
          .then(r => r.json()).catch(() => ({ data: null })),
      ]);

      const contractsList = contracts.data?.contracts || [];
      const activeContracts = contractsList.filter((c: Contract) => c.status === 'completed');
      const processingContracts = contractsList.filter((c: Contract) => c.status === 'processing');
      const failedContracts = contractsList.filter((c: Contract) => c.status === 'failed');

      return {
        contracts: {
          total: contracts.data?.pagination?.total || contractsList.length,
          active: activeContracts.length,
          processing: processingContracts.length,
          failed: failedContracts.length,
        },
        rateCards: {
          total: rateCards.data?.total || 0,
        },
        analytics: analytics.data,
        recentContracts: contractsList.slice(0, 5),
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Detailed dashboard stats - used by ProfessionalDashboard
 */
export function useDashboardStats() {
  const tenantId = getTenantId();
  
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Pending approvals for dashboard
 */
export function usePendingApprovals(limit = 5) {
  const tenantId = getTenantId();
  
  return useQuery({
    queryKey: ['pending-approvals', limit],
    queryFn: async () => {
      const response = await fetch(`/api/approvals?limit=${limit}&status=pending`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to fetch approvals');
      return response.json();
    },
    staleTime: 30000,
  });
}

/**
 * Contract expirations for dashboard
 */
export function useContractExpirations(limit = 5) {
  const tenantId = getTenantId();
  
  return useQuery({
    queryKey: ['contract-expirations', limit],
    queryFn: async () => {
      const response = await fetch(`/api/contracts/expirations?limit=${limit}&expired=false`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to fetch expirations');
      return response.json();
    },
    staleTime: 60000,
  });
}

/**
 * Contract health scores for dashboard
 */
export function useContractHealthScores() {
  const tenantId = getTenantId();
  
  return useQuery({
    queryKey: ['contract-health-scores'],
    queryFn: async () => {
      const response = await fetch('/api/contracts/health-scores', {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to fetch health scores');
      return response.json();
    },
    staleTime: 60000,
  });
}

/**
 * Cross-module search - searches across contracts, rate cards, and clauses
 */
export function useUnifiedSearch(query: string) {
  return useQuery({
    queryKey: ['unified-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return { contracts: [], rateCards: [], clauses: [] };

      const tenantId = getTenantId();
      const [contracts, rateCards, clauses] = await Promise.all([
        fetch(`/api/contracts/search?q=${encodeURIComponent(query)}`, { headers: { 'x-tenant-id': tenantId } })
          .then(r => r.json()).catch(() => ({ data: { results: [] } })),
        fetch(`/api/rate-cards?search=${encodeURIComponent(query)}`, { headers: { 'x-tenant-id': tenantId } })
          .then(r => r.json()).catch(() => ({ data: { entries: [] } })),
        fetch(`/api/clauses?search=${encodeURIComponent(query)}`, { headers: { 'x-tenant-id': tenantId } })
          .then(r => r.json()).catch(() => ({ data: { clauses: [] } })),
      ]);

      return {
        contracts: contracts.data?.results || [],
        rateCards: rateCards.data?.entries || [],
        clauses: clauses.data?.clauses || [],
        total: (contracts.data?.results?.length || 0) + 
               (rateCards.data?.entries?.length || 0) + 
               (clauses.data?.clauses?.length || 0),
      };
    },
    enabled: query.length >= 2,
    staleTime: 10000,
  });
}

/**
 * Renewal intelligence - combines renewal data with contract and rate card info
 */
export function useRenewalIntelligence() {
  return useQuery({
    queryKey: ['renewal-intelligence'],
    queryFn: async () => {
      const tenantId = getTenantId();
      const [renewals, contracts] = await Promise.all([
        fetch('/api/renewals', { headers: { 'x-tenant-id': tenantId } })
          .then(r => r.json()).catch(() => ({ data: { renewals: [] } })),
        fetch('/api/contracts?limit=100', { headers: { 'x-tenant-id': tenantId, 'x-data-mode': 'real' } })
          .then(r => r.json()).catch(() => ({ data: { contracts: [] } })),
      ]);

      const renewalsList = renewals.data?.renewals || [];
      const contractsList = contracts.data?.contracts || [];

      // Enrich renewals with contract data
      const enrichedRenewals = renewalsList.map((renewal: any) => {
        const contract = contractsList.find((c: Contract) => c.id === renewal.contractId);
        return {
          ...renewal,
          contractDetails: contract,
        };
      });

      return {
        renewals: enrichedRenewals,
        upcoming30Days: enrichedRenewals.filter((r: any) => r.daysUntilExpiry <= 30),
        upcoming90Days: enrichedRenewals.filter((r: any) => r.daysUntilExpiry <= 90),
        totalValue: enrichedRenewals.reduce((sum: number, r: any) => sum + (r.value || 0), 0),
      };
    },
    staleTime: 60000,
  });
}

// =====================
// Optimistic Updates Helper
// =====================

export function useOptimisticMutation<TData, TVariables>(
  options: {
    mutationFn: (variables: TVariables) => Promise<TData>;
    queryKey: readonly unknown[];
    optimisticUpdate: (old: TData | undefined, variables: TVariables) => TData;
    onSuccess?: (data: TData, variables: TVariables, context: { previousData: TData | undefined } | undefined) => void;
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, { previousData: TData | undefined }>({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: options.queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(options.queryKey);

      // Optimistically update
      queryClient.setQueryData<TData>(options.queryKey, (old) => 
        options.optimisticUpdate(old, variables)
      );

      return { previousData };
    },
    onError: (_error: Error, _variables: TVariables, context: { previousData: TData | undefined } | undefined) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(options.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: options.queryKey });
    },
    onSuccess: options.onSuccess,
  });
}

// =====================
// Cross-Module Cache Invalidation
// =====================

/**
 * Hook to invalidate related caches when data changes across modules
 * This ensures data stays in sync across the entire application
 */
export function useCrossModuleInvalidation() {
  const queryClient = useQueryClient();
  
  return {
    /**
     * Call when an approval is completed/rejected
     * Updates: approvals, contracts, dashboard, analytics
     */
    onApprovalComplete: (contractId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
        queryClient.invalidateQueries({ queryKey: ['contract-health', contractId] });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
    },
    
    /**
     * Call when a contract is uploaded or updated
     * Updates: contracts, dashboard, rate cards (if applicable), analytics
     */
    onContractChange: (contractId?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
        queryClient.invalidateQueries({ queryKey: ['contract-artifacts', contractId] });
        queryClient.invalidateQueries({ queryKey: ['contract-health', contractId] });
      }
    },
    
    /**
     * Call when rate card data changes
     * Updates: rate cards, contracts (for linked data), analytics
     */
    onRateCardChange: (contractId?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rateCards.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
      }
    },
    
    /**
     * Call when a renewal action is taken
     * Updates: renewals, contracts, dashboard, approvals (if submitted)
     */
    onRenewalChange: (contractId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (contractId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
      }
    },
    
    /**
     * Call when workflow configuration changes
     * Updates: workflows, approvals (workflow may affect pending items)
     */
    onWorkflowChange: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    
    /**
     * Call when template changes (create, update, delete)
     * Updates: templates, dashboard (may show template stats)
     */
    onTemplateChange: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    
    /**
     * Call when taxonomy/categories change (create, update, delete, import preset)
     * Updates: taxonomy, contracts (may use category data), dashboard
     */
    onTaxonomyChange: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taxonomy.all });
      queryClient.invalidateQueries({ queryKey: ['categories'] }); // Legacy key
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all }); // Contracts may show category
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    
    /**
     * Call when user/team settings change
     * Updates: users, teams, permissions
     */
    onUserChange: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
    
    /**
     * Call when integration settings change (SSO, storage, etc.)
     * Updates: integrations, settings
     */
    onIntegrationChange: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['sso-config'] });
      queryClient.invalidateQueries({ queryKey: ['storage-settings'] });
    },
    
    /**
     * Call when dashboard widgets or preferences change
     * Updates: dashboard data, user preferences
     */
    onDashboardChange: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
    },
    
    /**
     * Call when notifications are read/cleared
     * Updates: notifications, unread count
     */
    onNotificationChange: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    
    /**
     * Call when clauses library changes
     * Updates: clauses, contract analysis
     */
    onClauseChange: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clauses.all });
      queryClient.invalidateQueries({ queryKey: ['clause-library'] });
    },
    
    /**
     * Force refresh all data - use sparingly
     */
    refreshAll: () => {
      queryClient.invalidateQueries();
    },
  };
}

// =====================
// Approval Hooks with Cross-Module Integration
// =====================

export function useApprovals(filters?: { status?: string; priority?: string }) {
  return useQuery({
    queryKey: ['approvals', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.priority) params.set('priority', filters.priority);
      
      const response = await fetch(`/api/approvals?${params}`, {
        headers: { 'x-tenant-id': getTenantId() },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch approvals');
      }
      
      const json = await response.json();
      return {
        approvals: json.data?.approvals || [],
        stats: json.data?.stats || { pending: 0, completed: 0, total: 0 },
      };
    },
    staleTime: 15000, // Approvals should be relatively fresh
    refetchOnWindowFocus: true,
  });
}

export function useApprovalAction() {
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async ({ 
      approvalId, 
      action, 
      reason,
      contractId,
    }: { 
      approvalId: string; 
      action: 'approve' | 'reject' | 'escalate';
      reason?: string;
      contractId?: string;
    }) => {
      const response = await fetch(`/api/approvals/${approvalId}/${action}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({ reason }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} approval`);
      }
      
      return { approvalId, action, contractId };
    },
    onSuccess: (data) => {
      // Cross-module cache invalidation
      crossModule.onApprovalComplete(data.contractId);
    },
  });
}

export function useBulkApprovalAction() {
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async ({ 
      approvalIds, 
      action,
      reason,
    }: { 
      approvalIds: string[]; 
      action: 'approve' | 'reject';
      reason?: string;
    }) => {
      const response = await fetch('/api/approvals/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({ approvalIds, action, reason }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to bulk ${action}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refresh all related data after bulk action
      crossModule.onApprovalComplete();
    },
  });
}

// =====================
// Real-Time Data Sync Hook
// =====================

/**
 * Hook to sync query data with real-time events
 * Listens for SSE/WebSocket events and updates the query cache accordingly
 */
export function useRealTimeQuerySync() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();
  
  // Event handler reference for cleanup
  const eventHandlerRef = useRef<((event: CustomEvent) => void) | null>(null);
  
  useEffect(() => {
    const handleRealTimeEvent = (event: CustomEvent) => {
      const { type, data } = event.detail || {};
      
      switch (type) {
        // Contract events
        case 'contract:created':
        case 'contract:updated':
        case 'contract:deleted':
          crossModule.onContractChange(data?.contractId);
          break;
        
        // Approval events
        case 'approval:submitted':
        case 'approval:completed':
        case 'approval:rejected':
          crossModule.onApprovalComplete(data?.contractId);
          break;
        
        // Rate card events
        case 'ratecard:imported':
        case 'ratecard:updated':
        case 'ratecard:deleted':
          crossModule.onRateCardChange(data?.contractId);
          break;
        
        // Renewal events
        case 'renewal:initiated':
        case 'renewal:completed':
          crossModule.onRenewalChange(data?.contractId);
          break;
        
        // Processing events
        case 'processing:started':
        case 'processing:progress':
        case 'processing:completed':
        case 'processing:failed':
          if (data?.contractId) {
            queryClient.invalidateQueries({ 
              queryKey: queryKeys.contracts.detail(data.contractId) 
            });
          }
          queryClient.invalidateQueries({ queryKey: ['processing-jobs'] });
          break;
        
        // Notification events
        case 'notification:new':
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          break;
        
        // Generic refresh
        case 'data:refresh':
          if (data?.queryKey) {
            queryClient.invalidateQueries({ queryKey: data.queryKey });
          } else {
            crossModule.refreshAll();
          }
          break;
      }
    };
    
    eventHandlerRef.current = handleRealTimeEvent;
    
    // Listen for real-time events dispatched from WebSocket/SSE context
    window.addEventListener('realtime-event', handleRealTimeEvent as EventListener);
    
    return () => {
      window.removeEventListener('realtime-event', handleRealTimeEvent as EventListener);
    };
  }, [queryClient, crossModule]);
  
  // Helper to manually trigger a real-time event (for testing/local sync)
  const dispatchEvent = useCallback((type: string, data?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('realtime-event', { 
      detail: { type, data } 
    }));
  }, []);
  
  return { dispatchEvent };
}

// =====================
// Pagination Hook for Infinite Queries
// =====================

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Hook for paginated data with cursor/offset support
 */
export function usePaginatedQuery<T>(
  queryKey: readonly unknown[],
  fetchFn: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
  options?: {
    pageSize?: number;
    staleTime?: number;
    enabled?: boolean;
  }
) {
  const pageSize = options?.pageSize || 20;
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: [...queryKey, { page: 1, pageSize }],
    queryFn: () => fetchFn(1, pageSize),
    staleTime: options?.staleTime ?? STALE_TIMES.dynamic,
    enabled: options?.enabled ?? true,
  });
  
  // Prefetch next page
  useEffect(() => {
    if (query.data?.hasMore) {
      const nextPage = query.data.page + 1;
      queryClient.prefetchQuery({
        queryKey: [...queryKey, { page: nextPage, pageSize }],
        queryFn: () => fetchFn(nextPage, pageSize),
        staleTime: options?.staleTime ?? STALE_TIMES.dynamic,
      });
    }
  }, [query.data, queryKey, pageSize, queryClient, fetchFn, options?.staleTime]);
  
  const loadPage = useCallback(async (page: number) => {
    return queryClient.fetchQuery({
      queryKey: [...queryKey, { page, pageSize }],
      queryFn: () => fetchFn(page, pageSize),
      staleTime: options?.staleTime ?? STALE_TIMES.dynamic,
    });
  }, [queryKey, pageSize, queryClient, fetchFn, options?.staleTime]);
  
  return {
    ...query,
    loadPage,
    pageSize,
  };
}

// =====================
// Data Prefetching Utilities
// =====================

/**
 * Prefetch contract detail data for faster navigation
 */
export function usePrefetchContract() {
  const queryClient = useQueryClient();
  
  return useCallback((contractId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.contracts.detail(contractId),
      queryFn: async () => {
        const response = await fetch(`/api/contracts/${contractId}`, {
          headers: { 'x-tenant-id': getTenantId() },
        });
        if (!response.ok) throw new Error('Failed to fetch contract');
        return response.json();
      },
      staleTime: STALE_TIMES.dynamic,
    });
  }, [queryClient]);
}

/**
 * Hook to prefetch data on hover for faster perceived performance
 */
export function usePrefetchOnHover<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  delay = 200
) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const onMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: fetchFn,
        staleTime: STALE_TIMES.dynamic,
      });
    }, delay);
  }, [queryKey, fetchFn, delay, queryClient]);
  
  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  return { onMouseEnter, onMouseLeave };
}

// =====================
// Taxonomy Hooks
// =====================

export interface TaxonomyCategory {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  level: number;
  path: string;
  keywords: string[];
  aiClassificationPrompt?: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  contractCount?: number;
  children?: TaxonomyCategory[];
}

export interface TaxonomyPreset {
  id: string;
  name: string;
  description: string;
  categories: Array<{
    name: string;
    description: string;
    keywords: string[];
    color: string;
    icon: string;
    children?: Array<{
      name: string;
      description: string;
      keywords: string[];
      color?: string;
      icon?: string;
    }>;
  }>;
}

/**
 * Fetch taxonomy categories (flat list)
 */
export function useTaxonomyCategories(options?: { enabled?: boolean }) {
  return useQuery<TaxonomyCategory[]>({
    queryKey: queryKeys.taxonomy.flat(),
    queryFn: async () => {
      const response = await fetch('/api/taxonomy?flat=true', {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: STALE_TIMES.static, // Categories don't change often
    ...options,
  });
}

/**
 * Fetch taxonomy categories (tree structure)
 */
export function useTaxonomyTree(options?: { enabled?: boolean }) {
  return useQuery<TaxonomyCategory[]>({
    queryKey: queryKeys.taxonomy.tree(),
    queryFn: async () => {
      const response = await fetch('/api/taxonomy', {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to fetch taxonomy tree');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: STALE_TIMES.static,
    ...options,
  });
}

/**
 * Fetch available taxonomy presets
 */
export function useTaxonomyPresets(options?: { enabled?: boolean }) {
  return useQuery<TaxonomyPreset[]>({
    queryKey: queryKeys.taxonomy.presets(),
    queryFn: async () => {
      const response = await fetch('/api/taxonomy/presets', {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to fetch presets');
      const data = await response.json();
      return data.presets || [];
    },
    staleTime: STALE_TIMES.static,
    ...options,
  });
}

/**
 * Create a new taxonomy category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async (categoryData: Partial<TaxonomyCategory>) => {
      const response = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify(categoryData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create category');
      }
      return response.json();
    },
    onSuccess: () => {
      crossModule.onTaxonomyChange();
    },
  });
}

/**
 * Update an existing taxonomy category
 */
export function useUpdateCategory() {
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TaxonomyCategory> & { id: string }) => {
      const response = await fetch(`/api/taxonomy/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update category');
      }
      return response.json();
    },
    onSuccess: () => {
      crossModule.onTaxonomyChange();
    },
  });
}

/**
 * Delete a taxonomy category
 */
export function useDeleteCategory() {
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/taxonomy/${id}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete category');
      }
      return response.json();
    },
    onSuccess: () => {
      crossModule.onTaxonomyChange();
    },
  });
}

/**
 * Apply a taxonomy preset
 */
export function useApplyPreset() {
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async ({ presetId, clearExisting = false }: { presetId: string; clearExisting?: boolean }) => {
      const response = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({ preset: presetId, clearExisting }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply preset');
      }
      return response.json();
    },
    onSuccess: () => {
      crossModule.onTaxonomyChange();
    },
  });
}

/**
 * Upload custom taxonomy (CSV/JSON)
 */
export function useUploadTaxonomy() {
  const crossModule = useCrossModuleInvalidation();
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/taxonomy/upload', {
        method: 'POST',
        headers: { 'x-tenant-id': getTenantId() },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload taxonomy');
      }
      return response.json();
    },
    onSuccess: () => {
      crossModule.onTaxonomyChange();
    },
  });
}
