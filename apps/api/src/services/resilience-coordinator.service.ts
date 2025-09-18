/**
 * Resilience Coordinator Service
 * Coordinates circuit breakers and graceful degradation for comprehensive resilience
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { circuitBreakerManager } from './circuit-breaker.service';
import { gracefulDegradationService } from './graceful-degradation.service';

const logger = pino({ name: 'resilience-coordinator' });

export interface ResilienceConfig {
  enabled: boolean;
  coordination: {
    circuitBreakerIntegration: boolean;
    degradationTriggers: {
      circuitOpenThreshold: number;
      errorRateThreshold: number;
      responseTimeThreshold: number;
    };
    recoveryConditions: {
      circuitClosedRequired: boolean;
      successRateThreshold: number;
      stabilityPeriod: number;
    };
  };
  monitoring: {
    metricsInterval: number;
    healthCheckInterval: number;
  };
}

export interface ServiceResilienceStatus {
  service: string;
  circuitState: string;
  degradationLevel: number;
  fallbackActive: boolean;
  overallHealth: 'healthy' | 'degraded' | 'failed';
  metrics: {
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
    circuitFailures: number;
    fallbackUsage: number;
  };
  lastUpdate: Date;
}

export interface ResilienceMetrics {
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  failedServices: number;
  circuitsOpen: number;
  fallbacksActive: number;
  overallSystemHealth: number; // 0-100
  uptime: number;
}

export class ResilienceCoordinatorService extends EventEmitter {
  private config: ResilienceConfig;
  private serviceStatuses = new Map<string, ServiceResilienceStatus>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime = new Date();

  constructor(config: Partial<ResilienceConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      coordination: {
        circuitBreakerIntegration: true,
        degradationTriggers: {
          circuitOpenThreshold: 1, // Trigger degradation when circuit opens
          errorRateThreshold: 0.1, // 10% error rate
          responseTimeThreshold: 5000 // 5 seconds
        },
        recoveryConditions: {
          circuitClosedRequired: true,
          successRateThreshold: 0.9, // 90% success rate
          stabilityPeriod: 60000 // 1 minute of stability
        }
      },
      monitoring: {
        metricsInterval: 30000, // 30 seconds
        healthCheckInterval: 15000 // 15 seconds
      },
      ...config
    };

    this.initializeServices();
    this.startMonitoring();
    this.setupEventListeners();
  }

  /**
   * Initialize service tracking
   */
  private initializeServices(): void {
    const services = ['llm', 'database', 'storage', 'search', 'workers', 'cache'];
    
    services.forEach(service => {
      this.serviceStatuses.set(service, {
        service,
        circuitState: 'closed',
        degradationLevel: 0,
        fallbackActive: false,
        overallHealth: 'healthy',
        metrics: {
          requestCount: 0,
          errorRate: 0,
          averageResponseTime: 0,
          circuitFailures: 0,
          fallbackUsage: 0
        },
        lastUpdate: new Date()
      });
    });
  }

  /**
   * Setup event listeners for circuit breaker and degradation events
   */
  private setupEventListeners(): void {
    if (!this.config.enabled) return;

    // Listen to circuit breaker events
    circuitBreakerManager.on('circuit_opened', (event) => {
      this.handleCircuitOpened(event.service);
    });

    circuitBreakerManager.on('circuit_closed', (event) => {
      this.handleCircuitClosed(event.service);
    });

    circuitBreakerManager.on('circuit_half_opened', (event) => {
      this.handleCircuitHalfOpened(event.service);
    });

    // Listen to degradation events
    gracefulDegradationService.on('degradation_started', (event) => {
      this.handleDegradationStarted(event.service, event.level);
    });

    gracefulDegradationService.on('degradation_ended', (event) => {
      this.handleDegradationEnded(event.service);
    });

    gracefulDegradationService.on('fallback_activated', (event) => {
      this.handleFallbackActivated(event.service, event.strategy);
    });
  }

  /**
   * Start monitoring services
   */
  private startMonitoring(): void {
    if (!this.config.enabled) return;

    // Start metrics collection
    this.monitoringInterval = setInterval(() => {
      this.updateServiceMetrics();
    }, this.config.monitoring.metricsInterval);

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.monitoring.healthCheckInterval);

    logger.info('Resilience coordinator monitoring started');
  }

  /**
   * Execute operation with full resilience coordination
   */
  async executeWithResilience<T>(
    service: string,
    operation: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    if (!this.config.enabled) {
      return await operation();
    }

    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) {
      throw new Error(`Unknown service: ${service}`);
    }

    try {
      // First, try with circuit breaker protection
      const result = await circuitBreakerManager.execute(service, async () => {
        // Then, apply graceful degradation if needed
        return await gracefulDegradationService.executeWithDegradation(
          service,
          operation,
          fallbackData
        );
      });

      // Update success metrics
      this.updateServiceSuccess(service);
      return result;

    } catch (error) {
      // Update failure metrics
      this.updateServiceFailure(service, error);
      
      // If circuit breaker failed, try graceful degradation directly
      if (error.message?.includes('Circuit breaker is open')) {
        logger.warn({ service }, 'Circuit breaker open, attempting graceful degradation');
        
        try {
          return await gracefulDegradationService.executeWithDegradation(
            service,
            operation,
            fallbackData
          );
        } catch (degradationError) {
          logger.error({ service, error: degradationError }, 'Both circuit breaker and graceful degradation failed');
          throw degradationError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Handle circuit breaker opened event
   */
  private handleCircuitOpened(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.circuitState = 'open';
    serviceStatus.lastUpdate = new Date();

    // Trigger degradation if configured
    if (this.config.coordination.circuitBreakerIntegration) {
      gracefulDegradationService.forceDegradation(service, 80); // High degradation level
      
      logger.warn({ service }, 'Circuit breaker opened, triggering service degradation');
      
      this.emit('service_degraded', {
        service,
        reason: 'circuit_breaker_open',
        timestamp: new Date()
      });
    }

    this.updateOverallHealth(service);
  }

  /**
   * Handle circuit breaker closed event
   */
  private handleCircuitClosed(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.circuitState = 'closed';
    serviceStatus.lastUpdate = new Date();

    // Check if we can end degradation
    if (this.config.coordination.circuitBreakerIntegration) {
      const degradationStatus = gracefulDegradationService.getServiceStatus(service);
      
      if (degradationStatus && degradationStatus.degradationLevel > 0) {
        // Gradually recover from degradation
        gracefulDegradationService.resetService(service);
        
        logger.info({ service }, 'Circuit breaker closed, ending service degradation');
        
        this.emit('service_recovered', {
          service,
          reason: 'circuit_breaker_closed',
          timestamp: new Date()
        });
      }
    }

    this.updateOverallHealth(service);
  }

  /**
   * Handle circuit breaker half-opened event
   */
  private handleCircuitHalfOpened(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.circuitState = 'half_open';
    serviceStatus.lastUpdate = new Date();

    logger.info({ service }, 'Circuit breaker half-opened, testing service recovery');
    
    this.emit('service_testing_recovery', {
      service,
      timestamp: new Date()
    });

    this.updateOverallHealth(service);
  }

  /**
   * Handle degradation started event
   */
  private handleDegradationStarted(service: string, level: number): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.degradationLevel = level;
    serviceStatus.lastUpdate = new Date();

    logger.warn({ service, level }, 'Service degradation started');
    this.updateOverallHealth(service);
  }

  /**
   * Handle degradation ended event
   */
  private handleDegradationEnded(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.degradationLevel = 0;
    serviceStatus.fallbackActive = false;
    serviceStatus.lastUpdate = new Date();

    logger.info({ service }, 'Service degradation ended');
    this.updateOverallHealth(service);
  }

  /**
   * Handle fallback activated event
   */
  private handleFallbackActivated(service: string, strategy?: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.fallbackActive = true;
    serviceStatus.metrics.fallbackUsage++;
    serviceStatus.lastUpdate = new Date();

    logger.info({ service, strategy }, 'Fallback strategy activated');
    this.updateOverallHealth(service);
  }

  /**
   * Update service success metrics
   */
  private updateServiceSuccess(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.metrics.requestCount++;
    serviceStatus.lastUpdate = new Date();

    // Recalculate error rate
    const circuitStats = circuitBreakerManager.getStats(service);
    if (circuitStats) {
      serviceStatus.metrics.errorRate = circuitStats.failures / Math.max(circuitStats.requests, 1);
      serviceStatus.metrics.circuitFailures = circuitStats.failures;
    }
  }

  /**
   * Update service failure metrics
   */
  private updateServiceFailure(service: string, error: any): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.metrics.requestCount++;
    serviceStatus.lastUpdate = new Date();

    // Update error rate from circuit breaker stats
    const circuitStats = circuitBreakerManager.getStats(service);
    if (circuitStats) {
      serviceStatus.metrics.errorRate = circuitStats.failures / Math.max(circuitStats.requests, 1);
      serviceStatus.metrics.circuitFailures = circuitStats.failures;
    }

    // Check if we need to trigger additional degradation
    this.checkDegradationTriggers(service);
  }

  /**
   * Check if degradation should be triggered based on metrics
   */
  private checkDegradationTriggers(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    const triggers = this.config.coordination.degradationTriggers;
    
    // Check error rate trigger
    if (serviceStatus.metrics.errorRate > triggers.errorRateThreshold) {
      const degradationLevel = Math.min(100, Math.floor(serviceStatus.metrics.errorRate * 100));
      gracefulDegradationService.forceDegradation(service, degradationLevel);
      
      logger.warn({
        service,
        errorRate: serviceStatus.metrics.errorRate,
        degradationLevel
      }, 'Error rate threshold exceeded, triggering degradation');
    }

    // Check response time trigger
    if (serviceStatus.metrics.averageResponseTime > triggers.responseTimeThreshold) {
      gracefulDegradationService.forceDegradation(service, 50); // Medium degradation
      
      logger.warn({
        service,
        responseTime: serviceStatus.metrics.averageResponseTime
      }, 'Response time threshold exceeded, triggering degradation');
    }
  }

  /**
   * Update overall health for a service
   */
  private updateOverallHealth(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    // Determine overall health based on circuit state and degradation level
    if (serviceStatus.circuitState === 'open' || serviceStatus.degradationLevel >= 80) {
      serviceStatus.overallHealth = 'failed';
    } else if (serviceStatus.circuitState === 'half_open' || serviceStatus.degradationLevel >= 30 || serviceStatus.fallbackActive) {
      serviceStatus.overallHealth = 'degraded';
    } else {
      serviceStatus.overallHealth = 'healthy';
    }

    serviceStatus.lastUpdate = new Date();
  }

  /**
   * Update service metrics from external sources
   */
  private updateServiceMetrics(): void {
    this.serviceStatuses.forEach((status, service) => {
      // Update circuit breaker metrics
      const circuitStats = circuitBreakerManager.getStats(service);
      if (circuitStats) {
        status.circuitState = circuitStats.state;
        status.metrics.requestCount = circuitStats.requests;
        status.metrics.errorRate = circuitStats.failures / Math.max(circuitStats.requests, 1);
        status.metrics.circuitFailures = circuitStats.failures;
      }

      // Update degradation metrics
      const degradationStatus = gracefulDegradationService.getServiceStatus(service);
      if (degradationStatus) {
        status.degradationLevel = degradationStatus.degradationLevel;
        status.fallbackActive = degradationStatus.fallbackActive;
        status.metrics.fallbackUsage = degradationStatus.metrics.fallbackCount;
        status.metrics.averageResponseTime = degradationStatus.metrics.averageResponseTime;
      }

      // Update overall health
      this.updateOverallHealth(service);
    });
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.serviceStatuses.keys()).map(async (service) => {
      try {
        // Perform a simple health check operation
        await this.executeWithResilience(service, async () => {
          // Simulate health check - in real implementation, this would be actual service calls
          if (Math.random() < 0.05) { // 5% chance of health check failure
            throw new Error(`Health check failed for ${service}`);
          }
          return { healthy: true };
        });
      } catch (error) {
        logger.debug({ service, error: error.message }, 'Health check failed');
      }
    });

    await Promise.allSettled(healthPromises);
  }

  /**
   * Get service resilience status
   */
  getServiceStatus(service: string): ServiceResilienceStatus | undefined {
    return this.serviceStatuses.get(service);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): Map<string, ServiceResilienceStatus> {
    return new Map(this.serviceStatuses);
  }

  /**
   * Get resilience metrics
   */
  getResilienceMetrics(): ResilienceMetrics {
    const statuses = Array.from(this.serviceStatuses.values());
    const totalServices = statuses.length;
    const healthyServices = statuses.filter(s => s.overallHealth === 'healthy').length;
    const degradedServices = statuses.filter(s => s.overallHealth === 'degraded').length;
    const failedServices = statuses.filter(s => s.overallHealth === 'failed').length;
    const circuitsOpen = statuses.filter(s => s.circuitState === 'open').length;
    const fallbacksActive = statuses.filter(s => s.fallbackActive).length;

    // Calculate overall system health (0-100)
    const healthScore = totalServices > 0 
      ? Math.floor(((healthyServices * 100) + (degradedServices * 50)) / totalServices)
      : 100;

    return {
      totalServices,
      healthyServices,
      degradedServices,
      failedServices,
      circuitsOpen,
      fallbacksActive,
      overallSystemHealth: healthScore,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Get system resilience overview
   */
  getSystemOverview(): {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: ResilienceMetrics;
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getResilienceMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Determine overall system status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (metrics.failedServices > 0) {
      status = 'critical';
      issues.push(`${metrics.failedServices} services have failed`);
      recommendations.push('Investigate failed services immediately');
    } else if (metrics.degradedServices > metrics.totalServices * 0.3) {
      status = 'degraded';
      issues.push(`${metrics.degradedServices} services are degraded`);
      recommendations.push('Monitor degraded services and consider scaling resources');
    }

    if (metrics.circuitsOpen > 0) {
      issues.push(`${metrics.circuitsOpen} circuit breakers are open`);
      recommendations.push('Check external service dependencies');
    }

    if (metrics.fallbacksActive > metrics.totalServices * 0.2) {
      issues.push(`${metrics.fallbacksActive} services are using fallbacks`);
      recommendations.push('Review service performance and capacity');
    }

    if (metrics.overallSystemHealth < 70) {
      status = 'critical';
      issues.push(`System health is low: ${metrics.overallSystemHealth}%`);
      recommendations.push('Immediate intervention required');
    } else if (metrics.overallSystemHealth < 90) {
      if (status === 'healthy') status = 'degraded';
      issues.push(`System health is degraded: ${metrics.overallSystemHealth}%`);
      recommendations.push('Monitor system closely and prepare for scaling');
    }

    return {
      status,
      metrics,
      issues,
      recommendations
    };
  }

  /**
   * Force service recovery (for testing/emergency)
   */
  forceServiceRecovery(service: string): void {
    circuitBreakerManager.reset(service);
    gracefulDegradationService.resetService(service);
    
    const serviceStatus = this.serviceStatuses.get(service);
    if (serviceStatus) {
      serviceStatus.circuitState = 'closed';
      serviceStatus.degradationLevel = 0;
      serviceStatus.fallbackActive = false;
      serviceStatus.overallHealth = 'healthy';
      serviceStatus.lastUpdate = new Date();
    }

    logger.info({ service }, 'Forced service recovery');
    
    this.emit('service_force_recovered', {
      service,
      timestamp: new Date()
    });
  }

  /**
   * Health check for the resilience coordinator itself
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    uptime: number;
    servicesMonitored: number;
    systemHealth: number;
    criticalIssues: number;
    issues: string[];
  }> {
    const overview = this.getSystemOverview();
    const issues: string[] = [];

    if (overview.status === 'critical') {
      issues.push('System is in critical state');
    }

    if (overview.metrics.failedServices > 0) {
      issues.push(`${overview.metrics.failedServices} services failed`);
    }

    if (overview.metrics.overallSystemHealth < 50) {
      issues.push('System health critically low');
    }

    return {
      healthy: overview.status !== 'critical' && issues.length === 0,
      uptime: overview.metrics.uptime,
      servicesMonitored: overview.metrics.totalServices,
      systemHealth: overview.metrics.overallSystemHealth,
      criticalIssues: overview.issues.length,
      issues: [...issues, ...overview.issues]
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down resilience coordinator service');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.removeAllListeners();
    logger.info('Resilience coordinator service shutdown complete');
  }
}

export const resilienceCoordinatorService = new ResilienceCoordinatorService({
  enabled: true,
  coordination: {
    circuitBreakerIntegration: true,
    degradationTriggers: {
      circuitOpenThreshold: 1,
      errorRateThreshold: 0.1,
      responseTimeThreshold: 5000
    },
    recoveryConditions: {
      circuitClosedRequired: true,
      successRateThreshold: 0.9,
      stabilityPeriod: 60000
    }
  },
  monitoring: {
    metricsInterval: 30000,
    healthCheckInterval: 15000
  }
});