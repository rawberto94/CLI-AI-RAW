/**
 * Storage Capacity Management Service
 * Handles storage monitoring, capacity management, and automated archiving
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'storage-capacity' });

export interface StorageConfig {
  monitoring: {
    checkInterval: number; // Storage check frequency (ms)
    alertThresholds: {
      warning: number; // Warning threshold (percentage)
      critical: number; // Critical threshold (percentage)
      emergency: number; // Emergency threshold (percentage)
    };
  };
  archiving: {
    enabled: boolean;
    retentionPolicies: RetentionPolicy[];
    archiveLocation: string;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
  };
  cleanup: {
    enabled: boolean;
    tempFileMaxAge: number; // Max age for temp files (ms)
    logFileMaxAge: number; // Max age for log files (ms)
    cacheMaxAge: number; // Max age for cache files (ms)
  };
}

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    dataType: string; // e.g., 'contracts', 'artifacts', 'logs'
    maxAge: number; // Maximum age in milliseconds
    maxSize?: number; // Maximum size in bytes
    status?: string[]; // Specific statuses to archive
    priority?: number; // Priority level (1 = highest)
  };
  actions: {
    archive: boolean;
    compress: boolean;
    encrypt: boolean;
    delete: boolean;
  };
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // Time in HH:MM format
    timezone: string;
  };
}

export interface StorageMetrics {
  timestamp: Date;
  total: {
    capacity: number; // Total storage capacity (bytes)
    used: number; // Used storage (bytes)
    available: number; // Available storage (bytes)
    percentage: number; // Usage percentage
  };
  breakdown: {
    contracts: number;
    artifacts: number;
    logs: number;
    cache: number;
    temp: number;
    archive: number;
    other: number;
  };
  growth: {
    daily: number; // Daily growth rate (bytes)
    weekly: number; // Weekly growth rate (bytes)
    monthly: number; // Monthly growth rate (bytes)
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}

export interface ArchiveOperation {
  id: string;
  policyId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    totalItems: number;
    processedItems: number;
    archivedItems: number;
    deletedItems: number;
    errors: number;
  };
  metrics: {
    originalSize: number;
    archivedSize: number;
    compressionRatio: number;
    spaceSaved: number;
  };
  errors: Array<{
    item: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface StorageAlert {
  id: string;
  type: 'warning' | 'critical' | 'emergency';
  message: string;
  threshold: number;
  currentUsage: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export class StorageCapacityService extends EventEmitter {
  private config: StorageConfig;
  private metricsHistory: StorageMetrics[] = [];
  private activeOperations = new Map<string, ArchiveOperation>();
  private alerts: StorageAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private archiveSchedules = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<StorageConfig> = {}) {
    super();
    this.config = {
      monitoring: {
        checkInterval: 300000, // 5 minutes
        alertThresholds: {
          warning: 75,
          critical: 85,
          emergency: 95
        },
        ...config.monitoring
      },
      archiving: {
        enabled: true,
        retentionPolicies: [],
        archiveLocation: process.env.ARCHIVE_LOCATION || '/data/archive',
        compressionEnabled: true,
        encryptionEnabled: true,
        ...config.archiving
      },
      cleanup: {
        enabled: true,
        tempFileMaxAge: 86400000, // 24 hours
        logFileMaxAge: 2592000000, // 30 days
        cacheMaxAge: 604800000, // 7 days
        ...config.cleanup
      }
    };

    this.initializeDefaultPolicies();
    this.startMonitoring();
    this.scheduleArchiveOperations();
  }

  /**
   * Initialize default retention policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: RetentionPolicy[] = [
      {
        id: 'contracts-long-term',
        name: 'Contract Long-term Archiving',
        description: 'Archive completed contracts older than 2 years',
        enabled: true,
        conditions: {
          dataType: 'contracts',
          maxAge: 63072000000, // 2 years
          status: ['completed', 'expired', 'terminated'],
          priority: 2
        },
        actions: {
          archive: true,
          compress: true,
          encrypt: true,
          delete: false
        },
        schedule: {
          frequency: 'monthly',
          time: '02:00',
          timezone: 'UTC'
        }
      },
      {
        id: 'artifacts-cleanup',
        name: 'Artifact Cleanup',
        description: 'Archive old artifacts and temporary processing files',
        enabled: true,
        conditions: {
          dataType: 'artifacts',
          maxAge: 15552000000, // 6 months
          priority: 3
        },
        actions: {
          archive: true,
          compress: true,
          encrypt: false,
          delete: false
        },
        schedule: {
          frequency: 'weekly',
          time: '03:00',
          timezone: 'UTC'
        }
      },
      {
        id: 'logs-retention',
        name: 'Log File Retention',
        description: 'Archive and cleanup old log files',
        enabled: true,
        conditions: {
          dataType: 'logs',
          maxAge: 2592000000, // 30 days
          priority: 4
        },
        actions: {
          archive: true,
          compress: true,
          encrypt: false,
          delete: true // Delete after archiving
        },
        schedule: {
          frequency: 'daily',
          time: '01:00',
          timezone: 'UTC'
        }
      },
      {
        id: 'temp-cleanup',
        name: 'Temporary File Cleanup',
        description: 'Clean up temporary files and cache',
        enabled: true,
        conditions: {
          dataType: 'temp',
          maxAge: 86400000, // 24 hours
          priority: 5
        },
        actions: {
          archive: false,
          compress: false,
          encrypt: false,
          delete: true
        },
        schedule: {
          frequency: 'daily',
          time: '00:30',
          timezone: 'UTC'
        }
      },
      {
        id: 'emergency-cleanup',
        name: 'Emergency Storage Cleanup',
        description: 'Emergency cleanup when storage is critically low',
        enabled: true,
        conditions: {
          dataType: 'cache',
          maxAge: 604800000, // 7 days
          priority: 1 // Highest priority
        },
        actions: {
          archive: false,
          compress: false,
          encrypt: false,
          delete: true
        },
        schedule: {
          frequency: 'daily',
          time: '04:00',
          timezone: 'UTC'
        }
      }
    ];

    this.config.archiving.retentionPolicies = defaultPolicies;
    logger.info({ 
      policyCount: defaultPolicies.length 
    }, 'Initialized default retention policies');
  }

  /**
   * Start storage monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectStorageMetrics().catch(error => {
        logger.error({ error }, 'Failed to collect storage metrics');
      });
    }, this.config.monitoring.checkInterval);

    // Perform initial metrics collection
    this.collectStorageMetrics().catch(error => {
      logger.error({ error }, 'Initial storage metrics collection failed');
    });
  }

  /**
   * Collect storage metrics
   */
  private async collectStorageMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherStorageMetrics();
      this.metricsHistory.push(metrics);

      // Keep only recent metrics (last 30 days)
      const thirtyDaysAgo = Date.now() - 2592000000;
      this.metricsHistory = this.metricsHistory.filter(
        m => m.timestamp.getTime() > thirtyDaysAgo
      );

      // Check for alerts
      this.checkStorageAlerts(metrics);

      // Emit metrics event
      this.emit('metrics_collected', metrics);

      logger.debug({
        usage: metrics.total.percentage,
        available: this.formatBytes(metrics.total.available)
      }, 'Storage metrics collected');

    } catch (error) {
      logger.error({ error }, 'Failed to collect storage metrics');
    }
  }

  /**
   * Gather storage metrics from system
   */
  private async gatherStorageMetrics(): Promise<StorageMetrics> {
    // In a real implementation, this would query the actual filesystem
    // For now, we'll simulate realistic storage metrics
    
    const totalCapacity = 1000 * 1024 * 1024 * 1024; // 1TB
    const baseUsage = 0.6; // 60% base usage
    const randomVariation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const usagePercentage = Math.max(0.1, Math.min(0.95, baseUsage + randomVariation));
    
    const used = Math.floor(totalCapacity * usagePercentage);
    const available = totalCapacity - used;

    // Simulate breakdown by data type
    const breakdown = {
      contracts: Math.floor(used * 0.4),
      artifacts: Math.floor(used * 0.3),
      logs: Math.floor(used * 0.1),
      cache: Math.floor(used * 0.08),
      temp: Math.floor(used * 0.05),
      archive: Math.floor(used * 0.05),
      other: Math.floor(used * 0.02)
    };

    // Calculate growth trends
    const growth = this.calculateGrowthTrends();

    return {
      timestamp: new Date(),
      total: {
        capacity: totalCapacity,
        used,
        available,
        percentage: Math.round(usagePercentage * 100)
      },
      breakdown,
      growth
    };
  }

  /**
   * Calculate storage growth trends
   */
  private calculateGrowthTrends(): StorageMetrics['growth'] {
    if (this.metricsHistory.length < 2) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
        trend: 'stable'
      };
    }

    const recent = this.metricsHistory.slice(-7); // Last 7 data points
    const dailyGrowth = recent.length > 1 
      ? (recent[recent.length - 1].total.used - recent[recent.length - 2].total.used)
      : 0;

    const weeklyGrowth = recent.length >= 7
      ? (recent[recent.length - 1].total.used - recent[0].total.used) / 7
      : dailyGrowth;

    const monthlyGrowth = weeklyGrowth * 30;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (dailyGrowth > 1024 * 1024 * 100) { // > 100MB daily growth
      trend = 'increasing';
    } else if (dailyGrowth < -1024 * 1024 * 10) { // < -10MB daily growth
      trend = 'decreasing';
    }

    return {
      daily: dailyGrowth,
      weekly: weeklyGrowth,
      monthly: monthlyGrowth,
      trend
    };
  }

  /**
   * Check for storage alerts
   */
  private checkStorageAlerts(metrics: StorageMetrics): void {
    const { warning, critical, emergency } = this.config.monitoring.alertThresholds;
    const usage = metrics.total.percentage;

    // Check if we need to create new alerts
    if (usage >= emergency && !this.hasActiveAlert('emergency')) {
      this.createAlert('emergency', `Storage usage is critically high: ${usage}%`, emergency, usage);
    } else if (usage >= critical && !this.hasActiveAlert('critical')) {
      this.createAlert('critical', `Storage usage is high: ${usage}%`, critical, usage);
    } else if (usage >= warning && !this.hasActiveAlert('warning')) {
      this.createAlert('warning', `Storage usage approaching limit: ${usage}%`, warning, usage);
    }

    // Resolve alerts if usage has decreased
    if (usage < warning) {
      this.resolveAlerts(['warning', 'critical', 'emergency']);
    } else if (usage < critical) {
      this.resolveAlerts(['critical', 'emergency']);
    } else if (usage < emergency) {
      this.resolveAlerts(['emergency']);
    }

    // Trigger emergency cleanup if needed
    if (usage >= emergency) {
      this.triggerEmergencyCleanup().catch(error => {
        logger.error({ error }, 'Emergency cleanup failed');
      });
    }
  }

  /**
   * Check if there's an active alert of the given type
   */
  private hasActiveAlert(type: string): boolean {
    return this.alerts.some(alert => 
      alert.type === type && !alert.acknowledged && !alert.resolvedAt
    );
  }

  /**
   * Create a new storage alert
   */
  private createAlert(
    type: 'warning' | 'critical' | 'emergency',
    message: string,
    threshold: number,
    currentUsage: number
  ): void {
    const alert: StorageAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      threshold,
      currentUsage,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.push(alert);
    this.emit('storage_alert', alert);

    logger.warn({
      alertId: alert.id,
      type,
      usage: currentUsage,
      threshold
    }, message);
  }

  /**
   * Resolve alerts of specified types
   */
  private resolveAlerts(types: string[]): void {
    const now = new Date();
    let resolvedCount = 0;

    this.alerts.forEach(alert => {
      if (types.includes(alert.type) && !alert.resolvedAt) {
        alert.resolvedAt = now;
        resolvedCount++;
        this.emit('alert_resolved', alert);
      }
    });

    if (resolvedCount > 0) {
      logger.info({ resolvedCount, types }, 'Storage alerts resolved');
    }
  }

  /**
   * Trigger emergency cleanup
   */
  private async triggerEmergencyCleanup(): Promise<void> {
    logger.warn('Triggering emergency storage cleanup');

    const emergencyPolicy = this.config.archiving.retentionPolicies.find(
      p => p.id === 'emergency-cleanup'
    );

    if (emergencyPolicy && emergencyPolicy.enabled) {
      await this.executeArchiveOperation(emergencyPolicy);
    }

    // Also trigger temp file cleanup
    await this.cleanupTempFiles();
  }

  /**
   * Schedule archive operations based on retention policies
   */
  private scheduleArchiveOperations(): void {
    this.config.archiving.retentionPolicies.forEach(policy => {
      if (policy.enabled) {
        this.schedulePolicy(policy);
      }
    });
  }

  /**
   * Schedule a specific retention policy
   */
  private schedulePolicy(policy: RetentionPolicy): void {
    const scheduleId = `schedule-${policy.id}`;
    
    // Clear existing schedule if any
    const existingSchedule = this.archiveSchedules.get(scheduleId);
    if (existingSchedule) {
      clearTimeout(existingSchedule);
    }

    // Calculate next execution time
    const nextExecution = this.calculateNextExecution(policy.schedule);
    const delay = nextExecution.getTime() - Date.now();

    if (delay > 0) {
      const timeout = setTimeout(() => {
        this.executeArchiveOperation(policy).catch(error => {
          logger.error({ error, policyId: policy.id }, 'Scheduled archive operation failed');
        });
        
        // Reschedule for next execution
        this.schedulePolicy(policy);
      }, delay);

      this.archiveSchedules.set(scheduleId, timeout);

      logger.info({
        policyId: policy.id,
        nextExecution: nextExecution.toISOString(),
        delayMs: delay
      }, 'Archive operation scheduled');
    }
  }

  /**
   * Calculate next execution time for a schedule
   */
  private calculateNextExecution(schedule: RetentionPolicy['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow/next period
    if (next <= now) {
      switch (schedule.frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }

    return next;
  }

  /**
   * Execute archive operation for a retention policy
   */
  async executeArchiveOperation(policy: RetentionPolicy): Promise<string> {
    const operationId = `archive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const operation: ArchiveOperation = {
      id: operationId,
      policyId: policy.id,
      startTime: new Date(),
      status: 'running',
      progress: {
        totalItems: 0,
        processedItems: 0,
        archivedItems: 0,
        deletedItems: 0,
        errors: 0
      },
      metrics: {
        originalSize: 0,
        archivedSize: 0,
        compressionRatio: 0,
        spaceSaved: 0
      },
      errors: []
    };

    this.activeOperations.set(operationId, operation);
    this.emit('archive_started', { operation, policy });

    logger.info({
      operationId,
      policyId: policy.id,
      dataType: policy.conditions.dataType
    }, 'Starting archive operation');

    try {
      // Find items to archive based on policy conditions
      const itemsToProcess = await this.findItemsForArchiving(policy);
      operation.progress.totalItems = itemsToProcess.length;

      logger.info({
        operationId,
        totalItems: itemsToProcess.length
      }, 'Found items for archiving');

      // Process items in batches
      const batchSize = 100;
      for (let i = 0; i < itemsToProcess.length; i += batchSize) {
        const batch = itemsToProcess.slice(i, i + batchSize);
        
        for (const item of batch) {
          try {
            const result = await this.processArchiveItem(item, policy);
            
            operation.progress.processedItems++;
            if (result.archived) {
              operation.progress.archivedItems++;
              operation.metrics.originalSize += result.originalSize;
              operation.metrics.archivedSize += result.archivedSize;
            }
            if (result.deleted) {
              operation.progress.deletedItems++;
            }

          } catch (error) {
            operation.progress.errors++;
            operation.errors.push({
              item: item.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date()
            });

            logger.error({
              operationId,
              itemId: item.id,
              error
            }, 'Failed to process archive item');
          }
        }

        // Emit progress update
        this.emit('archive_progress', operation);
      }

      // Calculate final metrics
      operation.metrics.compressionRatio = operation.metrics.originalSize > 0
        ? operation.metrics.archivedSize / operation.metrics.originalSize
        : 0;
      operation.metrics.spaceSaved = operation.metrics.originalSize - operation.metrics.archivedSize;

      operation.status = 'completed';
      operation.endTime = new Date();

      logger.info({
        operationId,
        processed: operation.progress.processedItems,
        archived: operation.progress.archivedItems,
        deleted: operation.progress.deletedItems,
        errors: operation.progress.errors,
        spaceSaved: this.formatBytes(operation.metrics.spaceSaved)
      }, 'Archive operation completed');

      this.emit('archive_completed', operation);

    } catch (error) {
      operation.status = 'failed';
      operation.endTime = new Date();

      logger.error({
        operationId,
        error
      }, 'Archive operation failed');

      this.emit('archive_failed', { operation, error });
    }

    return operationId;
  }

  /**
   * Find items for archiving based on policy conditions
   */
  private async findItemsForArchiving(policy: RetentionPolicy): Promise<any[]> {
    // In a real implementation, this would query the database
    // For now, we'll simulate finding items based on the policy
    
    const { dataType, maxAge, status, maxSize } = policy.conditions;
    const cutoffDate = new Date(Date.now() - maxAge);
    
    // Simulate finding items
    const itemCount = Math.floor(Math.random() * 1000) + 100;
    const items = Array.from({ length: itemCount }, (_, i) => ({
      id: `${dataType}-${i}`,
      type: dataType,
      createdAt: new Date(cutoffDate.getTime() - Math.random() * maxAge),
      size: Math.floor(Math.random() * 10 * 1024 * 1024), // Random size up to 10MB
      status: status ? status[Math.floor(Math.random() * status.length)] : 'active'
    }));

    return items.filter(item => {
      // Apply policy conditions
      if (item.createdAt > cutoffDate) return false;
      if (status && !status.includes(item.status)) return false;
      if (maxSize && item.size > maxSize) return false;
      return true;
    });
  }

  /**
   * Process a single item for archiving
   */
  private async processArchiveItem(item: any, policy: RetentionPolicy): Promise<{
    archived: boolean;
    deleted: boolean;
    originalSize: number;
    archivedSize: number;
  }> {
    const { actions } = policy;
    let archived = false;
    let deleted = false;
    let originalSize = item.size;
    let archivedSize = originalSize;

    // Simulate processing time
    await this.sleep(10 + Math.random() * 50);

    if (actions.archive) {
      // Simulate archiving
      archived = true;
      
      if (actions.compress) {
        // Simulate compression (typically 60-80% of original size)
        archivedSize = Math.floor(originalSize * (0.6 + Math.random() * 0.2));
      }
      
      if (actions.encrypt) {
        // Encryption typically adds small overhead
        archivedSize = Math.floor(archivedSize * 1.05);
      }
    }

    if (actions.delete) {
      // Simulate deletion
      deleted = true;
    }

    return {
      archived,
      deleted,
      originalSize,
      archivedSize
    };
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(): Promise<{
    filesDeleted: number;
    spaceSaved: number;
  }> {
    logger.info('Starting temporary file cleanup');

    // Simulate temp file cleanup
    const filesDeleted = Math.floor(Math.random() * 100) + 50;
    const spaceSaved = filesDeleted * (Math.random() * 10 * 1024 * 1024); // Random size per file

    await this.sleep(1000 + Math.random() * 2000);

    logger.info({
      filesDeleted,
      spaceSaved: this.formatBytes(spaceSaved)
    }, 'Temporary file cleanup completed');

    return { filesDeleted, spaceSaved };
  }

  /**
   * Get current storage metrics
   */
  getCurrentMetrics(): StorageMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  /**
   * Get storage metrics history
   */
  getMetricsHistory(days: number = 7): StorageMetrics[] {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): StorageAlert[] {
    return this.alerts.filter(alert => !alert.resolvedAt);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): StorageAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
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
   * Get active archive operations
   */
  getActiveOperations(): ArchiveOperation[] {
    return Array.from(this.activeOperations.values())
      .filter(op => op.status === 'running');
  }

  /**
   * Get archive operation history
   */
  getOperationHistory(): ArchiveOperation[] {
    return Array.from(this.activeOperations.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get retention policies
   */
  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.config.archiving.retentionPolicies];
  }

  /**
   * Add or update retention policy
   */
  updateRetentionPolicy(policy: RetentionPolicy): void {
    const index = this.config.archiving.retentionPolicies.findIndex(p => p.id === policy.id);
    
    if (index >= 0) {
      this.config.archiving.retentionPolicies[index] = policy;
    } else {
      this.config.archiving.retentionPolicies.push(policy);
    }

    // Reschedule if enabled
    if (policy.enabled) {
      this.schedulePolicy(policy);
    }

    logger.info({ policyId: policy.id }, 'Retention policy updated');
  }

  /**
   * Remove retention policy
   */
  removeRetentionPolicy(policyId: string): boolean {
    const index = this.config.archiving.retentionPolicies.findIndex(p => p.id === policyId);
    
    if (index >= 0) {
      this.config.archiving.retentionPolicies.splice(index, 1);
      
      // Clear schedule
      const scheduleId = `schedule-${policyId}`;
      const schedule = this.archiveSchedules.get(scheduleId);
      if (schedule) {
        clearTimeout(schedule);
        this.archiveSchedules.delete(scheduleId);
      }

      logger.info({ policyId }, 'Retention policy removed');
      return true;
    }
    
    return false;
  }

  /**
   * Manually trigger archive operation
   */
  async triggerArchiveOperation(policyId: string): Promise<string> {
    const policy = this.config.archiving.retentionPolicies.find(p => p.id === policyId);
    
    if (!policy) {
      throw new Error(`Retention policy not found: ${policyId}`);
    }

    return await this.executeArchiveOperation(policy);
  }

  /**
   * Cancel archive operation
   */
  cancelArchiveOperation(operationId: string): boolean {
    const operation = this.activeOperations.get(operationId);
    
    if (operation && operation.status === 'running') {
      operation.status = 'cancelled';
      operation.endTime = new Date();
      
      this.emit('archive_cancelled', operation);
      logger.info({ operationId }, 'Archive operation cancelled');
      
      return true;
    }
    
    return false;
  }

  /**
   * Get storage capacity forecast
   */
  getCapacityForecast(days: number = 30): {
    currentUsage: number;
    projectedUsage: number;
    projectedDate: Date;
    recommendation: string;
  } {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      throw new Error('No current metrics available');
    }

    const dailyGrowth = currentMetrics.growth.daily;
    const projectedGrowth = dailyGrowth * days;
    const projectedUsage = currentMetrics.total.used + projectedGrowth;
    const projectedPercentage = (projectedUsage / currentMetrics.total.capacity) * 100;

    let recommendation = 'Storage usage is within normal limits';
    
    if (projectedPercentage > 90) {
      recommendation = 'Critical: Immediate action required - consider expanding storage or aggressive archiving';
    } else if (projectedPercentage > 80) {
      recommendation = 'Warning: Consider implementing archiving policies or expanding storage';
    } else if (projectedPercentage > 70) {
      recommendation = 'Monitor closely and prepare archiving strategies';
    }

    return {
      currentUsage: currentMetrics.total.percentage,
      projectedUsage: Math.round(projectedPercentage),
      projectedDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      recommendation
    };
  }

  /**
   * Health check for storage capacity service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    currentUsage: number;
    activeAlerts: number;
    activeOperations: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const currentMetrics = this.getCurrentMetrics();
    const activeAlerts = this.getActiveAlerts();
    const activeOperations = this.getActiveOperations();

    if (!currentMetrics) {
      issues.push('No storage metrics available');
    } else {
      if (currentMetrics.total.percentage > 90) {
        issues.push(`Storage usage critically high: ${currentMetrics.total.percentage}%`);
      }
    }

    if (activeAlerts.length > 0) {
      issues.push(`${activeAlerts.length} unresolved storage alerts`);
    }

    const failedOperations = Array.from(this.activeOperations.values())
      .filter(op => op.status === 'failed').length;
    
    if (failedOperations > 0) {
      issues.push(`${failedOperations} failed archive operations`);
    }

    return {
      healthy: issues.length === 0,
      currentUsage: currentMetrics?.total.percentage || 0,
      activeAlerts: activeAlerts.length,
      activeOperations: activeOperations.length,
      issues
    };
  }

  /**
   * Utility function for sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Shutdown the storage capacity service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down storage capacity service');

    // Clear monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clear all scheduled operations
    for (const [scheduleId, timeout] of this.archiveSchedules) {
      clearTimeout(timeout);
    }
    this.archiveSchedules.clear();

    // Cancel active operations
    for (const operation of this.activeOperations.values()) {
      if (operation.status === 'running') {
        operation.status = 'cancelled';
        operation.endTime = new Date();
      }
    }

    this.removeAllListeners();
    logger.info('Storage capacity service shutdown complete');
  }
}

export const storageCapacityService = new StorageCapacityService({
  monitoring: {
    checkInterval: 300000, // 5 minutes
    alertThresholds: {
      warning: 75,
      critical: 85,
      emergency: 95
    }
  },
  archiving: {
    enabled: true,
    retentionPolicies: [], // Will be populated by initializeDefaultPolicies
    archiveLocation: process.env.ARCHIVE_LOCATION || '/data/archive',
    compressionEnabled: true,
    encryptionEnabled: true
  },
  cleanup: {
    enabled: true,
    tempFileMaxAge: 86400000, // 24 hours
    logFileMaxAge: 2592000000, // 30 days
    cacheMaxAge: 604800000 // 7 days
  }
});