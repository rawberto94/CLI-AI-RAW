/**
 * Resource Monitor Service
 * Tracks memory usage, CPU utilization, and connection counts
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { sseConnectionManager } from './sse-connection-manager.service';
import { memoryManager } from './memory-manager.service';

export interface ResourceMetrics {
  timestamp: Date;
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  connections: ConnectionMetrics;
  system: SystemMetrics;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  heapUtilization: number; // percentage
  external: number;
  rss: number;
  arrayBuffers: number;
  cacheSize: number;
  cacheEntries: number;
  cacheUtilization: number; // percentage
}

export interface CPUMetrics {
  usage: number; // percentage
  loadAverage: number[];
  cores: number;
  model: string;
  speed: number; // MHz
}

export interface ConnectionMetrics {
  total: number;
  active: number;
  queued: number;
  byState: Record<string, number>;
  byTenant: Record<string, number>;
}

export interface SystemMetrics {
  platform: string;
  uptime: number; // seconds
  freeMemory: number;
  totalMemory: number;
  memoryUtilization: number; // percentage
  hostname: string;
}

export interface ResourceAlert {
  type: 'memory' | 'cpu' | 'connections';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Partial<ResourceMetrics>;
  timestamp: Date;
}

export interface ResourceMonitorConfig {
  monitoringInterval?: number; // milliseconds
  historySize?: number;
  enableAlerts?: boolean;
  thresholds?: {
    memoryWarning?: number; // percentage
    memoryCritical?: number; // percentage
    cpuWarning?: number; // percentage
    cpuCritical?: number; // percentage
    connectionsWarning?: number; // percentage
    connectionsCritical?: number; // percentage
  };
}

class ResourceMonitorService extends EventEmitter {
  private config: Required<ResourceMonitorConfig>;
  private metricsHistory: ResourceMetrics[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  private cpuUsage: { user: number; system: number } | null = null;
  private lastCPUCheck: number = 0;

  constructor(config: ResourceMonitorConfig = {}) {
    super();
    this.config = {
      monitoringInterval: config.monitoringInterval ?? 30000, // 30 seconds (reduced frequency to save memory)
      historySize: config.historySize ?? 120, // 1 hour at 30s intervals (reduced from 360)
      enableAlerts: config.enableAlerts ?? true,
      thresholds: {
        memoryWarning: config.thresholds?.memoryWarning ?? 70, // Lower threshold
        memoryCritical: config.thresholds?.memoryCritical ?? 85, // Lower critical threshold
        cpuWarning: config.thresholds?.cpuWarning ?? 70,
        cpuCritical: config.thresholds?.cpuCritical ?? 85,
        connectionsWarning: config.thresholds?.connectionsWarning ?? 80,
        connectionsCritical: config.thresholds?.connectionsCritical ?? 95,
      },
    };

    this.startMonitoring();
  }

  /**
   * Collect current resource metrics
   */
  async collectMetrics(): Promise<ResourceMetrics> {
    const memory = this.collectMemoryMetrics();
    const cpu = await this.collectCPUMetrics();
    const connections = this.collectConnectionMetrics();
    const system = this.collectSystemMetrics();

    const metrics: ResourceMetrics = {
      timestamp: new Date(),
      memory,
      cpu,
      connections,
      system,
    };

    // Store in history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.config.historySize) {
      this.metricsHistory.shift();
    }

    // Check for alerts
    if (this.config.enableAlerts) {
      this.checkAlerts(metrics);
    }

    // Emit metrics event
    this.emit('metrics:collected', metrics);

    return metrics;
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const cacheStats = memoryManager.getStats();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUtilization: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      cacheSize: cacheStats.totalCacheSize,
      cacheEntries: cacheStats.totalCacheEntries,
      cacheUtilization: cacheStats.cacheUtilization,
    };
  }

  /**
   * Collect CPU metrics
   */
  private async collectCPUMetrics(): Promise<CPUMetrics> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // Calculate CPU usage
    let usage = 0;
    const now = Date.now();

    if (this.cpuUsage && this.lastCPUCheck) {
      const currentUsage = process.cpuUsage();
      const elapsedTime = (now - this.lastCPUCheck) * 1000; // Convert to microseconds

      const userDiff = currentUsage.user - this.cpuUsage.user;
      const systemDiff = currentUsage.system - this.cpuUsage.system;
      const totalDiff = userDiff + systemDiff;

      usage = (totalDiff / elapsedTime) * 100;
    }

    this.cpuUsage = process.cpuUsage();
    this.lastCPUCheck = now;

    return {
      usage: Math.min(usage, 100), // Cap at 100%
      loadAverage: loadAvg,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
    };
  }

  /**
   * Collect connection metrics
   */
  private collectConnectionMetrics(): ConnectionMetrics {
    const connectionMetrics = sseConnectionManager.getMetrics();
    const queueStatus = sseConnectionManager.getQueueStatus();

    return {
      total: connectionMetrics.totalConnections,
      active: connectionMetrics.activeConnections,
      queued: queueStatus.queueSize,
      byState: connectionMetrics.connectionsByState,
      byTenant: connectionMetrics.connectionsByTenant,
    };
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();

    return {
      platform: os.platform(),
      uptime: os.uptime(),
      freeMemory,
      totalMemory,
      memoryUtilization: ((totalMemory - freeMemory) / totalMemory) * 100,
      hostname: os.hostname(),
    };
  }

  /**
   * Check for resource alerts
   */
  private checkAlerts(metrics: ResourceMetrics): void {
    const alerts: ResourceAlert[] = [];

    // Memory alerts
    if (metrics.memory.heapUtilization >= this.config.thresholds.memoryCritical) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${metrics.memory.heapUtilization.toFixed(1)}%`,
        metrics: { memory: metrics.memory },
        timestamp: new Date(),
      });
    } else if (metrics.memory.heapUtilization >= this.config.thresholds.memoryWarning) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${metrics.memory.heapUtilization.toFixed(1)}%`,
        metrics: { memory: metrics.memory },
        timestamp: new Date(),
      });
    }

    // CPU alerts
    if (metrics.cpu.usage >= this.config.thresholds.cpuCritical) {
      alerts.push({
        type: 'cpu',
        severity: 'critical',
        message: `Critical CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics: { cpu: metrics.cpu },
        timestamp: new Date(),
      });
    } else if (metrics.cpu.usage >= this.config.thresholds.cpuWarning) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics: { cpu: metrics.cpu },
        timestamp: new Date(),
      });
    }

    // Connection alerts
    const connectionUtilization = sseConnectionManager.getDegradationStatus().currentLoad;
    if (connectionUtilization >= this.config.thresholds.connectionsCritical) {
      alerts.push({
        type: 'connections',
        severity: 'critical',
        message: `Critical connection load: ${connectionUtilization.toFixed(1)}%`,
        metrics: { connections: metrics.connections },
        timestamp: new Date(),
      });
    } else if (connectionUtilization >= this.config.thresholds.connectionsWarning) {
      alerts.push({
        type: 'connections',
        severity: 'warning',
        message: `High connection load: ${connectionUtilization.toFixed(1)}%`,
        metrics: { connections: metrics.connections },
        timestamp: new Date(),
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('alert', alert);
      console.warn(`[ResourceMonitor] ${alert.severity.toUpperCase()}: ${alert.message}`);
    });
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): ResourceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): ResourceMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(duration: number = 3600000): {
    memory: { avg: number; min: number; max: number };
    cpu: { avg: number; min: number; max: number };
    connections: { avg: number; min: number; max: number };
  } {
    const cutoff = Date.now() - duration;
    const recentMetrics = this.metricsHistory.filter(
      m => m.timestamp.getTime() >= cutoff
    );

    if (recentMetrics.length === 0) {
      return {
        memory: { avg: 0, min: 0, max: 0 },
        cpu: { avg: 0, min: 0, max: 0 },
        connections: { avg: 0, min: 0, max: 0 },
      };
    }

    const memoryValues = recentMetrics.map(m => m.memory.heapUtilization);
    const cpuValues = recentMetrics.map(m => m.cpu.usage);
    const connectionValues = recentMetrics.map(m => m.connections.total);

    return {
      memory: {
        avg: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
      },
      cpu: {
        avg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
        min: Math.min(...cpuValues),
        max: Math.max(...cpuValues),
      },
      connections: {
        avg: connectionValues.reduce((a, b) => a + b, 0) / connectionValues.length,
        min: Math.min(...connectionValues),
        max: Math.max(...connectionValues),
      },
    };
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Collect initial metrics
    this.collectMetrics();

    // Start periodic collection
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    console.log(`[ResourceMonitor] Started monitoring (interval: ${this.config.monitoringInterval}ms)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    console.log('[ResourceMonitor] Stopped monitoring');
  }

  /**
   * Shutdown the resource monitor
   */
  shutdown(): void {
    console.log('[ResourceMonitor] Shutting down...');
    this.stopMonitoring();
    this.metricsHistory = [];
    console.log('[ResourceMonitor] Shutdown complete');
  }
}

// Export singleton instance
export const resourceMonitor = new ResourceMonitorService({
  monitoringInterval: 10000, // 10 seconds
  historySize: 360, // 1 hour
  enableAlerts: true,
  thresholds: {
    memoryWarning: 80,
    memoryCritical: 90,
    cpuWarning: 70,
    cpuCritical: 85,
    connectionsWarning: 80,
    connectionsCritical: 95,
  },
});
