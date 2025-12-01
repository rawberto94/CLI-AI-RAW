'use client';

/**
 * Real-Time Sync Provider
 * 
 * This component enables app-wide real-time synchronization between
 * WebSocket events and React Query cache. It listens for real-time
 * events and invalidates the appropriate query caches.
 */

import { useRealTimeQuerySync } from '@/hooks/use-queries';

export function RealTimeSyncProvider({ children }: { children: React.ReactNode }) {
  // Enable real-time cache synchronization
  useRealTimeQuerySync();

  return <>{children}</>;
}
