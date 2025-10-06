/**
 * API Monitoring and Analytics Service
 * Tracks API usage, performance, and generates analytics
 */

import { EventEmitter } from 'events';

export interface APIMetric {
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  tenantId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  requestSize?: number;
  responseSize?: number;
  error?: string;
}

export interface APIAnalytics {
  timeRange: {
    start: Date;
    end: Date;
  };
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByStatus: Record<string, number>;
  requestsByTenant: Record<string, number>;
  errorsByType: Record<string, number>;
  performancePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: {
    metric: 'response_time' | 'error_rate' | 'throughput' | 'status_code';
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    timeWindow: number; // seconds
  };
  actions: Array<{
    type: 'email' | 'webhook' | 'slack';
    target: string;
  }>;
  enabled: boolean;
}

export class APIMonitoringService extends EventEmitter {
  private metrics: APIMetric[] = [];
  private alertRules: AlertRule[] = [];
  private maxMetricsRetention = 100000; // Keep last 100k metrics
  private metricsBuffer: APIMetric[] = [];
  private bufferFlushInterval = 5000; // 5 seconds

  constructor() {
    super();
    this.startMetricsBuffer();
    this.setupDefaultAlerts();
  }

  /**
   * Record an API request metric
   */
  recordMetric(metric: APIMetric): void {
    this.metricsBuffer.push(metric);
    this.emit('metric:recorded', metric);

    // Check alerts in real-time for critical metrics
    if (metric.responseTime > 5000 || metric.statusCode >= 500) {
      this.checkAlerts([metric]);
    }
  }

  /**
   * Get API analytics for a time range
   */
  getAnalytics(
    startTime: Date,
    endTime: Date,
    tenantId?: string
  ): APIAnalytics {
    let filteredMetrics = this.metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (tenantId) {
      filteredMetrics = filteredMetrics.filter(m => m.tenantId === tenantId);
    }

    return this.calculateAnalytics(filteredMetrics, startTime, endTime);
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): {
    currentRPS: number;
    averageResponseTime: number;
    errorRate: number;
    activeRequests: number;
  } {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    const recentMetrics = this.metrics.filter(
      m => m.timestamp >= oneMinuteAgo
    );

    const totalRequests = recentMetrics.length;
    const errors = recentMetrics.filter(m => m.statusCode >= 400).length;
    const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);

