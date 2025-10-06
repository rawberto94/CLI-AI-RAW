/**
 * Integration Manager
 * Coordinates all integration layers and provides unified API
 */

import { EventEmitter } from 'events';
import { SystemOrchestrator, SystemContext, OrchestrationResult } from './system-orchestrator';
import { ServiceMesh, ServiceEndpoint, ServiceCall } from './service-mesh';
import { EventBus, DomainEvent, EventHandler, EventProjection } from './event-bus';

export interface IntegrationConfig {
  orchestrator: {
    enabled: boolean;
    maxConcurrentJobs: number;
    defaultTimeout: number;
  };
  serviceMesh: {
    enabled: boolean;
    healthCheckInterval: number;
    circuitBreakerEnabled: boolean;
  };
  eventBus: {
    enabled: boolean;
    batchSize: number;
    processingTimeout: number;
  };
  monitoring: {
    enabled: boolean;
    metricsRetention: number;
    alertThresholds: {
      errorRate: number;
      latency: number;
      throughput: number;
    };
  };
}

export interface IntegrationMetrics {
  orchestrator: {
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
  };
  serviceMesh: {
    totalServices: number;
    healthyServices: number;
    totalCalls: number;
    successRate: number;
    averageLatency: number;
  };
  eventBus: {
    totalEvents: number;
    processedEvents: number;
    failedEvents: number;
    activeHandlers: number;
    activeProjections: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  };
}

export interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    orchestrator: ComponentHealth;
    serviceMesh: ComponentHealth;
    eventBus: ComponentHealth;
  };
  issues: HealthIssue[];
  recommendations: string[];
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: Record<string, any>;
  errors: string[];
}

export interface HealthIssue {
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendation: string;
}

export class IntegrationManager extends EventEmitter {
  private orchestrator: SystemOrchestrator;
  private serviceMesh: ServiceMesh;
  private eventBus: EventBus;
  private config: IntegrationConfig;
  
