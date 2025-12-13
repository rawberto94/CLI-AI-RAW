/**
 * Connection Health Monitor
 * Tracks the health of API endpoints and services
 * Provides automatic failover and recovery detection
 */

// ============================================================================
// Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface EndpointHealth {
  endpoint: string;
  status: HealthStatus;
  latencyMs: number;
  successRate: number;
  lastCheck: Date;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number;          // Check interval in ms
  timeout: number;           // Request timeout in ms
  healthyThreshold: number;  // Consecutive successes to mark healthy
  unhealthyThreshold: number; // Consecutive failures to mark unhealthy
  expectedStatus?: number[];  // Expected HTTP status codes (default: [200, 201, 204])
}

export interface HealthMonitorOptions {
  checkInterval?: number;     // Default interval between checks
  retryOnFailure?: boolean;   // Retry failed checks immediately
  maxHistory?: number;        // Max history entries to keep
  onStatusChange?: (endpoint: string, from: HealthStatus, to: HealthStatus) => void;
}

interface HealthHistoryEntry {
  timestamp: Date;
  success: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

// ============================================================================
// Health Monitor Class
// ============================================================================

export class ConnectionHealthMonitor {
  private endpoints: Map<string, EndpointHealth> = new Map();
  private configs: Map<string, HealthCheckConfig> = new Map();
  private history: Map<string, HealthHistoryEntry[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<HealthMonitorOptions>;

  constructor(options: HealthMonitorOptions = {}) {
    this.options = {
      checkInterval: options.checkInterval ?? 30000,  // 30 seconds default
      retryOnFailure: options.retryOnFailure ?? true,
      maxHistory: options.maxHistory ?? 100,
      onStatusChange: options.onStatusChange ?? (() => {}),
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Register an endpoint for health monitoring
   */
  register(config: HealthCheckConfig): void {
    this.configs.set(config.endpoint, config);
    this.endpoints.set(config.endpoint, {
      endpoint: config.endpoint,
      status: 'unknown',
      latencyMs: 0,
      successRate: 0,
      lastCheck: new Date(0),
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    });
    this.history.set(config.endpoint, []);
  }

  /**
   * Start monitoring all registered endpoints
   */
  startAll(): void {
    for (const endpoint of this.configs.keys()) {
      this.start(endpoint);
    }
  }

  /**
   * Start monitoring a specific endpoint
   */
  start(endpoint: string): void {
    if (this.intervals.has(endpoint)) {
      return; // Already monitoring
    }

    const config = this.configs.get(endpoint);
    if (!config) {
      console.warn(`Endpoint ${endpoint} not registered`);
      return;
    }

    // Initial check
    this.check(endpoint);

    // Set up interval
    const interval = setInterval(
      () => this.check(endpoint),
      config.interval || this.options.checkInterval
    );
    this.intervals.set(endpoint, interval);
  }

  /**
   * Stop monitoring a specific endpoint
   */
  stop(endpoint: string): void {
    const interval = this.intervals.get(endpoint);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(endpoint);
    }
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  /**
   * Get health status of an endpoint
   */
  getHealth(endpoint: string): EndpointHealth | null {
    return this.endpoints.get(endpoint) || null;
  }

  /**
   * Get health status of all endpoints
   */
  getAllHealth(): EndpointHealth[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Check if an endpoint is healthy
   */
  isHealthy(endpoint: string): boolean {
    const health = this.endpoints.get(endpoint);
    return health?.status === 'healthy';
  }

  /**
   * Get history for an endpoint
   */
  getHistory(endpoint: string): HealthHistoryEntry[] {
    return this.history.get(endpoint) || [];
  }

  /**
   * Force a health check for an endpoint
   */
  async forceCheck(endpoint: string): Promise<EndpointHealth | null> {
    await this.check(endpoint);
    return this.getHealth(endpoint);
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  private async check(endpoint: string): Promise<void> {
    const config = this.configs.get(endpoint);
    const health = this.endpoints.get(endpoint);
    
    if (!config || !health) {
      return;
    }

    const startTime = performance.now();
    let success = false;
    let statusCode: number | undefined;
    let error: string | undefined;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout || 5000
      );

      const response = await fetch(endpoint, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      statusCode = response.status;

      const expectedStatuses = config.expectedStatus || [200, 201, 204];
      success = expectedStatuses.includes(response.status);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      success = false;
    }

    const latencyMs = performance.now() - startTime;
    this.recordResult(endpoint, success, latencyMs, statusCode, error);
  }

  private recordResult(
    endpoint: string,
    success: boolean,
    latencyMs: number,
    statusCode?: number,
    error?: string
  ): void {
    const health = this.endpoints.get(endpoint);
    const config = this.configs.get(endpoint);
    
    if (!health || !config) {
      return;
    }

    // Add to history
    const historyList = this.history.get(endpoint) || [];
    historyList.push({
      timestamp: new Date(),
      success,
      latencyMs,
      statusCode,
      error,
    });

    // Trim history
    if (historyList.length > this.options.maxHistory) {
      historyList.shift();
    }
    this.history.set(endpoint, historyList);

    // Update health stats
    const previousStatus = health.status;
    health.lastCheck = new Date();
    health.latencyMs = latencyMs;

    if (success) {
      health.lastSuccess = new Date();
      health.consecutiveSuccesses++;
      health.consecutiveFailures = 0;
    } else {
      health.lastFailure = new Date();
      health.consecutiveFailures++;
      health.consecutiveSuccesses = 0;
    }

    // Calculate success rate from history
    const recentHistory = historyList.slice(-20);
    const successCount = recentHistory.filter(h => h.success).length;
    health.successRate = recentHistory.length > 0
      ? successCount / recentHistory.length
      : 0;

    // Determine status
    health.status = this.calculateStatus(health, config);

    // Notify on status change
    if (previousStatus !== health.status) {
      this.options.onStatusChange(endpoint, previousStatus, health.status);
    }

    this.endpoints.set(endpoint, health);

    // Retry on failure if configured
    if (!success && this.options.retryOnFailure && health.consecutiveFailures === 1) {
      setTimeout(() => this.check(endpoint), 1000);
    }
  }

  private calculateStatus(health: EndpointHealth, config: HealthCheckConfig): HealthStatus {
    // Unknown if never checked
    if (health.lastSuccess === null && health.lastFailure === null) {
      return 'unknown';
    }

    // Unhealthy if consecutive failures exceed threshold
    if (health.consecutiveFailures >= config.unhealthyThreshold) {
      return 'unhealthy';
    }

    // Healthy if consecutive successes exceed threshold
    if (health.consecutiveSuccesses >= config.healthyThreshold) {
      return 'healthy';
    }

    // Degraded if success rate is below 80%
    if (health.successRate < 0.8) {
      return 'degraded';
    }

    // Default to previous healthy/degraded state
    return health.status === 'unknown' ? 'degraded' : health.status;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalHealthMonitor: ConnectionHealthMonitor | null = null;

export function getHealthMonitor(): ConnectionHealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new ConnectionHealthMonitor({
      onStatusChange: (endpoint, from, to) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[HealthMonitor] ${endpoint}: ${from} → ${to}`);
        }
      },
    });
  }
  return globalHealthMonitor;
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect } from 'react';

export function useEndpointHealth(endpoint: string): EndpointHealth | null {
  const [health, setHealth] = useState<EndpointHealth | null>(null);

  useEffect(() => {
    const monitor = getHealthMonitor();
    
    // Get initial health
    setHealth(monitor.getHealth(endpoint));

    // Poll for updates
    const interval = setInterval(() => {
      setHealth(monitor.getHealth(endpoint));
    }, 1000);

    return () => clearInterval(interval);
  }, [endpoint]);

  return health;
}

export function useAllEndpointHealth(): EndpointHealth[] {
  const [health, setHealth] = useState<EndpointHealth[]>([]);

  useEffect(() => {
    const monitor = getHealthMonitor();
    
    // Get initial health
    setHealth(monitor.getAllHealth());

    // Poll for updates
    const interval = setInterval(() => {
      setHealth(monitor.getAllHealth());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return health;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Register common API endpoints for monitoring
 */
export function setupDefaultHealthChecks(baseUrl: string): void {
  const monitor = getHealthMonitor();

  // API health endpoint
  monitor.register({
    endpoint: `${baseUrl}/api/health`,
    interval: 30000,
    timeout: 5000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  });

  // Contracts API
  monitor.register({
    endpoint: `${baseUrl}/api/contracts`,
    interval: 60000,
    timeout: 10000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    expectedStatus: [200, 401], // 401 is expected if not authenticated
  });

  // Start monitoring
  monitor.startAll();
}

/**
 * Get overall system health based on all endpoints
 */
export function getOverallSystemHealth(): HealthStatus {
  const monitor = getHealthMonitor();
  const allHealth = monitor.getAllHealth();

  if (allHealth.length === 0) {
    return 'unknown';
  }

  const statuses = allHealth.map(h => h.status);

  // All unhealthy = unhealthy
  if (statuses.every(s => s === 'unhealthy')) {
    return 'unhealthy';
  }

  // Any unhealthy = degraded
  if (statuses.some(s => s === 'unhealthy')) {
    return 'degraded';
  }

  // Any degraded = degraded
  if (statuses.some(s => s === 'degraded')) {
    return 'degraded';
  }

  // All healthy = healthy
  if (statuses.every(s => s === 'healthy')) {
    return 'healthy';
  }

  return 'unknown';
}
