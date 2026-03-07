/**
 * React Hook for Performance Monitoring
 * Provides easy access to performance tracking in React components
 */

import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor } from '@/lib/performance/performance-monitor';

/**
 * Hook to track component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      performanceMonitor.trackRender(componentName, renderTime);
    };
  });
}

/**
 * Hook to track API call performance
 */
export function useApiPerformance() {
  const trackApiCall = useCallback(
    (
      endpoint: string,
      method: string,
      duration: number,
      status: number,
      cached: boolean = false
    ) => {
      performanceMonitor.trackApiCall(endpoint, method, duration, status, cached);
    },
    []
  );

  return { trackApiCall };
}

/**
 * Hook to measure async operation performance
 */
export function useMeasureAsync<T>(
  operationName: string
): (operation: () => Promise<T>) => Promise<T> {
  return useCallback(
    async (operation: () => Promise<T>) => {
      const startTime = performance.now();
      
      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        
        performanceMonitor.trackRender(operationName, duration);
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        performanceMonitor.trackRender(`${operationName}.error`, duration);
        throw error;
      }
    },
    [operationName]
  );
}

/**
 * Hook to get performance metrics
 */
export function usePerformanceMetrics() {
  const getPageLoadMetrics = useCallback(() => {
    return performanceMonitor.getPageLoadMetrics();
  }, []);

  const getApiMetrics = useCallback(() => {
    return performanceMonitor.getApiMetrics();
  }, []);

  const getRenderMetrics = useCallback((componentName?: string) => {
    return performanceMonitor.getRenderMetrics(componentName);
  }, []);

  const getSummary = useCallback(() => {
    return performanceMonitor.getPerformanceSummary();
  }, []);

  return {
    getPageLoadMetrics,
    getApiMetrics,
    getRenderMetrics,
    getSummary,
  };
}
