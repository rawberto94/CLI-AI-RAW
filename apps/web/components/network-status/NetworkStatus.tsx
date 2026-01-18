'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, CloudOff, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

interface NetworkState {
  isOnline: boolean;
  wasOffline: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  quality: ConnectionQuality;
}

interface NetworkContextValue extends NetworkState {
  checkConnection: () => Promise<boolean>;
  retry: () => void;
}

// ============================================================================
// Context
// ============================================================================

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkStatusProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface NetworkStatusProviderProps {
  children: React.ReactNode;
  pingUrl?: string;
  pingInterval?: number;
  showBanner?: boolean;
}

export function NetworkStatusProvider({
  children,
  pingUrl = '/api/health',
  pingInterval = 30000,
  showBanner = true,
}: NetworkStatusProviderProps) {
  const [state, setState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    quality: 'good',
  });

  const [showReconnected, setShowReconnected] = useState(false);

  // Get connection quality
  const getConnectionQuality = useCallback((): ConnectionQuality => {
    if (!state.isOnline) return 'offline';
    
    const connection = (navigator as unknown as { connection?: NetworkInformation })?.connection;
    if (!connection) return 'good';

    const { effectiveType, rtt } = connection;

    if (effectiveType === '4g' && (rtt === undefined || rtt < 100)) return 'excellent';
    if (effectiveType === '4g' || effectiveType === '3g') return 'good';
    if (effectiveType === '2g') return 'fair';
    return 'poor';
  }, [state.isOnline]);

  // Check actual connection
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [pingUrl]);

  // Update network info
  const updateNetworkInfo = useCallback(() => {
    const connection = (navigator as unknown as { connection?: NetworkInformation })?.connection;
    
    setState(prev => ({
      ...prev,
      isOnline: navigator.onLine,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      quality: getConnectionQuality(),
    }));
  }, [getConnectionQuality]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => {
        if (prev.wasOffline) {
          setShowReconnected(true);
          setTimeout(() => setShowReconnected(false), 3000);
        }
        return { ...prev, isOnline: true, wasOffline: false };
      });
      updateNetworkInfo();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false, wasOffline: true, quality: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as unknown as { connection?: NetworkInformation })?.connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    // Initial check
    updateNetworkInfo();

    // Periodic ping check
    const interval = setInterval(async () => {
      if (navigator.onLine) {
        const isReachable = await checkConnection();
        if (!isReachable) {
          setState(prev => ({ ...prev, quality: 'poor' }));
        }
      }
    }, pingInterval);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
      clearInterval(interval);
    };
  }, [updateNetworkInfo, checkConnection, pingInterval]);

  const retry = useCallback(() => {
    updateNetworkInfo();
    checkConnection();
  }, [updateNetworkInfo, checkConnection]);

  return (
    <NetworkContext.Provider
      value={{
        ...state,
        checkConnection,
        retry,
      }}
    >
      {children}
      {showBanner && <NetworkBanner isOnline={state.isOnline} showReconnected={showReconnected} />}
    </NetworkContext.Provider>
  );
}

// ============================================================================
// Network Information Interface
// ============================================================================

interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

// ============================================================================
// Network Banner
// ============================================================================

interface NetworkBannerProps {
  isOnline: boolean;
  showReconnected: boolean;
}

function NetworkBanner({ isOnline, showReconnected }: NetworkBannerProps) {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4"
        >
          <div className="container mx-auto flex items-center justify-center gap-3">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">You&apos;re offline. Some features may not work.</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white py-2 px-4"
        >
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Wifi className="w-5 h-5" />
            <span className="font-medium">You&apos;re back online!</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Connection Quality Indicator
// ============================================================================

interface ConnectionQualityIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionQualityIndicator({
  className = '',
  showLabel = false,
  size = 'md',
}: ConnectionQualityIndicatorProps) {
  const { quality, isOnline } = useNetwork();

  const qualityConfig = {
    excellent: { icon: SignalHigh, color: 'text-green-500', label: 'Excellent' },
    good: { icon: SignalMedium, color: 'text-green-500', label: 'Good' },
    fair: { icon: SignalLow, color: 'text-yellow-500', label: 'Fair' },
    poor: { icon: Signal, color: 'text-red-500', label: 'Poor' },
    offline: { icon: WifiOff, color: 'text-gray-500', label: 'Offline' },
  };

  const config = qualityConfig[quality];
  const Icon = config.icon;

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Icon className={`${iconSizes[size]} ${config.color}`} />
      {showLabel && (
        <span className={`text-sm ${config.color}`}>{config.label}</span>
      )}
    </div>
  );
}

// ============================================================================
// Offline Fallback
// ============================================================================

interface OfflineFallbackProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function OfflineFallback({ children, fallback }: OfflineFallbackProps) {
  const { isOnline } = useNetwork();

  if (!isOnline) {
    return (
      <>
        {fallback || (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CloudOff className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              You&apos;re offline
            </h3>
            <p className="text-gray-500 max-w-sm">
              This content is not available offline. Please check your connection and try again.
            </p>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// Retry on Reconnect
// ============================================================================

interface RetryOnReconnectProps {
  children: React.ReactNode;
  onReconnect: () => void;
}

export function RetryOnReconnect({ children, onReconnect }: RetryOnReconnectProps) {
  const { isOnline } = useNetwork();
  const wasOffline = React.useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      onReconnect();
    }
  }, [isOnline, onReconnect]);

  return <>{children}</>;
}

// ============================================================================
// Network Status Badge
// ============================================================================

interface NetworkStatusBadgeProps {
  className?: string;
}

export function NetworkStatusBadge({ className = '' }: NetworkStatusBadgeProps) {
  const { isOnline, quality, effectiveType, downlink } = useNetwork();

  if (isOnline && quality === 'excellent') {
    return null; // Don't show when connection is excellent
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
        ${isOnline 
          ? quality === 'good' 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : quality === 'fair'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        }
        ${className}
      `}
    >
      <ConnectionQualityIndicator size="sm" />
      <span>
        {isOnline 
          ? `${effectiveType?.toUpperCase() || 'Connected'}${downlink ? ` • ${downlink}Mbps` : ''}`
          : 'Offline'
        }
      </span>
    </motion.div>
  );
}

// ============================================================================
// Slow Connection Warning
// ============================================================================

interface SlowConnectionWarningProps {
  threshold?: ConnectionQuality[];
  children: React.ReactNode;
  warning?: React.ReactNode;
}

export function SlowConnectionWarning({
  threshold = ['fair', 'poor'],
  children,
  warning,
}: SlowConnectionWarningProps) {
  const { quality } = useNetwork();
  const showWarning = threshold.includes(quality);

  return (
    <>
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            {warning || (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
                <SignalLow className="w-5 h-5 flex-shrink-0" />
                <span>Your connection is slow. Some features may take longer to load.</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