  private metrics: IntegrationMetrics;
  private startTime: Date;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    orchestrator: SystemOrchestrator,
    serviceMesh: ServiceMesh,
    eventBus: EventBus,
    config: IntegrationConfig
  ) {
    super();
    
    this.orchestrator = orchestrator;
    this.serviceMesh = serviceMesh;
    this.eventBus = eventBus;
    this.config = config;
    this.startTime = new Date();
    
    this.initializeMetrics();
    this.setupEventHandlers();
    this.startHealthMonitoring();
  }

  /**
   * Initialize the integration layer
   */
  async initialize(): Promise<void> {
    try {
      // Register core event handlers
      await this.registerCoreEventHandlers();
      
      // Register core services
      await this.registerCoreServices();
      
      // Setup cross-system communication
      await this.setupCrossSystemCommunication();
      
      this.emit('integration:initialized');
    } catch (error) {
      this.emit('integration:initialization_failed', error);
      throw error;
    }
  }

  /**
   * Process contract through integrated system
   */
  async processContract(
    contractData: any,
    context: SystemContext,
    options?: {
      pipeline?: string;
      enableRealTimeUpdates?: boolean;
      priority?: number;
    }
  ): Promise<OrchestrationResult> {
    const correlationId = this.generateCorrelationId();
    
    try {
      // Publish contract processing started event
      await this.eventBus.publish({
        type: 'contract.processing.started',
        aggregateId: contractData.id,
        aggregateType: 'Contract',
        version: 1,
        payload: { contractId: contractData.id, pipeline: options?.pipeline },
        metadata: {
          ...context,
          correlationId,
          source: 'integration-manager'
        }
      });

      // Execute orchestrated processing
      const result = await this.orchestrator.processContract(contractData, context, options);

      // Publish completion event
      await this.eventBus.publish({
        type: result.success ? 'contract.processing.completed' : 'contract.processing.failed',
        aggregateId: contractData.id,
        aggregateType: 'Contract',
        version: 2,
        payload: { 
          contractId: contractData.id, 
          result: result.success,
          metrics: result.metrics,
          errors: result.errors
        },
        metadata: {
          ...context,
          correlationId,
          source: 'integration-manager'
        }
      });

      return result;

    } catch (error) {
      // Publish error event
      await this.eventBus.publish({
        type: 'contract.processing.error',
        aggregateId: contractData.id,
        aggregateType: 'Contract',
        version: 1,
        payload: { 
          contractId: contractData.id, 
          error: error.message 
        },
        metadata: {
          ...context,
          correlationId,
          source: 'integration-manager'
        }
      });

      throw error;
    }
  }

  /**
   * Execute cross-system query
   */
  async executeQuery(
    query: any,
    context: SystemContext,
    options?: {
      timeout?: number;
      enableCaching?: boolean;
      priority?: number;
    }
  ): Promise<OrchestrationResult> {
    const correlationId = this.generateCorrelationId();

    try {
      // Publish query started event
      await this.eventBus.publish({
        type: 'query.execution.started',
        aggregateId: query.id || correlationId,
        aggregateType: 'Query',
        version: 1,
        payload: { query, options },
        metadata: {
          ...context,
          correlationId,
          source: 'integration-manager'
        }
      });

      // Execute query through orchestrator
      const result = await this.orchestrator.executeQuery(query, context, options);

      // Publish completion event
      await this.eventBus.publish({
        type: 'query.execution.completed',
        aggregateId: query.id || correlationId,
        aggregateType: 'Query',
        version: 2,
        payload: { 
          query, 
          result: result.success,
          data: result.results
        },
        metadata: {
          ...context,
          correlationId,
          source: 'integration-manager'
        }
      });

      return result;

    } catch (error) {
      await this.eventBus.publish({
        type: 'query.execution.error',
        aggregateId: query.id || correlationId,
        aggregateType: 'Query',
        version: 1,
        payload: { query, error: error.message },
        metadata: {
          ...context,
          correlationId,
          source: 'integration-manager'
        }
      });

      throw error;
    }
  }

  /**
   * Make service call through service mesh
   */
  async callService(
    serviceName: string,
    method: string,
    endpoint: string,
    payload: any,
    context: SystemContext,
    options?: {
      timeout?: number;
      retries?: number;
      priority?: number;
    }
  ): Promise<any> {
    const serviceCall: ServiceCall = {
      id: this.generateCorrelationId(),
      serviceId: serviceName,
      method,
      endpoint,
      payload,
      headers: {
        'X-Tenant-ID': context.tenantId,
        'X-User-ID': context.userId || '',
        'X-Session-ID': context.sessionId,
        'X-Request-ID': context.requestId
      },
      timeout: options?.timeout || this.config.orchestrator.defaultTimeout,
      retryPolicy: {
        maxAttempts: options?.retries || 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['timeout', 'connection', 'network', '5xx']
      },
      circuitBreaker: {
        enabled: this.config.serviceMesh.circuitBreakerEnabled,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3
      }
    };

    const result = await this.serviceMesh.call(serviceCall);
    
    if (!result.success) {
      throw new Error(`Service call failed: ${result.error}`);
    }

    return result.data;
  }

  /**
   * Register service endpoint
   */
  registerService(service: ServiceEndpoint): void {
    this.serviceMesh.registerService(service);
    
    // Publish service registration event
    this.eventBus.publish({
      type: 'service.registered',
      aggregateId: service.id,
      aggregateType: 'Service',
      version: 1,
      payload: { service },
      metadata: {
        tenantId: 'system',
        correlationId: this.generateCorrelationId(),
        source: 'integration-manager'
      }
    });
  }

  /**
   * Register event handler
   */
  registerEventHandler(handler: EventHandler): void {
    this.eventBus.registerHandler(handler);
    this.emit('handler:registered', handler);
  }

  /**
   * Register event projection
   */
  registerProjection(projection: EventProjection): void {
    this.eventBus.registerProjection(projection);
    this.emit('projection:registered', projection);
  }

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<IntegrationMetrics> {
    // Update metrics from subsystems
    await this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get system health
   */
  async getHealth(): Promise<IntegrationHealth> {
    const orchestratorHealth = await this.checkOrchestratorHealth();
    const serviceMeshHealth = await this.checkServiceMeshHealth();
    const eventBusHealth = await this.checkEventBusHealth();

    const components = {
      orchestrator: orchestratorHealth,
      serviceMesh: serviceMeshHealth,
      eventBus: eventBusHealth
    };

    const overallStatus = this.calculateOverallHealth(components);
    const issues = this.identifyHealthIssues(components);
    const recommendations = this.generateHealthRecommendations(issues);

    return {
      status: overallStatus,
      components,
      issues,
      recommendations
    };
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<any> {
    const [metrics, health] = await Promise.all([
      this.getMetrics(),
      this.getHealth()
    ]);

    return {
      status: health.status,
      uptime: Date.now() - this.startTime.getTime(),
      metrics,
      health,
      config: this.config,
      timestamp: new Date()
    };
  }

  /**
   * Shutdown integration manager
   */
  async shutdown(): Promise<void> {
    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Publish shutdown event
      await this.eventBus.publish({
        type: 'system.shutdown.started',
        aggregateId: 'system',
        aggregateType: 'System',
        version: 1,
        payload: { timestamp: new Date() },
        metadata: {
          tenantId: 'system',
          correlationId: this.generateCorrelationId(),
          source: 'integration-manager'
        }
      });

      this.emit('integration:shutdown');

    } catch (error) {
      this.emit('integration:shutdown_error', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private initializeMetrics(): void {
    this.metrics = {
      orchestrator: {
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0
      },
      serviceMesh: {
        totalServices: 0,
        healthyServices: 0,
        totalCalls: 0,
        successRate: 0,
        averageLatency: 0
      },
      eventBus: {
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
        activeHandlers: 0,
        activeProjections: 0
      },
      system: {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        errorRate: 0
      }
    };
  }

  private setupEventHandlers(): void {
    // Orchestrator events
    this.orchestrator.on('job:started', (job) => {
      this.metrics.orchestrator.activeJobs++;
      this.emit('job:started', job);
    });

    this.orchestrator.on('job:completed', (job, result) => {
      this.metrics.orchestrator.activeJobs--;
      this.metrics.orchestrator.completedJobs++;
      this.emit('job:completed', job, result);
    });

    this.orchestrator.on('job:failed', (jobId, error, result) => {
      this.metrics.orchestrator.activeJobs--;
      this.metrics.orchestrator.failedJobs++;
      this.emit('job:failed', jobId, error, result);
    });

    // Service mesh events
    this.serviceMesh.on('service:registered', (service) => {
      this.metrics.serviceMesh.totalServices++;
      this.emit('service:registered', service);
    });

    this.serviceMesh.on('call:completed', (callInfo) => {
      this.metrics.serviceMesh.totalCalls++;
      this.emit('call:completed', callInfo);
    });

    // Event bus events
    this.eventBus.on('event:published', (event) => {
      this.metrics.eventBus.totalEvents++;
      this.emit('event:published', event);
    });

    this.eventBus.on('event:processed', (eventInfo) => {
      this.metrics.eventBus.processedEvents++;
      this.emit('event:processed', eventInfo);
    });

    this.eventBus.on('event:processing_failed', (eventInfo) => {
      this.metrics.eventBus.failedEvents++;
      this.emit('event:processing_failed', eventInfo);
    });
  }

  private async registerCoreEventHandlers(): Promise<void> {
    // Contract processing events
    this.registerEventHandler({
      id: 'contract-processing-logger',
      eventTypes: ['contract.processing.*'],
      handler: async (event: DomainEvent) => {
        console.log(`Contract processing event: ${event.type}`, {
          contractId: event.payload.contractId,
          timestamp: event.timestamp
        });
      },
      options: {
        retry: false,
        maxRetries: 0,
        deadLetterQueue: false,
        timeout: 5000,
        priority: 1
      }
    });

    // System monitoring events
    this.registerEventHandler({
      id: 'system-monitor',
      eventTypes: ['system.*', 'service.*'],
      handler: async (event: DomainEvent) => {
        // Update system metrics based on events
        await this.updateMetricsFromEvent(event);
      },
      options: {
        retry: true,
        maxRetries: 3,
        deadLetterQueue: true,
        timeout: 10000,
        priority: 5
      }
    });
  }

  private async registerCoreServices(): Promise<void> {
    // Register orchestrator as a service
    this.registerService({
      id: 'orchestrator-service',
      name: 'orchestrator',
      url: 'http://localhost:3001',
      version: '1.0.0',
      health: 'healthy',
      lastHealthCheck: new Date(),
      metadata: {
        region: 'local',
        zone: 'default',
        capabilities: ['contract-processing', 'query-execution', 'analysis'],
        loadFactor: 0.5
      }
    });

    // Register event bus as a service
    this.registerService({
      id: 'event-bus-service',
      name: 'event-bus',
      url: 'http://localhost:3002',
      version: '1.0.0',
      health: 'healthy',
      lastHealthCheck: new Date(),
      metadata: {
        region: 'local',
        zone: 'default',
        capabilities: ['event-publishing', 'event-handling', 'projections'],
        loadFactor: 0.3
      }
    });
  }

  private async setupCrossSystemCommunication(): Promise<void> {
    // Setup communication patterns between subsystems
    
    // Orchestrator -> Event Bus
    this.orchestrator.on('job:completed', async (job, result) => {
      await this.eventBus.publish({
        type: 'orchestration.job.completed',
        aggregateId: job.id,
        aggregateType: 'OrchestrationJob',
        version: 1,
        payload: { job, result },
        metadata: {
          tenantId: job.context.tenantId,
          correlationId: this.generateCorrelationId(),
          source: 'orchestrator'
        }
      });
    });

    // Service Mesh -> Event Bus
    this.serviceMesh.on('service:registered', async (service) => {
      await this.eventBus.publish({
        type: 'service.mesh.service.registered',
        aggregateId: service.id,
        aggregateType: 'Service',
        version: 1,
        payload: { service },
        metadata: {
          tenantId: 'system',
          correlationId: this.generateCorrelationId(),
          source: 'service-mesh'
        }
      });
    });
  }

  private startHealthMonitoring(): void {
    const interval = this.config.monitoring.enabled ? 30000 : 60000; // 30s or 1m
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();
        this.emit('health:checked', health);
        
        if (health.status !== 'healthy') {
          this.emit('health:degraded', health);
        }
      } catch (error) {
        this.emit('health:check_failed', error);
      }
    }, interval);
  }

  private async updateMetrics(): Promise<void> {
    // Update system metrics
    this.metrics.system.uptime = Date.now() - this.startTime.getTime();
    this.metrics.system.memoryUsage = process.memoryUsage().heapUsed;
    
    // Update orchestrator metrics
    const orchestratorStatus = await this.orchestrator.getSystemStatus();
    this.metrics.orchestrator.activeJobs = orchestratorStatus.activeJobs;

    // Update service mesh metrics
    // This would typically query the service mesh for current metrics
    
    // Update event bus metrics
    const eventBusStats = this.eventBus.getStatistics();
    this.metrics.eventBus.activeHandlers = eventBusStats.handlers.total;
    this.metrics.eventBus.activeProjections = eventBusStats.projections.total;
  }

  private async updateMetricsFromEvent(event: DomainEvent): Promise<void> {
    // Update metrics based on specific events
    switch (event.type) {
      case 'contract.processing.completed':
        this.metrics.orchestrator.completedJobs++;
        break;
      case 'contract.processing.failed':
        this.metrics.orchestrator.failedJobs++;
        break;
      case 'service.registered':
        this.metrics.serviceMesh.totalServices++;
        break;
    }
  }

  private async checkOrchestratorHealth(): Promise<ComponentHealth> {
    try {
      const status = await this.orchestrator.getSystemStatus();
      return {
        status: status.health.status === 'healthy' ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        metrics: {
          activeJobs: status.activeJobs,
          pipelines: status.pipelines.length
        },
        errors: []
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        metrics: {},
        errors: [error.message]
      };
    }
  }

  private async checkServiceMeshHealth(): Promise<ComponentHealth> {
    try {
      // This would check service mesh health
      return {
        status: 'healthy',
        lastCheck: new Date(),
        metrics: {
          totalServices: this.metrics.serviceMesh.totalServices,
          healthyServices: this.metrics.serviceMesh.healthyServices
        },
        errors: []
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        metrics: {},
        errors: [error.message]
      };
    }
  }

  private async checkEventBusHealth(): Promise<ComponentHealth> {
    try {
      const health = await this.eventBus.healthCheck();
      return {
        status: health.status === 'healthy' ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        metrics: {
          handlers: health.handlers,
          projections: health.projections,
          queueSize: health.queueSize
        },
        errors: []
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        metrics: {},
        errors: [error.message]
      };
    }
  }

  private calculateOverallHealth(components: Record<string, ComponentHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.every(s => s === 'healthy')) return 'healthy';
    if (statuses.some(s => s === 'unhealthy')) return 'unhealthy';
    return 'degraded';
  }

  private identifyHealthIssues(components: Record<string, ComponentHealth>): HealthIssue[] {
    const issues: HealthIssue[] = [];

    for (const [componentName, health] of Object.entries(components)) {
      if (health.status !== 'healthy') {
        health.errors.forEach(error => {
          issues.push({
            component: componentName,
            severity: health.status === 'unhealthy' ? 'critical' : 'medium',
            description: error,
            impact: `${componentName} functionality may be impaired`,
            recommendation: `Check ${componentName} logs and configuration`
          });
        });
      }
    }

    return issues;
  }

  private generateHealthRecommendations(issues: HealthIssue[]): string[] {
    const recommendations = new Set<string>();

    issues.forEach(issue => {
      recommendations.add(issue.recommendation);
      
      if (issue.severity === 'critical') {
        recommendations.add('Consider scaling up resources');
        recommendations.add('Enable circuit breakers for failing services');
      }
    });

    return Array.from(recommendations);
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function to create integration manager
export function createIntegrationManager(
  orchestrator: SystemOrchestrator,
  serviceMesh: ServiceMesh,
  eventBus: EventBus,
  config?: Partial<IntegrationConfig>
): IntegrationManager {
  const defaultConfig: IntegrationConfig = {
    orchestrator: {
      enabled: true,
      maxConcurrentJobs: 10,
      defaultTimeout: 30000
    },
    serviceMesh: {
      enabled: true,
      healthCheckInterval: 30000,
      circuitBreakerEnabled: true
    },
    eventBus: {
      enabled: true,
      batchSize: 100,
      processingTimeout: 10000
    },
    monitoring: {
      enabled: true,
      metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        errorRate: 0.05, // 5%
        latency: 5000, // 5 seconds
        throughput: 100 // requests per second
      }
    }
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new IntegrationManager(orchestrator, serviceMesh, eventBus, finalConfig);
}