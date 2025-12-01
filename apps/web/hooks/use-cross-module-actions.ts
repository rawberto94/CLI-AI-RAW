/**
 * Cross-Module Action Hooks
 * Unified hooks for actions that can be used across all modules
 * Provides consistent API for approvals, notifications, sharing, and AI features
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { copyToClipboard } from './useCopyToClipboard';

// =====================
// Types
// =====================

export interface Approval {
  id: string;
  contractId: string;
  requesterId: string;
  approverId?: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'approval' | 'comment' | 'deadline' | 'share' | 'ai' | 'system';
  title: string;
  message: string;
  read: boolean;
  contractId?: string;
  link?: string;
  createdAt: string;
}

export interface ShareRequest {
  contractId: string;
  recipientEmails: string[];
  permission: 'view' | 'comment' | 'edit';
  message?: string;
  expiresAt?: string;
}

export interface AIAnalysisRequest {
  contractId: string;
  analysisType: 'full' | 'risk' | 'compliance' | 'comparison';
  options?: Record<string, unknown>;
}

// =====================
// Query Keys
// =====================

export const crossModuleKeys = {
  approvals: {
    all: ['approvals'] as const,
    pending: () => [...crossModuleKeys.approvals.all, 'pending'] as const,
    byContract: (contractId: string) => [...crossModuleKeys.approvals.all, 'contract', contractId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unread: () => [...crossModuleKeys.notifications.all, 'unread'] as const,
  },
  shares: {
    all: ['shares'] as const,
    byContract: (contractId: string) => [...crossModuleKeys.shares.all, 'contract', contractId] as const,
  },
  ai: {
    analysis: (contractId: string) => ['ai', 'analysis', contractId] as const,
    suggestions: (query: string) => ['ai', 'suggestions', query] as const,
    history: () => ['ai', 'history'] as const,
  },
};

// =====================
// Fetch Helpers
// =====================

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
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
// Approval Hooks
// =====================

/**
 * Get pending approvals for the current user
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: crossModuleKeys.approvals.pending(),
    queryFn: () => fetchAPI<{ data: { approvals: Approval[] } }>('/api/approvals?status=pending'),
    select: (data) => data.data?.approvals || [],
  });
}

/**
 * Get approvals for a specific contract
 */
export function useContractApprovals(contractId: string) {
  return useQuery({
    queryKey: crossModuleKeys.approvals.byContract(contractId),
    queryFn: () => fetchAPI<{ data: { approvals: Approval[] } }>(`/api/approvals?contractId=${contractId}`),
    enabled: !!contractId,
    select: (data) => data.data?.approvals || [],
  });
}

/**
 * Request approval for a contract
 */
export function useRequestApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { contractId: string; approverId: string; comments?: string }) => {
      return fetchAPI<{ data: Approval }>('/api/approvals', {
        method: 'POST',
        body: JSON.stringify({
          contractId: data.contractId,
          approverId: data.approverId,
          comments: data.comments,
        }),
      });
    },
    onSuccess: (_, variables) => {
      toast.success('Approval request sent');
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.approvals.all });
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.notifications.all });
    },
    onError: (error) => {
      toast.error(`Failed to request approval: ${error.message}`);
    },
  });
}

/**
 * Approve or reject an approval request
 */
export function useRespondToApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { approvalId: string; action: 'approve' | 'reject'; comments?: string }) => {
      return fetchAPI<{ data: Approval }>(`/api/approvals/${data.approvalId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: data.action === 'approve' ? 'approved' : 'rejected',
          comments: data.comments,
        }),
      });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'approve' ? 'Approved successfully' : 'Rejected successfully');
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.approvals.all });
    },
    onError: (error) => {
      toast.error(`Failed to respond to approval: ${error.message}`);
    },
  });
}

// =====================
// Notification Hooks
// =====================

/**
 * Get all notifications
 */
export function useNotifications() {
  return useQuery({
    queryKey: crossModuleKeys.notifications.all,
    queryFn: () => fetchAPI<{ data: { notifications: Notification[] } }>('/api/notifications'),
    select: (data) => data.data?.notifications || [],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: crossModuleKeys.notifications.unread(),
    queryFn: () => fetchAPI<{ data: { count: number } }>('/api/notifications/unread'),
    select: (data) => data.data?.count || 0,
    refetchInterval: 30000,
  });
}

/**
 * Mark notifications as read
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      return fetchAPI<{ success: boolean }>('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notificationIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.notifications.all });
    },
  });
}

// =====================
// Sharing Hooks
// =====================

/**
 * Share a contract with users
 */
export function useShareContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: ShareRequest) => {
      return fetchAPI<{ data: { shareId: string } }>('/api/sharing', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Contract shared with ${variables.recipientEmails.length} recipient(s)`);
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.shares.byContract(variables.contractId) });
    },
    onError: (error) => {
      toast.error(`Failed to share: ${error.message}`);
    },
  });
}

/**
 * Get shares for a contract
 */
export function useContractShares(contractId: string) {
  return useQuery({
    queryKey: crossModuleKeys.shares.byContract(contractId),
    queryFn: () => fetchAPI<{ data: { shares: any[] } }>(`/api/sharing?contractId=${contractId}`),
    enabled: !!contractId,
    select: (data) => data.data?.shares || [],
  });
}

/**
 * Revoke a share
 */