    return {
      currentRPS: totalRequests / 60,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
      activeRequests: 0 // Would be tracked separately in real implementation
    };
  }

  /**
   * Get endpoint performance statistics
   */
  getEndpointStats(
    endpoint: string,
    timeRange: { start: Date; end: Date }
  ): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    statusCodeDistribution: Record<string, number>;
    responseTimePercentiles: Record<string, number>;
  } {
    const endpointMetrics = this.metrics.filter(
      m => m.path === endpoint &&
           m.timestamp >= timeRange.start &&
           m.timestamp <= timeRange.end
    );

    const totalRequests = endpointMetrics.length;
    const errors = endpointMetrics.filter(m => m.statusCode >= 400).length;
    const totalResponseTime = endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0);

    // Status code distribution
    const statusCodeDistribution: Record<string, number> = {};
    endpointMetrics.forEach(m => {
      const statusGroup = `${Math.floor(m.statusCode / 100)}xx`;
      statusCodeDistribution[statusGroup] = (statusCodeDistribution[statusGroup] || 0) + 1;
    });

    // Response time percentiles
    const responseTimes = endpointMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const responseTimePercentiles = this.calculatePercentiles(responseTimes);

    return {
      totalRequests,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
      statusCodeDistribution,
      responseTimePercentiles
    };
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    this.emit('alert:rule_added', rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      const rule = this.alertRules.splice(index, 1)[0];
      this.emit('alert:rule_removed', rule);
      return true;
    }
    return false;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(
    startTime: Date,
    endTime: Date
  ): {
    summary: APIAnalytics;
    topEndpoints: Array<{
      endpoint: string;
      requests: number;
      averageResponseTime: number;
      errorRate: number;
    }>;
    slowestEndpoints: Array<{
      endpoint: string;
      averageResponseTime: number;
      p95ResponseTime: number;
    }>;
    errorAnalysis: Array<{
      endpoint: string;
      errorCount: number;
      errorRate: number;
      commonErrors: string[];
    }>;
    recommendations: string[];
  } {
    const analytics = this.getAnalytics(startTime, endTime);
    
    // Top endpoints by request count
    const endpointStats = new Map<string, {
      requests: number;
      totalResponseTime: number;
      errors: number;
      responseTimes: number[];
      errorMessages: string[];
    }>();

    const filteredMetrics = this.metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    filteredMetrics.forEach(metric => {
      if (!endpointStats.has(metric.path)) {
        endpointStats.set(metric.path, {
          requests: 0,
          totalResponseTime: 0,
          errors: 0,
          responseTimes: [],
          errorMessages: []
        });
      }

      const stats = endpointStats.get(metric.path)!;
      stats.requests++;
      stats.totalResponseTime += metric.responseTime;
      stats.responseTimes.push(metric.responseTime);
      
      if (metric.statusCode >= 400) {
        stats.errors++;
        if (metric.error) {
          stats.errorMessages.push(metric.error);
        }
      }
    });

    // Convert to arrays and sort
    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        averageResponseTime: stats.totalResponseTime / stats.requests,
        errorRate: (stats.errors / stats.requests) * 100
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageResponseTime: stats.totalResponseTime / stats.requests,
        p95ResponseTime: this.calculatePercentiles(stats.responseTimes).p95
      }))
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10);

    const errorAnalysis = Array.from(endpointStats.entries())
      .filter(([, stats]) => stats.errors > 0)
      .map(([endpoint, stats]) => ({
        endpoint,
        errorCount: stats.errors,
        errorRate: (stats.errors / stats.requests) * 100,
        commonErrors: this.getCommonErrors(stats.errorMessages)
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);

    const recommendations = this.generateRecommendations(analytics, topEndpoints, slowestEndpoints, errorAnalysis);

    return {
      summary: analytics,
      topEndpoints,
      slowestEndpoints,
      errorAnalysis,
      recommendations
    };
  }

  // Private helper methods

  private startMetricsBuffer(): void {
    setInterval(() => {
      if (this.metricsBuffer.length > 0) {
        this.flushMetricsBuffer();
      }
    }, this.bufferFlushInterval);
  }

  private flushMetricsBuffer(): void {
    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    // Add to main metrics array
    this.metrics.push(...metricsToFlush);

    // Trim if exceeding retention limit
    if (this.metrics.length > this.maxMetricsRetention) {
      this.metrics = this.metrics.slice(-this.maxMetricsRetention);
    }

    // Check alerts
    this.checkAlerts(metricsToFlush);

    this.emit('metrics:flushed', metricsToFlush.length);
  }

  private calculateAnalytics(
    metrics: APIMetric[],
    startTime: Date,
    endTime: Date
  ): APIAnalytics {
    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter(m => m.statusCode < 400).length;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    // Group by endpoint
    const requestsByEndpoint: Record<string, number> = {};
    metrics.forEach(m => {
      requestsByEndpoint[m.path] = (requestsByEndpoint[m.path] || 0) + 1;
    });

    // Group by status code
    const requestsByStatus: Record<string, number> = {};
    metrics.forEach(m => {
      const statusGroup = `${Math.floor(m.statusCode / 100)}xx`;
      requestsByStatus[statusGroup] = (requestsByStatus[statusGroup] || 0) + 1;
    });

    // Group by tenant
    const requestsByTenant: Record<string, number> = {};
    metrics.forEach(m => {
      if (m.tenantId) {
        requestsByTenant[m.tenantId] = (requestsByTenant[m.tenantId] || 0) + 1;
      }
    });

    // Group errors by type
    const errorsByType: Record<string, number> = {};
    metrics.filter(m => m.error).forEach(m => {
      const errorType = m.error!.split(':')[0] || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    // Calculate percentiles
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const performancePercentiles = this.calculatePercentiles(responseTimes);

    // Calculate throughput
    const timeRangeSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    const requestsPerSecond = timeRangeSeconds > 0 ? totalRequests / timeRangeSeconds : 0;

    return {
      timeRange: { start: startTime, end: endTime },
      totalRequests,
      successRate,
      averageResponseTime,
      requestsByEndpoint,
      requestsByStatus,
      requestsByTenant,
      errorsByType,
      performancePercentiles,
      throughput: {
        requestsPerSecond,
        requestsPerMinute: requestsPerSecond * 60,
        requestsPerHour: requestsPerSecond * 3600
      }
    };
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * values.length) - 1;
      return values[Math.max(0, index)];
    };

    return {
      p50: getPercentile(50),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }

  private checkAlerts(metrics: APIMetric[]): void {
    this.alertRules.filter(rule => rule.enabled).forEach(rule => {
      const shouldAlert = this.evaluateAlertRule(rule, metrics);
      if (shouldAlert) {
        this.triggerAlert(rule, metrics);
      }
    });
  }

  private evaluateAlertRule(rule: AlertRule, metrics: APIMetric[]): boolean {
    const now = new Date();
    const windowStart = new Date(now.getTime() - rule.condition.timeWindow * 1000);
    
    const windowMetrics = this.metrics.filter(
      m => m.timestamp >= windowStart && m.timestamp <= now
    );

    switch (rule.condition.metric) {
      case 'response_time':
        const avgResponseTime = windowMetrics.length > 0 
          ? windowMetrics.reduce((sum, m) => sum + m.responseTime, 0) / windowMetrics.length
          : 0;
        return this.compareValue(avgResponseTime, rule.condition.operator, rule.condition.threshold);

      case 'error_rate':
        const errorRate = windowMetrics.length > 0
          ? (windowMetrics.filter(m => m.statusCode >= 400).length / windowMetrics.length) * 100
          : 0;
        return this.compareValue(errorRate, rule.condition.operator, rule.condition.threshold);

      case 'throughput':
        const throughput = windowMetrics.length / (rule.condition.timeWindow / 60); // per minute
        return this.compareValue(throughput, rule.condition.operator, rule.condition.threshold);

      case 'status_code':
        const hasStatusCode = windowMetrics.some(m => m.statusCode === rule.condition.threshold);
        return rule.condition.operator === 'eq' ? hasStatusCode : !hasStatusCode;

      default:
        return false;
    }
  }

  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule, metrics: APIMetric[]): void {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp: new Date(),
      metrics: metrics.slice(-10) // Include last 10 metrics for context
    };

    this.emit('alert:triggered', alert);

    // Execute alert actions
    rule.actions.forEach(action => {
      this.executeAlertAction(action, alert);
    });
  }

  private executeAlertAction(action: any, alert: any): void {
    switch (action.type) {
      case 'email':
        // Send email notification
        console.log(`Email alert sent to ${action.target}:`, alert);
        break;
      case 'webhook':
        // Send webhook
        console.log(`Webhook alert sent to ${action.target}:`, alert);
        break;
      case 'slack':
        // Send Slack notification
        console.log(`Slack alert sent to ${action.target}:`, alert);
        break;
    }
  }

  private setupDefaultAlerts(): void {
    this.addAlertRule({
      id: 'high_response_time',
      name: 'High Response Time',
      condition: {
        metric: 'response_time',
        operator: 'gt',
        threshold: 5000, // 5 seconds
        timeWindow: 300 // 5 minutes
      },
      actions: [
        { type: 'email', target: 'alerts@company.com' }
      ],
      enabled: true
    });

    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        metric: 'error_rate',
        operator: 'gt',
        threshold: 5, // 5%
        timeWindow: 300 // 5 minutes
      },
      actions: [
        { type: 'email', target: 'alerts@company.com' }
      ],
      enabled: true
    });

    this.addAlertRule({
      id: 'low_throughput',
      name: 'Low Throughput',
      condition: {
        metric: 'throughput',
        operator: 'lt',
        threshold: 10, // 10 requests per minute
        timeWindow: 600 // 10 minutes
      },
      actions: [
        { type: 'email', target: 'alerts@company.com' }
      ],
      enabled: true
    });
  }

  private getCommonErrors(errorMessages: string[]): string[] {
    const errorCounts = new Map<string, number>();
    
    errorMessages.forEach(error => {
      const errorType = error.split(':')[0] || error;
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
  }

  private generateRecommendations(
    analytics: APIAnalytics,
    topEndpoints: any[],
    slowestEndpoints: any[],
    errorAnalysis: any[]
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (analytics.averageResponseTime > 1000) {
      recommendations.push('Consider implementing caching to reduce average response time');
    }

    if (analytics.performancePercentiles.p95 > 5000) {
      recommendations.push('Investigate and optimize slow endpoints - 95th percentile is above 5 seconds');
    }

    // Error rate recommendations
    if (analytics.successRate < 95) {
      recommendations.push('Error rate is high - investigate and fix common error causes');
    }

    // Endpoint-specific recommendations
    slowestEndpoints.slice(0, 3).forEach(endpoint => {
      if (endpoint.averageResponseTime > 2000) {
        recommendations.push(`Optimize ${endpoint.endpoint} - average response time is ${endpoint.averageResponseTime.toFixed(0)}ms`);
      }
    });

    // Throughput recommendations
    if (analytics.throughput.requestsPerSecond < 10) {
      recommendations.push('Consider scaling up infrastructure - current throughput is low');
    }

    // Error-specific recommendations
    errorAnalysis.slice(0, 3).forEach(error => {
      if (error.errorRate > 10) {
        recommendations.push(`Address errors in ${error.endpoint} - error rate is ${error.errorRate.toFixed(1)}%`);
      }
    });

    return recommendations;
  }
}

// Export singleton instance
export const apiMonitoringService = new APIMonitoringService();