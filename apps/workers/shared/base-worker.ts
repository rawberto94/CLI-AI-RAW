/**
 * Base Worker Foundation
 * Provides standardized functionality for all contract analysis workers
 */

import { Job } from 'bullmq';
import { getSharedLLMClient, SharedLLMClient } from './llm-utils';
import { getSharedDatabaseClient, SharedDatabaseClient } from './database-utils';
import { RAGIntegration } from './rag-utils';
import { getArtifactManager, ArtifactType, ArtifactMetadata } from './artifact-manager';
import { getErrorRecoveryManager, RecoveryStrategy } from './error-recovery-manager';
import { getProvenanceGenerator, ProcessingMetrics as ProvenanceProcessingMetrics } from './provenance-generator';
import { createJobLogger, EnhancedStructuredLogger } from './enhanced-logger';
import { ConfigUtils } from './config-manager';

// Worker Configuration Interface
export interface WorkerConfig {
  // Service Configuration
  openai: {
    apiKey?: string;
    model: string;
    timeout: number;
    retryAttempts: number;
  };
  
  database: {
    connectionString?: string;
    maxConnections: number;
    queryTimeout: number;
    retryAttempts: number;
  };
  
  storage: {
    provider: 'local' | 's3' | 'azure';
    config: any;
  };
  
  // Worker Behavior
  enableLLM: boolean;
  enableFallbacks: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;
  
  // Environment
  environment: 'development' | 'staging' | 'production';
  tenantId?: string;
}

// Processing Result Interface
export interface ProcessingResult<T> {
  success: boolean;
  data?: T;
  error?: ProcessingError;
  metrics: ProcessingMetrics;
  fallbackUsed: boolean;
  confidence: number;
}

// Processing Metrics Interface
export interface ProcessingMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  llmTokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  databaseQueries: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

// Processing Error Interface
export interface ProcessingError {
  code: string;
  message: string;
  category: 'configuration' | 'dependency' | 'validation' | 'processing' | 'external';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any>;
  suggestions: string[];
  retryable: boolean;
}

// Structured Logger Interface
export interface StructuredLogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
  setCorrelationId(id: string): void;
}

// Metrics Collector Interface
export interface MetricsCollector {
  recordProcessingTime(operation: string, duration: number): void;
  recordLLMUsage(tokens: { prompt: number; completion: number; total: number }): void;
  recordDatabaseQuery(operation: string, duration: number): void;
  recordMemoryUsage(usage: { heapUsed: number; heapTotal: number; external: number }): void;
  getMetrics(): Record<string, any>;
}

/**
 * Structured Logger Implementation
 */
export class DefaultStructuredLogger implements StructuredLogger {
  private correlationId?: string;
  private logLevel: string;

