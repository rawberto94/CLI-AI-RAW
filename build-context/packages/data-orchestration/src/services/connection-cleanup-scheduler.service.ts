/**
 * Connection Cleanup Scheduler Service
 * Schedules and manages periodic cleanup of stale SSE connections
 */

import { sseConnectionManager } from './sse-connection-manager.service';
import { monitoringService } from './monitoring.service';

export interface CleanupSchedulerConfig {
  enabled: boolean;
  interval: number; // milliseconds
  staleThreshold: number; // milliseconds
  timeoutThreshold: number; // milliseconds
  maxConnectionsBeforeCleanup?: number;
}

export interface CleanupStats {
  totalCleanups: number;
  totalConnectionsCleaned: number;
  lastCleanup?: Date;
  lastCleanupCount: number;
  averageCleanupCount: number;
}

class ConnectionCleanupSchedulerService {
  private config: CleanupSchedulerConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private stats: CleanupStats;
  private isRunning: boolean = false;

  constructor(config: Partial<CleanupSchedulerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      interval: config.interval ?? 60000, // 1 minute
      staleThreshold: config.staleThreshold ?? 120000, // 2 minutes
      timeoutThreshold: config.timeoutThreshold ?? 600000, // 10 minutes
      maxConnectionsBeforeCleanup: config.maxConnectionsBeforeCleanup,
    };

    this.stats = {
      totalCleanups: 0,
      totalConnectionsCleaned: 0,
      lastCleanupCount: 0,
      averageCleanupCount: 0,
    };

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * Start the cleanup scheduler
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.interval);

    // Perform initial cleanup
    this.performCleanup();
  }

  /**
   * Stop the cleanup scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Perform cleanup of stale connections
   */
  private performCleanup(): void {
    try {
      const metrics = sseConnectionManager.getMetrics();

      // Check if we should skip cleanup based on connection count
      if (
        this.config.maxConnectionsBeforeCleanup &&
        metrics.totalConnections < this.config.maxConnectionsBeforeCleanup
      ) {
        return;
      }

      // Get stale and timed-out connections
      const staleConnections = sseConnectionManager.findStaleConnections();
      const timedOutConnections = sseConnectionManager.findTimedOutConnections();

      const totalToClean = new Set([
        ...staleConnections.map(c => c.id),
        ...timedOutConnections.map(c => c.id),
      ]).size;

      if (totalToClean === 0) {
        return;
      }

      // Perform cleanup
      const cleanedCount = sseConnectionManager.cleanupConnections();

      // Update stats
      this.stats.totalCleanups++;
      this.stats.totalConnectionsCleaned += cleanedCount;
      this.stats.lastCleanup = new Date();
      this.stats.lastCleanupCount = cleanedCount;
      this.stats.averageCleanupCount =
        this.stats.totalConnectionsCleaned / this.stats.totalCleanups;

      // Log to monitoring service
      monitoringService.recordMetric('connection.cleanup.count', cleanedCount, {
        type: 'cleanup',
      });

      monitoringService.logInfo('Connection cleanup completed', {
        cleanedCount,
        staleCount: staleConnections.length,
        timedOutCount: timedOutConnections.length,
        totalCleanups: this.stats.totalCleanups,
        totalCleaned: this.stats.totalConnectionsCleaned,
      });

    } catch (error) {
      monitoringService.logError(
        error instanceof Error ? error : new Error('Cleanup failed'),
        {
          service: 'ConnectionCleanupScheduler',
          operation: 'performCleanup',
        }
      );
    }
  }

  /**
   * Force an immediate cleanup
   */
  forceCleanup(): number {
    const cleanedCount = sseConnectionManager.cleanupConnections();

    // Update stats
    this.stats.totalCleanups++;
    this.stats.totalConnectionsCleaned += cleanedCount;
    this.stats.lastCleanup = new Date();
    this.stats.lastCleanupCount = cleanedCount;
    this.stats.averageCleanupCount =
      this.stats.totalConnectionsCleaned / this.stats.totalCleanups;

    return cleanedCount;
  }

  /**
   * Get cleanup statistics
   */
  getStats(): Readonly<CleanupStats> {
    return { ...this.stats };
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<CleanupSchedulerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CleanupSchedulerConfig>): void {
    const wasRunning = this.isRunning;

    // Stop if running
    if (wasRunning) {
      this.stop();
    }

    // Update config
    this.config = {
      ...this.config,
      ...config,
    };

    // Restart if it was running and still enabled
    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCleanups: 0,
      totalConnectionsCleaned: 0,
      lastCleanupCount: 0,
      averageCleanupCount: 0,
    };
  }
}

// Export singleton instance with more aggressive cleanup settings
export const connectionCleanupScheduler = new ConnectionCleanupSchedulerService({
  enabled: true,
  interval: 30000, // 30 seconds (more frequent cleanup)
  staleThreshold: 60000, // 1 minute (faster stale detection)
  timeoutThreshold: 300000, // 5 minutes (faster timeout)
  maxConnectionsBeforeCleanup: 3, // Cleanup when more than 3 connections
});
