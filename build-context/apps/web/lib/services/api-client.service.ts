/**
 * Unified API Client Service
 * Provides a centralized, type-safe API layer with built-in
 * caching, retries, circuit breaker, and request deduplication
 */

import { BaseService, type ServiceConfig } from '@/lib/service-base';
import { type AppResult } from '@/lib/result';

// ============================================================================
// Types
// ============================================================================

export interface Contract {
  id: string;
  title: string;
  vendor?: string;
  status: string;
  type?: string;
  value?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface ContractSummary {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  totalValue: number;
  recentlyUpdated: number;
}

export interface CreateContractInput {
  title: string;
  vendor?: string;
  type?: string;
  value?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateContractInput extends Partial<CreateContractInput> {
  status?: string;
}

export interface ListContractsParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Artifact {
  id: string;
  contractId: string;
  type: string;
  content: Record<string, unknown>;
  confidence?: number;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  contractId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approver?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Contracts API Service
// ============================================================================

class ContractsApiService extends BaseService {
  constructor(config?: ServiceConfig) {
    super('contracts-api', {
      baseUrl: '/api/contracts',
      timeout: 10000,
      retries: 3,
      cacheEnabled: true,
      cacheTTL: 30, // 30 seconds
      circuitBreakerEnabled: true,
      deduplicationEnabled: true,
      ...config,
    });
  }

  // List contracts with pagination
  async list(params?: ListContractsParams): Promise<AppResult<PaginatedResponse<Contract>>> {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    
    return this.get<PaginatedResponse<Contract>>(queryString);
  }

  // Get a single contract
  async getById(id: string): Promise<AppResult<Contract>> {
    return this.get<Contract>(`/${id}`);
  }

  // Get contract summary/stats
  async getSummary(): Promise<AppResult<ContractSummary>> {
    return this.get<ContractSummary>('/summary');
  }

  // Create a new contract
  async create(data: CreateContractInput): Promise<AppResult<Contract>> {
    this.clearServiceCache(); // Invalidate list cache
    return this.post<Contract>('', data);
  }

  // Update a contract
  async update(id: string, data: UpdateContractInput): Promise<AppResult<Contract>> {
    this.clearServiceCache(`/${id}`);
    return this.patch<Contract>(`/${id}`, data);
  }

  // Delete a contract
  async remove(id: string): Promise<AppResult<void>> {
    this.clearServiceCache();
    return this.delete<void>(`/${id}`);
  }

  // Get contract artifacts
  async getArtifacts(id: string): Promise<AppResult<Artifact[]>> {
    return this.get<Artifact[]>(`/${id}/artifacts`);
  }

  // Submit for approval
  async submitForApproval(id: string, approver: string): Promise<AppResult<Approval>> {
    return this.post<Approval>(`/${id}/approvals`, { approver });
  }

  // Search contracts
  async search(query: string): Promise<AppResult<Contract[]>> {
    return this.get<Contract[]>(`/search?q=${encodeURIComponent(query)}`);
  }
}

// ============================================================================
// Templates API Service
// ============================================================================

class TemplatesApiService extends BaseService {
  constructor(config?: ServiceConfig) {
    super('templates-api', {
      baseUrl: '/api/templates',
      timeout: 10000,
      retries: 3,
      cacheEnabled: true,
      cacheTTL: 300, // 5 minutes (templates change less often)
      circuitBreakerEnabled: true,
      ...config,
    });
  }

  async list(): Promise<AppResult<Template[]>> {
    return this.get<Template[]>('');
  }

  async getById(id: string): Promise<AppResult<Template>> {
    return this.get<Template>(`/${id}`);
  }

  async create(data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<AppResult<Template>> {
    this.clearServiceCache();
    return this.post<Template>('', data);
  }

  async update(id: string, data: Partial<Template>): Promise<AppResult<Template>> {
    this.clearServiceCache();
    return this.patch<Template>(`/${id}`, data);
  }

  async remove(id: string): Promise<AppResult<void>> {
    this.clearServiceCache();
    return this.delete<void>(`/${id}`);
  }
}

// ============================================================================
// Approvals API Service
// ============================================================================

class ApprovalsApiService extends BaseService {
  constructor(config?: ServiceConfig) {
    super('approvals-api', {
      baseUrl: '/api/approvals',
      timeout: 10000,
      retries: 3,
      cacheEnabled: true,
      cacheTTL: 10, // 10 seconds (approvals are time-sensitive)
      circuitBreakerEnabled: true,
      ...config,
    });
  }

  async list(status?: 'pending' | 'approved' | 'rejected'): Promise<AppResult<Approval[]>> {
    const query = status ? `?status=${status}` : '';
    return this.get<Approval[]>(query);
  }

  async getById(id: string): Promise<AppResult<Approval>> {
    return this.get<Approval>(`/${id}`);
  }

  async approve(id: string, comments?: string): Promise<AppResult<Approval>> {
    this.clearServiceCache();
    return this.post<Approval>(`/${id}/approve`, { comments });
  }

  async reject(id: string, reason: string): Promise<AppResult<Approval>> {
    this.clearServiceCache();
    return this.post<Approval>(`/${id}/reject`, { reason });
  }

  async getPending(): Promise<AppResult<Approval[]>> {
    return this.list('pending');
  }

  async getMyApprovals(): Promise<AppResult<Approval[]>> {
    return this.get<Approval[]>('/my');
  }
}

// ============================================================================
// Analytics API Service
// ============================================================================

class AnalyticsApiService extends BaseService {
  constructor(config?: ServiceConfig) {
    super('analytics-api', {
      baseUrl: '/api/analytics',
      timeout: 30000, // Analytics can take longer
      retries: 2,
      cacheEnabled: true,
      cacheTTL: 60, // 1 minute
      circuitBreakerEnabled: true,
      ...config,
    });
  }

