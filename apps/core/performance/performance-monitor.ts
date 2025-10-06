/**
 * Performance Monitor
 * Tracks and reports system performance metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    throughput: number;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000;
  private startTime = Date.now();

  /**
   * Record a performance metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.record(name, duration, tags);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Measure sync function execution time
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.record(name, duration, tags);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, since?: number): PerformanceMetric[] {
    const cutoff = since || 0;
    return this.metrics.filter(
      m => m.name === name && m.timestamp >= cutoff
    );
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Generate performance report
   */
  getReport(name?: string, since?: number): PerformanceReport {
    const cutoff = since || this.startTime;
    let metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (name) {
      metrics = metrics.filter(m => m.name === name);
    }

    const values = metrics.map(m => m.value);
    const errors = metrics.filter(m => m.tags?.['error'] === 'true').length;
    const duration = (Date.now() - cutoff) / 1000; // seconds

    return {
      metrics,
      summary: {
        avgResponseTime: values.reduce((a, b) => a + b, 0) / values.length || 0,
        p50: this.calculatePercentile(values, 50),
        p95: this.calculatePercentile(values, 95),
        p99: this.calculatePercentile(values, 99),
        errorRate: errors / metrics.length || 0,
        throughput: metrics.length / duration,
      },
    };
  }

  /**
   * Get slow operations
   */
  getSlowOperations(threshold: number = 1000): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.value > threshold)
      .sort((a, b) => b.value - a.value)
      .slice(0, 100);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.startTime = Date.now();
  }

  /**
   * Get real-time stats
   */
  getRealTimeStats(windowMs: number = 60000) {
    const since = Date.now() - windowMs;
    const recent = this.metrics.filter(m => m.timestamp >= since);
    
    const byName = new Map<string, number[]>();
    for (const metric of recent) {
      if (!byName.has(metric.name)) {
        byName.set(metric.name, []);
      }
      byName.get(metric.name)!.push(metric.value);
    }

    const stats: Record<string, any> = {};
    for (const [name, values] of byName.entries()) {
      stats[name] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        p95: this.calculatePercentile(values, 95),
      };
    }

    return stats;
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Helper function for API routes
export function withPerformanceTracking(
  name: string,
  handler: (...args: any[]) => Promise<any>
) {
  return async (...args: any[]) => {
    return performanceMonitor.measure(name, () => handler(...args));
  };
}
