'use client';

/**
 * Network Status & Offline Mode Indicator
 * Shows connection status and queues actions when offline
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type ConnectionStatus = 'online' | 'offline' | 'slow' | 'reconnecting';

export interface NetworkState {
  status: ConnectionStatus;
  isOnline: boolean;
  effectiveType: string | null; // '4g', '3g', '2g', 'slow-2g'
  downlink: number | null; // Mbps
  rtt: number | null; // Round trip time in ms
  lastOnline: Date | null;
  pendingActions: number;
}

interface PendingAction {
  id: string;
  action: () => Promise<void>;
  description: string;
  timestamp: Date;
  retries: number;
}

interface NetworkContextValue extends NetworkState {
  queueAction: (action: () => Promise<void>, description: string) => string;
  cancelAction: (id: string) => void;
  retryNow: () => void;
}

// ============================================
// Network Context
// ============================================

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}

// ============================================
// Network Provider
// ============================================

interface NetworkProviderProps {
  children: React.ReactNode;
  pingUrl?: string;
  pingInterval?: number;
}

export function NetworkProvider({
  children,
  pingUrl = '/api/monitoring/health',
  pingInterval = 30000,
}: NetworkProviderProps) {
  const [state, setState] = useState<NetworkState>({
    status: 'online',
    isOnline: true,
    effectiveType: null,
    downlink: null,
    rtt: null,
    lastOnline: new Date(),
    pendingActions: 0,
  });

  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  // Update network info from Network Information API
  const updateNetworkInfo = useCallback(() => {
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;

    if (connection) {
      setState(prev => ({
        ...prev,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        status: connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' 
          ? 'slow' 
          : prev.status,
      }));
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        status: 'reconnecting',
        isOnline: true,
        lastOnline: new Date(),
      }));

      // Verify connection with ping
      fetch(pingUrl, { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          setState(prev => ({ ...prev, status: 'online' }));
        })
        .catch(() => {
          setState(prev => ({ ...prev, status: 'slow' }));
        });
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        status: 'offline',
        isOnline: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }
    updateNetworkInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, [pingUrl, updateNetworkInfo]);

  // Periodic connectivity check
  useEffect(() => {
    const checkConnectivity = async () => {
      if (!navigator.onLine) return;

      try {
        const start = performance.now();
        const response = await fetch(pingUrl, { 
          method: 'HEAD', 
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        const latency = performance.now() - start;

        setState(prev => ({
          ...prev,
          status: response.ok ? (latency > 2000 ? 'slow' : 'online') : 'slow',
          rtt: Math.round(latency),
        }));
      } catch {
        if (navigator.onLine) {
          setState(prev => ({ ...prev, status: 'slow' }));
        }
      }
    };

    const interval = setInterval(checkConnectivity, pingInterval);
    return () => clearInterval(interval);
  }, [pingUrl, pingInterval]);

  // Process pending actions when online
  useEffect(() => {
    if (state.status !== 'online' || pendingActions.length === 0) return;

    const processActions = async () => {
      for (const action of pendingActions) {
        try {
          await action.action();
          setPendingActions(prev => prev.filter(a => a.id !== action.id));
        } catch (error) {
          console.error(`Failed to execute pending action: ${action.description}`, error);
          
          // Retry up to 3 times
          if (action.retries < 3) {
            setPendingActions(prev =>
              prev.map(a =>
                a.id === action.id ? { ...a, retries: a.retries + 1 } : a
              )
            );
          } else {
            // Remove after max retries
            setPendingActions(prev => prev.filter(a => a.id !== action.id));
          }
        }
      }
    };

    processActions();
  }, [state.status, pendingActions]);

  // Update pending count in state
  useEffect(() => {
    setState(prev => ({ ...prev, pendingActions: pendingActions.length }));
  }, [pendingActions.length]);

  // Queue action for offline execution
  const queueAction = useCallback((action: () => Promise<void>, description: string): string => {
    const id = `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    setPendingActions(prev => [
      ...prev,
      { id, action, description, timestamp: new Date(), retries: 0 },
    ]);

    return id;
  }, []);

  // Cancel pending action
  const cancelAction = useCallback((id: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== id));
  }, []);

  // Force retry all pending actions
  const retryNow = useCallback(() => {
    if (state.isOnline && pendingActions.length > 0) {
      // Trigger re-processing by updating state
      setState(prev => ({ ...prev }));
    }
  }, [state.isOnline, pendingActions.length]);

  const value: NetworkContextValue = {
    ...state,
    queueAction,
    cancelAction,
    retryNow,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

// ============================================
// Network Status Banner
// ============================================

interface NetworkStatusBannerProps {
  position?: 'top' | 'bottom';
  showWhenOnline?: boolean;
}

export function NetworkStatusBanner({
  position = 'top',
  showWhenOnline = false,
}: NetworkStatusBannerProps) {
  const { status, pendingActions, retryNow } = useNetwork();

  const shouldShow = status !== 'online' || (showWhenOnline && pendingActions > 0);

  const statusConfig = {
    offline: {
      bg: 'bg-red-500',
      icon: WifiOff,
      message: 'You are offline',
      submessage: pendingActions > 0 
        ? `${pendingActions} action${pendingActions > 1 ? 's' : ''} queued`
        : 'Changes will sync when you reconnect',
    },
    slow: {
      bg: 'bg-amber-500',
      icon: AlertTriangle,
      message: 'Slow connection detected',
      submessage: 'Some features may be delayed',
    },
    reconnecting: {
      bg: 'bg-blue-500',
      icon: RefreshCw,
      message: 'Reconnecting...',
      submessage: 'Restoring your connection',
    },
    online: {
      bg: 'bg-emerald-500',
      icon: Wifi,
      message: 'Back online',
      submessage: pendingActions > 0 
        ? `Syncing ${pendingActions} pending action${pendingActions > 1 ? 's' : ''}...`
        : 'All changes synced',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -50 : 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -50 : 50 }}
          className={cn(
            'fixed left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-white text-sm',
            config.bg,
            position === 'top' ? 'top-0' : 'bottom-0'
          )}
        >
          <Icon className={cn('w-4 h-4', status === 'reconnecting' && 'animate-spin')} />
          <span className="font-medium">{config.message}</span>
          <span className="opacity-80">—</span>
          <span className="opacity-80">{config.submessage}</span>
          {status === 'offline' && pendingActions > 0 && (
            <button
              onClick={retryNow}
              className="ml-2 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
            >
              Retry Now
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Compact Network Indicator
// ============================================

interface NetworkIndicatorProps {
  showLabel?: boolean;
  className?: string;
}

export function NetworkIndicator({ showLabel = true, className }: NetworkIndicatorProps) {
  const { status, effectiveType, pendingActions } = useNetwork();

  const indicatorConfig = {
    online: { color: 'bg-emerald-500', label: 'Online' },
    offline: { color: 'bg-red-500', label: 'Offline' },
    slow: { color: 'bg-amber-500', label: 'Slow' },
    reconnecting: { color: 'bg-blue-500 animate-pulse', label: 'Connecting...' },
  };

  const config = indicatorConfig[status];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        {pendingActions > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 text-[8px] text-white items-center justify-center font-bold">
              {pendingActions > 9 ? '9+' : pendingActions}
            </span>
          </span>
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {config.label}
          {effectiveType && status === 'online' && ` (${effectiveType})`}
        </span>
      )}
    </div>
  );
}

// ============================================
// Offline Action Wrapper
// ============================================

interface OfflineActionProps {
  children: React.ReactNode;
  onAction: () => Promise<void>;
  actionDescription: string;
  disabled?: boolean;
}

export function OfflineAction({
  children,
  onAction,
  actionDescription,
  disabled,
}: OfflineActionProps) {
  const { isOnline, queueAction } = useNetwork();
  const [isPending, setIsPending] = useState(false);

  const handleAction = async () => {
    if (disabled) return;

    if (isOnline) {
      setIsPending(true);
      try {
        await onAction();
      } finally {
        setIsPending(false);
      }
    } else {
      // Queue for later
      queueAction(onAction, actionDescription);
    }
  };

  return (
    <div 
      onClick={handleAction}
      className={cn(
        'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        isPending && 'opacity-75 pointer-events-none'
      )}
    >
      {children}
    </div>
  );
}

export default NetworkProvider;
