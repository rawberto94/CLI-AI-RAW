'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/contexts/websocket-context';
import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface Approval {
  id: string;
  type: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  currentStep: number;
  totalSteps: number;
  approvers: ApprovalStep[];
}

interface ApprovalStep {
  step: number;
  role: string;
  status: string;
  approver: string;
  completedAt: string | null;
}

interface Share {
  id: string;
  documentId: string;
  sharedWith: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  mentions: string[];
  isResolved: boolean;
  createdAt: string;
  replies?: Comment[];
}

// ============================================================================
// useNotifications Hook
// ============================================================================

export function useNotifications(options?: { unreadOnly?: boolean; pollInterval?: number }) {
  const queryClient = useQueryClient();
  const wsContext = useWebSocket();

  // Fetch notifications
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', options?.unreadOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.unreadOnly) params.set('unread', 'true');
      
      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    refetchInterval: options?.pollInterval || 30000, // Default 30s polling
    staleTime: 10000,
  });

  // Real-time notification updates via WebSocket
  useEffect(() => {
    if (!wsContext?.onEvent) return;
    
    const unsubscribe = wsContext.onEvent((event: unknown) => {
      const typedEvent = event as { type?: string; data?: Notification };
      if (typedEvent.type === 'notification' && typedEvent.data) {
        queryClient.setQueryData(['notifications', options?.unreadOnly], (old: { notifications?: Notification[]; unreadCount?: number }) => ({
          ...old,
          notifications: [typedEvent.data!, ...(old?.notifications || [])],
          unreadCount: (old?.unreadCount || 0) + 1,
        }));
      }
    });

    return () => unsubscribe?.();
  }, [wsContext, queryClient, options?.unreadOnly]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: (data?.notifications || []) as Notification[],
    unreadCount: data?.unreadCount || 0,
    isLoading,
    error,
    refetch,
    markAsRead: (ids: string[]) => markAsReadMutation.mutateAsync(ids),
    markAllAsRead: () => markAllAsReadMutation.mutateAsync(),
  };
}

// ============================================================================
// useApprovalFlow Hook
// ============================================================================

export function useApprovalFlow(approvalId?: string) {
  const queryClient = useQueryClient();

  // Fetch all approvals
  const approvalsQuery = useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const response = await fetch('/api/approvals');
      if (!response.ok) throw new Error('Failed to fetch approvals');
      const data = await response.json();
      return data.data;
    },
    staleTime: 30000,
  });

  // Fetch single approval details
  const approvalQuery = useQuery({
    queryKey: ['approval', approvalId],
    queryFn: async () => {
      if (!approvalId) return null;
      const response = await fetch(`/api/approvals/${approvalId}`);
      if (!response.ok) throw new Error('Failed to fetch approval');
      return response.json();
    },
    enabled: !!approvalId,
    staleTime: 10000,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approvalId: id, comment }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval', approvalId] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', approvalId: id, reason }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  // Delegate mutation
  const delegateMutation = useMutation({
    mutationFn: async ({ id, delegateTo }: { id: string; delegateTo: string }) => {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delegate', approvalId: id, delegateTo }),
      });
      if (!response.ok) throw new Error('Failed to delegate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'escalate', approvalId: id }),
      });
      if (!response.ok) throw new Error('Failed to escalate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  return {
    approvals: (approvalsQuery.data?.items || approvalsQuery.data?.approvals || []) as Approval[],
    stats: approvalsQuery.data?.stats,
    currentApproval: approvalQuery.data,
    isLoading: approvalsQuery.isLoading,
    error: approvalsQuery.error,
    approve: (id: string, comment?: string) => approveMutation.mutateAsync({ id, comment }),
    reject: (id: string, reason: string) => rejectMutation.mutateAsync({ id, reason }),
    delegate: (id: string, delegateTo: string) => delegateMutation.mutateAsync({ id, delegateTo }),
    escalate: (id: string) => escalateMutation.mutateAsync(id),
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    refetch: approvalsQuery.refetch,
  };
}

// ============================================================================
// useContractApprovalStatus Hook
// ============================================================================