  constructor(logLevel: string = 'info') {
    this.logLevel = logLevel;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  debug(message: string, context?: any): void {
    if (this.shouldLog('debug')) {
      this.log('DEBUG', message, context);
    }
  }

  info(message: string, context?: any): void {
    if (this.shouldLog('info')) {
      this.log('INFO', message, context);
    }
  }

  warn(message: string, context?: any): void {
    if (this.shouldLog('warn')) {
      this.log('WARN', message, context);
    }
  }

  error(message: string, context?: any): void {
    if (this.shouldLog('error')) {
      this.log('ERROR', message, context);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level as keyof typeof levels] >= levels[this.logLevel as keyof typeof levels];
  }

  private log(level: string, message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      ...context
    };
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Metrics Collector Implementation
 */
export class DefaultMetricsCollector implements MetricsCollector {
  private metrics: Record<string, any> = {};

  recordProcessingTime(operation: string, duration: number): void {
    if (!this.metrics.processingTimes) {
      this.metrics.processingTimes = {};
    }
    this.metrics.processingTimes[operation] = duration;
  }

  recordLLMUsage(tokens: { prompt: number; completion: number; total: number }): void {
    if (!this.metrics.llmUsage) {
      this.metrics.llmUsage = { prompt: 0, completion: 0, total: 0 };
    }
    this.metrics.llmUsage.prompt += tokens.prompt;
    this.metrics.llmUsage.completion += tokens.completion;
    this.metrics.llmUsage.total += tokens.total;
  }

  recordDatabaseQuery(operation: string, duration: number): void {
    if (!this.metrics.databaseQueries) {
      this.metrics.databaseQueries = {};
    }
    if (!this.metrics.databaseQueries[operation]) {
      this.metrics.databaseQueries[operation] = { count: 0, totalDuration: 0 };
    }
    this.metrics.databaseQueries[operation].count++;
    this.metrics.databaseQueries[operation].totalDuration += duration;
  }

  recordMemoryUsage(usage: { heapUsed: number; heapTotal: number; external: number }): void {
    this.metrics.memoryUsage = usage;
  }

  getMetrics(): Record<string, any> {
    return { ...this.metrics };
  }
}

/**
 * Abstract Base Worker Class
 * All workers should extend this class for consistent behavior
 */
export abstract class BaseWorker<TRequest, TResult> {
  protected config: WorkerConfig;
  protected logger: StructuredLogger;
  protected metrics: MetricsCollector;
  protected llmClient: SharedLLMClient;
  protected dbClient: SharedDatabaseClient;

  constructor(config?: Partial<WorkerConfig>) {
    this.config = this.createDefaultConfig(config);
    this.logger = new DefaultStructuredLogger(this.config.logLevel);
    this.metrics = new DefaultMetricsCollector();
    this.llmClient = getSharedLLMClient({
      apiKey: this.config.openai.apiKey,
      model: this.config.openai.model,
      timeout: this.config.openai.timeout
    });
    this.dbClient = getSharedDatabaseClient();

    this.validateConfiguration();
  }

  /**
   * Abstract method that each worker must implement
   */
  abstract process(job: Job<TRequest>): Promise<TResult>;

  /**
   * Execute operation with fallback mechanism
   */
  protected async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    operation: string
  ): Promise<ProcessingResult<T>> {
    const startTime = new Date();
    let fallbackUsed = false;
    let error: ProcessingError | undefined;

    try {
      this.logger.info(`Starting ${operation}`, { operation });
      const result = await primary();
      
      const metrics = this.createProcessingMetrics(startTime);
      this.logger.info(`Completed ${operation}`, { operation, duration: metrics.duration });
      
      return {
        success: true,
        data: result,
        metrics,
        fallbackUsed: false,
        confidence: 0.9
      };
    } catch (primaryError) {
      this.logger.warn(`Primary ${operation} failed, attempting fallback`, { 
        operation, 
        error: primaryError 
      });

      if (this.config.enableFallbacks) {
        try {
          const result = await fallback();
          fallbackUsed = true;
          
          const metrics = this.createProcessingMetrics(startTime);
          this.logger.info(`Completed ${operation} with fallback`, { 
            operation, 
            duration: metrics.duration 
          });
          
          return {
            success: true,
            data: result,
            metrics,
            fallbackUsed: true,
            confidence: 0.6
          };
        } catch (fallbackError) {
          error = this.createProcessingError(
            'FALLBACK_FAILED',
            `Both primary and fallback ${operation} failed`,
            'processing',
            'high',
            { primaryError, fallbackError },
            [`Check ${operation} configuration`, 'Verify external service availability'],
            false
          );
        }
      } else {
        error = this.createProcessingError(
          'PRIMARY_FAILED',
          `Primary ${operation} failed and fallbacks disabled`,
          'processing',
          'high',
          { primaryError },
          [`Enable fallbacks in configuration`, `Check ${operation} service availability`],
          true
        );
      }

      const metrics = this.createProcessingMetrics(startTime);
      this.logger.error(`Failed ${operation}`, { operation, error });
      
      return {
        success: false,
        error,
        metrics,
        fallbackUsed,
        confidence: 0
      };
    }
  }

  /**
   * Create artifact with validation and error handling
   */
  protected async createArtifact(data: {
    contractId: string;
    type: string;
    data: any;
    tenantId: string;
    metadata?: any;
  }): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.dbClient.createArtifact(data);
      
      if (!result.success) {
        throw new Error(`Failed to create artifact: ${result.error}`);
      }
      
      this.metrics.recordDatabaseQuery('createArtifact', Date.now() - startTime);
      this.logger.info('Artifact created successfully', { 
        contractId: data.contractId, 
        type: data.type 
      });
      
      // Trigger RAG indexation
      await RAGIntegration.triggerAutoIndexation(
        data.contractId, 
        data.tenantId, 
        `${data.type.toLowerCase()}_complete`
      );
      
    } catch (error) {
      this.metrics.recordDatabaseQuery('createArtifact', Date.now() - startTime);
      this.logger.error('Failed to create artifact', { 
        contractId: data.contractId, 
        type: data.type, 
        error 
      });
      throw error;
    }
  }

  /**
   * Update job progress with error handling
   */
  protected async updateJobProgress(job: Job, progress: number): Promise<void> {
    try {
      await job.updateProgress(progress);
      this.logger.debug('Job progress updated', { jobId: job.id, progress });
    } catch (error) {
      this.logger.warn('Failed to update job progress', { jobId: job.id, progress, error });
    }
  }

  /**
   * Log performance metrics
   */
  protected logPerformanceMetrics(operation: string, duration: number): void {
    this.metrics.recordProcessingTime(operation, duration);
    this.logger.info('Performance metric recorded', { operation, duration });
  }

  /**
   * Get memory usage metrics
   */
  protected getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; rss: number } {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(config?: Partial<WorkerConfig>): WorkerConfig {
    return {
      openai: {
        apiKey: config?.openai?.apiKey || process.env.OPENAI_API_KEY,
        model: config?.openai?.model || process.env.OPENAI_MODEL || 'gpt-4o',
        timeout: config?.openai?.timeout || 60000,
        retryAttempts: config?.openai?.retryAttempts || 3
      },
      database: {
        connectionString: config?.database?.connectionString || process.env.DATABASE_URL,
        maxConnections: config?.database?.maxConnections || 10,
        queryTimeout: config?.database?.queryTimeout || 60000,
        retryAttempts: config?.database?.retryAttempts || 3
      },
      storage: {
        provider: config?.storage?.provider || 'local',
        config: config?.storage?.config || {}
      },
      enableLLM: config?.enableLLM ?? true,
      enableFallbacks: config?.enableFallbacks ?? true,
      logLevel: config?.logLevel || 'info',
      metricsEnabled: config?.metricsEnabled ?? true,
      environment: config?.environment || (process.env.NODE_ENV as any) || 'development',
      tenantId: config?.tenantId
    };
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    if (this.config.enableLLM && !this.config.openai.apiKey) {
      errors.push('OpenAI API key is required when LLM is enabled');
    }

    if (this.config.openai.timeout < 1000) {
      errors.push('OpenAI timeout must be at least 1000ms');
    }

    if (this.config.database.maxConnections < 1) {
      errors.push('Database max connections must be at least 1');
    }

    if (errors.length > 0) {
      const error = new Error(`Configuration validation failed: ${errors.join(', ')}`);
      this.logger.error('Configuration validation failed', { errors });
      throw error;
    }

    this.logger.info('Configuration validated successfully', { 
      environment: this.config.environment,
      enableLLM: this.config.enableLLM,
      enableFallbacks: this.config.enableFallbacks
    });
  }

  /**
   * Create processing metrics
   */
  private createProcessingMetrics(startTime: Date): ProcessingMetrics {
    const endTime = new Date();
    const memoryUsage = this.getMemoryUsage();
    
    this.metrics.recordMemoryUsage(memoryUsage);
    
    return {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      databaseQueries: 0, // This would be tracked by the database client
      memoryUsage
    };
  }

  /**
   * Create processing error
   */
  private createProcessingError(
    code: string,
    message: string,
    category: ProcessingError['category'],
    severity: ProcessingError['severity'],
    context: Record<string, unknown>,
    suggestions: string[],
    retryable: boolean
  ): ProcessingError {
    return {
      code,
      message,
      category,
      severity,
      context,
      suggestions,
      retryable
    };
  }
}