export function useRevokeShare() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (shareId: string) => {
      return fetchAPI<{ success: boolean }>(`/api/sharing/${shareId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast.success('Share revoked');
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.shares.all });
    },
    onError: (error) => {
      toast.error(`Failed to revoke share: ${error.message}`);
    },
  });
}

// =====================
// AI Action Hooks
// =====================

/**
 * Run AI analysis on a contract
 */
export function useRunAIAnalysis() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: AIAnalysisRequest) => {
      return fetchAPI<{ data: any }>('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          contractId: request.contractId,
          type: request.analysisType,
          ...request.options,
        }),
      });
    },
    onSuccess: (_, variables) => {
      toast.success('AI analysis completed');
      queryClient.invalidateQueries({ queryKey: crossModuleKeys.ai.analysis(variables.contractId) });
    },
    onError: (error) => {
      toast.error(`AI analysis failed: ${error.message}`);
    },
  });
}

/**
 * Get AI suggestions based on query
 */
export function useAISuggestions(query: string) {
  return useQuery({
    queryKey: crossModuleKeys.ai.suggestions(query),
    queryFn: () => fetchAPI<{ data: { suggestions: string[] } }>(`/api/ai/suggestions?query=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 60000,
    select: (data) => data.data?.suggestions || [],
  });
}

/**
 * Chat with AI about a contract
 */
export function useAIChat() {
  return useMutation({
    mutationFn: async (data: { contractId?: string; message: string; history?: any[] }) => {
      return fetchAPI<{ data: { response: string } }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  });
}

/**
 * Get AI query history
 */
export function useAIQueryHistory() {
  return useQuery({
    queryKey: crossModuleKeys.ai.history(),
    queryFn: () => fetchAPI<{ data: { queries: any[] } }>('/api/ai/history'),
    select: (data) => data.data?.queries || [],
  });
}

// =====================
// Quick Action Hooks
// =====================

/**
 * Combined hook for quick actions on a contract
 */
export function useContractActions(contractId: string) {
  const router = useRouter();
  const shareContract = useShareContract();
  const requestApproval = useRequestApproval();
  const runAnalysis = useRunAIAnalysis();
  
  return {
    // Navigation actions
    viewDetails: () => router.push(`/contracts/${contractId}`),
    viewAIAnalysis: () => router.push(`/contracts/${contractId}?tab=artifacts`),
    viewVersions: () => router.push(`/contracts/${contractId}/versions`),
    askAI: () => window.dispatchEvent(new CustomEvent('openAIChatbot')),
    
    // Sharing
    share: (emails: string[], permission: 'view' | 'comment' | 'edit' = 'view') => {
      return shareContract.mutateAsync({
        contractId,
        recipientEmails: emails,
        permission,
      });
    },
    isSharing: shareContract.isPending,
    
    // Approvals
    requestApproval: (approverId: string, comments?: string) => {
      return requestApproval.mutateAsync({
        contractId,
        approverId,
        comments,
      });
    },
    isRequestingApproval: requestApproval.isPending,
    
    // AI
    runAnalysis: (type: 'full' | 'risk' | 'compliance' | 'comparison' = 'full') => {
      return runAnalysis.mutateAsync({
        contractId,
        analysisType: type,
      });
    },
    isAnalyzing: runAnalysis.isPending,
    
    // Copy link
    copyLink: () => {
      copyToClipboard(`${window.location.origin}/contracts/${contractId}`, {
        successMessage: 'Link copied to clipboard',
      });
    },
    
    // Download
    download: async (format: 'pdf' | 'word' = 'pdf') => {
      try {
        const response = await fetch(`/api/contracts/${contractId}/export?format=${format}`, {
          headers: { 'x-tenant-id': 'demo' },
        });
        
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract-${contractId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success('Download started');
      } catch (error) {
        toast.error('Failed to download contract');
      }
    },
  };
}

// =====================
// Bulk Action Hooks
// =====================

/**
 * Bulk operations on multiple contracts
 */
export function useBulkContractActions() {
  const queryClient = useQueryClient();
  
  const bulkMutation = useMutation({
    mutationFn: async (data: { 
      contractIds: string[]; 
      operation: 'export' | 'analyze' | 'share' | 'delete';
      options?: Record<string, unknown>;
    }) => {
      return fetchAPI<{ success: boolean; message: string }>('/api/contracts/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Bulk ${variables.operation} completed for ${variables.contractIds.length} contracts`);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (error) => {
      toast.error(`Bulk operation failed: ${error.message}`);
    },
  });
  
  return {
    bulkExport: (contractIds: string[]) => 
      bulkMutation.mutateAsync({ contractIds, operation: 'export' }),
    bulkAnalyze: (contractIds: string[]) => 
      bulkMutation.mutateAsync({ contractIds, operation: 'analyze' }),
    bulkShare: (contractIds: string[], emails: string[]) => 
      bulkMutation.mutateAsync({ contractIds, operation: 'share', options: { emails } }),
    bulkDelete: (contractIds: string[]) => 
      bulkMutation.mutateAsync({ contractIds, operation: 'delete' }),
    isPending: bulkMutation.isPending,
  };
}

// =====================
// Deadline Hooks
// =====================

/**
 * Get upcoming deadlines
 */
export function useUpcomingDeadlines(daysAhead: number = 90) {
  return useQuery({
    queryKey: ['deadlines', 'upcoming', daysAhead],
    queryFn: async () => {
      const response = await fetch(`/api/contracts?expiresWithin=${daysAhead}`, {
        headers: { 'x-tenant-id': 'demo', 'x-data-mode': 'real' },
      });
      
      if (!response.ok) throw new Error('Failed to fetch deadlines');
      
      const data = await response.json();
      return data.data?.contracts || [];
    },
    staleTime: 60000,
  });
}

/**
 * Set deadline reminder
 */
export function useSetDeadlineReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { contractId: string; reminderDate: string; type: 'expiration' | 'renewal' }) => {
      return fetchAPI<{ success: boolean }>('/api/reminders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Reminder set successfully');
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
    },
    onError: (error) => {
      toast.error(`Failed to set reminder: ${error.message}`);
    },
  });
}
