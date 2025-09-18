/**
 * Graceful Degradation Service
 * Implements graceful degradation patterns for system resilience
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'graceful-degradation' });

export interface DegradationConfig {
  enabled: boolean;
  fallbackStrategies: {
    [service: string]: FallbackStrategy;
  };
  backpressure: {
    enabled: boolean;
    maxQueueSize: number;
    maxConcurrentRequests: number;
    rejectionThreshold: number;
  };
  monitoring: {
    metricsInterval: number;
    alertThresholds: {
      degradationRate: number;
      fallbackUsage: number;
      queueDepth: number;
    };
  };
}

export interface FallbackStrategy {
  type: 'cache' | 'simplified' | 'offline' | 'queue' | 'reject';
  priority: number;
  timeout: number;
  retryCount: number;
  fallbackData?: any;
  queueable: boolean;
  essential: boolean;
}

export interface ServiceStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'failed';
  degradationLevel: number; // 0-100
  fallbackActive: boolean;
  fallbackStrategy?: string;
  lastHealthCheck: Date;
  metrics: {
    requestCount: number;
    errorCount: number;
    fallbackCount: number;
    averageResponseTime: number;
  };
}

export interface BackpressureMetrics {
  queueDepth: number;
  concurrentRequests: number;
  rejectedRequests: number;
  averageWaitTime: number;
  throughput: number;
}

export interface DegradationEvent {
  service: string;
  type: 'degradation_started' | 'degradation_ended' | 'fallback_activated' | 'backpressure_triggered';
  level: number;
  strategy?: string;
  timestamp: Date;
  details: Record<string, any>;
}

export class GracefulDegradationService extends EventEmitter {
  private config: DegradationConfig;
  private serviceStatuses = new Map<string, ServiceStatus>();
  private requestQueues = new Map<string, Array<{ request: any; resolve: Function; reject: Function; timestamp: Date }>>();
  private concurrentRequests = new Map<string, number>();
  private backpressureMetrics: BackpressureMetrics;
  private metricsInterval: NodeJS.Timeout | null = null;
  private startTime = new Date();

  constructor(config: Partial<DegradationConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      fallbackStrategies: {
        llm: {
          type: 'cache',
          priority: 1,
          timeout: 5000,
          retryCount: 2,
          queueable: true,
          essential: false
        },
        database: {
          type: 'cache',
          priority: 1,
          timeout: 3000,
          retryCount: 3,
          queueable: false,
          essential: true
        },
        storage: {
          type: 'simplified',
          priority: 2,
          timeout: 2000,
          retryCount: 2,
          queueable: true,
          essential: false
        },
        search: {
          type: 'cache',
          priority: 1,
          timeout: 1000,
          retryCount: 1,
          queueable: true,
          essential: false
        }
      },
      backpressure: {
        enabled: true,
        maxQueueSize: 1000,
        maxConcurrentRequests: 100,
        rejectionThreshold: 0.8
      },
      monitoring: {
        metricsInterval: 30000,
        alertThresholds: {
          degradationRate: 0.1,
          fallbackUsage: 0.2,
          queueDepth: 500
        }
      },
      ...config
    };

    this.backpressureMetrics = {
      queueDepth: 0,
      concurrentRequests: 0,
      rejectedRequests: 0,
      averageWaitTime: 0,
      throughput: 0
    };

    this.initializeServices();
    this.startMonitoring();
  }

  /**
   * Initialize service statuses
   */
  private initializeServices(): void {
    Object.keys(this.config.fallbackStrategies).forEach(service => {
      this.serviceStatuses.set(service, {
        service,
        status: 'healthy',
        degradationLevel: 0,
        fallbackActive: false,
        lastHealthCheck: new Date(),
        metrics: {
          requestCount: 0,
          errorCount: 0,
          fallbackCount: 0,
          averageResponseTime: 0
        }
      });
      
      this.requestQueues.set(service, []);
      this.concurrentRequests.set(service, 0);
    });
  }

  /**
   * Start monitoring and metrics collection
   */
  private startMonitoring(): void {
    if (!this.config.enabled) return;

    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.checkAlertThresholds();
    }, this.config.monitoring.metricsInterval);

    logger.info('Graceful degradation monitoring started');
  }

  /**
   * Execute request with graceful degradation
   */
  async executeWithDegradation<T>(
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

    // Check backpressure
    if (this.shouldApplyBackpressure(service)) {
      return await this.handleBackpressure(service, operation, fallbackData);
    }

    // Increment concurrent requests
    this.incrementConcurrentRequests(service);

    try {
      const startTime = Date.now();
      const result = await operation();
      
      // Update success metrics
      this.updateServiceMetrics(service, Date.now() - startTime, false);
      
      // Check if we can recover from degradation
      if (serviceStatus.status === 'degraded') {
        this.checkRecovery(service);
      }

      return result;

    } catch (error) {
      // Update error metrics
      this.updateServiceMetrics(service, 0, true);
      
      // Trigger degradation if needed
      this.triggerDegradation(service, error);
      
      // Apply fallback strategy
      return await this.applyFallbackStrategy(service, operation, fallbackData, error);
      
    } finally {
      this.decrementConcurrentRequests(service);
    }
  }

  /**
   * Check if backpressure should be applied
   */
  private shouldApplyBackpressure(service: string): boolean {
    if (!this.config.backpressure.enabled) return false;

    const queueSize = this.requestQueues.get(service)?.length || 0;
    const concurrent = this.concurrentRequests.get(service) || 0;
    
    return queueSize >= this.config.backpressure.maxQueueSize ||
           concurrent >= this.config.backpressure.maxConcurrentRequests;
  }

  /**
   * Handle backpressure by queuing or rejecting requests
   */
  private async handleBackpressure<T>(
    service: string,
    operation: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    const strategy = this.config.fallbackStrategies[service];
    const queue = this.requestQueues.get(service)!;
    
    // If not queueable or queue is full, reject or use fallback
    if (!strategy.queueable || queue.length >= this.config.backpressure.maxQueueSize) {
      this.backpressureMetrics.rejectedRequests++;
      
      if (fallbackData !== undefined) {
        logger.warn({ service }, 'Backpressure triggered, using fallback data');
        return fallbackData;
      }
      
      throw new Error(`Service ${service} is overloaded - request rejected`);
    }

    // Queue the request
    return new Promise<T>((resolve, reject) => {
      queue.push({
        request: operation,
        resolve,
        reject,
        timestamp: new Date()
      });

      this.emit('backpressure_triggered', {
        service,
        queueDepth: queue.length,
        timestamp: new Date()
      });

      // Process queue
      this.processQueue(service);
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(service: string): Promise<void> {
    const queue = this.requestQueues.get(service)!;
    const concurrent = this.concurrentRequests.get(service) || 0;
    
    if (queue.length === 0 || concurrent >= this.config.backpressure.maxConcurrentRequests) {
      return;
    }

    const queuedRequest = queue.shift();
    if (!queuedRequest) return;

    try {
      this.incrementConcurrentRequests(service);
      const result = await queuedRequest.request();
      queuedRequest.resolve(result);
    } catch (error) {
      queuedRequest.reject(error);
    } finally {
      this.decrementConcurrentRequests(service);
      
      // Process next request in queue
      setImmediate(() => this.processQueue(service));
    }
  }

  /**
   * Apply fallback strategy when service fails
   */
  private async applyFallbackStrategy<T>(
    service: string,
    operation: () => Promise<T>,
    fallbackData: T | undefined,
    error: any
  ): Promise<T> {
    const strategy = this.config.fallbackStrategies[service];
    const serviceStatus = this.serviceStatuses.get(service)!;

    serviceStatus.fallbackActive = true;
    serviceStatus.fallbackStrategy = strategy.type;
    serviceStatus.metrics.fallbackCount++;

    this.emit('fallback_activated', {
      service,
      type: 'fallback_activated',
      level: serviceStatus.degradationLevel,
      strategy: strategy.type,
      timestamp: new Date(),
      details: { error: error.message }
    });

    logger.warn({
      service,
      strategy: strategy.type,
      error: error.message
    }, 'Fallback strategy activated');

    switch (strategy.type) {
      case 'cache':
        return await this.applyCacheFallback(service, fallbackData);
        
      case 'simplified':
        return await this.applySimplifiedFallback(service, fallbackData);
        
      case 'offline':
        return await this.applyOfflineFallback(service, fallbackData);
        
      case 'queue':
        return await this.applyQueueFallback(service, operation);
        
      case 'reject':
        throw new Error(`Service ${service} is unavailable`);
        
      default:
        throw error;
    }
  }

  /**
   * Apply cache fallback strategy
   */
  private async applyCacheFallback<T>(service: string, fallbackData?: T): Promise<T> {
    // In a real implementation, this would check cache for previous results
    if (fallbackData !== undefined) {
      logger.info({ service }, 'Using cached fallback data');
      return fallbackData;
    }

    // Return simplified/default response
    return this.getDefaultFallbackData(service);
  }

  /**
   * Apply simplified fallback strategy
   */
  private async applySimplifiedFallback<T>(service: string, fallbackData?: T): Promise<T> {
    if (fallbackData !== undefined) {
      return fallbackData;
    }

    // Return simplified version of the expected response
    return this.getSimplifiedResponse(service);
  }

  /**
   * Apply offline fallback strategy
   */
  private async applyOfflineFallback<T>(service: string, fallbackData?: T): Promise<T> {
    if (fallbackData !== undefined) {
      return fallbackData;
    }

    // Return offline/static data
    return this.getOfflineData(service);
  }

  /**
   * Apply queue fallback strategy
   */
  private async applyQueueFallback<T>(service: string, operation: () => Promise<T>): Promise<T> {
    // Queue the request for later processing
    return new Promise<T>((resolve, reject) => {
      const queue = this.requestQueues.get(service)!;
      queue.push({
        request: operation,
        resolve,
        reject,
        timestamp: new Date()
      });

      // Set timeout for queued request
      const strategy = this.config.fallbackStrategies[service];
      setTimeout(() => {
        reject(new Error(`Queued request for ${service} timed out`));
      }, strategy.timeout);
    });
  }

  /**
   * Get default fallback data for a service
   */
  private getDefaultFallbackData<T>(service: string): T {
    const fallbackData = this.config.fallbackStrategies[service]?.fallbackData;
    
    if (fallbackData) {
      return fallbackData;
    }

    // Service-specific default responses
    switch (service) {
      case 'llm':
        return {
          analysis: 'Service temporarily unavailable - analysis will be retried',
          confidence: 0,
          fallback: true
        } as T;
        
      case 'database':
        return {
          data: [],
          cached: true,
          fallback: true
        } as T;
        
      case 'storage':
        return {
          stored: false,
          queued: true,
          fallback: true
        } as T;
        
      case 'search':
        return {
          results: [],
          total: 0,
          fallback: true
        } as T;
        
      default:
        return {
          error: 'Service unavailable',
          fallback: true
        } as T;
    }
  }

  /**
   * Get simplified response for a service
   */
  private getSimplifiedResponse<T>(service: string): T {
    switch (service) {
      case 'llm':
        return {
          analysis: 'Simplified analysis - full analysis will be available when service recovers',
          confidence: 0.5,
          simplified: true
        } as T;
        
      case 'search':
        return {
          results: [],
          total: 0,
          simplified: true,
          message: 'Search temporarily simplified - try again later for full results'
        } as T;
        
      default:
        return this.getDefaultFallbackData(service);
    }
  }

  /**
   * Get offline data for a service
   */
  private getOfflineData<T>(service: string): T {
    // In a real implementation, this would return pre-cached offline data
    return {
      offline: true,
      message: `${service} is operating in offline mode`,
      data: null
    } as T;
  }

  /**
   * Trigger degradation for a service
   */
  private triggerDegradation(service: string, error: any): void {
    const serviceStatus = this.serviceStatuses.get(service)!;
    const strategy = this.config.fallbackStrategies[service];
    
    // Calculate degradation level based on error rate
    const errorRate = serviceStatus.metrics.errorCount / Math.max(serviceStatus.metrics.requestCount, 1);
    const newDegradationLevel = Math.min(100, Math.floor(errorRate * 100));
    
    if (newDegradationLevel > serviceStatus.degradationLevel) {
      const previousStatus = serviceStatus.status;
      serviceStatus.degradationLevel = newDegradationLevel;
      
      // Update service status based on degradation level
      if (newDegradationLevel >= 80) {
        serviceStatus.status = 'failed';
      } else if (newDegradationLevel >= 30) {
        serviceStatus.status = 'degraded';
      }
      
      // Emit degradation event if status changed
      if (serviceStatus.status !== previousStatus) {
        const event: DegradationEvent = {
          service,
          type: 'degradation_started',
          level: newDegradationLevel,
          timestamp: new Date(),
          details: {
            previousStatus,
            newStatus: serviceStatus.status,
            errorRate,
            error: error.message
          }
        };
        
        this.emit('degradation_started', event);
        
        logger.warn({
          service,
          degradationLevel: newDegradationLevel,
          status: serviceStatus.status,
          errorRate
        }, 'Service degradation triggered');
      }
    }
  }

  /**
   * Check if service can recover from degradation
   */
  private checkRecovery(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service)!;
    
    // Calculate recent success rate
    const recentRequests = Math.min(serviceStatus.metrics.requestCount, 100);
    const recentErrors = Math.min(serviceStatus.metrics.errorCount, recentRequests);
    const successRate = (recentRequests - recentErrors) / Math.max(recentRequests, 1);
    
    // If success rate is high enough, start recovery
    if (successRate >= 0.8 && serviceStatus.degradationLevel > 0) {
      const newDegradationLevel = Math.max(0, serviceStatus.degradationLevel - 10);
      serviceStatus.degradationLevel = newDegradationLevel;
      
      // Update status based on new degradation level
      const previousStatus = serviceStatus.status;
      if (newDegradationLevel === 0) {
        serviceStatus.status = 'healthy';
        serviceStatus.fallbackActive = false;
        serviceStatus.fallbackStrategy = undefined;
      } else if (newDegradationLevel < 30) {
        serviceStatus.status = 'healthy';
      } else if (newDegradationLevel < 80) {
        serviceStatus.status = 'degraded';
      }
      
      // Emit recovery event if fully recovered
      if (serviceStatus.status === 'healthy' && previousStatus !== 'healthy') {
        const event: DegradationEvent = {
          service,
          type: 'degradation_ended',
          level: 0,
          timestamp: new Date(),
          details: {
            previousStatus,
            successRate,
            recoveryTime: Date.now() - this.startTime.getTime()
          }
        };
        
        this.emit('degradation_ended', event);
        
        logger.info({
          service,
          successRate,
          recoveryTime: Date.now() - this.startTime.getTime()
        }, 'Service recovered from degradation');
      }
    }
  }

  /**
   * Update service metrics
   */
  private updateServiceMetrics(service: string, responseTime: number, isError: boolean): void {
    const serviceStatus = this.serviceStatuses.get(service)!;
    
    serviceStatus.metrics.requestCount++;
    if (isError) {
      serviceStatus.metrics.errorCount++;
    }
    
    // Update average response time
    const totalTime = serviceStatus.metrics.averageResponseTime * (serviceStatus.metrics.requestCount - 1);
    serviceStatus.metrics.averageResponseTime = (totalTime + responseTime) / serviceStatus.metrics.requestCount;
    
    serviceStatus.lastHealthCheck = new Date();
  }

  /**
   * Increment concurrent requests counter
   */
  private incrementConcurrentRequests(service: string): void {
    const current = this.concurrentRequests.get(service) || 0;
    this.concurrentRequests.set(service, current + 1);
  }

  /**
   * Decrement concurrent requests counter
   */
  private decrementConcurrentRequests(service: string): void {
    const current = this.concurrentRequests.get(service) || 0;
    this.concurrentRequests.set(service, Math.max(0, current - 1));
  }

  /**
   * Update backpressure metrics
   */
  private updateMetrics(): void {
    let totalQueueDepth = 0;
    let totalConcurrent = 0;
    
    this.requestQueues.forEach(queue => {
      totalQueueDepth += queue.length;
    });
    
    this.concurrentRequests.forEach(count => {
      totalConcurrent += count;
    });
    
    this.backpressureMetrics.queueDepth = totalQueueDepth;
    this.backpressureMetrics.concurrentRequests = totalConcurrent;
    
    // Calculate throughput (requests per second)
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    const totalRequests = Array.from(this.serviceStatuses.values())
      .reduce((sum, status) => sum + status.metrics.requestCount, 0);
    this.backpressureMetrics.throughput = totalRequests / Math.max(uptime, 1);
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(): void {
    const thresholds = this.config.monitoring.alertThresholds;
    
    // Check degradation rate
    const degradedServices = Array.from(this.serviceStatuses.values())
      .filter(status => status.status !== 'healthy').length;
    const totalServices = this.serviceStatuses.size;
    const degradationRate = degradedServices / Math.max(totalServices, 1);
    
    if (degradationRate > thresholds.degradationRate) {
      this.emit('alert', {
        type: 'high_degradation_rate',
        value: degradationRate,
        threshold: thresholds.degradationRate,
        timestamp: new Date()
      });
    }
    
    // Check fallback usage
    const fallbackServices = Array.from(this.serviceStatuses.values())
      .filter(status => status.fallbackActive).length;
    const fallbackUsage = fallbackServices / Math.max(totalServices, 1);
    
    if (fallbackUsage > thresholds.fallbackUsage) {
      this.emit('alert', {
        type: 'high_fallback_usage',
        value: fallbackUsage,
        threshold: thresholds.fallbackUsage,
        timestamp: new Date()
      });
    }
    
    // Check queue depth
    if (this.backpressureMetrics.queueDepth > thresholds.queueDepth) {
      this.emit('alert', {
        type: 'high_queue_depth',
        value: this.backpressureMetrics.queueDepth,
        threshold: thresholds.queueDepth,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(service: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(service);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): Map<string, ServiceStatus> {
    return new Map(this.serviceStatuses);
  }

  /**
   * Get backpressure metrics
   */
  getBackpressureMetrics(): BackpressureMetrics {
    return { ...this.backpressureMetrics };
  }

  /**
   * Get system overview
   */
  getSystemOverview(): {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    failedServices: number;
    fallbacksActive: number;
    backpressure: BackpressureMetrics;
    uptime: number;
  } {
    const statuses = Array.from(this.serviceStatuses.values());
    
    return {
      totalServices: statuses.length,
      healthyServices: statuses.filter(s => s.status === 'healthy').length,
      degradedServices: statuses.filter(s => s.status === 'degraded').length,
      failedServices: statuses.filter(s => s.status === 'failed').length,
      fallbacksActive: statuses.filter(s => s.fallbackActive).length,
      backpressure: this.getBackpressureMetrics(),
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Force service degradation (for testing)
   */
  forceDegradation(service: string, level: number): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;
    
    serviceStatus.degradationLevel = Math.max(0, Math.min(100, level));
    
    if (level >= 80) {
      serviceStatus.status = 'failed';
    } else if (level >= 30) {
      serviceStatus.status = 'degraded';
    } else {
      serviceStatus.status = 'healthy';
    }
    
    logger.info({ service, level }, 'Forced service degradation');
  }

  /**
   * Reset service status (for testing)
   */
  resetService(service: string): void {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;
    
    serviceStatus.status = 'healthy';
    serviceStatus.degradationLevel = 0;
    serviceStatus.fallbackActive = false;
    serviceStatus.fallbackStrategy = undefined;
    serviceStatus.metrics = {
      requestCount: 0,
      errorCount: 0,
      fallbackCount: 0,
      averageResponseTime: 0
    };
    
    logger.info({ service }, 'Service status reset');
  }

  /**
   * Health check for the degradation service itself
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    uptime: number;
    servicesMonitored: number;
    degradedServices: number;
    fallbacksActive: number;
    queueDepth: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const overview = this.getSystemOverview();
    
    if (overview.failedServices > 0) {
      issues.push(`${overview.failedServices} services failed`);
    }
    
    if (overview.degradedServices > overview.totalServices * 0.5) {
      issues.push('More than 50% of services are degraded');
    }
    
    if (overview.backpressure.queueDepth > this.config.backpressure.maxQueueSize * 0.8) {
      issues.push('Queue depth approaching maximum capacity');
    }
    
    return {
      healthy: issues.length === 0,
      uptime: overview.uptime,
      servicesMonitored: overview.totalServices,
      degradedServices: overview.degradedServices + overview.failedServices,
      fallbacksActive: overview.fallbacksActive,
      queueDepth: overview.backpressure.queueDepth,
      issues
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down graceful degradation service');
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    // Clear all queues
    this.requestQueues.forEach(queue => {
      queue.forEach(item => {
        item.reject(new Error('Service shutting down'));
      });
      queue.length = 0;
    });
    
    this.removeAllListeners();
    logger.info('Graceful degradation service shutdown complete');
  }
}

export const gracefulDegradationService = new GracefulDegradationService({
  enabled: true,
  fallbackStrategies: {
    llm: {
      type: 'cache',
      priority: 1,
      timeout: 5000,
      retryCount: 2,
      queueable: true,
      essential: false
    },
    database: {
      type: 'cache',
      priority: 1,
      timeout: 3000,
      retryCount: 3,
      queueable: false,
      essential: true
    },
    storage: {
      type: 'simplified',
      priority: 2,
      timeout: 2000,
      retryCount: 2,
      queueable: true,
      essential: false
    },
    search: {
      type: 'cache',
      priority: 1,
      timeout: 1000,
      retryCount: 1,
      queueable: true,
      essential: false
    }
  },
  backpressure: {
    enabled: true,
    maxQueueSize: 1000,
    maxConcurrentRequests: 100,
    rejectionThreshold: 0.8
  },
  monitoring: {
    metricsInterval: 30000,
    alertThresholds: {
      degradationRate: 0.1,
      fallbackUsage: 0.2,
      queueDepth: 500
    }
  }
});