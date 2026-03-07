/**
 * Web Performance Monitoring
 * Track Core Web Vitals and custom metrics without external services
 * 
 * Cost: $0 - Uses browser's native Performance APIs
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';

// =====================
// Types
// =====================

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface NavigationTiming {
  dnsLookup: number;
  tcpConnect: number;
  requestTime: number;
  responseTime: number;
  domParsing: number;
  domContentLoaded: number;
  windowLoad: number;
  totalTime: number;
}

type MetricName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';

// Thresholds based on Google's Core Web Vitals
const THRESHOLDS: Record<MetricName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
  FID: { good: 100, poor: 300 },        // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 },      // First Contentful Paint
  TTFB: { good: 800, poor: 1800 },      // Time to First Byte
  INP: { good: 200, poor: 500 },        // Interaction to Next Paint
};

// =====================
// Helpers
// =====================

function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// Store metrics in memory for development debugging
const metricsStore: PerformanceMetric[] = [];
const MAX_STORED_METRICS = 100;

function storeMetric(metric: PerformanceMetric): void {
  metricsStore.push(metric);
  if (metricsStore.length > MAX_STORED_METRICS) {
    metricsStore.shift();
  }
}

// =====================
// Core Web Vitals Observers
// =====================

/**
 * Observe Largest Contentful Paint
 */
function observeLCP(callback: (metric: PerformanceMetric) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      const value = lastEntry.startTime;
      callback({
        name: 'LCP',
        value,
        rating: getRating('LCP', value),
        timestamp: Date.now(),
      });
    }
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Safari doesn't support this
  }

  return () => observer.disconnect();
}

/**
 * Observe First Input Delay
 */
function observeFID(callback: (metric: PerformanceMetric) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry: any) => {
      const value = entry.processingStart - entry.startTime;
      callback({
        name: 'FID',
        value,
        rating: getRating('FID', value),
        timestamp: Date.now(),
      });
    });
  });

  try {
    observer.observe({ type: 'first-input', buffered: true });
  } catch {
    // Not supported
  }

  return () => observer.disconnect();
}

/**
 * Observe Cumulative Layout Shift
 */
function observeCLS(callback: (metric: PerformanceMetric) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};

  let clsValue = 0;
  const clsEntries: PerformanceEntry[] = [];

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries() as any[];
    entries.forEach((entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        clsEntries.push(entry);
      }
    });

    callback({
      name: 'CLS',
      value: clsValue,
      rating: getRating('CLS', clsValue),
      timestamp: Date.now(),
    });
  });

  try {
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Not supported
  }

  return () => observer.disconnect();
}

/**
 * Observe First Contentful Paint
 */
function observeFCP(callback: (metric: PerformanceMetric) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {};

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntriesByName('first-contentful-paint');
    if (entries.length > 0) {
      const value = entries[0].startTime;
      callback({
        name: 'FCP',
        value,
        rating: getRating('FCP', value),
        timestamp: Date.now(),
      });
    }
  });

  try {
    observer.observe({ type: 'paint', buffered: true });
  } catch {
    // Not supported
  }

  return () => observer.disconnect();
}

// =====================
// Navigation Timing
// =====================

export function getNavigationTiming(): NavigationTiming | null {
  if (typeof window === 'undefined' || !window.performance) return null;

  const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!timing) return null;

  return {
    dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
    tcpConnect: timing.connectEnd - timing.connectStart,
    requestTime: timing.responseStart - timing.requestStart,
    responseTime: timing.responseEnd - timing.responseStart,
    domParsing: timing.domComplete - timing.domInteractive,
    domContentLoaded: timing.domContentLoadedEventEnd - timing.startTime,
    windowLoad: timing.loadEventEnd - timing.startTime,
    totalTime: timing.loadEventEnd - timing.startTime,
  };
}

// =====================
// Custom Timing
// =====================

const customMarks = new Map<string, number>();

/**
 * Start timing a custom operation
 */
export function startTiming(name: string): void {
  customMarks.set(name, performance.now());
}

/**
 * End timing and get the duration
 */
export function endTiming(name: string): number | null {
  const start = customMarks.get(name);
  if (start === undefined) return null;
  
  const duration = performance.now() - start;
  customMarks.delete(name);
  
  storeMetric({
    name: `custom:${name}`,
    value: duration,
    rating: duration < 100 ? 'good' : duration < 500 ? 'needs-improvement' : 'poor',
    timestamp: Date.now(),
  });
  
  return duration;
}

/**
 * Time an async function
 */
export async function timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  startTiming(name);
  try {
    return await fn();
  } finally {
    endTiming(name);
  }
}

// =====================
// React Hooks
// =====================

/**
 * Hook to observe Core Web Vitals
 */
export function useWebVitals(onMetric?: (metric: PerformanceMetric) => void) {
  useEffect(() => {
    const callback = (metric: PerformanceMetric) => {
      storeMetric(metric);
      onMetric?.(metric);
    };

    const unsubscribers = [
      observeLCP(callback),
      observeFID(callback),
      observeCLS(callback),
      observeFCP(callback),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [onMetric]);
}

/**
 * Hook to track component render time
 */
export function useRenderTime(componentName: string) {
  const renderStart = useRef(performance.now());

  useEffect(() => {
    // Track render time for monitoring
    const _renderTime = performance.now() - renderStart.current;
  }, [componentName]);
}

/**
 * Hook to measure interaction latency
 */
export function useInteractionTiming(interactionName: string) {
  const measureInteraction = useCallback(() => {
    startTiming(interactionName);
    
    // Schedule end timing for next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        endTiming(interactionName);
      });
    });
  }, [interactionName]);

  return measureInteraction;
}

// =====================
// Component
// =====================

/**
 * Component that monitors Core Web Vitals
 * Add to root layout for automatic monitoring
 */
export function WebVitalsMonitor({ 
  debug = false 
}: { 
  debug?: boolean;
}) {
  useWebVitals(debug ? (_metric) => {
    // Debug mode enabled but logging removed
  } : undefined);

  return null;
}

/**
 * Get all stored metrics (for debugging)
 */
export function getStoredMetrics(): PerformanceMetric[] {
  return [...metricsStore];
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  webVitals: Record<string, PerformanceMetric | null>;
  navigation: NavigationTiming | null;
  custom: PerformanceMetric[];
} {
  const webVitals: Record<string, PerformanceMetric | null> = {
    LCP: null,
    FID: null,
    CLS: null,
    FCP: null,
  };

  const custom: PerformanceMetric[] = [];

  metricsStore.forEach((metric) => {
    if (metric.name in webVitals) {
      webVitals[metric.name] = metric;
    } else if (metric.name.startsWith('custom:')) {
      custom.push(metric);
    }
  });

  return {
    webVitals,
    navigation: getNavigationTiming(),
    custom,
  };
}

export default useWebVitals;