  async getDashboardMetrics(): Promise<AppResult<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>('/dashboard');
  }

  async getContractMetrics(contractId: string): Promise<AppResult<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>(`/contracts/${contractId}`);
  }

  async getTrends(period: 'week' | 'month' | 'quarter' | 'year'): Promise<AppResult<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>(`/trends?period=${period}`);
  }

  async getRiskAnalysis(): Promise<AppResult<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>('/risk');
  }

  async getComplianceReport(): Promise<AppResult<Record<string, unknown>>> {
    return this.get<Record<string, unknown>>('/compliance');
  }
}

// ============================================================================
// Upload API Service
// ============================================================================

class UploadApiService extends BaseService {
  constructor(config?: ServiceConfig) {
    super('upload-api', {
      baseUrl: '/api/upload',
      timeout: 120000, // 2 minutes for uploads
      retries: 1,
      cacheEnabled: false,
      circuitBreakerEnabled: true,
      ...config,
    });
  }

  async uploadFile(file: File, metadata?: Record<string, unknown>): Promise<AppResult<{ jobId: string; contractId?: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    return this.fetch<{ jobId: string; contractId?: string }>('', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type, let browser set it with boundary
      headers: {},
    });
  }

  async getJobStatus(jobId: string): Promise<AppResult<{ status: string; progress: number; result?: unknown }>> {
    return this.get<{ status: string; progress: number; result?: unknown }>(`/status/${jobId}`);
  }

  async cancelJob(jobId: string): Promise<AppResult<void>> {
    return this.post<void>(`/${jobId}/cancel`, {});
  }
}

// ============================================================================
// Unified API Client
// ============================================================================

export class ApiClient {
  public readonly contracts: ContractsApiService;
  public readonly templates: TemplatesApiService;
  public readonly approvals: ApprovalsApiService;
  public readonly analytics: AnalyticsApiService;
  public readonly upload: UploadApiService;

  constructor(baseConfig?: ServiceConfig) {
    this.contracts = new ContractsApiService(baseConfig);
    this.templates = new TemplatesApiService(baseConfig);
    this.approvals = new ApprovalsApiService(baseConfig);
    this.analytics = new AnalyticsApiService(baseConfig);
    this.upload = new UploadApiService(baseConfig);
  }

  // Clear all service caches
  clearAllCaches(): void {
    // Each service has its own cache that gets cleared on mutations
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClient) {
    apiClient = new ApiClient();
  }
  return apiClient;
}

// Convenience exports for individual services
export const contractsApi = () => getApiClient().contracts;
export const templatesApi = () => getApiClient().templates;
export const approvalsApi = () => getApiClient().approvals;
export const analyticsApi = () => getApiClient().analytics;
export const uploadApi = () => getApiClient().upload;

// ============================================================================
// React Hooks for API
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query keys
export const queryKeys = {
  contracts: {
    all: ['contracts'] as const,
    list: (params?: ListContractsParams) => ['contracts', 'list', params] as const,
    detail: (id: string) => ['contracts', 'detail', id] as const,
    summary: () => ['contracts', 'summary'] as const,
    artifacts: (id: string) => ['contracts', 'artifacts', id] as const,
    search: (query: string) => ['contracts', 'search', query] as const,
  },
  templates: {
    all: ['templates'] as const,
    list: () => ['templates', 'list'] as const,
    detail: (id: string) => ['templates', 'detail', id] as const,
  },
  approvals: {
    all: ['approvals'] as const,
    list: (status?: string) => ['approvals', 'list', status] as const,
    detail: (id: string) => ['approvals', 'detail', id] as const,
    pending: () => ['approvals', 'pending'] as const,
    my: () => ['approvals', 'my'] as const,
  },
  analytics: {
    dashboard: () => ['analytics', 'dashboard'] as const,
    contract: (id: string) => ['analytics', 'contract', id] as const,
    trends: (period: string) => ['analytics', 'trends', period] as const,
    risk: () => ['analytics', 'risk'] as const,
    compliance: () => ['analytics', 'compliance'] as const,
  },
};

// Hook: useContracts
export function useContracts(params?: ListContractsParams) {
  return useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: async () => {
      const result = await contractsApi().list(params);
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook: useContract
export function useContract(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: async () => {
      const result = await contractsApi().getById(id);
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    enabled: !!id,
  });
}

// Hook: useContractSummary
export function useContractSummary() {
  return useQuery({
    queryKey: queryKeys.contracts.summary(),
    queryFn: async () => {
      const result = await contractsApi().getSummary();
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook: useCreateContract
export function useCreateContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateContractInput) => {
      const result = await contractsApi().create(data);
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}

// Hook: useUpdateContract
export function useUpdateContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateContractInput }) => {
      const result = await contractsApi().update(id, data);
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.list() });
    },
  });
}

// Hook: useDeleteContract
export function useDeleteContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await contractsApi().remove(id);
      if (result.isOk()) return;
      throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}

// Hook: usePendingApprovals
export function usePendingApprovals() {
  return useQuery({
    queryKey: queryKeys.approvals.pending(),
    queryFn: async () => {
      const result = await approvalsApi().getPending();
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

// Hook: useApproveContract
export function useApproveContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      const result = await approvalsApi().approve(id, comments);
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
    },
  });
}

// Hook: useDashboardMetrics
export function useDashboardMetrics() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(),
    queryFn: async () => {
      const result = await analyticsApi().getDashboardMetrics();
      if (result.isOk()) return result.value;
      throw new Error(result.error.message);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
