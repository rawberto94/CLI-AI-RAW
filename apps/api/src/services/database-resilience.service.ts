/**
 * Database Resilience Service
 * Comprehensive database error handling, recovery, and failover mechanisms
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { circuitBreakerManager } from './circuit-breaker.service';

const logger = pino({ name: 'database-resilience' });

export interface DatabaseConfig {
  primary: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
  replicas?: Array<{
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    priority: number; // 1 = highest priority
  }>;
  resilience: {
    maxRetries: number;
    baseDelay: number; // Base delay for exponential backoff (ms)
    maxDelay: number; // Maximum delay between retries (ms)
    timeout: number; // Query timeout (ms)
    healthCheckInterval: number; // Health check frequency (ms)
    failoverThreshold: number; // Failures before failover
    recoveryThreshold: number; // Successes needed to recover
  };
}

export interface DatabaseOperation {
  id: string;
  query: string;
  params?: any[];
  type: 'read' | 'write';
  priority: 'high' | 'medium' | 'low';
  timeout?: number;
  retryable: boolean;
}

export interface DatabaseError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  category: 'connection' | 'timeout' | 'syntax' | 'constraint' | 'resource' | 'unknown';
  timestamp: Date;
  operation?: DatabaseOperation;
}

export interface FailoverEvent {
  type: 'failover_initiated' | 'failover_completed' | 'recovery_initiated' | 'recovery_completed';
  from?: string;
  to?: string;
  reason: string;
  timestamp: Date;
  duration?: number;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  responseTime: number;
  errorRate: number;
  connectionCount: number;
  lastCheck: Date;
  issues: string[];
}

export class DatabaseResilienceService extends EventEmitter {
  private config: DatabaseConfig;
  private currentDatabase: 'primary' | string = 'primary';
  private healthStatus = new Map<string, DatabaseHealth>();
  private errorHistory: DatabaseError[] = [];
  private failoverHistory: FailoverEvent[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isFailoverInProgress = false;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
    this.startHealthMonitoring();
  }

  /**
   * Execute database operation with full resilience
   */
  async executeWithResilience<T>(operation: DatabaseOperation): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    logger.debug({ 
      operationId: operation.id, 
      type: operation.type, 
      priority: operation.priority 
    }, 'Executing database operation with resilience');

    for (let attempt = 1; attempt <= this.config.resilience.maxRetries; attempt++) {
      try {
        // Check if we need to failover before attempting
        await this.checkAndHandleFailover();

        // Execute with circuit breaker protection
        const result = await this.executeWithCircuitBreaker(operation, attempt);
        
        // Record successful operation
        this.recordSuccess(operation, Date.now() - startTime);
        
        if (attempt > 1) {
          logger.info({ 
            operationId: operation.id, 
            attempt, 
            duration: Date.now() - startTime 
          }, 'Database operation succeeded after retry');
        }

        return result;

      } catch (error) {
        lastError = error as Error;
        const dbError = this.classifyError(error as Error, operation);
        this.recordError(dbError);

        logger.warn({ 
          operationId: operation.id, 
          attempt, 
          error: dbError.message, 
          retryable: dbError.retryable 
        }, 'Database operation failed');

        // Don't retry if error is not retryable or if it's the last attempt
        if (!dbError.retryable || attempt === this.config.resilience.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt);
        logger.debug({ 
          operationId: operation.id, 
          attempt, 
          delay 
        }, 'Waiting before retry');
        
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    const totalDuration = Date.now() - startTime;
    logger.error({ 
      operationId: operation.id, 
      attempts: this.config.resilience.maxRetries, 
      totalDuration,
      error: lastError?.message 
    }, 'Database operation failed after all retries');

    throw new Error(`Database operation failed after ${this.config.resilience.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(operation: DatabaseOperation, attempt: number): Promise<T> {
    const circuitBreakerName = `database-${this.currentDatabase}`;
    
    return circuitBreakerManager.execute(circuitBreakerName, async () => {
      return this.executeOperation<T>(operation, attempt);
    }, {
      failureThreshold: this.config.resilience.failoverThreshold,
      recoveryTimeout: this.config.resilience.baseDelay * 10,
      timeout: operation.timeout || this.config.resilience.timeout
    });
  }

  /**
   * Execute the actual database operation
   */
  private async executeOperation<T>(operation: DatabaseOperation, attempt: number): Promise<T> {
    // This would integrate with your actual database client
    // For now, we'll simulate database operations
    
    const isHealthy = this.isDatabaseHealthy(this.currentDatabase);
    if (!isHealthy) {
      throw new Error(`Database ${this.currentDatabase} is not healthy`);
    }

    // Simulate operation execution with realistic timing and occasional failures
    const executionTime = this.simulateOperationExecution(operation, attempt);
    await this.sleep(executionTime);

    // Simulate occasional failures for testing resilience
    if (Math.random() < 0.05) { // 5% failure rate for testing
      throw new Error('Simulated database connection error');
    }

    // Return mock result
    return this.generateMockResult<T>(operation);
  }

  /**
   * Simulate database operation execution
   */
  private simulateOperationExecution(operation: DatabaseOperation, attempt: number): number {
    const baseTime = operation.type === 'read' ? 50 : 100;
    const priorityMultiplier = operation.priority === 'high' ? 0.8 : operation.priority === 'low' ? 1.2 : 1.0;
    const attemptPenalty = attempt > 1 ? attempt * 20 : 0;
    
    return Math.floor((baseTime * priorityMultiplier + attemptPenalty) * (0.5 + Math.random()));
  }

  /**
   * Generate mock result for testing
   */
  private generateMockResult<T>(operation: DatabaseOperation): T {
    if (operation.type === 'read') {
      return {
        rows: Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
          id: `row-${i}`,
          data: `mock-data-${i}`
        })),
        rowCount: Math.floor(Math.random() * 10)
      } as T;
    } else {
      return {
        affectedRows: Math.floor(Math.random() * 5) + 1,
        insertId: `insert-${Date.now()}`
      } as T;
    }
  }

  /**
   * Check if failover is needed and handle it
   */
  private async checkAndHandleFailover(): Promise<void> {
    if (this.isFailoverInProgress) {
      return; // Failover already in progress
    }

    const currentHealth = this.healthStatus.get(this.currentDatabase);
    if (!currentHealth || currentHealth.status === 'offline' || currentHealth.status === 'unhealthy') {
      await this.initiateFailover();
    }
  }

  /**
   * Initiate database failover
   */
  private async initiateFailover(): Promise<void> {
    if (this.isFailoverInProgress) {
      return;
    }

    this.isFailoverInProgress = true;
    const startTime = Date.now();
    const originalDatabase = this.currentDatabase;

    logger.warn({ 
      from: originalDatabase 
    }, 'Initiating database failover');

    try {
      // Find the best available replica
      const targetDatabase = await this.findBestReplica();
      
      if (!targetDatabase) {
        throw new Error('No healthy replica available for failover');
      }

      // Emit failover initiated event
      const failoverEvent: FailoverEvent = {
        type: 'failover_initiated',
        from: originalDatabase,
        to: targetDatabase,
        reason: 'Primary database unhealthy',
        timestamp: new Date()
      };
      this.recordFailoverEvent(failoverEvent);

      // Switch to the new database
      this.currentDatabase = targetDatabase;

      // Verify the new database is working
      await this.verifyDatabaseConnection(targetDatabase);

      const duration = Date.now() - startTime;
      
      // Emit failover completed event
      const completedEvent: FailoverEvent = {
        type: 'failover_completed',
        from: originalDatabase,
        to: targetDatabase,
        reason: 'Failover successful',
        timestamp: new Date(),
        duration
      };
      this.recordFailoverEvent(completedEvent);

      logger.info({ 
        from: originalDatabase, 
        to: targetDatabase, 
        duration 
      }, 'Database failover completed successfully');

      this.emit('failover_completed', completedEvent);

    } catch (error) {
      logger.error({ 
        error, 
        from: originalDatabase 
      }, 'Database failover failed');
      
      this.emit('failover_failed', { 
        from: originalDatabase, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      this.isFailoverInProgress = false;
    }
  }

  /**
   * Find the best available replica for failover
   */
  private async findBestReplica(): Promise<string | null> {
    if (!this.config.replicas || this.config.replicas.length === 0) {
      return null;
    }

    // Sort replicas by priority and health
    const availableReplicas = this.config.replicas
      .map((replica, index) => ({
        name: `replica-${index}`,
        priority: replica.priority,
        health: this.healthStatus.get(`replica-${index}`)
      }))
      .filter(replica => replica.health && replica.health.status === 'healthy')
      .sort((a, b) => a.priority - b.priority);

    return availableReplicas.length > 0 ? availableReplicas[0].name : null;
  }

  /**
   * Verify database connection
   */
  private async verifyDatabaseConnection(databaseName: string): Promise<void> {
    const testOperation: DatabaseOperation = {
      id: `health-check-${Date.now()}`,
      query: 'SELECT 1 as test',
      type: 'read',
      priority: 'high',
      retryable: false
    };

    try {
      await this.executeOperation(testOperation, 1);
      logger.debug({ database: databaseName }, 'Database connection verified');
    } catch (error) {
      throw new Error(`Failed to verify database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Classify database errors
   */
  private classifyError(error: Error, operation: DatabaseOperation): DatabaseError {
    const message = error.message.toLowerCase();
    let category: DatabaseError['category'] = 'unknown';
    let retryable = true;
    let severity: DatabaseError['severity'] = 'medium';

    // Connection errors
    if (message.includes('connection') || message.includes('connect') || message.includes('econnrefused')) {
      category = 'connection';
      severity = 'high';
      retryable = true;
    }
    // Timeout errors
    else if (message.includes('timeout') || message.includes('etimedout')) {
      category = 'timeout';
      severity = 'medium';
      retryable = true;
    }
    // Syntax errors
    else if (message.includes('syntax') || message.includes('invalid') || message.includes('parse')) {
      category = 'syntax';
      severity = 'low';
      retryable = false;
    }
    // Constraint violations
    else if (message.includes('constraint') || message.includes('duplicate') || message.includes('unique')) {
      category = 'constraint';
      severity = 'low';
      retryable = false;
    }
    // Resource errors
    else if (message.includes('resource') || message.includes('memory') || message.includes('disk')) {
      category = 'resource';
      severity = 'critical';
      retryable = true;
    }

    return {
      code: error.name || 'DatabaseError',
      message: error.message,
      severity,
      retryable,
      category,
      timestamp: new Date(),
      operation
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.config.resilience.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = Math.min(exponentialDelay + jitter, this.config.resilience.maxDelay);
    return Math.floor(delay);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        logger.error({ error }, 'Health check failed');
      });
    }, this.config.resilience.healthCheckInterval);

    // Perform initial health check
    this.performHealthChecks().catch(error => {
      logger.error({ error }, 'Initial health check failed');
    });
  }

  /**
   * Perform health checks on all databases
   */
  private async performHealthChecks(): Promise<void> {
    const databases = ['primary'];
    if (this.config.replicas) {
      databases.push(...this.config.replicas.map((_, index) => `replica-${index}`));
    }

    const healthPromises = databases.map(db => this.checkDatabaseHealth(db));
    await Promise.allSettled(healthPromises);
  }

  /**
   * Check health of a specific database
   */
  private async checkDatabaseHealth(databaseName: string): Promise<void> {
    const startTime = Date.now();
    const issues: string[] = [];

    try {
      // Simulate health check
      const responseTime = await this.simulateHealthCheck(databaseName);
      const errorRate = this.calculateErrorRate(databaseName);
      
      let status: DatabaseHealth['status'] = 'healthy';
      
      if (responseTime > 1000) {
        status = 'degraded';
        issues.push('High response time');
      }
      
      if (errorRate > 0.1) {
        status = 'degraded';
        issues.push('High error rate');
      }
      
      if (responseTime > 5000 || errorRate > 0.5) {
        status = 'unhealthy';
      }

      this.healthStatus.set(databaseName, {
        status,
        responseTime,
        errorRate,
        connectionCount: Math.floor(Math.random() * 20) + 5,
        lastCheck: new Date(),
        issues
      });

    } catch (error) {
      this.healthStatus.set(databaseName, {
        status: 'offline',
        responseTime: -1,
        errorRate: 1.0,
        connectionCount: 0,
        lastCheck: new Date(),
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      });
    }
  }

  /**
   * Simulate health check
   */
  private async simulateHealthCheck(databaseName: string): Promise<number> {
    const baseTime = 50;
    const randomFactor = Math.random() * 100;
    const healthTime = baseTime + randomFactor;
    
    await this.sleep(healthTime);
    return healthTime;
  }

  /**
   * Calculate error rate for a database
   */
  private calculateErrorRate(databaseName: string): number {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp.getTime() < 300000 // Last 5 minutes
    );
    
    if (recentErrors.length === 0) return 0;
    
    // Simulate error rate calculation
    return Math.min(recentErrors.length / 100, 1.0);
  }

  /**
   * Check if database is healthy
   */
  private isDatabaseHealthy(databaseName: string): boolean {
    const health = this.healthStatus.get(databaseName);
    return health ? health.status === 'healthy' || health.status === 'degraded' : false;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operation: DatabaseOperation, duration: number): void {
    logger.debug({ 
      operationId: operation.id, 
      type: operation.type, 
      duration 
    }, 'Database operation successful');
  }

  /**
   * Record database error
   */
  private recordError(error: DatabaseError): void {
    this.errorHistory.push(error);
    
    // Keep only recent errors
    const cutoff = Date.now() - 3600000; // 1 hour
    this.errorHistory = this.errorHistory.filter(e => e.timestamp.getTime() > cutoff);
    
    this.emit('database_error', error);
  }

  /**
   * Record failover event
   */
  private recordFailoverEvent(event: FailoverEvent): void {
    this.failoverHistory.push(event);
    
    // Keep only recent events
    if (this.failoverHistory.length > 100) {
      this.failoverHistory = this.failoverHistory.slice(-100);
    }
    
    this.emit('failover_event', event);
  }

  /**
   * Utility function for sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current database health status
   */
  getDatabaseHealth(): Map<string, DatabaseHealth> {
    return new Map(this.healthStatus);
  }

  /**
   * Get error history
   */
  getErrorHistory(): DatabaseError[] {
    return [...this.errorHistory];
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  /**
   * Get current active database
   */
  getCurrentDatabase(): string {
    return this.currentDatabase;
  }

  /**
   * Force failover to specific database
   */
  async forceFailover(targetDatabase: string): Promise<void> {
    logger.info({ target: targetDatabase }, 'Forcing failover to specific database');
    
    const originalDatabase = this.currentDatabase;
    this.currentDatabase = targetDatabase;
    
    try {
      await this.verifyDatabaseConnection(targetDatabase);
      
      const failoverEvent: FailoverEvent = {
        type: 'failover_completed',
        from: originalDatabase,
        to: targetDatabase,
        reason: 'Manual failover',
        timestamp: new Date()
      };
      
      this.recordFailoverEvent(failoverEvent);
      this.emit('failover_completed', failoverEvent);
      
    } catch (error) {
      // Rollback on failure
      this.currentDatabase = originalDatabase;
      throw error;
    }
  }

  /**
   * Health check for the resilience service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    currentDatabase: string;
    databaseHealth: Record<string, DatabaseHealth>;
    recentErrors: number;
    recentFailovers: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp.getTime() < 3600000
    ).length;
    
    const recentFailovers = this.failoverHistory.filter(
      e => Date.now() - e.timestamp.getTime() < 3600000
    ).length;

    // Check current database health
    const currentHealth = this.healthStatus.get(this.currentDatabase);
    if (!currentHealth || currentHealth.status === 'unhealthy' || currentHealth.status === 'offline') {
      issues.push(`Current database ${this.currentDatabase} is ${currentHealth?.status || 'unknown'}`);
    }

    // Check error rate
    if (recentErrors > 50) {
      issues.push(`High error rate: ${recentErrors} errors in the last hour`);
    }

    // Check failover frequency
    if (recentFailovers > 3) {
      issues.push(`Frequent failovers: ${recentFailovers} in the last hour`);
    }

    const databaseHealth: Record<string, DatabaseHealth> = {};
    for (const [name, health] of this.healthStatus) {
      databaseHealth[name] = health;
    }

    return {
      healthy: issues.length === 0,
      currentDatabase: this.currentDatabase,
      databaseHealth,
      recentErrors,
      recentFailovers,
      issues
    };
  }

  /**
   * Shutdown the resilience service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down database resilience service');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.removeAllListeners();
    
    logger.info('Database resilience service shutdown complete');
  }
}

export const databaseResilienceService = new DatabaseResilienceService({
  primary: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'contract_intelligence',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  },
  replicas: [
    {
      host: process.env.DB_REPLICA_HOST || 'localhost',
      port: parseInt(process.env.DB_REPLICA_PORT || '5433'),
      database: process.env.DB_NAME || 'contract_intelligence',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      priority: 1
    }
  ],
  resilience: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    timeout: 30000,
    healthCheckInterval: 30000,
    failoverThreshold: 5,
    recoveryThreshold: 3
  }
});