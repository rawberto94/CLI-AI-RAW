/**
 * Health Monitoring Service
 * Comprehensive system health monitoring and alerting
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'health-monitoring' });

export interface HealthCheck {
  name: string;
  component: string;
  status: HealthStatus;
  responseTime: number;
  timestamp: Date;
  details?: Record<string, any>;
  error?: string;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  CRITICAL = 'critical'
}

export interface SystemMetrics {
  timestamp: Date;
  system: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      connectionsActive: number;
    };
  };
  application: {
    uptime: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  database: {
    connectionCount: number;
    queryTime: number;
    transactionsPerSecond: number;
    lockWaitTime: number;
  };
  workers: {
    activeJobs: number;
    queueDepth: number;
    processingRate: number;
    failureRate: number;
  };
}

export interface HealthAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  component: string;
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}expo
rt enum AlertType {
  CPU_HIGH = 'cpu_high',
  MEMORY_HIGH = 'memory_high',
  DISK_FULL = 'disk_full',
  RESPONSE_TIME_HIGH = 'response_time_high',
  ERROR_RATE_HIGH = 'error_rate_high',
  DATABASE_SLOW = 'database_slow',
  WORKER_QUEUE_FULL = 'worker_queue_full',
  SERVICE_DOWN = 'service_down',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface MonitoringConfig {
  healthChecks: {
    interval: number;
    timeout: number;
    retries: number;
  };
  metrics: {
    collectionInterval: number;
    retentionPeriod: number;
    aggregationWindow: number;
  };
  alerts: {
    enabled: boolean;
    thresholds: Record<string, number>;
    cooldownPeriod: number;
    escalationRules: EscalationRule[];
  };
}

export interface EscalationRule {
  severity: AlertSeverity;
  duration: number;
  actions: string[];
}

export class HealthMonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private healthChecks = new Map<string, HealthCheck>();
  private metricsHistory: SystemMetrics[] = [];
  private alerts: HealthAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private lastAlertTime = new Map<string, Date>();

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = {
      healthChecks: {
        interval: 30000, // 30 seconds
        timeout: 5000,
        retries: 3
      },
      metrics: {
        collectionInterval: 60000, // 1 minute
        retentionPeriod: 86400000, // 24 hours
        aggregationWindow: 300000 // 5 minutes
      },
      alerts: {
        enabled: true,
        thresholds: {
          cpu_usage: 80,
          memory_usage: 85,
          disk_usage: 90,
          response_time: 2000,
          error_rate: 0.05,
          database_query_time: 1000,
          worker_queue_depth: 1000
        },
        cooldownPeriod: 300000, // 5 minutes
        escalationRules: [
          {
            severity: AlertSeverity.WARNING,
            duration: 300000, // 5 minutes
            actions: ['log', 'metric']
          },
          {
            severity: AlertSeverity.ERROR,
            duration: 600000, // 10 minutes
            actions: ['log', 'metric', 'notify']
          },
          {
            severity: AlertSeverity.CRITICAL,
            duration: 0, // Immediate
            actions: ['log', 'metric', 'notify', 'escalate']
          }
        ]
      },
      ...config
    };

    this.startMonitoring();
  }

  /**
   * Start monitoring services
   */
  private startMonitoring(): void {
    // Start health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        logger.error({ error }, 'Health check failed');
      });
    }, this.config.healthChecks.interval);

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics().catch(error => {
        logger.error({ error }, 'Metrics collection failed');
      });
    }, this.config.metrics.collectionInterval);

    // Perform initial checks
    this.performHealthChecks().catch(error => {
      logger.error({ error }, 'Initial health check failed');
    });

    this.collectSystemMetrics().catch(error => {
      logger.error({ error }, 'Initial metrics collection failed');
    });

    logger.info('Health monitoring service started');
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = [
      this.checkDatabaseHealth(),
      this.checkWorkerHealth(),
      this.checkStorageHealth(),
      this.checkExternalServicesHealth(),
      this.checkCircuitBreakerHealth()
    ];

    const results = await Promise.allSettled(healthCheckPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error({ 
          error: result.reason,
          checkIndex: index 
        }, 'Health check failed');
      }
    });

    // Analyze overall system health
    this.analyzeSystemHealth();
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { databaseResilienceService } = await import('./database-resilience.service');
      const health = await databaseResilienceService.healthCheck();
      
      const responseTime = Date.now() - startTime;
      const status = health.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
      
      const healthCheck: HealthCheck = {
        name: 'database',
        component: 'database',
        status,
        responseTime,
        timestamp: new Date(),
        details: {
          currentDatabase: health.currentDatabase,
          recentErrors: health.recentErrors,
          recentFailovers: health.recentFailovers,
          issues: health.issues
        }
      };

      this.healthChecks.set('database', healthCheck);
      this.checkThresholds('database', responseTime, health);

    } catch (error) {
      const healthCheck: HealthCheck = {
        name: 'database',
        component: 'database',
        status: HealthStatus.CRITICAL,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.healthChecks.set('database', healthCheck);
      this.createAlert(AlertType.SERVICE_DOWN, AlertSeverity.CRITICAL, 'database', 'Database service is down');
    }
  }

  /**
   * Check worker health
   */
  private async checkWorkerHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simulate worker health check
      const workerStats = {
        activeJobs: Math.floor(Math.random() * 50),
        queueDepth: Math.floor(Math.random() * 200),
        processingRate: Math.random() * 100,
        failureRate: Math.random() * 0.1
      };

      const responseTime = Date.now() - startTime;
      let status = HealthStatus.HEALTHY;

      if (workerStats.queueDepth > 150) {
        status = HealthStatus.DEGRADED;
      }
      if (workerStats.queueDepth > 500 || workerStats.failureRate > 0.2) {
        status = HealthStatus.UNHEALTHY;
      }

      const healthCheck: HealthCheck = {
        name: 'workers',
        component: 'workers',
        status,
        responseTime,
        timestamp: new Date(),
        details: workerStats
      };

      this.healthChecks.set('workers', healthCheck);
      
      // Check thresholds
      if (workerStats.queueDepth > this.config.alerts.thresholds.worker_queue_depth) {
        this.createAlert(AlertType.WORKER_QUEUE_FULL, AlertSeverity.WARNING, 'workers', 
          `Worker queue depth is high: ${workerStats.queueDepth}`);
      }

    } catch (error) {
      const healthCheck: HealthCheck = {
        name: 'workers',
        component: 'workers',
        status: HealthStatus.CRITICAL,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.healthChecks.set('workers', healthCheck);
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { storageCapacityService } = await import('./storage-capacity.service');
      const health = await storageCapacityService.healthCheck();
      
      const responseTime = Date.now() - startTime;
      let status = HealthStatus.HEALTHY;

      if (health.currentUsage > 75) {
        status = HealthStatus.DEGRADED;
      }
      if (health.currentUsage > 90) {
        status = HealthStatus.UNHEALTHY;
      }

      const healthCheck: HealthCheck = {
        name: 'storage',
        component: 'storage',
        status,
        responseTime,
        timestamp: new Date(),
        details: {
          currentUsage: health.currentUsage,
          activeAlerts: health.activeAlerts,
          activeOperations: health.activeOperations,
          issues: health.issues
        }
      };

      this.healthChecks.set('storage', healthCheck);

      // Check disk usage threshold
      if (health.currentUsage > this.config.alerts.thresholds.disk_usage) {
        this.createAlert(AlertType.DISK_FULL, AlertSeverity.ERROR, 'storage', 
          `Disk usage is high: ${health.currentUsage}%`);
      }

    } catch (error) {
      const healthCheck: HealthCheck = {
        name: 'storage',
        component: 'storage',
        status: HealthStatus.CRITICAL,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.healthChecks.set('storage', healthCheck);
    }
  }

  /**
   * Check external services health
   */
  private async checkExternalServicesHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simulate external service checks (LLM APIs, etc.)
      const externalServices = {
        llm_api: Math.random() > 0.1, // 90% uptime
        file_storage: Math.random() > 0.05, // 95% uptime
        notification_service: Math.random() > 0.02 // 98% uptime
      };

      const responseTime = Date.now() - startTime;
      const allHealthy = Object.values(externalServices).every(Boolean);
      const status = allHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

      const healthCheck: HealthCheck = {
        name: 'external_services',
        component: 'external',
        status,
        responseTime,
        timestamp: new Date(),
        details: externalServices
      };

      this.healthChecks.set('external_services', healthCheck);

    } catch (error) {
      const healthCheck: HealthCheck = {
        name: 'external_services',
        component: 'external',
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.healthChecks.set('external_services', healthCheck);
    }
  }

  /**
   * Check circuit breaker health
   */
  private async checkCircuitBreakerHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { circuitBreakerManager } = await import('./circuit-breaker.service');
      const stats = circuitBreakerManager.getStats();
      
      const responseTime = Date.now() - startTime;
      const openCircuits = stats.healthy.length === 0 && stats.unhealthy.length > 0;
      const status = openCircuits ? HealthStatus.DEGRADED : HealthStatus.HEALTHY;

      const healthCheck: HealthCheck = {
        name: 'circuit_breakers',
        component: 'circuit_breakers',
        status,
        responseTime,
        timestamp: new Date(),
        details: {
          healthy: stats.healthy,
          unhealthy: stats.unhealthy,
          totalCircuits: stats.healthy.length + stats.unhealthy.length
        }
      };

      this.healthChecks.set('circuit_breakers', healthCheck);

      // Alert on open circuit breakers
      if (stats.unhealthy.length > 0) {
        this.createAlert(AlertType.CIRCUIT_BREAKER_OPEN, AlertSeverity.WARNING, 'circuit_breakers',
          `${stats.unhealthy.length} circuit breakers are open`);
      }

    } catch (error) {
      const healthCheck: HealthCheck = {
        name: 'circuit_breakers',
        component: 'circuit_breakers',
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.healthChecks.set('circuit_breakers', healthCheck);
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        system: await this.collectSystemResourceMetrics(),
        application: await this.collectApplicationMetrics(),
        database: await this.collectDatabaseMetrics(),
        workers: await this.collectWorkerMetrics()
      };

      this.metricsHistory.push(metrics);

      // Keep only recent metrics
      const cutoff = Date.now() - this.config.metrics.retentionPeriod;
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);

      // Check metric thresholds
      this.checkMetricThresholds(metrics);

      // Emit metrics event
      this.emit('metrics_collected', metrics);

    } catch (error) {
      logger.error({ error }, 'Failed to collect system metrics');
    }
  }

  /**
   * Collect system resource metrics
   */
  private async collectSystemResourceMetrics(): Promise<SystemMetrics['system']> {
    // Simulate system metrics collection
    return {
      cpu: {
        usage: Math.random() * 100,
        loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
      },
      memory: {
        used: Math.floor(Math.random() * 8 * 1024 * 1024 * 1024), // Up to 8GB
        total: 16 * 1024 * 1024 * 1024, // 16GB total
        percentage: Math.random() * 100
      },
      disk: {
        used: Math.floor(Math.random() * 500 * 1024 * 1024 * 1024), // Up to 500GB
        total: 1024 * 1024 * 1024 * 1024, // 1TB total
        percentage: Math.random() * 100
      },
      network: {
        bytesIn: Math.floor(Math.random() * 1024 * 1024 * 100), // Up to 100MB
        bytesOut: Math.floor(Math.random() * 1024 * 1024 * 50), // Up to 50MB
        connectionsActive: Math.floor(Math.random() * 1000)
      }
    };
  }

  /**
   * Collect application metrics
   */
  private async collectApplicationMetrics(): Promise<SystemMetrics['application']> {
    return {
      uptime: process.uptime(),
      requestsPerSecond: Math.random() * 100,
      averageResponseTime: Math.random() * 1000,
      errorRate: Math.random() * 0.1,
      activeConnections: Math.floor(Math.random() * 500)
    };
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const { connectionPoolService } = await import('./connection-pool.service');
      const stats = connectionPoolService.getStats();
      
      return {
        connectionCount: stats.totalConnections,
        queryTime: stats.averageAcquireTime,
        transactionsPerSecond: Math.random() * 1000,
        lockWaitTime: Math.random() * 100
      };
    } catch (error) {
      return {
        connectionCount: 0,
        queryTime: 0,
        transactionsPerSecond: 0,
        lockWaitTime: 0
      };
    }
  }

  /**
   * Collect worker metrics
   */
  private async collectWorkerMetrics(): Promise<SystemMetrics['workers']> {
    return {
      activeJobs: Math.floor(Math.random() * 100),
      queueDepth: Math.floor(Math.random() * 500),
      processingRate: Math.random() * 50,
      failureRate: Math.random() * 0.05
    };
  }

  /**
   * Check metric thresholds and create alerts
   */
  private checkMetricThresholds(metrics: SystemMetrics): void {
    const { thresholds } = this.config.alerts;

    // CPU usage
    if (metrics.system.cpu.usage > thresholds.cpu_usage) {
      this.createAlert(AlertType.CPU_HIGH, AlertSeverity.WARNING, 'system',
        `CPU usage is high: ${metrics.system.cpu.usage.toFixed(1)}%`);
    }

    // Memory usage
    if (metrics.system.memory.percentage > thresholds.memory_usage) {
      this.createAlert(AlertType.MEMORY_HIGH, AlertSeverity.WARNING, 'system',
        `Memory usage is high: ${metrics.system.memory.percentage.toFixed(1)}%`);
    }

    // Response time
    if (metrics.application.averageResponseTime > thresholds.response_time) {
      this.createAlert(AlertType.RESPONSE_TIME_HIGH, AlertSeverity.WARNING, 'application',
        `Response time is high: ${metrics.application.averageResponseTime.toFixed(0)}ms`);
    }

    // Error rate
    if (metrics.application.errorRate > thresholds.error_rate) {
      this.createAlert(AlertType.ERROR_RATE_HIGH, AlertSeverity.ERROR, 'application',
        `Error rate is high: ${(metrics.application.errorRate * 100).toFixed(2)}%`);
    }

    // Database query time
    if (metrics.database.queryTime > thresholds.database_query_time) {
      this.createAlert(AlertType.DATABASE_SLOW, AlertSeverity.WARNING, 'database',
        `Database query time is high: ${metrics.database.queryTime.toFixed(0)}ms`);
    }
  }

  /**
   * Check thresholds for health checks
   */
  private checkThresholds(component: string, responseTime: number, health: any): void {
    // Response time threshold
    if (responseTime > this.config.alerts.thresholds.response_time) {
      this.createAlert(AlertType.RESPONSE_TIME_HIGH, AlertSeverity.WARNING, component,
        `${component} response time is high: ${responseTime}ms`);
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    type: AlertType,
    severity: AlertSeverity,
    component: string,
    message: string,
    threshold?: number,
    currentValue?: number
  ): void {
    if (!this.config.alerts.enabled) {
      return;
    }

    // Check cooldown period
    const alertKey = `${type}-${component}`;
    const lastAlert = this.lastAlertTime.get(alertKey);
    if (lastAlert && Date.now() - lastAlert.getTime() < this.config.alerts.cooldownPeriod) {
      return;
    }

    const alert: HealthAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      component,
      message,
      threshold: threshold || 0,
      currentValue: currentValue || 0,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.push(alert);
    this.lastAlertTime.set(alertKey, alert.timestamp);

    // Emit alert event
    this.emit('alert_created', alert);

    // Execute escalation actions
    this.executeEscalationActions(alert);

    logger.warn({
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      component: alert.component,
      message: alert.message
    }, 'Health alert created');
  }

  /**
   * Execute escalation actions
   */
  private executeEscalationActions(alert: HealthAlert): void {
    const rule = this.config.alerts.escalationRules.find(r => r.severity === alert.severity);
    if (!rule) return;

    rule.actions.forEach(action => {
      switch (action) {
        case 'log':
          logger.warn({ alert }, `Health alert: ${alert.message}`);
          break;
        case 'metric':
          this.emit('alert_metric', alert);
          break;
        case 'notify':
          this.emit('alert_notification', alert);
          break;
        case 'escalate':
          this.emit('alert_escalation', alert);
          break;
      }
    });
  }

  /**
   * Analyze overall system health
   */
  private analyzeSystemHealth(): void {
    const healthChecks = Array.from(this.healthChecks.values());
    const criticalCount = healthChecks.filter(h => h.status === HealthStatus.CRITICAL).length;
    const unhealthyCount = healthChecks.filter(h => h.status === HealthStatus.UNHEALTHY).length;
    const degradedCount = healthChecks.filter(h => h.status === HealthStatus.DEGRADED).length;

    let overallStatus = HealthStatus.HEALTHY;
    if (criticalCount > 0) {
      overallStatus = HealthStatus.CRITICAL;
    } else if (unhealthyCount > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedCount > 0) {
      overallStatus = HealthStatus.DEGRADED;
    }

    this.emit('system_health_analyzed', {
      status: overallStatus,
      criticalCount,
      unhealthyCount,
      degradedCount,
      totalChecks: healthChecks.length
    });
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): {
    overall: HealthStatus;
    components: Record<string, HealthCheck>;
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      critical: number;
    };
  } {
    const components: Record<string, HealthCheck> = {};
    const summary = { healthy: 0, degraded: 0, unhealthy: 0, critical: 0 };

    for (const [name, check] of this.healthChecks) {
      components[name] = check;
      summary[check.status]++;
    }

    let overall = HealthStatus.HEALTHY;
    if (summary.critical > 0) {
      overall = HealthStatus.CRITICAL;
    } else if (summary.unhealthy > 0) {
      overall = HealthStatus.UNHEALTHY;
    } else if (summary.degraded > 0) {
      overall = HealthStatus.DEGRADED;
    }

    return { overall, components, summary };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(timeRange: number = 3600000): SystemMetrics[] {
    const cutoff = Date.now() - timeRange;
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged && !alert.resolvedAt);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): HealthAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      this.emit('alert_acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolvedAt) {
      alert.resolvedAt = new Date();
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Health check for monitoring service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    monitoringActive: boolean;
    healthChecksCount: number;
    activeAlerts: number;
    metricsCollected: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const activeAlerts = this.getActiveAlerts();
    
    if (!this.monitoringInterval) {
      issues.push('Health monitoring is not active');
    }

    if (!this.metricsInterval) {
      issues.push('Metrics collection is not active');
    }

    if (activeAlerts.length > 10) {
      issues.push(`High number of active alerts: ${activeAlerts.length}`);
    }

    const criticalAlerts = activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts active`);
    }

    return {
      healthy: issues.length === 0,
      monitoringActive: !!this.monitoringInterval,
      healthChecksCount: this.healthChecks.size,
      activeAlerts: activeAlerts.length,
      metricsCollected: this.metricsHistory.length,
      issues
    };
  }

  /**
   * Shutdown monitoring service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down health monitoring service');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.removeAllListeners();
    logger.info('Health monitoring service shutdown complete');
  }
}

export const healthMonitoringService = new HealthMonitoringService({
  healthChecks: {
    interval: 30000, // 30 seconds
    timeout: 5000,
    retries: 3
  },
  metrics: {
    collectionInterval: 60000, // 1 minute
    retentionPeriod: 86400000, // 24 hours
    aggregationWindow: 300000 // 5 minutes
  },
  alerts: {
    enabled: true,
    thresholds: {
      cpu_usage: 80,
      memory_usage: 85,
      disk_usage: 90,
      response_time: 2000,
      error_rate: 0.05,
      database_query_time: 1000,
      worker_queue_depth: 1000
    },
    cooldownPeriod: 300000, // 5 minutes
    escalationRules: [
      {
        severity: AlertSeverity.WARNING,
        duration: 300000,
        actions: ['log', 'metric']
      },
      {
        severity: AlertSeverity.ERROR,
        duration: 600000,
        actions: ['log', 'metric', 'notify']
      },
      {
        severity: AlertSeverity.CRITICAL,
        duration: 0,
        actions: ['log', 'metric', 'notify', 'escalate']
      }
    ]
  }
});