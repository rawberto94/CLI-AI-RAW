"use client";

/**
 * Offline Status Indicator Component
 * 
 * Shows network status and pending offline requests.
 * Provides sync controls and queue management.
 */

import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOfflineQueue, QueuedRequest } from '@/lib/ai/offline-queue.service';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OfflineStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
  position?: 'fixed' | 'relative';
}

export function OfflineStatusIndicator({
  showDetails = true,
  className = '',
  position = 'fixed',
}: OfflineStatusIndicatorProps) {
  const {
    queue,
    isOnline,
    isSyncing,
    sync,
    clear,
    remove,
    pendingCount,
    hasQueuedRequests,
  } = useOfflineQueue();

  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when going offline with pending requests
  useEffect(() => {
    if (!isOnline && hasQueuedRequests) {
      setIsExpanded(true);
    }
  }, [isOnline, hasQueuedRequests]);

  // Don't render if online and no queued requests
  if (isOnline && !hasQueuedRequests) {
    return null;
  }

  const positionClass = position === 'fixed' 
    ? 'fixed bottom-4 right-4 z-50' 
    : '';

  return (
    <div className={`${positionClass} ${className}`}>
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-lg shadow-lg w-80"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <div className="flex items-center gap-1.5 text-green-600">
                    <Wifi className="w-4 h-4" />
                    <span className="text-sm font-medium">Online</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Offline</span>
                  </div>
                )}
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {pendingCount} pending
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Queue List */}
            {showDetails && queue.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                {queue.slice(0, 5).map((request) => (
                  <QueueItem
                    key={request.id}
                    request={request}
                    onRemove={() => remove(request.id)}
                  />
                ))}
                {queue.length > 5 && (
                  <div className="px-3 py-2 text-xs text-slate-500 text-center">
                    +{queue.length - 5} more requests
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {showDetails && queue.length === 0 && !isOnline && (
              <div className="p-4 text-center text-slate-500 text-sm">
                <CloudOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>You&apos;re offline</p>
                <p className="text-xs mt-1">Requests will be queued automatically</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-100 rounded-b-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                disabled={queue.length === 0}
                className="text-slate-500"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={sync}
                disabled={!isOnline || isSyncing || pendingCount === 0}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-colors ${
              isOnline
                ? 'bg-violet-500 text-white hover:bg-violet-600'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            {isOnline ? (
              <Cloud className="w-4 h-4" />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{pendingCount}</span>
            <ChevronUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Queue Item Component
function QueueItem({
  request,
  onRemove,
}: {
  request: QueuedRequest;
  onRemove: () => void;
}) {
  const typeLabels: Record<string, string> = {
    chat: 'Chat',
    analysis: 'Analysis',
    suggestion: 'Suggestion',
    batch: 'Batch',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-slate-400" />,
    processing: <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
      {statusIcons[request.status]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {typeLabels[request.type] || request.type}
        </p>
        <p className="text-xs text-slate-400">
          {formatTime(request.createdAt)}
          {request.retryCount > 0 && ` • Retry ${request.retryCount}`}
        </p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onRemove}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove from queue</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// Compact Offline Badge
export function OfflineBadge() {
  const { isOnline, pendingCount } = useOfflineQueue();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        isOnline
          ? 'bg-violet-100 text-violet-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      {isOnline ? (
        <Cloud className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      {isOnline ? `${pendingCount} syncing` : 'Offline'}
    </div>
  );
}

// Network Status Hook with Toast
export function useNetworkStatusToast() {
  const { isOnline } = useOfflineQueue();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      // Offline - requests will be queued
    } else if (wasOffline) {
      // Back online - syncing queued requests
      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  return { isOnline };
}

export default OfflineStatusIndicator;
