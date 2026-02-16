'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, Clock, XCircle, AlertTriangle, X, Eye, Check, ThumbsDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWebSocket, type ApprovalNotification } from '@/contexts/websocket-context';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    whileHover?: object;
    className?: string;
    key?: string;
  }
>;

interface NotificationItemProps {
  notification: ApprovalNotification;
  onDismiss: (id: string) => void;
  onQuickApprove?: (approvalId: string) => void;
  onQuickReject?: (approvalId: string) => void;
  isProcessing?: boolean;
}

function NotificationItem({ notification, onDismiss, onQuickApprove, onQuickReject, isProcessing }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'new_approval':
        return <Clock className="w-4 h-4 text-amber-500" aria-hidden="true" />;
      case 'approval_completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />;
      case 'approval_rejected':
        return <XCircle className="w-4 h-4 text-red-500" aria-hidden="true" />;
      case 'step_completed':
        return <CheckCircle2 className="w-4 h-4 text-violet-500" aria-hidden="true" />;
      case 'deadline_reminder':
        return <AlertTriangle className="w-4 h-4 text-orange-500" aria-hidden="true" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" aria-hidden="true" />;
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-amber-500';
      default:
        return 'border-l-gray-300';
    }
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Check if this notification type can have quick actions
  const canQuickApprove = notification.type === 'new_approval' || notification.type === 'deadline_reminder';

  return (
    <MotionDiv
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      role="article"
      aria-label={`${notification.title}: ${notification.message}`}
      className={cn(
        "p-3 bg-white border-l-4 rounded-r-lg hover:bg-gray-50 transition-colors",
        getPriorityColor()
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {notification.title}
          </p>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          
          {/* Quick action buttons for new approvals */}
          {canQuickApprove && onQuickApprove && onQuickReject && (
            <div className="flex items-center gap-2 mt-2" role="group" aria-label="Quick actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickApprove(notification.approvalId);
                }}
                disabled={isProcessing}
                aria-label="Quick approve"
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  "bg-green-50 text-green-700 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="w-3 h-3" aria-hidden="true" />
                )}
                Approve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickReject(notification.approvalId);
                }}
                disabled={isProcessing}
                aria-label="Quick reject"
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  "bg-red-50 text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                ) : (
                  <ThumbsDown className="w-3 h-3" aria-hidden="true" />
                )}
                Reject
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">
              {timeAgo(notification.timestamp)}
            </span>
            <Link 
              href={`/approvals?id=${notification.approvalId}`}
              className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 focus:outline-none focus:underline"
              aria-label={`View ${notification.title}`}
            >
              <Eye className="w-3 h-3" aria-hidden="true" />
              View
            </Link>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label={`Dismiss notification: ${notification.title}`}
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>
    </MotionDiv>
  );
}

export function ApprovalNotificationBell() {
  const ws = useWebSocket();
  
  const approvalNotifications = ws?.approvalNotifications ?? [];
  const clearApprovalNotification = ws?.clearApprovalNotification ?? (() => {});
  
  const subscribeToApprovals = ws?.subscribeToApprovals ?? (() => {});
  const connected = ws?.connected ?? false;
  const [isOpen, setIsOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<ApprovalNotification[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Quick approve mutation
  const approveMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      const response = await fetch(`/api/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Approved via quick action' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      return response.json();
    },
    onSuccess: (_, approvalId) => {
      toast.success('Approval submitted', {
        description: 'The item has been approved successfully',
      });
      // Remove from notifications
      setLocalNotifications(prev => prev.filter(n => n.approvalId !== approvalId));
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
      setProcessingId(null);
    },
    onError: () => {
      toast.error('Failed to approve', {
        description: 'Please try again or view the full approval',
      });
      setProcessingId(null);
    },
  });

  // Quick reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      const response = await fetch(`/api/approvals/${approvalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected via quick action' }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      return response.json();
    },
    onSuccess: (_, approvalId) => {
      toast.success('Rejection submitted', {
        description: 'The item has been rejected',
      });
      // Remove from notifications
      setLocalNotifications(prev => prev.filter(n => n.approvalId !== approvalId));
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
      setProcessingId(null);
    },
    onError: () => {
      toast.error('Failed to reject', {
        description: 'Please try again or view the full approval',
      });
      setProcessingId(null);
    },
  });

  const handleQuickApprove = (approvalId: string) => {
    setProcessingId(approvalId);
    approveMutation.mutate(approvalId);
  };

  const handleQuickReject = (approvalId: string) => {
    setProcessingId(approvalId);
    rejectMutation.mutate(approvalId);
  };

  // Subscribe to approvals when connected
  useEffect(() => {
    if (connected) {
      subscribeToApprovals();
    }
     
  }, [connected, subscribeToApprovals]);

  // Merge websocket notifications with local state
  useEffect(() => {
    setLocalNotifications(prev => {
      const ids = new Set(prev.map((n: ApprovalNotification) => n.id));
      const newNotifs = approvalNotifications.filter((n: ApprovalNotification) => !ids.has(n.id));
      return [...newNotifs, ...prev].slice(0, 50);
    });
     
  }, [approvalNotifications]);

  // Fetch pending approvals from API when not connected to WebSocket
  useEffect(() => {
    if (!connected && localNotifications.length === 0) {
      (async () => {
        try {
          const res = await fetch('/api/approvals');
          const json = await res.json();
          if (json.success && json.data?.items) {
            const pending = json.data.items
              .filter((item: any) => item.status === 'pending')
              .slice(0, 10)
              .map((item: any) => ({
                id: `notif-${item.id}`,
                type: 'new_approval' as const,
                title: item.title || item.contractName || 'Approval Request',
                message: `${item.supplierName || item.counterparty || 'Contract'} requires your approval`,
                approvalId: item.id,
                priority: item.priority || 'medium',
                timestamp: new Date(item.createdAt || Date.now()),
              }));
            if (pending.length > 0) {
              setLocalNotifications(pending);
            }
          }
        } catch {
          // Could not load — show empty
        }
      })();
    }
     
  }, [connected, localNotifications.length]);

  const handleDismiss = (id: string) => {
    clearApprovalNotification(id);
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    setLocalNotifications([]);
  };

  const unreadCount = localNotifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2"
          aria-label={`${unreadCount} approval notifications`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <MotionDiv key="unread-count"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </MotionDiv>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 overflow-hidden" 
        align="end"
        sideOffset={8}
      >
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Approval Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-violet-600 hover:text-violet-700"
              >
                Clear all
              </button>
            )}
          </div>
          {connected && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Live updates</span>
            </div>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {localNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notifications</p>
              <p className="text-xs text-gray-400 mt-1">
                You&apos;ll be notified of approval updates here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <AnimatePresence>
                {localNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                    onQuickApprove={handleQuickApprove}
                    onQuickReject={handleQuickReject}
                    isProcessing={processingId === notification.approvalId}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-4 py-2 border-t">
          <Link 
            href="/approvals"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            onClick={() => setIsOpen(false)}
          >
            View all approvals →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ApprovalNotificationBell;
