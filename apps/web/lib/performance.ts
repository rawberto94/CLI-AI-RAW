"use client";

/**
 * Performance Monitoring Utilities
 * 
 * Web Vitals tracking and performance measurement utilities.
 * 
 * @example
 * // Track Web Vitals
 * reportWebVitals(metric => console.log(metric));
 * 
 * @example
 * // Measure custom performance
 * const end = measureStart('api-call');
 * await fetchData();
 * const duration = end();
 */

import { useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface WebVitalMetric {
  name: "CLS" | "FID" | "FCP" | "LCP" | "TTFB" | "INP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: "navigate" | "reload" | "back-forward" | "prerender";
}

export interface PerformanceEntry {
  name: string;
  duration: number;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export type VitalsReporter = (metric: WebVitalMetric) => void;

// ============================================================================
// Web Vitals Thresholds
// ============================================================================

const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
} as const;

function getRating(name: keyof typeof THRESHOLDS, value: number): WebVitalMetric["rating"] {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

// ============================================================================
// Web Vitals Reporting
// ============================================================================

/**
 * Report Web Vitals to a callback function
 */
export function reportWebVitals(onReport: VitalsReporter): void {
  if (typeof window === "undefined") return;

  // Dynamically import web-vitals to avoid SSR issues
  import("web-vitals").then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    const reporter = (metric: { name: string; value: number; delta: number; id: string }) => {
      const webVitalMetric: WebVitalMetric = {
        name: metric.name as WebVitalMetric["name"],
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
        rating: getRating(metric.name as keyof typeof THRESHOLDS, metric.value),
        navigationType: getNavigationType(),
      };
      onReport(webVitalMetric);
    };

    onCLS(reporter);
    // Note: onFID was deprecated in web-vitals v5, replaced by onINP
    onFCP(reporter);
    onLCP(reporter);
    onTTFB(reporter);
    onINP(reporter);
  }).catch(console.error);
}

function getNavigationType(): WebVitalMetric["navigationType"] {
  if (typeof window === "undefined") return "navigate";
  
  const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return (navEntry?.type as WebVitalMetric["navigationType"]) || "navigate";
}

// ============================================================================
// Performance Measurement
// ============================================================================

const performanceEntries: PerformanceEntry[] = [];

/**
 * Start measuring a custom performance metric
 */