interface ContractApprovalStatus {
  hasActiveApproval: boolean;
  status: 'none' | 'pending' | 'in_progress' | 'approved' | 'rejected';
  currentStep?: number;
  totalSteps?: number;
  currentApprover?: string;
  dueDate?: string;
  executionId?: string;
}

export function useContractApprovalStatus(contractId?: string) {
  const { data, isLoading, error, refetch } = useQuery<ContractApprovalStatus>({
    queryKey: ['contract-approval-status', contractId],
    queryFn: async () => {
      if (!contractId) {
        return { hasActiveApproval: false, status: 'none' as const };
      }
      
      try {
        const response = await fetch(`/api/approvals?contractId=${contractId}`);
        if (!response.ok) {
          return { hasActiveApproval: false, status: 'none' as const };
        }
        
        const data = await response.json();
        const items = data.data?.items || [];
        
        // Find active approval for this contract
        const activeApproval = items.find((item: { 
          status: string; 
          contractId?: string;
        }) => 
          item.status === 'pending' || item.status === 'in_progress'
        );
        
        if (activeApproval) {
          return {
            hasActiveApproval: true,
            status: (activeApproval.status || 'pending') as 'pending' | 'in_progress',
            currentStep: activeApproval.currentStep || 1,
            totalSteps: activeApproval.totalSteps || 2,
            currentApprover: activeApproval.assignedTo?.name || activeApproval.stage,
            dueDate: activeApproval.dueDate,
            executionId: activeApproval.id,
          };
        }
        
        // Check for completed approvals
        const completedApproval = items.find((item: { status: string }) => 
          item.status === 'approved' || item.status === 'rejected'
        );
        
        if (completedApproval) {
          return {
            hasActiveApproval: false,
            status: completedApproval.status as 'approved' | 'rejected',
            executionId: completedApproval.id,
          };
        }
        
        return { hasActiveApproval: false, status: 'none' as const };
      } catch {
        return { hasActiveApproval: false, status: 'none' as const };
      }
    },
    enabled: !!contractId,
    staleTime: 30000,
    refetchInterval: 60000, // Auto-refresh every minute
  });

  return {
    approvalStatus: data || { hasActiveApproval: false, status: 'none' as const },
    isLoading,
    error,
    refetch,
  };
}

// ============================================================================
// useSharing Hook
// ============================================================================

