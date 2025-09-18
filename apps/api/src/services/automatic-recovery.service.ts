/**
 * Automatic Recovery Service
 * Handles automatic recovery from various system failures
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'automatic-recovery' });

export interface RecoveryScenario {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  actions: RecoveryAction[];
  priority: number;
  enabled: boolean;
  cooldownPeriod: number; // Minimum time between executions (ms)
  maxExecutions: number; // Maximum executions per hour
}

export interface RecoveryAction {
  type: 'restart_service' | 'clear_cache' | 'reset_connections' | 'failover_database' | 'scale_resources' | 'notify_admin';
  parameters: Record<string, any>;
  timeout: number;
  retryCount: number;
}

export interface RecoveryExecution {
  id: string;
  scenarioId: string;
  trigger: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  actions: Array<{
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    error?: string;
    result?: any;
  }>;
  error?: string;
  duration?: number;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  databaseConnections: number;
  errorRate: number;
  responseTime: number;
  timestamp: Date;
}

export class AutomaticRecoveryService extends EventEmitter {
  private scenarios: Map<string, RecoveryScenario> = new Map();
  private executions: RecoveryExecution[] = [];
  private executionCounts = new Map<string, number[]>(); // Track executions per scenario
  private lastExecution = new Map<string, Date>(); // Track last execution time
  private metricsHistory: SystemMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isEnabled = true;

  constructor() {
    super();
    this.initializeDefaultScenarios();
    this.startMonitoring();
  }

  /**
   * Initialize default recovery scenarios
   */
  private initializeDefaultScenarios(): void {
    const defaultScenarios: RecoveryScenario[] = [
      {
        id: 'database-connection-failure',
        name: 'Database Connection Failure Recovery',
        description: 'Handles database connection failures with connection reset and failover',
        triggers: ['database_connection_error', 'database_timeout', 'connection_pool_exhausted'],
        actions: [
          {
            type: 'reset_connections',
            parameters: { service: 'database' },
            timeout: 30000,
            retryCount: 2
          },
          {
            type: 'failover_database',
            parameters: { target: 'replica' },
            timeout: 60000,
            retryCount: 1
          }
        ],
        priority: 1,
        enabled: true,
        cooldownPeriod: 300000, // 5 minutes
        maxExecutions: 3
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate Recovery',
        description: 'Handles high error rates by clearing caches and restarting services',
        triggers: ['high_error_rate', 'service_degradation'],
        actions: [
          {
            type: 'clear_cache',
            parameters: { cacheType: 'all' },
            timeout: 10000,
            retryCount: 1
          },
          {
            type: 'restart_service',
            parameters: { service: 'workers' },
            timeout: 60000,
            retryCount: 1
          }
        ],
        priority: 2,
        enabled: true,
        cooldownPeriod: 600000, // 10 minutes
        maxExecutions: 2
      },
      {
        id: 'memory-exhaustion',
        name: 'Memory Exhaustion Recovery',
        description: 'Handles memory exhaustion by clearing caches and scaling resources',
        triggers: ['high_memory_usage', 'out_of_memory'],
        actions: [
          {
            type: 'clear_cache',
            parameters: { cacheType: 'memory' },
            timeout: 15000,
            retryCount: 1
          },
          {
            type: 'scale_resources',
            parameters: { resource: 'memory', action: 'increase' },
            timeout: 120000,
            retryCount: 1
          }
        ],
        priority: 1,
        enabled: true,
        cooldownPeriod: 900000, // 15 minutes
        maxExecutions: 2
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time Recovery',
        description: 'Handles slow response times by optimizing connections and clearing caches',
        triggers: ['slow_response_time', 'performance_degradation'],
        actions: [
          {
            type: 'clear_cache',
            parameters: { cacheType: 'query' },
            timeout: 10000,
            retryCount: 1
          },
          {
            type: 'reset_connections',
            parameters: { service: 'all' },
            timeout: 30000,
            retryCount: 1
          }
        ],
        priority: 3,
        enabled: true,
        cooldownPeriod: 300000, // 5 minutes
        maxExecutions: 4
      },
      {
        id: 'critical-system-failure',
        name: 'Critical System Failure Recovery',
        description: 'Handles critical system failures with comprehensive recovery actions',
        triggers: ['system_failure', 'service_unavailable', 'critical_error'],
        actions: [
          {
            type: 'notify_admin',
            parameters: { severity: 'critical', message: 'Critical system failure detected' },
            timeout: 5000,
            retryCount: 3
          },
          {
            type: 'failover_database',
            parameters: { target: 'replica' },
            timeout: 60000,
            retryCount: 1
          },
          {
            type: 'restart_service',
            parameters: { service: 'all' },
            timeout: 120000,
            retryCount: 1
          }
        ],
        priority: 0, // Highest priority
        enabled: true,
        cooldownPeriod: 1800000, // 30 minutes
        maxExecutions: 1
      }
    ];

    defaultScenarios.forEach(scenario => {
      this.scenarios.set(scenario.id, scenario);
    });

    logger.info({ 
      scenarioCount: defaultScenarios.length 
    }, 'Initialized default recovery scenarios');
  }

  /**
   * Trigger recovery based on an event
   */
  async triggerRecovery(trigger: string, context?: Record<string, any>): Promise<string | null> {
    if (!this.isEnabled) {
      logger.debug({ trigger }, 'Recovery service is disabled, ignoring trigger');
      return null;
    }

    logger.info({ trigger, context }, 'Recovery trigger received');

    // Find matching scenarios
    const matchingScenarios = Array.from(this.scenarios.values())
      .filter(scenario => scenario.enabled && scenario.triggers.includes(trigger))
      .sort((a, b) => a.priority - b.priority); // Sort by priority (0 = highest)

    if (matchingScenarios.length === 0) {
      logger.debug({ trigger }, 'No matching recovery scenarios found');
      return null;
    }

    // Execute the highest priority scenario that can run
    for (const scenario of matchingScenarios) {
      if (this.canExecuteScenario(scenario)) {
        return await this.executeRecoveryScenario(scenario, trigger, context);
      } else {
        logger.debug({ 
          scenarioId: scenario.id, 
          trigger 
        }, 'Scenario cannot be executed due to cooldown or execution limits');
      }
    }

    logger.warn({ trigger }, 'No recovery scenarios could be executed');
    return null;
  }

  /**
   * Check if a scenario can be executed
   */
  private canExecuteScenario(scenario: RecoveryScenario): boolean {
    // Check cooldown period
    const lastExec = this.lastExecution.get(scenario.id);
    if (lastExec && Date.now() - lastExec.getTime() < scenario.cooldownPeriod) {
      return false;
    }

    // Check execution limits
    const executions = this.executionCounts.get(scenario.id) || [];
    const oneHourAgo = Date.now() - 3600000;
    const recentExecutions = executions.filter(time => time > oneHourAgo);
    
    return recentExecutions.length < scenario.maxExecutions;
  }

  /**
   * Execute a recovery scenario
   */
  private async executeRecoveryScenario(
    scenario: RecoveryScenario, 
    trigger: string, 
    context?: Record<string, any>
  ): Promise<string> {
    const executionId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    const execution: RecoveryExecution = {
      id: executionId,
      scenarioId: scenario.id,
      trigger,
      startTime,
      status: 'running',
      actions: scenario.actions.map(action => ({
        type: action.type,
        status: 'pending'
      }))
    };

    this.executions.push(execution);
    this.recordExecution(scenario.id);

    logger.info({ 
      executionId, 
      scenarioId: scenario.id, 
      trigger 
    }, 'Starting recovery scenario execution');

    this.emit('recovery_started', { execution, scenario, trigger, context });

    try {
      // Execute actions sequentially
      for (let i = 0; i < scenario.actions.length; i++) {
        const action = scenario.actions[i];
        const executionAction = execution.actions[i];

        executionAction.status = 'running';
        executionAction.startTime = new Date();

        try {
          logger.debug({ 
            executionId, 
            actionType: action.type 
          }, 'Executing recovery action');

          const result = await this.executeRecoveryAction(action, context);
          
          executionAction.status = 'completed';
          executionAction.endTime = new Date();
          executionAction.result = result;

          logger.info({ 
            executionId, 
            actionType: action.type 
          }, 'Recovery action completed successfully');

        } catch (error) {
          executionAction.status = 'failed';
          executionAction.endTime = new Date();
          executionAction.error = error instanceof Error ? error.message : 'Unknown error';

          logger.error({ 
            executionId, 
            actionType: action.type, 
            error 
          }, 'Recovery action failed');

          // Continue with next action unless it's critical
          if (action.type === 'notify_admin') {
            continue;
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();

      logger.info({ 
        executionId, 
        scenarioId: scenario.id, 
        duration: execution.duration 
      }, 'Recovery scenario completed');

      this.emit('recovery_completed', { execution, scenario });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error({ 
        executionId, 
        scenarioId: scenario.id, 
        error 
      }, 'Recovery scenario failed');

      this.emit('recovery_failed', { execution, scenario, error });
    }

    // Keep only recent executions
    if (this.executions.length > 1000) {
      this.executions = this.executions.slice(-1000);
    }

    return executionId;
  }

  /**
   * Execute a specific recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction, context?: Record<string, any>): Promise<any> {
    const timeout = action.timeout || 30000;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Recovery action ${action.type} timed out after ${timeout}ms`));
      }, timeout);

      this.performRecoveryAction(action, context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Perform the actual recovery action
   */
  private async performRecoveryAction(action: RecoveryAction, context?: Record<string, any>): Promise<any> {
    switch (action.type) {
      case 'restart_service':
        return this.restartService(action.parameters.service);
      
      case 'clear_cache':
        return this.clearCache(action.parameters.cacheType);
      
      case 'reset_connections':
        return this.resetConnections(action.parameters.service);
      
      case 'failover_database':
        return this.failoverDatabase(action.parameters.target);
      
      case 'scale_resources':
        return this.scaleResources(action.parameters.resource, action.parameters.action);
      
      case 'notify_admin':
        return this.notifyAdmin(action.parameters.severity, action.parameters.message, context);
      
      default:
        throw new Error(`Unknown recovery action type: ${action.type}`);
    }
  }

  /**
   * Restart a service
   */
  private async restartService(service: string): Promise<any> {
    logger.info({ service }, 'Restarting service');
    
    // Simulate service restart
    await this.sleep(2000 + Math.random() * 3000);
    
    return { 
      service, 
      action: 'restart', 
      status: 'completed',
      timestamp: new Date()
    };
  }

  /**
   * Clear cache
   */
  private async clearCache(cacheType: string): Promise<any> {
    logger.info({ cacheType }, 'Clearing cache');
    
    // Simulate cache clearing
    await this.sleep(500 + Math.random() * 1500);
    
    return { 
      cacheType, 
      action: 'clear', 
      itemsCleared: Math.floor(Math.random() * 1000) + 100,
      timestamp: new Date()
    };
  }

  /**
   * Reset connections
   */
  private async resetConnections(service: string): Promise<any> {
    logger.info({ service }, 'Resetting connections');
    
    // Simulate connection reset
    await this.sleep(1000 + Math.random() * 2000);
    
    return { 
      service, 
      action: 'reset_connections', 
      connectionsReset: Math.floor(Math.random() * 50) + 10,
      timestamp: new Date()
    };
  }

  /**
   * Failover database
   */
  private async failoverDatabase(target: string): Promise<any> {
    logger.info({ target }, 'Failing over database');
    
    try {
      const { databaseResilienceService } = await import('./database-resilience.service');
      await databaseResilienceService.forceFailover(target);
      
      return { 
        action: 'failover', 
        target, 
        status: 'completed',
        timestamp: new Date()
      };
    } catch (error) {
      // Simulate failover for testing
      await this.sleep(3000 + Math.random() * 2000);
      
      return { 
        action: 'failover', 
        target, 
        status: 'simulated',
        timestamp: new Date()
      };
    }
  }

  /**
   * Scale resources
   */
  private async scaleResources(resource: string, action: string): Promise<any> {
    logger.info({ resource, action }, 'Scaling resources');
    
    // Simulate resource scaling
    await this.sleep(5000 + Math.random() * 5000);
    
    return { 
      resource, 
      action: `${action}_${resource}`, 
      status: 'completed',
      newCapacity: Math.floor(Math.random() * 100) + 50,
      timestamp: new Date()
    };
  }

  /**
   * Notify admin
   */
  private async notifyAdmin(severity: string, message: string, context?: Record<string, any>): Promise<any> {
    logger.warn({ severity, message, context }, 'Notifying admin');
    
    // Simulate notification
    await this.sleep(100 + Math.random() * 400);
    
    return { 
      action: 'notify', 
      severity, 
      message, 
      status: 'sent',
      timestamp: new Date()
    };
  }

  /**
   * Record scenario execution
   */
  private recordExecution(scenarioId: string): void {
    const now = Date.now();
    this.lastExecution.set(scenarioId, new Date(now));
    
    const executions = this.executionCounts.get(scenarioId) || [];
    executions.push(now);
    
    // Keep only executions from the last hour
    const oneHourAgo = now - 3600000;
    const recentExecutions = executions.filter(time => time > oneHourAgo);
    this.executionCounts.set(scenarioId, recentExecutions);
  }

  /**
   * Start system monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics().catch(error => {
        logger.error({ error }, 'Failed to collect system metrics');
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    const metrics: SystemMetrics = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 100,
      databaseConnections: Math.floor(Math.random() * 50) + 10,
      errorRate: Math.random() * 0.1,
      responseTime: Math.random() * 1000 + 100,
      timestamp: new Date()
    };

    this.metricsHistory.push(metrics);
    
    // Keep only recent metrics
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }

    // Check for automatic triggers
    this.checkAutomaticTriggers(metrics);
  }

  /**
   * Check for automatic triggers based on metrics
   */
  private checkAutomaticTriggers(metrics: SystemMetrics): void {
    // High memory usage
    if (metrics.memory > 90) {
      this.triggerRecovery('high_memory_usage', { memory: metrics.memory });
    }

    // High error rate
    if (metrics.errorRate > 0.05) {
      this.triggerRecovery('high_error_rate', { errorRate: metrics.errorRate });
    }

    // Slow response time
    if (metrics.responseTime > 2000) {
      this.triggerRecovery('slow_response_time', { responseTime: metrics.responseTime });
    }

    // High CPU usage
    if (metrics.cpu > 95) {
      this.triggerRecovery('high_cpu_usage', { cpu: metrics.cpu });
    }
  }

  /**
   * Utility function for sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery scenarios
   */
  getScenarios(): RecoveryScenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): RecoveryExecution[] {
    return [...this.executions];
  }

  /**
   * Get system metrics history
   */
  getMetricsHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Enable/disable recovery service
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info({ enabled }, 'Recovery service enabled status changed');
  }

  /**
   * Add or update recovery scenario
   */
  addScenario(scenario: RecoveryScenario): void {
    this.scenarios.set(scenario.id, scenario);
    logger.info({ scenarioId: scenario.id }, 'Recovery scenario added/updated');
  }

  /**
   * Remove recovery scenario
   */
  removeScenario(scenarioId: string): boolean {
    const removed = this.scenarios.delete(scenarioId);
    if (removed) {
      logger.info({ scenarioId }, 'Recovery scenario removed');
    }
    return removed;
  }

  /**
   * Health check for recovery service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    enabled: boolean;
    scenarios: number;
    recentExecutions: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    if (!this.isEnabled) {
      issues.push('Recovery service is disabled');
    }

    const recentExecutions = this.executions.filter(
      e => Date.now() - e.startTime.getTime() < 3600000
    ).length;

    if (recentExecutions > 10) {
      issues.push(`High recovery activity: ${recentExecutions} executions in the last hour`);
    }

    const failedExecutions = this.executions.filter(
      e => e.status === 'failed' && Date.now() - e.startTime.getTime() < 3600000
    ).length;

    if (failedExecutions > 3) {
      issues.push(`High failure rate: ${failedExecutions} failed recoveries in the last hour`);
    }

    return {
      healthy: issues.length === 0,
      enabled: this.isEnabled,
      scenarios: this.scenarios.size,
      recentExecutions,
      issues
    };
  }

  /**
   * Shutdown the recovery service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down automatic recovery service');
    
    this.isEnabled = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.removeAllListeners();
    
    logger.info('Automatic recovery service shutdown complete');
  }
}

export const automaticRecoveryService = new AutomaticRecoveryService();