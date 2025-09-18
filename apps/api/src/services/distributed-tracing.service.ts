/**
 * Distributed Tracing Service
 * Implements distributed tracing with correlation IDs and request flow tracking
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

const logger = pino({ name: 'distributed-tracing' });

export interface TracingConfig {
  enabled: boolean;
  sampling: {
    rate: number; // 0.0 to 1.0
    forceTraceHeaders: string[];
  };
  storage: {
    maxTraces: number;
    retentionPeriod: number; // milliseconds
    cleanupInterval: number; // milliseconds
  };
  correlation: {
    headerName: string;
    contextKey: string;
    propagateHeaders: string[];
  };
  performance: {
    slowRequestThreshold: number; // milliseconds
    enableMetrics: boolean;
  };
}

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'started' | 'completed' | 'error';
  tags: Record<string, any>;
  logs: TraceLog[];
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface TraceLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage: Record<string, string>;
  sampled: boolean;
}

export interface RequestTrace {
  traceId: string;
  correlationId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'active' | 'completed' | 'error';
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    userId?: string;
    tenantId?: string;
  };
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
  };
  spans: TraceSpan[];
  metrics: {
    totalSpans: number;
    errorSpans: number;
    slowSpans: number;
    databaseCalls: number;
    externalCalls: number;
    workerCalls: number;
  };
  troubleshooting: {
    issues: string[];
    recommendations: string[];
    relatedTraces: string[];
  };
}

export interface TracingMetrics {
  totalTraces: number;
  activeTraces: number;
  completedTraces: number;
  errorTraces: number;
  averageRequestDuration: number;
  slowRequests: number;
  samplingRate: number;
  storageUsage: {
    traces: number;
    spans: number;
    memoryUsage: number;
  };
}

export class DistributedTracingService extends EventEmitter {
  private config: TracingConfig;
  private traces = new Map<string, RequestTrace>();
  private spans = new Map<string, TraceSpan>();
  private activeContexts = new Map<string, TraceContext>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private startTime = new Date();

  constructor(config: Partial<TracingConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      sampling: {
        rate: 1.0, // 100% sampling by default
        forceTraceHeaders: ['x-force-trace', 'x-debug-trace']
      },
      storage: {
        maxTraces: 10000,
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        cleanupInterval: 60 * 60 * 1000 // 1 hour
      },
      correlation: {
        headerName: 'x-correlation-id',
        contextKey: 'correlationId',
        propagateHeaders: ['x-user-id', 'x-tenant-id', 'authorization']
      },
      performance: {
        slowRequestThreshold: 2000, // 2 seconds
        enableMetrics: true
      },
      ...config
    };

    this.startCleanupProcess();
    logger.info('Distributed tracing service initialized');
  }

  /**
   * Start cleanup process for old traces
   */
  private startCleanupProcess(): void {
    if (!this.config.enabled) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTraces();
    }, this.config.storage.cleanupInterval);
  }

  /**
   * Create a new trace for a request
   */
  startTrace(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    userId?: string;
    tenantId?: string;
  }): string {
    if (!this.config.enabled) {
      return '';
    }

    // Check if we should sample this trace
    const shouldSample = this.shouldSampleTrace(request.headers);
    if (!shouldSample) {
      return '';
    }

    const traceId = this.generateTraceId();
    const correlationId = this.extractOrGenerateCorrelationId(request.headers);

    const trace: RequestTrace = {
      traceId,
      correlationId,
      startTime: new Date(),
      status: 'active',
      request: {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        body: this.sanitizeBody(request.body),
        userId: request.userId,
        tenantId: request.tenantId
      },
      spans: [],
      metrics: {
        totalSpans: 0,
        errorSpans: 0,
        slowSpans: 0,
        databaseCalls: 0,
        externalCalls: 0,
        workerCalls: 0
      },
      troubleshooting: {
        issues: [],
        recommendations: [],
        relatedTraces: []
      }
    };

    this.traces.set(traceId, trace);

    // Create root span
    const rootSpan = this.startSpan(traceId, 'http_request', 'api-gateway', {
      'http.method': request.method,
      'http.url': request.url,
      'user.id': request.userId,
      'tenant.id': request.tenantId
    });

    this.emit('trace_started', { traceId, correlationId, trace });

    logger.debug({ traceId, correlationId }, 'New trace started');
    return traceId;
  }

  /**
   * Complete a trace
   */
  completeTrace(traceId: string, response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
  }): void {
    if (!this.config.enabled || !traceId) return;

    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = response?.statusCode && response.statusCode >= 400 ? 'error' : 'completed';

    if (response) {
      trace.response = {
        statusCode: response.statusCode,
        headers: this.sanitizeHeaders(response.headers),
        body: this.sanitizeBody(response.body)
      };
    }

    // Complete root span
    const rootSpan = trace.spans.find(s => s.operationName === 'http_request');
    if (rootSpan && !rootSpan.endTime) {
      this.finishSpan(rootSpan.spanId, {
        'http.status_code': response?.statusCode,
        'response.size': response?.body ? JSON.stringify(response.body).length : 0
      });
    }

    // Analyze trace for troubleshooting
    this.analyzeTroubleshooting(trace);

    this.emit('trace_completed', { traceId, trace });

    logger.debug({
      traceId,
      duration: trace.duration,
      status: trace.status,
      spans: trace.spans.length
    }, 'Trace completed');
  }

  /**
   * Start a new span within a trace
   */
  startSpan(traceId: string, operationName: string, serviceName: string, tags: Record<string, any> = {}, parentSpanId?: string): string {
    if (!this.config.enabled || !traceId) return '';

    const trace = this.traces.get(traceId);
    if (!trace) return '';

    const spanId = this.generateSpanId();
    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId,
      operationName,
      serviceName,
      startTime: new Date(),
      status: 'started',
      tags: { ...tags },
      logs: []
    };

    this.spans.set(spanId, span);
    trace.spans.push(span);
    trace.metrics.totalSpans++;

    // Update service-specific metrics
    this.updateServiceMetrics(trace, serviceName);

    this.emit('span_started', { traceId, spanId, span });

    logger.debug({
      traceId,
      spanId,
      operationName,
      serviceName
    }, 'Span started');

    return spanId;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, tags: Record<string, any> = {}, error?: Error): void {
    if (!this.config.enabled || !spanId) return;

    const span = this.spans.get(spanId);
    if (!span || span.endTime) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = error ? 'error' : 'completed';
    span.tags = { ...span.tags, ...tags };

    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };

      const trace = this.traces.get(span.traceId);
      if (trace) {
        trace.metrics.errorSpans++;
      }
    }

    // Check if span is slow
    if (span.duration && span.duration > this.config.performance.slowRequestThreshold) {
      const trace = this.traces.get(span.traceId);
      if (trace) {
        trace.metrics.slowSpans++;
      }
    }

    this.emit('span_finished', { spanId, span });

    logger.debug({
      traceId: span.traceId,
      spanId,
      duration: span.duration,
      status: span.status
    }, 'Span finished');
  }

  /**
   * Add a log entry to a span
   */
  logToSpan(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, any>): void {
    if (!this.config.enabled || !spanId) return;

    const span = this.spans.get(spanId);
    if (!span) return;

    const logEntry: TraceLog = {
      timestamp: new Date(),
      level,
      message,
      fields
    };

    span.logs.push(logEntry);

    logger.debug({
      traceId: span.traceId,
      spanId,
      level,
      message
    }, 'Log added to span');
  }

  /**
   * Set baggage item for trace context
   */
  setBaggage(traceId: string, key: string, value: string): void {
    if (!this.config.enabled || !traceId) return;

    const context = this.activeContexts.get(traceId);
    if (context) {
      context.baggage[key] = value;
    }
  }

  /**
   * Get baggage item from trace context
   */
  getBaggage(traceId: string, key: string): string | undefined {
    if (!this.config.enabled || !traceId) return undefined;

    const context = this.activeContexts.get(traceId);
    return context?.baggage[key];
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): RequestTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get traces by correlation ID
   */
  getTracesByCorrelationId(correlationId: string): RequestTrace[] {
    return Array.from(this.traces.values()).filter(
      trace => trace.correlationId === correlationId
    );
  }

  /**
   * Search traces by criteria
   */
  searchTraces(criteria: {
    userId?: string;
    tenantId?: string;
    serviceName?: string;
    operationName?: string;
    status?: 'active' | 'completed' | 'error';
    minDuration?: number;
    maxDuration?: number;
    startTime?: Date;
    endTime?: Date;
    hasErrors?: boolean;
    limit?: number;
  }): RequestTrace[] {
    let traces = Array.from(this.traces.values());

    // Apply filters
    if (criteria.userId) {
      traces = traces.filter(t => t.request.userId === criteria.userId);
    }

    if (criteria.tenantId) {
      traces = traces.filter(t => t.request.tenantId === criteria.tenantId);
    }

    if (criteria.status) {
      traces = traces.filter(t => t.status === criteria.status);
    }

    if (criteria.minDuration) {
      traces = traces.filter(t => t.duration && t.duration >= criteria.minDuration!);
    }

    if (criteria.maxDuration) {
      traces = traces.filter(t => t.duration && t.duration <= criteria.maxDuration!);
    }

    if (criteria.startTime) {
      traces = traces.filter(t => t.startTime >= criteria.startTime!);
    }

    if (criteria.endTime) {
      traces = traces.filter(t => t.startTime <= criteria.endTime!);
    }

    if (criteria.hasErrors) {
      traces = traces.filter(t => t.metrics.errorSpans > 0);
    }

    if (criteria.serviceName) {
      traces = traces.filter(t => 
        t.spans.some(s => s.serviceName === criteria.serviceName)
      );
    }

    if (criteria.operationName) {
      traces = traces.filter(t => 
        t.spans.some(s => s.operationName === criteria.operationName)
      );
    }

    // Sort by start time (newest first)
    traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Apply limit
    if (criteria.limit) {
      traces = traces.slice(0, criteria.limit);
    }

    return traces;
  }

  /**
   * Get troubleshooting information for a trace
   */
  getTroubleshootingInfo(traceId: string): {
    trace: RequestTrace;
    analysis: {
      performance: {
        totalDuration: number;
        slowestSpan: TraceSpan | null;
        bottlenecks: string[];
      };
      errors: {
        errorSpans: TraceSpan[];
        errorPatterns: string[];
        rootCause: string | null;
      };
      dependencies: {
        services: string[];
        externalCalls: number;
        databaseCalls: number;
      };
      recommendations: string[];
    };
  } | null {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    const errorSpans = trace.spans.filter(s => s.status === 'error');
    const slowestSpan = trace.spans.reduce((slowest, span) => {
      if (!span.duration) return slowest;
      if (!slowest || !slowest.duration || span.duration > slowest.duration) {
        return span;
      }
      return slowest;
    }, null as TraceSpan | null);

    const services = [...new Set(trace.spans.map(s => s.serviceName))];
    const bottlenecks = this.identifyBottlenecks(trace);
    const errorPatterns = this.identifyErrorPatterns(errorSpans);
    const rootCause = this.identifyRootCause(trace);
    const recommendations = this.generateRecommendations(trace);

    return {
      trace,
      analysis: {
        performance: {
          totalDuration: trace.duration || 0,
          slowestSpan,
          bottlenecks
        },
        errors: {
          errorSpans,
          errorPatterns,
          rootCause
        },
        dependencies: {
          services,
          externalCalls: trace.metrics.externalCalls,
          databaseCalls: trace.metrics.databaseCalls
        },
        recommendations
      }
    };
  }

  /**
   * Get tracing metrics
   */
  getMetrics(): TracingMetrics {
    const traces = Array.from(this.traces.values());
    const activeTraces = traces.filter(t => t.status === 'active').length;
    const completedTraces = traces.filter(t => t.status === 'completed').length;
    const errorTraces = traces.filter(t => t.status === 'error').length;
    
    const completedTracesWithDuration = traces.filter(t => t.duration);
    const averageRequestDuration = completedTracesWithDuration.length > 0
      ? completedTracesWithDuration.reduce((sum, t) => sum + (t.duration || 0), 0) / completedTracesWithDuration.length
      : 0;

    const slowRequests = traces.filter(t => 
      t.duration && t.duration > this.config.performance.slowRequestThreshold
    ).length;

    const totalSpans = Array.from(this.spans.values()).length;
    const memoryUsage = this.estimateMemoryUsage();

    return {
      totalTraces: traces.length,
      activeTraces,
      completedTraces,
      errorTraces,
      averageRequestDuration,
      slowRequests,
      samplingRate: this.config.sampling.rate,
      storageUsage: {
        traces: traces.length,
        spans: totalSpans,
        memoryUsage
      }
    };
  }

  /**
   * Generate correlation ID headers for outgoing requests
   */
  getCorrelationHeaders(traceId: string): Record<string, string> {
    if (!this.config.enabled || !traceId) return {};

    const trace = this.traces.get(traceId);
    if (!trace) return {};

    const headers: Record<string, string> = {};
    headers[this.config.correlation.headerName] = trace.correlationId;

    // Propagate configured headers
    this.config.correlation.propagateHeaders.forEach(headerName => {
      const value = trace.request.headers[headerName.toLowerCase()];
      if (value) {
        headers[headerName] = value;
      }
    });

    return headers;
  }

  /**
   * Check if we should sample this trace
   */
  private shouldSampleTrace(headers: Record<string, string>): boolean {
    // Check for force trace headers
    for (const header of this.config.sampling.forceTraceHeaders) {
      if (headers[header.toLowerCase()]) {
        return true;
      }
    }

    // Apply sampling rate
    return Math.random() < this.config.sampling.rate;
  }

  /**
   * Extract or generate correlation ID
   */
  private extractOrGenerateCorrelationId(headers: Record<string, string>): string {
    const existingId = headers[this.config.correlation.headerName.toLowerCase()];
    return existingId || randomUUID();
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return randomUUID();
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return randomUUID();
  }

  /**
   * Sanitize headers for storage
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    Object.entries(headers).forEach(([key, value]) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Sanitize body for storage
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    // For now, just limit size
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 10000) {
      return '[BODY TOO LARGE]';
    }

    return body;
  }

  /**
   * Update service-specific metrics
   */
  private updateServiceMetrics(trace: RequestTrace, serviceName: string): void {
    switch (serviceName) {
      case 'database':
      case 'db':
        trace.metrics.databaseCalls++;
        break;
      case 'worker':
      case 'workers':
        trace.metrics.workerCalls++;
        break;
      case 'llm':
      case 'external':
        trace.metrics.externalCalls++;
        break;
    }
  }

  /**
   * Analyze trace for troubleshooting
   */
  private analyzeTroubleshooting(trace: RequestTrace): void {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for errors
    if (trace.metrics.errorSpans > 0) {
      issues.push(`${trace.metrics.errorSpans} spans failed`);
      recommendations.push('Review error logs and implement retry logic');
    }

    // Check for slow performance
    if (trace.duration && trace.duration > this.config.performance.slowRequestThreshold) {
      issues.push(`Request took ${trace.duration}ms (threshold: ${this.config.performance.slowRequestThreshold}ms)`);
      recommendations.push('Optimize slow operations and consider caching');
    }

    // Check for too many database calls
    if (trace.metrics.databaseCalls > 10) {
      issues.push(`High number of database calls: ${trace.metrics.databaseCalls}`);
      recommendations.push('Consider query optimization or batching');
    }

    trace.troubleshooting.issues = issues;
    trace.troubleshooting.recommendations = recommendations;
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(trace: RequestTrace): string[] {
    const bottlenecks: string[] = [];
    const totalDuration = trace.duration || 0;

    trace.spans.forEach(span => {
      if (span.duration && totalDuration > 0) {
        const percentage = (span.duration / totalDuration) * 100;
        if (percentage > 30) { // Span takes more than 30% of total time
          bottlenecks.push(`${span.operationName} in ${span.serviceName} (${percentage.toFixed(1)}%)`);
        }
      }
    });

    return bottlenecks;
  }

  /**
   * Identify error patterns
   */
  private identifyErrorPatterns(errorSpans: TraceSpan[]): string[] {
    const patterns: string[] = [];
    const errorsByService = new Map<string, number>();
    const errorsByOperation = new Map<string, number>();

    errorSpans.forEach(span => {
      errorsByService.set(span.serviceName, (errorsByService.get(span.serviceName) || 0) + 1);
      errorsByOperation.set(span.operationName, (errorsByOperation.get(span.operationName) || 0) + 1);
    });

    // Service-level patterns
    errorsByService.forEach((count, service) => {
      if (count > 1) {
        patterns.push(`Multiple errors in ${service} service`);
      }
    });

    // Operation-level patterns
    errorsByOperation.forEach((count, operation) => {
      if (count > 1) {
        patterns.push(`Multiple errors in ${operation} operation`);
      }
    });

    return patterns;
  }

  /**
   * Identify root cause of errors
   */
  private identifyRootCause(trace: RequestTrace): string | null {
    const errorSpans = trace.spans.filter(s => s.status === 'error');
    if (errorSpans.length === 0) return null;

    // Find the earliest error
    const earliestError = errorSpans.reduce((earliest, span) => {
      if (!earliest || span.startTime < earliest.startTime) {
        return span;
      }
      return earliest;
    });

    return `${earliestError.operationName} in ${earliestError.serviceName}: ${earliestError.error?.message}`;
  }

  /**
   * Generate recommendations based on trace analysis
   */
  private generateRecommendations(trace: RequestTrace): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (trace.duration && trace.duration > this.config.performance.slowRequestThreshold) {
      recommendations.push('Consider implementing caching for frequently accessed data');
      recommendations.push('Review database queries for optimization opportunities');
    }

    // Error handling recommendations
    if (trace.metrics.errorSpans > 0) {
      recommendations.push('Implement circuit breakers for external service calls');
      recommendations.push('Add retry logic with exponential backoff');
    }

    // Resource usage recommendations
    if (trace.metrics.databaseCalls > 10) {
      recommendations.push('Consider batching database operations');
      recommendations.push('Implement connection pooling if not already in use');
    }

    if (trace.metrics.externalCalls > 5) {
      recommendations.push('Consider parallel processing for independent external calls');
      recommendations.push('Implement request deduplication for similar calls');
    }

    return recommendations;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation based on object counts
    const traceSize = 1000; // bytes per trace
    const spanSize = 500; // bytes per span
    
    return (this.traces.size * traceSize) + (this.spans.size * spanSize);
  }

  /**
   * Clean up old traces
   */
  private cleanupOldTraces(): void {
    const cutoffTime = Date.now() - this.config.storage.retentionPeriod;
    let cleanedTraces = 0;
    let cleanedSpans = 0;

    // Clean up old traces
    for (const [traceId, trace] of this.traces.entries()) {
      if (trace.startTime.getTime() < cutoffTime) {
        // Remove associated spans
        trace.spans.forEach(span => {
          this.spans.delete(span.spanId);
          cleanedSpans++;
        });

        this.traces.delete(traceId);
        this.activeContexts.delete(traceId);
        cleanedTraces++;
      }
    }

    // Enforce max traces limit
    if (this.traces.size > this.config.storage.maxTraces) {
      const tracesToRemove = this.traces.size - this.config.storage.maxTraces;
      const sortedTraces = Array.from(this.traces.entries())
        .sort(([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime());

      for (let i = 0; i < tracesToRemove; i++) {
        const [traceId, trace] = sortedTraces[i];
        
        // Remove associated spans
        trace.spans.forEach(span => {
          this.spans.delete(span.spanId);
          cleanedSpans++;
        });

        this.traces.delete(traceId);
        this.activeContexts.delete(traceId);
        cleanedTraces++;
      }
    }

    if (cleanedTraces > 0) {
      logger.info({
        cleanedTraces,
        cleanedSpans,
        remainingTraces: this.traces.size,
        remainingSpans: this.spans.size
      }, 'Cleaned up old traces');
    }
  }

  /**
   * Health check for the tracing service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    uptime: number;
    tracesActive: number;
    tracesStored: number;
    spansStored: number;
    memoryUsage: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.storageUsage.traces > this.config.storage.maxTraces * 0.9) {
      issues.push('Trace storage approaching capacity');
    }

    if (metrics.storageUsage.memoryUsage > 100 * 1024 * 1024) { // 100MB
      issues.push('High memory usage for trace storage');
    }

    if (metrics.activeTraces > 1000) {
      issues.push('High number of active traces');
    }

    return {
      healthy: issues.length === 0,
      uptime: Date.now() - this.startTime.getTime(),
      tracesActive: metrics.activeTraces,
      tracesStored: metrics.totalTraces,
      spansStored: metrics.storageUsage.spans,
      memoryUsage: metrics.storageUsage.memoryUsage,
      issues
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down distributed tracing service');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.removeAllListeners();
    logger.info('Distributed tracing service shutdown complete');
  }
}

export const distributedTracingService = new DistributedTracingService({
  enabled: true,
  sampling: {
    rate: 1.0,
    forceTraceHeaders: ['x-force-trace', 'x-debug-trace']
  },
  storage: {
    maxTraces: 10000,
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    cleanupInterval: 60 * 60 * 1000 // 1 hour
  },
  correlation: {
    headerName: 'x-correlation-id',
    contextKey: 'correlationId',
    propagateHeaders: ['x-user-id', 'x-tenant-id', 'authorization']
  },
  performance: {
    slowRequestThreshold: 2000,
    enableMetrics: true
  }
});