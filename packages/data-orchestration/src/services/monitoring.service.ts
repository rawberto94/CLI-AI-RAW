// @ts-nocheck
/**
 * Monitoring Service
 * Provides centralized monitoring, logging, and metrics tracking
 * Supports counters, gauges, timings, and histograms
 */

export interface MetricTags {
  [key: string]: string;
}

export interface LogContext {
  [key: string]: any;
}

export interface Trace {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  spans: Span[];
  metadata?: Record<string, any>;
}

export interface Span {
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  userId?: string;
  requestId?: string;
  traceId?: string;
  environment?: string;
  service?: string;
}

export interface MetricValue {
  value: number;
  timestamp: Date;
  tags?: MetricTags;
}

export interface GaugeValue {
  value: number;
  timestamp: Date;
}

export interface PerformanceMetrics {
  pageLoadTime?: number;
  timeToInteractive?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  apiResponseTimes: Record<string, number[]>;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  endpoint: string;
  method: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
}

class MonitoringService {
  private traces: Map<string, Trace> = new Map();
  private metrics: Map<string, MetricValue[]> = new Map();
  private gauges: Map<string, GaugeValue> = new Map();
  private counters: Map<string, number> = new Map();
  private logs: LogEntry[] = [];
  private maxLogSize = 1000; // Keep last 1000 logs in memory
  private performanceMetrics: PerformanceMetrics = {
    apiResponseTimes: {},
  };

