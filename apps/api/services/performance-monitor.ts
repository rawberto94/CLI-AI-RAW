import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

interface RequestMetrics {
  method: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  tenantId?: string;
  userId?: string;
  errorMessage?: string;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usage: number;
  };
  process: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  eventLoop: {
    delay: number;
    utilization: number;
  };
}

interface DatabaseMetrics {
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    slowQueries: number;
  };
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
  averageResponseTime: number;
}

interface ContractProcessingMetrics {
  totalProcessed: number;
  currentlyProcessing: number;
  averageProcessingTime: number;
  failureRate: number;
  throughput: number; // contracts per minute
  queueDepth: number;
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // in seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved';
  triggeredAt: Date;
  resolvedAt?: Date;
  message: string;
}

export class PerformanceMonitoringSystem extends EventEmitter {
  private metrics = new Map<string, PerformanceMetric[]>();
  private requestMetrics: RequestMetrics[] = [];
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private metricsRetentionDays = 7;
  private maxMetricsPerType = 10000;
  private alertCheckInterval = 30000; // 30 seconds
  private systemMetricsInterval = 10000; // 10 seconds
  private isMonitoring = false;

  constructor() {
    super();
    this.setupDefaultAlertRules();
  }

  /**
   * Start the monitoring system
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startSystemMetricsCollection();
    this.startAlertEvaluation();
    this.startMetricsCleanup();

    console.log('Performance monitoring system started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop the monitoring system
   */
  stop(): void {
    this.isMonitoring = false;
    console.log('Performance monitoring system stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      tags,
      unit
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Limit the number of metrics stored
    if (metricArray.length > this.maxMetricsPerType) {
      metricArray.splice(0, metricArray.length - this.maxMetricsPerType);
    }

    this.emit('metricRecorded', metric);
  }

  /**
   * Record HTTP request metrics
   */
  recordRequest(request: RequestMetrics): void {
    this.requestMetrics.push(request);

    // Limit request metrics storage
    if (this.requestMetrics.length > this.maxMetricsPerType) {
      this.requestMetrics.splice(0, this.requestMetrics.length - this.maxMetricsPerType);
    }

    // Record derived metrics
    this.recordMetric('http_requests_total', 1, {
      method: request.method,
      endpoint: request.endpoint,
      status: request.statusCode.toString()
    });

    this.recordMetric('http_request_duration', request.duration, {
      method: request.method,
      endpoint: request.endpoint
    }, 'ms');

    if (request.statusCode >= 400) {
      this.recordMetric('http_errors_total', 1, {
        method: request.method,
        endpoint: request.endpoint,
        status: request.statusCode.toString()
      });
    }

    this.emit('requestRecorded', request);
  }

  /**
   * Get metrics for a specific name and time range
   */
  getMetrics(
    name: string,
    startTime?: Date,
    endTime?: Date,
    tags?: Record<string, string>
  ): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];
    
    return metrics.filter(metric => {
      // Time range filter
      if (startTime && metric.timestamp < startTime) return false;
      if (endTime && metric.timestamp > endTime) return false;

      // Tags filter
      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          if (!metric.tags || metric.tags[key] !== value) return false;
        }
      }

