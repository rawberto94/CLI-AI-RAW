/**
 * Service Mesh Integration Layer
 * Manages inter-service communication, load balancing, and circuit breaking
 */

import { EventEmitter } from 'events';

export interface ServiceEndpoint {
  id: string;
  name: string;
  url: string;
  version: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: Date;
  metadata: {
    region: string;
    zone: string;
    capabilities: string[];
    loadFactor: number;
  };
}

export interface ServiceCall {
  id: string;
  serviceId: string;
  method: string;
  endpoint: string;
  payload: any;
  headers: Record<string, string>;
  timeout: number;
  retryPolicy: RetryPolicy;
  circuitBreaker: CircuitBreakerConfig;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'weighted' | 'least-connections' | 'random' | 'geographic';
  config: Record<string, any>;
}

export interface ServiceCallResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    serviceId: string;
    endpoint: string;
    duration: number;
    attempts: number;
    circuitBreakerState: 'closed' | 'open' | 'half-open';
  };
}

export class ServiceMesh extends EventEmitter {
  private services = new Map<string, ServiceEndpoint[]>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private loadBalancers = new Map<string, LoadBalancer>();
  private callHistory = new Map<string, ServiceCallHistory>();
  
  private healthCheckInterval = 30000; // 30 seconds
  private metricsRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    this.startHealthChecking();
    this.startMetricsCleanup();
  }

  /**
   * Register a service endpoint
   */
  registerService(service: ServiceEndpoint): void {
    if (!this.services.has(service.name)) {
      this.services.set(service.name, []);
    }

    const serviceList = this.services.get(service.name)!;
    const existingIndex = serviceList.findIndex(s => s.id === service.id);
    
    if (existingIndex >= 0) {
      serviceList[existingIndex] = service;
    } else {
      serviceList.push(service);
    }

    // Initialize circuit breaker for this service
    if (!this.circuitBreakers.has(service.id)) {
      this.circuitBreakers.set(service.id, new CircuitBreaker({
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3
      }));
    }

    // Initialize load balancer for this service type
    if (!this.loadBalancers.has(service.name)) {
      this.loadBalancers.set(service.name, new LoadBalancer({
        type: 'weighted',
        config: { considerHealth: true, considerLoad: true }
      }));
    }

    this.emit('service:registered', service);
  }

  /**
   * Unregister a service endpoint
   */
  unregisterService(serviceName: string, serviceId: string): boolean {
    const serviceList = this.services.get(serviceName);
    if (!serviceList) return false;

    const index = serviceList.findIndex(s => s.id === serviceId);
    if (index >= 0) {
      serviceList.splice(index, 1);
      this.circuitBreakers.delete(serviceId);
      this.emit('service:unregistered', { serviceName, serviceId });
      return true;
    }

    return false;
  }

  /**
   * Make a service call with automatic load balancing and circuit breaking
   */
  async call(serviceCall: ServiceCall): Promise<ServiceCallResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    // Get available service endpoints
    const serviceEndpoints = this.services.get(serviceCall.serviceId) || [];
    if (serviceEndpoints.length === 0) {
      throw new Error(`No endpoints available for service: ${serviceCall.serviceId}`);
    }

    // Retry loop
    while (attempts < serviceCall.retryPolicy.maxAttempts) {
      attempts++;

      try {
        // Select endpoint using load balancer
        const endpoint = await this.selectEndpoint(serviceCall.serviceId, serviceEndpoints);
        if (!endpoint) {
          throw new Error(`No healthy endpoints available for service: ${serviceCall.serviceId}`);
        }

        // Check circuit breaker
        const circuitBreaker = this.circuitBreakers.get(endpoint.id);
        if (circuitBreaker && !circuitBreaker.canExecute()) {
          throw new Error(`Circuit breaker is open for service: ${endpoint.id}`);
        }

        // Make the actual call
        const result = await this.executeCall(serviceCall, endpoint);
        
        // Record success
        if (circuitBreaker) {
          circuitBreaker.recordSuccess();
        }
        this.recordCallMetrics(serviceCall, endpoint, true, Date.now() - startTime, attempts);

        return {
          success: true,
          data: result,
          metadata: {
            serviceId: endpoint.id,
            endpoint: endpoint.url,
            duration: Date.now() - startTime,
            attempts,
            circuitBreakerState: circuitBreaker?.getState() || 'closed'
          }
        };

      } catch (error) {
        lastError = error as Error;
        
        // Record failure
        const endpoint = serviceEndpoints[0]; // Fallback for metrics
        const circuitBreaker = this.circuitBreakers.get(endpoint?.id || '');
        if (circuitBreaker) {
          circuitBreaker.recordFailure();
        }

        // Check if error is retryable
        if (!this.isRetryableError(error as Error, serviceCall.retryPolicy)) {
          break;
        }

        // Wait before retry
        if (attempts < serviceCall.retryPolicy.maxAttempts) {
          const delay = this.calculateRetryDelay(attempts, serviceCall.retryPolicy);
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    this.recordCallMetrics(serviceCall, serviceEndpoints[0], false, Date.now() - startTime, attempts);
    
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      metadata: {
        serviceId: serviceCall.serviceId,
        endpoint: serviceCall.endpoint,
        duration: Date.now() - startTime,
        attempts,
        circuitBreakerState: 'unknown'
      }
    };
  }

  /**
   * Execute the actual HTTP call
   */
  private async executeCall(serviceCall: ServiceCall, endpoint: ServiceEndpoint): Promise<any> {
    const url = `${endpoint.url}${serviceCall.endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), serviceCall.timeout);

    try {
      const response = await fetch(url, {
        method: serviceCall.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Mesh': 'true',
          'X-Request-ID': serviceCall.id,
          ...serviceCall.headers
        },
        body: serviceCall.method !== 'GET' ? JSON.stringify(serviceCall.payload) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Select the best endpoint using load balancing strategy
   */
  private async selectEndpoint(
    serviceName: string,
    endpoints: ServiceEndpoint[]
  ): Promise<ServiceEndpoint | null> {
    const loadBalancer = this.loadBalancers.get(serviceName);
    if (!loadBalancer) {
      // Fallback to simple round-robin
      const healthyEndpoints = endpoints.filter(e => e.health === 'healthy');
      return healthyEndpoints.length > 0 ? healthyEndpoints[0] : null;
    }

    return loadBalancer.selectEndpoint(endpoints);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error, retryPolicy: RetryPolicy): boolean {
    if (retryPolicy.retryableErrors.length === 0) {
      // Default retryable errors
      return error.message.includes('timeout') ||
             error.message.includes('connection') ||
             error.message.includes('network') ||
             error.message.includes('500') ||
             error.message.includes('502') ||
             error.message.includes('503') ||
             error.message.includes('504');
    }

    return retryPolicy.retryableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attempt: number, retryPolicy: RetryPolicy): number {
    let delay: number;

    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        delay = retryPolicy.baseDelay * attempt;
        break;
      
      case 'exponential':
        delay = retryPolicy.baseDelay * Math.pow(2, attempt - 1);
        break;
      
      case 'fixed':
      default:
        delay = retryPolicy.baseDelay;
        break;
    }

    return Math.min(delay, retryPolicy.maxDelay);
  }

  /**
   * Record call metrics for monitoring
   */
  private recordCallMetrics(
    serviceCall: ServiceCall,
    endpoint: ServiceEndpoint | null,
    success: boolean,
    duration: number,
    attempts: number
  ): void {
    const serviceId = endpoint?.id || serviceCall.serviceId;
    
    if (!this.callHistory.has(serviceId)) {
      this.callHistory.set(serviceId, new ServiceCallHistory());
    }

    const history = this.callHistory.get(serviceId)!;
    history.recordCall({
      timestamp: new Date(),
      success,
      duration,
      attempts,
      endpoint: serviceCall.endpoint,
      method: serviceCall.method
    });

    this.emit('call:completed', {
      serviceId,
      success,
      duration,
      attempts,
      endpoint: serviceCall.endpoint
    });
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceName: string): any {
    const endpoints = this.services.get(serviceName) || [];
    const metrics = {
      totalEndpoints: endpoints.length,
      healthyEndpoints: endpoints.filter(e => e.health === 'healthy').length,
      degradedEndpoints: endpoints.filter(e => e.health === 'degraded').length,
      unhealthyEndpoints: endpoints.filter(e => e.health === 'unhealthy').length,
      callMetrics: {} as Record<string, any>
    };

    // Aggregate call metrics for all endpoints
    endpoints.forEach(endpoint => {
      const history = this.callHistory.get(endpoint.id);
      if (history) {
        metrics.callMetrics[endpoint.id] = history.getMetrics();
      }
    });

    return metrics;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(serviceId: string): any {
    const circuitBreaker = this.circuitBreakers.get(serviceId);
    return circuitBreaker ? circuitBreaker.getStatus() : null;
  }

  /**
   * Health check all registered services
   */
  private startHealthChecking(): void {
    setInterval(async () => {
      for (const [serviceName, endpoints] of this.services.entries()) {
        for (const endpoint of endpoints) {
          try {
            const health = await this.checkEndpointHealth(endpoint);
            endpoint.health = health;
            endpoint.lastHealthCheck = new Date();
            
            this.emit('health:checked', { serviceName, endpoint, health });
          } catch (error) {
            endpoint.health = 'unhealthy';
            endpoint.lastHealthCheck = new Date();
            
            this.emit('health:check_failed', { serviceName, endpoint, error });
          }
        }
      }
    }, this.healthCheckInterval);
  }

  /**
   * Check individual endpoint health
   */
  private async checkEndpointHealth(endpoint: ServiceEndpoint): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${endpoint.url}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const healthData = await response.json();
        return healthData.status || 'healthy';
      } else {
        return 'degraded';
      }
    } catch (error) {
      return 'unhealthy';
    }
  }

  /**
   * Clean up old metrics
   */
  private startMetricsCleanup(): void {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - this.metricsRetentionPeriod);
      
      for (const history of this.callHistory.values()) {
        history.cleanup(cutoffTime);
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private halfOpenCallCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  canExecute(): boolean {
    if (!this.config.enabled) return true;

    switch (this.state) {
      case 'closed':
        return true;
      
      case 'open':
        if (this.shouldAttemptReset()) {
          this.state = 'half-open';
          this.halfOpenCallCount = 0;
          return true;
        }
        return false;
      
      case 'half-open':
        return this.halfOpenCallCount < this.config.halfOpenMaxCalls;
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getStatus(): any {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      config: this.config
    };
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }
}

/**
 * Load Balancer Implementation
 */
class LoadBalancer {
  private roundRobinIndex = 0;

  constructor(private strategy: LoadBalancingStrategy) {}

  selectEndpoint(endpoints: ServiceEndpoint[]): ServiceEndpoint | null {
    const healthyEndpoints = endpoints.filter(e => e.health === 'healthy');
    if (healthyEndpoints.length === 0) {
      // Fallback to degraded endpoints if no healthy ones
      const degradedEndpoints = endpoints.filter(e => e.health === 'degraded');
      if (degradedEndpoints.length === 0) return null;
      return this.applyStrategy(degradedEndpoints);
    }

    return this.applyStrategy(healthyEndpoints);
  }

  private applyStrategy(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    switch (this.strategy.type) {
      case 'round-robin':
        const endpoint = endpoints[this.roundRobinIndex % endpoints.length];
        this.roundRobinIndex++;
        return endpoint;
      
      case 'weighted':
        return this.selectWeightedEndpoint(endpoints);
      
      case 'least-connections':
        return this.selectLeastConnectionsEndpoint(endpoints);
      
      case 'random':
        return endpoints[Math.floor(Math.random() * endpoints.length)];
      
      case 'geographic':
        return this.selectGeographicEndpoint(endpoints);
      
      default:
        return endpoints[0];
    }
  }

  private selectWeightedEndpoint(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Simple weighted selection based on inverse load factor
    const weights = endpoints.map(e => 1 / (e.metadata.loadFactor || 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < endpoints.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return endpoints[i];
      }
    }
    
    return endpoints[0];
  }

  private selectLeastConnectionsEndpoint(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Select endpoint with lowest load factor
    return endpoints.reduce((min, current) => 
      current.metadata.loadFactor < min.metadata.loadFactor ? current : min
    );
  }

  private selectGeographicEndpoint(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Prefer endpoints in the same region/zone
    const preferredRegion = this.strategy.config.preferredRegion;
    const preferredZone = this.strategy.config.preferredZone;

    if (preferredRegion) {
      const regionalEndpoints = endpoints.filter(e => e.metadata.region === preferredRegion);
      if (regionalEndpoints.length > 0) {
        if (preferredZone) {
          const zonalEndpoints = regionalEndpoints.filter(e => e.metadata.zone === preferredZone);
          if (zonalEndpoints.length > 0) {
            return zonalEndpoints[0];
          }
        }
        return regionalEndpoints[0];
      }
    }

    return endpoints[0];
  }
}

/**
 * Service Call History for Metrics
 */
class ServiceCallHistory {
  private calls: Array<{
    timestamp: Date;
    success: boolean;
    duration: number;
    attempts: number;
    endpoint: string;
    method: string;
  }> = [];

  recordCall(call: {
    timestamp: Date;
    success: boolean;
    duration: number;
    attempts: number;
    endpoint: string;
    method: string;
  }): void {
    this.calls.push(call);
  }

  getMetrics(): any {
    if (this.calls.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageDuration: 0,
        averageAttempts: 0
      };
    }

    const successfulCalls = this.calls.filter(c => c.success);
    const totalDuration = this.calls.reduce((sum, c) => sum + c.duration, 0);
    const totalAttempts = this.calls.reduce((sum, c) => sum + c.attempts, 0);

    return {
      totalCalls: this.calls.length,
      successfulCalls: successfulCalls.length,
      failedCalls: this.calls.length - successfulCalls.length,
      successRate: (successfulCalls.length / this.calls.length) * 100,
      averageDuration: totalDuration / this.calls.length,
      averageAttempts: totalAttempts / this.calls.length,
      recentCalls: this.calls.slice(-10) // Last 10 calls
    };
  }

  cleanup(cutoffTime: Date): void {
    this.calls = this.calls.filter(call => call.timestamp > cutoffTime);
  }
}

// Export singleton instance
export const serviceMesh = new ServiceMesh();