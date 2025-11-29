import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

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
};

// =====================
// Helper Functions
// =====================

function getDataMode(): string {
  // PRODUCTION: Always use real data mode
  // The mock mode was causing issues - disabled for reliability
  return 'real';
}

function getTenantId(): string {
  // PRODUCTION: Use demo tenant - this is where all contracts are stored
  return 'demo';
}

// =====================
// Generic Fetch Function
// =====================

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-data-mode': 'real',
      'x-tenant-id': 'demo',
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
      
      // Direct fetch with hardcoded headers for reliability
      const response = await fetch(`/api/contracts?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-data-mode': 'real',
          'x-tenant-id': 'demo',
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