      return true;
    });
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    name: string,
    aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count',
    timeWindow: number, // in milliseconds
    tags?: Record<string, string>
  ): number {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeWindow);
    
    const metrics = this.getMetrics(name, startTime, endTime, tags);
    
    if (metrics.length === 0) return 0;

    const values = metrics.map(m => m.value);

    switch (aggregation) {
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        throw new Error(`Unknown aggregation type: ${aggregation}`);
    }
  }

  /**
   * Get system health overview
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    version: string;
    timestamp: Date;
    metrics: {
      system: SystemMetrics;
      database?: DatabaseMetrics;
      cache?: CacheMetrics;
      contracts?: ContractProcessingMetrics;
    };
    activeAlerts: Alert[];
    recentErrors: Array<{
      timestamp: Date;
      error: string;
      endpoint?: string;
      count: number;
    }>;
  }> {
    const systemMetrics = await this.collectSystemMetrics();
    const activeAlerts = Array.from(this.activeAlerts.values());
    
    // Determine overall health status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const highAlerts = activeAlerts.filter(a => a.severity === 'high');
    
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (highAlerts.length > 0 || activeAlerts.length > 5) {
      status = 'warning';
    }

    // Get recent errors
    const recentErrors = this.getRecentErrors();

    return {
      status,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      metrics: {
        system: systemMetrics,
        // database: await this.getDatabaseMetrics(),
        // cache: await this.getCacheMetrics(),
        // contracts: await this.getContractProcessingMetrics()
      },
      activeAlerts,
      recentErrors
    };
  }

  /**
   * Add or update an alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.emit('alertRuleAdded', rule);
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      this.emit('alertRuleRemoved', { ruleId });
    }
    return removed;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'active');
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(timeWindow: number = 3600000): {
    responseTime: { current: number; trend: 'up' | 'down' | 'stable' };
    throughput: { current: number; trend: 'up' | 'down' | 'stable' };
    errorRate: { current: number; trend: 'up' | 'down' | 'stable' };
    memoryUsage: { current: number; trend: 'up' | 'down' | 'stable' };
  } {
    const endTime = new Date();
    const midTime = new Date(endTime.getTime() - timeWindow / 2);
    const startTime = new Date(endTime.getTime() - timeWindow);

    // Response time trend
    const recentResponseTime = this.getAggregatedMetrics('http_request_duration', 'avg', timeWindow / 2);
    const previousResponseTime = this.getAggregatedMetrics('http_request_duration', 'avg', timeWindow / 2);
    
    // Calculate trends (simplified)
    const responseTimeTrend = this.calculateTrend(previousResponseTime, recentResponseTime);
    const throughputTrend = 'stable' as const; // Placeholder
    const errorRateTrend = 'stable' as const; // Placeholder
    const memoryTrend = 'stable' as const; // Placeholder

    return {
      responseTime: { current: recentResponseTime, trend: responseTimeTrend },
      throughput: { current: 0, trend: throughputTrend },
      errorRate: { current: 0, trend: errorRateTrend },
      memoryUsage: { current: 0, trend: memoryTrend }
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    let output = '';

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const latestMetric = metrics[metrics.length - 1];
      const metricName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      
      output += `# HELP ${metricName} ${name}\n`;
      output += `# TYPE ${metricName} gauge\n`;
      
      if (latestMetric.tags) {
        const tags = Object.entries(latestMetric.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        output += `${metricName}{${tags}} ${latestMetric.value}\n`;
      } else {
        output += `${metricName} ${latestMetric.value}\n`;
      }
    }

    return output;
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    const collectMetrics = async () => {
      if (!this.isMonitoring) return;

      try {
        const metrics = await this.collectSystemMetrics();
        
        // Record system metrics
        this.recordMetric('system_cpu_usage', metrics.cpu.usage, {}, '%');
        this.recordMetric('system_memory_usage', metrics.memory.usage, {}, '%');
        this.recordMetric('system_memory_used', metrics.memory.used, {}, 'bytes');
        this.recordMetric('process_uptime', metrics.process.uptime, {}, 'seconds');
        this.recordMetric('event_loop_delay', metrics.eventLoop.delay, {}, 'ms');

      } catch (error) {
        console.error('Error collecting system metrics:', error);
      }

      setTimeout(collectMetrics, this.systemMetricsInterval);
    };

    collectMetrics();
  }

  /**
   * Collect current system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;

    // Measure event loop delay
    const eventLoopStart = performance.now();
    await new Promise(resolve => setImmediate(resolve));
    const eventLoopDelay = performance.now() - eventLoopStart;

    return {
      cpu: {
        usage: Math.min(100, cpuPercent * 100),
        loadAverage: [0, 0, 0] // Would use os.loadavg() in real implementation
      },
      memory: {
        used: memoryUsage.heapUsed,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        total: totalMemory,
        usage: (memoryUsage.heapUsed / totalMemory) * 100
      },
      process: {
        uptime: process.uptime(),
        memoryUsage,
        cpuUsage
      },
      eventLoop: {
        delay: eventLoopDelay,
        utilization: Math.min(100, eventLoopDelay / 10) // Simplified calculation
      }
    };
  }

  /**
   * Start alert evaluation
   */
  private startAlertEvaluation(): void {
    const evaluateAlerts = () => {
      if (!this.isMonitoring) return;

      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue;

        this.evaluateAlertRule(rule);
      }

      setTimeout(evaluateAlerts, this.alertCheckInterval);
    };

    evaluateAlerts();
  }

  /**
   * Evaluate a single alert rule
   */
  private evaluateAlertRule(rule: AlertRule): void {
    try {
      const value = this.getAggregatedMetrics(rule.metric, 'avg', rule.duration * 1000);
      
      let shouldAlert = false;
      switch (rule.condition) {
        case 'greater_than':
          shouldAlert = value > rule.threshold;
          break;
        case 'less_than':
          shouldAlert = value < rule.threshold;
          break;
        case 'equals':
          shouldAlert = value === rule.threshold;
          break;
        case 'not_equals':
          shouldAlert = value !== rule.threshold;
          break;
      }

      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.ruleId === rule.id && alert.status === 'active');

      if (shouldAlert && !existingAlert) {
        // Trigger new alert
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          value,
          threshold: rule.threshold,
          severity: rule.severity,
          status: 'active',
          triggeredAt: new Date(),
          message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`
        };

        this.activeAlerts.set(alert.id, alert);
        this.emit('alertTriggered', alert);

      } else if (!shouldAlert && existingAlert) {
        // Resolve existing alert
        this.resolveAlert(existingAlert.id);
      }

    } catch (error) {
      console.error(`Error evaluating alert rule ${rule.id}:`, error);
    }
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        metric: 'system_cpu_usage',
        condition: 'greater_than',
        threshold: 80,
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'system_memory_usage',
        condition: 'greater_than',
        threshold: 85,
        duration: 300,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        metric: 'http_request_duration',
        condition: 'greater_than',
        threshold: 5000, // 5 seconds
        duration: 120, // 2 minutes
        severity: 'medium',
        enabled: true,
        notificationChannels: ['slack']
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'http_errors_total',
        condition: 'greater_than',
        threshold: 10, // 10 errors per time window
        duration: 300,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      }
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }

  /**
   * Get recent errors from request metrics
   */
  private getRecentErrors(): Array<{
    timestamp: Date;
    error: string;
    endpoint?: string;
    count: number;
  }> {
    const recentTime = new Date(Date.now() - 3600000); // Last hour
    const errorRequests = this.requestMetrics.filter(
      req => req.timestamp > recentTime && req.statusCode >= 400
    );

    // Group errors by message and endpoint
    const errorGroups = new Map<string, { 
      timestamp: Date; 
      error: string; 
      endpoint?: string; 
      count: number 
    }>();

    errorRequests.forEach(req => {
      const key = `${req.errorMessage || req.statusCode}:${req.endpoint}`;
      
      if (errorGroups.has(key)) {
        const group = errorGroups.get(key)!;
        group.count++;
        if (req.timestamp > group.timestamp) {
          group.timestamp = req.timestamp;
        }
      } else {
        errorGroups.set(key, {
          timestamp: req.timestamp,
          error: req.errorMessage || `HTTP ${req.statusCode}`,
          endpoint: req.endpoint,
          count: 1
        });
      }
    });

    return Array.from(errorGroups.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10); // Top 10 recent errors
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(previous: number, current: number): 'up' | 'down' | 'stable' {
    const threshold = 0.05; // 5% change threshold
    const change = Math.abs(current - previous) / (previous || 1);
    
    if (change < threshold) return 'stable';
    return current > previous ? 'up' : 'down';
  }

  /**
   * Start metrics cleanup task
   */
  private startMetricsCleanup(): void {
    const cleanup = () => {
      if (!this.isMonitoring) return;

      const cutoffTime = new Date(Date.now() - this.metricsRetentionDays * 24 * 60 * 60 * 1000);

      // Clean up old metrics
      for (const [name, metrics] of this.metrics.entries()) {
        const filteredMetrics = metrics.filter(metric => metric.timestamp > cutoffTime);
        this.metrics.set(name, filteredMetrics);
      }

      // Clean up old request metrics
      this.requestMetrics = this.requestMetrics.filter(req => req.timestamp > cutoffTime);

      // Clean up resolved alerts older than 24 hours
      const alertCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const [id, alert] of this.activeAlerts.entries()) {
        if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < alertCutoff) {
          this.activeAlerts.delete(id);
        }
      }

      setTimeout(cleanup, 3600000); // Run every hour
    };

    cleanup();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitoringSystem();

// Middleware for automatic request tracking
export function createPerformanceMiddleware() {
  return (request: any, reply: any, done: any) => {
    const startTime = performance.now();
    
    reply.addHook('onSend', (request: any, reply: any, payload: any, done: any) => {
      const duration = performance.now() - startTime;
      
      performanceMonitor.recordRequest({
        method: request.method,
        endpoint: request.url,
        statusCode: reply.statusCode,
        duration,
        timestamp: new Date(),
        userAgent: request.headers['user-agent'],
        tenantId: request.headers['x-tenant-id'],
        userId: request.user?.id,
        errorMessage: reply.statusCode >= 400 ? payload?.error : undefined
      });

      done();
    });

    done();
  };
}
