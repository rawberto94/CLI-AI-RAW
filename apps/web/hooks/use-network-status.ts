/**
 * Network Status Hook
 * 
 * Provides real-time network status updates and reconnection handling
 * for better app reactiveness and user feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient, onlineManager } from '@tanstack/react-query';

export type NetworkStatus = 'online' | 'offline' | 'slow' | 'reconnecting';

interface NetworkInfo {
  status: NetworkStatus;
  isOnline: boolean;
  isSlow: boolean;
  lastOnline: Date | null;
  reconnectAttempts: number;
}

/**
 * Hook to track network status with React Query integration
 */
export function useNetworkStatus() {
  const queryClient = useQueryClient();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    status: 'online',
    isOnline: true,
    isSlow: false,
    lastOnline: new Date(),
    reconnectAttempts: 0,
  });

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setNetworkInfo(prev => ({
        ...prev,
        status: 'online',
        isOnline: true,
        lastOnline: new Date(),
        reconnectAttempts: 0,
      }));
      
      // Resume paused queries
      onlineManager.setOnline(true);
      
      // Refetch stale queries when back online
      queryClient.resumePausedMutations();
      queryClient.invalidateQueries();
    };

    const handleOffline = () => {
      setNetworkInfo(prev => ({
        ...prev,
        status: 'offline',
        isOnline: false,
      }));
      
      onlineManager.setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  // Detect slow connection using Network Information API
  useEffect(() => {
    // @ts-expect-error - Navigator.connection is not in standard typings
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const updateConnectionStatus = () => {
        const effectiveType = connection.effectiveType;
        const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g';
        
        setNetworkInfo(prev => ({
          ...prev,
          isSlow,
          status: isSlow ? 'slow' : prev.isOnline ? 'online' : 'offline',
        }));
      };

      connection.addEventListener('change', updateConnectionStatus);
      updateConnectionStatus();

      return () => {
        connection.removeEventListener('change', updateConnectionStatus);
      };
    }
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(async () => {
    setNetworkInfo(prev => ({
      ...prev,
      status: 'reconnecting',
      reconnectAttempts: prev.reconnectAttempts + 1,
    }));

    try {
      // Try to ping the API
      const response = await fetch('/api/health', { method: 'HEAD' });
      if (response.ok) {
        setNetworkInfo(prev => ({
          ...prev,
          status: 'online',
          isOnline: true,
          lastOnline: new Date(),
          reconnectAttempts: 0,
        }));
        onlineManager.setOnline(true);
        queryClient.invalidateQueries();
        return true;
      }
    } catch {
      // Still offline
      setNetworkInfo(prev => ({
        ...prev,
        status: 'offline',
        isOnline: false,
      }));
    }
    return false;
  }, [queryClient]);

  return {
    ...networkInfo,
    reconnect,
  };
}

/**
 * Hook to show a toast/banner when network status changes
 */
export function useNetworkStatusToast(
  onStatusChange?: (status: NetworkStatus, isOnline: boolean) => void
) {
  const networkInfo = useNetworkStatus();
  const [previousStatus, setPreviousStatus] = useState<NetworkStatus>('online');

  useEffect(() => {
    if (networkInfo.status !== previousStatus) {
      onStatusChange?.(networkInfo.status, networkInfo.isOnline);
      setPreviousStatus(networkInfo.status);
    }
  }, [networkInfo.status, networkInfo.isOnline, previousStatus, onStatusChange]);

  return networkInfo;
}