  /**
   * Record a metric value with timestamp
   */
  recordMetric(name: string, value: number, tags?: MetricTags): void {
    const key = this.getMetricKey(name, tags);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metricValue: MetricValue = {
      value,
      timestamp: new Date(),
      tags,
    };
    
    this.metrics.get(key)!.push(metricValue);
    
    // Keep only last 1000 values per metric
    const values = this.metrics.get(key)!;
    if (values.length > 1000) {
      values.shift();
    }
    
    // Log metric in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Metric] ${name}:`, value, tags);
    }
  }

  /**
   * Set a gauge value (current state)
   */
  setGauge(name: string, value: number, tags?: MetricTags): void {
    const key = this.getMetricKey(name, tags);
    
    this.gauges.set(key, {
      value,
      timestamp: new Date(),
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Gauge] ${name}:`, value, tags);
    }
  }

  /**
   * Get current gauge value
   */
  getGauge(name: string, tags?: MetricTags): number | null {
    const key = this.getMetricKey(name, tags);
    const gauge = this.gauges.get(key);
    return gauge ? gauge.value : null;
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, tags?: MetricTags): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Counter] ${name}:`, current + 1, tags);
    }
  }

  /**
   * Decrement a counter
   */
  decrementCounter(name: string, tags?: MetricTags): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, Math.max(0, current - 1));
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: MetricTags): number {
    const key = this.getMetricKey(name, tags);
    return this.counters.get(key) || 0;
  }

  /**
   * Record timing information
   */
  recordTiming(name: string, duration: number, tags?: MetricTags): void {
    this.recordMetric(`${name}.duration`, duration, tags);
  }

  /**
   * Record API response time
   */
  recordApiResponseTime(endpoint: string, duration: number): void {
    if (!this.performanceMetrics.apiResponseTimes[endpoint]) {
      this.performanceMetrics.apiResponseTimes[endpoint] = [];
    }
    
    this.performanceMetrics.apiResponseTimes[endpoint].push(duration);
    
    // Keep only last 100 values per endpoint
    if (this.performanceMetrics.apiResponseTimes[endpoint].length > 100) {
      this.performanceMetrics.apiResponseTimes[endpoint].shift();
    }
    
    this.recordTiming('api.response', duration, { endpoint });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name: string, tags?: MetricTags): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getMetricKey(name, tags);
    const metricValues = this.metrics.get(key);
    
    if (!metricValues || metricValues.length === 0) {
      return null;
    }
    
    const values = metricValues.map(m => m.value);
    const sorted = [...values].sort((a, b) => a - b);
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    // Calculate percentiles
    const p50 = this.percentile(sorted, 50);
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);
    
    return { count: values.length, sum, avg, min, max, p50, p95, p99 };
  }

  /**
   * Get metrics within a time window
   */
  getMetricsInWindow(
    name: string,
    windowMs: number,
    tags?: MetricTags
  ): MetricValue[] {
    const key = this.getMetricKey(name, tags);
    const metricValues = this.metrics.get(key);
    
    if (!metricValues) {
      return [];
    }
    
    const cutoff = new Date(Date.now() - windowMs);
    return metricValues.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Log info message with structured context
   */
  logInfo(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message with structured context
   */
  logWarning(message: string, context?: LogContext): void {
    this.log('warning', message, context);
  }

  /**
   * Log error with full context and stack trace
   */
  logError(error: Error, context?: LogContext): void {
    const errorContext: any = {
      ...context,
      stack: error.stack,
      name: error.name,
    };
    
    // Add cause if available (ES2022+)
    if ('cause' in error) {
      errorContext.cause = (error as any).cause;
    }
    
    const logEntry: LogEntry = {
      level: 'error',
      message: error.message,
      timestamp: new Date(),
      context: errorContext,
      environment: process.env.NODE_ENV,
      service: 'contract-intelligence',
    };
    
    this.writeLog(logEntry);
    this.incrementCounter('errors.total', { 
      errorType: error.name,
      service: 'contract-intelligence',
    });
  }

  /**
   * Log debug message (only in development)
   */
  logDebug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, context);
    }
  }

  /**
   * Log with request context
   */
  logWithRequest(
    level: LogLevel,
    message: string,
    requestContext: RequestContext,
    additionalContext?: LogContext
  ): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      requestId: requestContext.requestId,
      userId: requestContext.userId,
      context: {
        endpoint: requestContext.endpoint,
        method: requestContext.method,
        userAgent: requestContext.userAgent,
        ip: requestContext.ip,
        ...additionalContext,
      },
      environment: process.env.NODE_ENV,
      service: 'contract-intelligence',
    };
    
    this.writeLog(logEntry);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    let logs = this.logs;
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    return logs.slice(-limit);
  }

  /**
   * Get error rate (errors per minute)
   */
  getErrorRate(windowMinutes: number = 5): number {
    const windowMs = windowMinutes * 60 * 1000;
    const cutoff = new Date(Date.now() - windowMs);
    
    const recentErrors = this.logs.filter(
      log => log.level === 'error' && log.timestamp >= cutoff
    );
    
    return recentErrors.length / windowMinutes;
  }

  /**
   * Start a trace for request tracking
   */
  startTrace(name: string, metadata?: Record<string, any>): Trace {
    const trace: Trace = {
      id: this.generateId(),
      name,
      startTime: new Date(),
      spans: [],
      metadata,
    };
    
    this.traces.set(trace.id, trace);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Trace Start] ${trace.name} (${trace.id})`);
    }
    
    return trace;
  }

  /**
   * End a trace and record metrics
   */
  endTrace(trace: Trace): void {
    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    
    this.recordTiming(`trace.${trace.name}`, trace.duration);
    
    // Record span timings
    trace.spans.forEach(span => {
      if (span.duration) {
        this.recordTiming(`span.${span.name}`, span.duration, {
          trace: trace.name,
        });
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Trace End] ${trace.name}:`, `${trace.duration}ms`, {
        spans: trace.spans.length,
        metadata: trace.metadata,
      });
    }
    
    // Clean up after some time
    setTimeout(() => {
      this.traces.delete(trace.id);
    }, 60000); // Keep for 1 minute
  }

  /**
   * Get active traces
   */
  getActiveTraces(): Trace[] {
    return Array.from(this.traces.values()).filter(t => !t.endTime);
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Add a span to a trace
   */
  addSpan(trace: Trace, name: string, metadata?: Record<string, any>): Span {
    const span: Span = {
      name,
      startTime: new Date(),
      metadata,
    };
    
    trace.spans.push(span);
    return span;
  }

  /**
   * End a span
   */
  endSpan(span: Span): void {
    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
  }

  /**
   * Measure async operation
   */
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: MetricTags
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.recordTiming(name, duration, { ...tags, status: 'success' });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordTiming(name, duration, { ...tags, status: 'error' });
      this.incrementCounter(`${name}.errors`, tags);
      
      throw error;
    }
  }

  /**
   * Measure sync operation
   */
  measure<T>(
    name: string,
    operation: () => T,
    tags?: MetricTags
  ): T {
    const startTime = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      
      this.recordTiming(name, duration, { ...tags, status: 'success' });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordTiming(name, duration, { ...tags, status: 'error' });
      this.incrementCounter(`${name}.errors`, tags);
      
      throw error;
    }
  }

  /**
   * Get system metrics summary
   */
  getSystemMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    traces: {
      active: number;
      total: number;
    };
    logs: {
      total: number;
      errors: number;
      warnings: number;
    };
  } {
    const errorLogs = this.logs.filter(l => l.level === 'error').length;
    const warningLogs = this.logs.filter(l => l.level === 'warning').length;
    
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([key, value]) => [key, value.value])
      ),
      traces: {
        active: this.getActiveTraces().length,
        total: this.traces.size,
      },
      logs: {
        total: this.logs.length,
        errors: errorLogs,
        warnings: warningLogs,
      },
    };
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.gauges.clear();
    this.counters.clear();
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, MetricValue[]> {
    return new Map(this.metrics);
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    metrics: Array<{
      name: string;
      type: 'counter' | 'gauge' | 'histogram';
      value: number;
      tags?: MetricTags;
      timestamp: Date;
    }>;
    timestamp: Date;
  } {
    const exported: any[] = [];
    
    // Export counters
    this.counters.forEach((value, key) => {
      const { name, tags } = this.parseMetricKey(key);
      exported.push({
        name,
        type: 'counter',
        value,
        tags,
        timestamp: new Date(),
      });
    });
    
    // Export gauges
    this.gauges.forEach((gauge, key) => {
      const { name, tags } = this.parseMetricKey(key);
      exported.push({
        name,
        type: 'gauge',
        value: gauge.value,
        tags,
        timestamp: gauge.timestamp,
      });
    });
    
    // Export histogram metrics (with stats)
    this.metrics.forEach((values, key) => {
      const { name, tags } = this.parseMetricKey(key);
      const stats = this.getMetricStats(name, tags);
      
      if (stats) {
        exported.push({
          name,
          type: 'histogram',
          value: stats.avg,
          tags: { ...tags, stat: 'avg' },
          timestamp: new Date(),
        });
        exported.push({
          name,
          type: 'histogram',
          value: stats.p95,
          tags: { ...tags, stat: 'p95' },
          timestamp: new Date(),
        });
      }
    });
    
    return {
      metrics: exported,
      timestamp: new Date(),
    };
  }

  // Private methods

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      environment: process.env.NODE_ENV,
      service: 'contract-intelligence',
    };
    
    this.writeLog(logEntry);
  }

  private writeLog(entry: LogEntry): void {
    // Store in memory
    this.logs.push(entry);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift();
    }
    
    // Console output with structured format
    const logMessage = `[${entry.level.toUpperCase()}] ${entry.message}`;
    const logData = {
      timestamp: entry.timestamp.toISOString(),
      requestId: entry.requestId,
      userId: entry.userId,
      traceId: entry.traceId,
      service: entry.service,
      environment: entry.environment,
      ...entry.context,
    };
    
    switch (entry.level) {
      case 'error':
        console.error(logMessage, logData);
        break;
      case 'warning':
        console.warn(logMessage, logData);
        break;
      case 'debug':
        console.debug(logMessage, logData);
        break;
      default:
        console.log(logMessage, logData);
    }
  }

  private getMetricKey(name: string, tags?: MetricTags): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    
    return `${name}{${tagString}}`;
  }

  private parseMetricKey(key: string): { name: string; tags?: MetricTags } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    
    if (!match) {
      return { name: key };
    }
    
    const name = match[1];
    const tagString = match[2];
    
    if (!tagString) {
      return { name };
    }
    
    const tags: MetricTags = {};
    tagString.split(',').forEach(pair => {
      const [key, value] = pair.split(':');
      tags[key] = value;
    });
    
    return { name, tags };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
