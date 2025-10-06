/**
 * Integration Layer - Main Export
 * Provides unified access to all integration components
 */

// Core integration components
export { SystemOrchestrator, systemOrchestrator } from './system-orchestrator';
export { ServiceMesh, serviceMesh } from './service-mesh';
export { EventBus, eventBus, eventStore } from './event-bus';
export { IntegrationManager, createIntegrationManager } from './integration-manager';

// Types and interfaces
export type {
  SystemContext,
  OrchestrationConfig,
  OrchestrationResult,
  ProcessingPipeline,
  PipelineStage
} from './system-orchestrator';

export type {
  ServiceEndpoint,
  ServiceCall,
  ServiceCallResult,
  LoadBalancingStrategy,
  RetryPolicy,
  CircuitBreakerConfig
} from './service-mesh';

export type {
  DomainEvent,
  EventHandler,
  EventProjection,
  EventStore,
  EventSubscription
} from './event-bus';

export type {
  IntegrationConfig,
  IntegrationMetrics,
  IntegrationHealth,
  ComponentHealth,
  HealthIssue
} from './integration-manager';

// Pre-configured integration instance
import { systemOrchestrator } from './system-orchestrator';
import { serviceMesh } from './service-mesh';
import { eventBus } from './event-bus';
import { createIntegrationManager } from './integration-manager';

// Create and export the main integration manager instance
export const integrationManager = createIntegrationManager(
  systemOrchestrator,
  serviceMesh,
  eventBus,
  {
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
      metricsRetention: 24 * 60 * 60 * 1000,
      alertThresholds: {
        errorRate: 0.05,
        latency: 5000,
        throughput: 100
      }
    }
  }
);

// Initialize the integration layer
export async function initializeIntegration(): Promise<void> {
  try {
    await integrationManager.initialize();
    console.log('Integration layer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize integration layer:', error);
    throw error;
  }
}

// Utility functions for common integration patterns
export const IntegrationUtils = {
  /**
   * Create a system context for operations
   */
  createSystemContext(
    tenantId: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): SystemContext {
    return {
      tenantId,
      userId,
      sessionId: sessionId || `session_${Date.now()}`,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: metadata || {}
    };
  },

  /**
   * Create a correlation ID for tracking operations
   */
  createCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Create a domain event
   */
  createDomainEvent(
    type: string,
    aggregateId: string,
    aggregateType: string,
    payload: any,
    context: SystemContext,
    version = 1
  ): Omit<DomainEvent, 'id' | 'timestamp'> {
    return {
      type,
      aggregateId,
      aggregateType,
      version,
      payload,
      metadata: {
        tenantId: context.tenantId,
        userId: context.userId,
        sessionId: context.sessionId,
        correlationId: context.requestId,
        source: 'integration-utils'
      }
    };
  },

  /**
   * Create a service call configuration
   */
  createServiceCall(
    serviceId: string,
    method: string,
    endpoint: string,
    payload: any,
    context: SystemContext,
    options?: {
      timeout?: number;
      retries?: number;
    }
  ): ServiceCall {
    return {
      id: this.createCorrelationId(),
      serviceId,
      method,
      endpoint,
      payload,
      headers: {
        'X-Tenant-ID': context.tenantId,
        'X-User-ID': context.userId || '',
        'X-Session-ID': context.sessionId,
        'X-Request-ID': context.requestId
      },
      timeout: options?.timeout || 30000,
      retryPolicy: {
        maxAttempts: options?.retries || 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['timeout', 'connection', 'network', '5xx']
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3
      }
    };
  }
};

// Export commonly used patterns
export const IntegrationPatterns = {
  /**
   * Saga pattern for distributed transactions
   */
  async executeSaga(
    sagaId: string,
    steps: Array<{
      service: string;
      operation: string;
      payload: any;
      compensate?: {
        service: string;
        operation: string;
        payload: any;
      };
    }>,
    context: SystemContext
  ): Promise<any> {
    const results: any[] = [];
    const compensations: any[] = [];

    try {
      for (const step of steps) {
        const result = await integrationManager.callService(
          step.service,
          'POST',
          step.operation,
          step.payload,
          context
        );
        
        results.push(result);
        
        if (step.compensate) {
          compensations.unshift(step.compensate);
        }
      }

      return results;

    } catch (error) {
      // Execute compensations in reverse order
      for (const compensation of compensations) {
        try {
          await integrationManager.callService(
            compensation.service,
            'POST',
            compensation.operation,
            compensation.payload,
            context
          );
        } catch (compensationError) {
          console.error('Compensation failed:', compensationError);
        }
      }

      throw error;
    }
  },

  /**
   * Event sourcing pattern
   */
  async replayEvents(
    aggregateId: string,
    fromVersion = 0
  ): Promise<DomainEvent[]> {
    return await eventBus.replayEvents(aggregateId, fromVersion);
  },

  /**
   * CQRS pattern - Command handling
   */
  async executeCommand(
    command: {
      type: string;
      aggregateId: string;
      payload: any;
    },
    context: SystemContext
  ): Promise<any> {
    // Publish command event
    await eventBus.publish(
      IntegrationUtils.createDomainEvent(
        `command.${command.type}`,
        command.aggregateId,
        'Command',
        command.payload,
        context
      )
    );

    // Execute through orchestrator
    return await integrationManager.orchestrator.orchestrate(
      'execute-command',
      command,
      context
    );
  },

  /**
   * CQRS pattern - Query handling
   */
  async executeQuery(
    query: {
      type: string;
      parameters: any;
    },
    context: SystemContext
  ): Promise<any> {
    return await integrationManager.executeQuery(query, context);
  }
};

// Health check endpoint
export async function healthCheck(): Promise<IntegrationHealth> {
  return await integrationManager.getHealth();
}

// Metrics endpoint
export async function getMetrics(): Promise<IntegrationMetrics> {
  return await integrationManager.getMetrics();
}

// Status endpoint
export async function getStatus(): Promise<any> {
  return await integrationManager.getStatus();
}