export function useSharing(documentId: string, documentType: 'contract' | 'rate_card' | 'template' | 'workflow') {
  const queryClient = useQueryClient();

  // Fetch shares
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['shares', documentId, documentType],
    queryFn: async () => {
      const response = await fetch(`/api/sharing?documentId=${documentId}&documentType=${documentType}`);
      if (!response.ok) throw new Error('Failed to fetch shares');
      return response.json();
    },
    enabled: !!documentId,
    staleTime: 30000,
  });

  // Create share mutation
  const shareMutation = useMutation({
    mutationFn: async (params: { 
      recipients: string[]; 
      permission: string; 
      message?: string;
      expiresAt?: string;
    }) => {
      const response = await fetch('/api/sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId, 
          documentType,
          ...params,
        }),
      });
      if (!response.ok) throw new Error('Failed to create share');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', documentId, documentType] });
    },
  });

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ shareId, permission }: { shareId: string; permission: string }) => {
      const response = await fetch('/api/sharing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, permission }),
      });
      if (!response.ok) throw new Error('Failed to update permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', documentId, documentType] });
    },
  });

  // Revoke share mutation
  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const response = await fetch(`/api/sharing?id=${shareId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to revoke share');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', documentId, documentType] });
    },
  });

  return {
    shares: (data?.shares || []) as Share[],
    isLoading,
    error,
    refetch,
    share: shareMutation.mutateAsync,
    updatePermission: (shareId: string, permission: string) => 
      updatePermissionMutation.mutateAsync({ shareId, permission }),
    revoke: revokeMutation.mutateAsync,
    isSharing: shareMutation.isPending,
  };
}

// ============================================================================
// useComments Hook
// ============================================================================

export function useComments(contractId: string) {
  const queryClient = useQueryClient();
  const wsContext = useWebSocket();

  // Fetch comments
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['comments', contractId],
    queryFn: async () => {
      const response = await fetch(`/api/contracts/${contractId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!contractId,
    staleTime: 10000,
  });

  // Real-time comment updates via WebSocket
  useEffect(() => {
    if (!wsContext?.onEvent) return;
    
    const unsubscribe = wsContext.onEvent((event: unknown) => {
      const typedEvent = event as { type?: string; data?: Comment; contractId?: string };
      if (typedEvent.type === 'comment' && typedEvent.contractId === contractId) {
        queryClient.invalidateQueries({ queryKey: ['comments', contractId] });
      }
    });

    return () => unsubscribe?.();
  }, [wsContext, contractId, queryClient]);

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentId, mentions }: { 
      content: string; 
      parentId?: string; 
      mentions?: string[];
    }) => {
      const response = await fetch(`/api/contracts/${contractId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content, 
          parentId, 
          mentions,
          author: 'Current User', // TODO: Get from auth context
          authorEmail: 'user@company.com',
        }),
      });
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', contractId] });
    },
  });

  // Resolve comment mutation
  const resolveCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(`/api/contracts/${contractId}/comments/${commentId}/resolve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to resolve comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', contractId] });
    },
  });

  return {
    comments: (data?.comments || []) as Comment[],
    isLoading,
    error,
    refetch,
    addComment: (content: string, parentId?: string, mentions?: string[]) => 
      addCommentMutation.mutateAsync({ content, parentId, mentions }),
    resolveComment: resolveCommentMutation.mutateAsync,
    isPosting: addCommentMutation.isPending,
  };
}

// ============================================================================
// useCollaboration Hook (Unified)
// ============================================================================

export function useCollaboration(documentId: string, documentType: 'contract' | 'rate_card' | 'template' | 'workflow') {
  const wsContext = useWebSocket();
  const [activeUsers, setActiveUsers] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Join document room on mount
  useEffect(() => {
    if (wsContext?.joinDocument) {
      wsContext.joinDocument(documentId, documentType);
      setIsConnected(wsContext.connected ?? false);
    }

    return () => {
      wsContext?.leaveDocument?.();
    };
  }, [wsContext, documentId, documentType]);

  // Track active users
  useEffect(() => {
    if (wsContext?.presence) {
      const users = Array.from(wsContext.presence.values()).map((p: { userId?: string; name?: string; status?: string }) => ({
        id: p.userId || 'unknown',
        name: p.name || 'Unknown',
        status: p.status || 'viewing',
      }));
      setActiveUsers(users);
    }
  }, [wsContext?.presence]);

  // Connection status tracking
  useEffect(() => {
    setIsConnected(wsContext?.connected ?? false);
  }, [wsContext?.connected]);

  // Get combined hooks
  const notifications = useNotifications({ pollInterval: 60000 });
  const sharing = useSharing(documentId, documentType);
  const comments = documentType === 'contract' ? useComments(documentId) : null;

  return {
    // Connection status
    isConnected,
    activeUsers,
    
    // Notifications
    notifications: notifications.notifications,
    unreadCount: notifications.unreadCount,
    markNotificationAsRead: notifications.markAsRead,
    
    // Sharing
    shares: sharing.shares,
    share: sharing.share,
    updateSharePermission: sharing.updatePermission,
    revokeShare: sharing.revoke,
    
    // Comments (contracts only)
    comments: comments?.comments || [],
    addComment: comments?.addComment,
    resolveComment: comments?.resolveComment,
    
    // Cursor/presence updates
    updateCursor: wsContext?.updateCursor,
    broadcastEdit: wsContext?.broadcastEdit,
    lockSection: wsContext?.lockSection,
    unlockSection: wsContext?.unlockSection,
  };
}

export default {
  useNotifications,
  useApprovalFlow,
  useContractApprovalStatus,
  useSharing,
  useComments,
  useCollaboration,
};