export function measureStart(name: string, metadata?: Record<string, unknown>): () => number {
  const startTime = performance.now();
  
  return () => {
    const duration = performance.now() - startTime;
    const entry: PerformanceEntry = {
      name,
      duration,
      startTime,
      metadata,
    };
    performanceEntries.push(entry);
    
    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`, metadata || "");
    }
    
    return duration;
  };
}

/**
 * Measure an async function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const end = measureStart(name, metadata);
  try {
    const result = await fn();
    end();
    return result;
  } catch (error) {
    end();
    throw error;
  }
}

/**
 * Get all recorded performance entries
 */
export function getPerformanceEntries(): PerformanceEntry[] {
  return [...performanceEntries];
}

/**
 * Clear recorded performance entries
 */
export function clearPerformanceEntries(): void {
  performanceEntries.length = 0;
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): Record<string, { count: number; avg: number; min: number; max: number }> {
  const summary: Record<string, { count: number; total: number; min: number; max: number }> = {};
  
  for (const entry of performanceEntries) {
    if (!summary[entry.name]) {
      summary[entry.name] = {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
      };
    }
    
    const summaryEntry = summary[entry.name]!;
    summaryEntry.count++;
    summaryEntry.total += entry.duration;
    summaryEntry.min = Math.min(summaryEntry.min, entry.duration);
    summaryEntry.max = Math.max(summaryEntry.max, entry.duration);
  }
  
  return Object.fromEntries(
    Object.entries(summary).map(([name, data]) => [
      name,
      {
        count: data.count,
        avg: data.total / data.count,
        min: data.min,
        max: data.max,
      },
    ])
  );
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to report Web Vitals
 */
export function useWebVitals(onReport: VitalsReporter): void {
  useEffect(() => {
    reportWebVitals(onReport);
  }, [onReport]);
}

/**
 * Hook to measure render time of a component
 */
export function useRenderTime(componentName: string): void {
  const startTimeRef = useRef<number>(performance.now());
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const duration = performance.now() - startTimeRef.current;
      
      performanceEntries.push({
        name: `render:${componentName}`,
        duration,
        startTime: startTimeRef.current,
      });

      if (process.env.NODE_ENV === "development") {
        console.log(`[Perf] Render ${componentName}: ${duration.toFixed(2)}ms`);
      }
    }
  }, [componentName]);
}

/**
 * Hook to track interaction timing
 */
export function useInteractionTiming(
  interactionName: string
): {
  startInteraction: () => void;
  endInteraction: () => number;
} {
  const startTimeRef = useRef<number | null>(null);

  const startInteraction = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endInteraction = useCallback(() => {
    if (startTimeRef.current === null) {
      console.warn(`Interaction "${interactionName}" was not started`);
      return 0;
    }

    const duration = performance.now() - startTimeRef.current;
    startTimeRef.current = null;

    performanceEntries.push({
      name: `interaction:${interactionName}`,
      duration,
      startTime: performance.now() - duration,
    });

    return duration;
  }, [interactionName]);

  return { startInteraction, endInteraction };
}

// ============================================================================
// Performance Observer
// ============================================================================

/**
 * Observe long tasks
 */
export function observeLongTasks(
  callback: (entries: PerformanceEntryList) => void,
  threshold = 50
): (() => void) | null {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const longTasks = list.getEntries().filter(
        (entry) => entry.duration > threshold
      );
      if (longTasks.length > 0) {
        callback(longTasks);
      }
    });

    observer.observe({ entryTypes: ["longtask"] });

    return () => observer.disconnect();
  } catch {
    // Long task observation not supported
    return null;
  }
}

/**
 * Observe resource timing
 */
export function observeResourceTiming(
  callback: (entry: PerformanceResourceTiming) => void,
  filter?: (entry: PerformanceResourceTiming) => boolean
): (() => void) | null {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming;
        if (!filter || filter(resourceEntry)) {
          callback(resourceEntry);
        }
      }
    });

    observer.observe({ entryTypes: ["resource"] });

    return () => observer.disconnect();
  } catch {
    return null;
  }
}

// ============================================================================
// Decorators / HOCs
// ============================================================================

/**
 * Decorator to measure function execution time
 */
export function measureFn<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const end = measureStart(name);
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.finally(end) as ReturnType<T>;
      }
      end();
      return result as ReturnType<T>;
    } catch (error) {
      end();
      throw error;
    }
  }) as T;
}

// ============================================================================
// Analytics Integration
// ============================================================================

/**
 * Send vitals to analytics endpoint
 */
export function sendVitalsToAnalytics(
  metric: WebVitalMetric,
  endpoint?: string
): void {
  const body = {
    ...metric,
    page: typeof window !== "undefined" ? window.location.pathname : "",
    timestamp: Date.now(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  // Use sendBeacon for reliability
  if (typeof navigator !== "undefined" && navigator.sendBeacon && endpoint) {
    navigator.sendBeacon(endpoint, JSON.stringify(body));
  } else if (endpoint) {
    fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(console.error);
  }

  // Log in development
  if (process.env.NODE_ENV === "development") {
    const color = {
      good: "\x1b[32m", // green
      "needs-improvement": "\x1b[33m", // yellow
      poor: "\x1b[31m", // red
    }[metric.rating];
    
    console.log(
      `%c[Web Vital] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      `color: ${color === "\x1b[32m" ? "green" : color === "\x1b[33m" ? "orange" : "red"}`
    );
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  reportWebVitals,
  measureStart,
  measureAsync,
  measureFn,
  getPerformanceEntries,
  clearPerformanceEntries,
  getPerformanceSummary,
  observeLongTasks,
  observeResourceTiming,
  sendVitalsToAnalytics,
};
