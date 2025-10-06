/**
 * Enhanced Structured Logging System
 * Provides comprehensive logging with correlation IDs, performance metrics, and structured output
 */

import { randomUUID } from 'crypto';

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  workerId?: string;
  jobId?: string;
  contractId?: string;
  tenantId?: string;
  operation?: string;
  duration?: number;
  error?: any;
  context?: Record<string, any>;
}

// Log level enum
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

// Performance tracking interface
export interface PerformanceTracker {
  operation: string;
  startTime: number;
  metadata?: Record<string, any>;
}

/**
 * Enhanced Structured Logger
 * Provides comprehensive logging capabilities for workers
 */
export class EnhancedStructuredLogger {
  private config: LoggerConfig;
  private correlationId?: string;
  private workerId?: string;
  private jobId?: string;
  private contractId?: string;
  private tenantId?: string;
  private performanceTrackers: Map<string, PerformanceTracker> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || LogLevel.INFO,
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      enableStructured: config.enableStructured ?? true,
      filePath: config.filePath || './logs/worker.log',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 5
    };
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Generate and set new correlation ID
   */
  generateCorrelationId(): string {
    this.correlationId = randomUUID();
    return this.correlationId;
  }

  /**
   * Set worker context information
   */
  setWorkerContext(workerId: string, jobId?: string, contractId?: string, tenantId?: string): void {
    this.workerId = workerId;
    this.jobId = jobId;
    this.contractId = contractId;
    this.tenantId = tenantId;
  }

  /**
   * Clear worker context
   */
  clearWorkerContext(): void {
    this.workerId = undefined;
    this.jobId = undefined;
    this.contractId = undefined;
    this.tenantId = undefined;
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: any, context?: Record<string, any>): void {
    const errorContext = error ? { error: this.serializeError(error), ...context } : context;
    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Start performance tracking for an operation
   */
  startPerformanceTracking(operation: string, metadata?: Record<string, any>): string {
    const trackerId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.performanceTrackers.set(trackerId, {
      operation,
      startTime: Date.now(),
      metadata
    });

    this.debug(`Started performance tracking for ${operation}`, { 
      trackerId, 
      operation,
      metadata 
    });

    return trackerId;
  }

  /**
   * End performance tracking and log results
   */
  endPerformanceTracking(trackerId: string, additionalContext?: Record<string, any>): number {
    const tracker = this.performanceTrackers.get(trackerId);
    
    if (!tracker) {
      this.warn(`Performance tracker not found: ${trackerId}`);
      return 0;
    }

    const duration = Date.now() - tracker.startTime;
    this.performanceTrackers.delete(trackerId);

    this.info(`Performance: ${tracker.operation} completed`, {
      operation: tracker.operation,
      duration,
      trackerId,
      metadata: tracker.metadata,
      ...additionalContext
    });

    return duration;
  }

  /**
   * Log with automatic performance tracking
   */
  async logWithPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const trackerId = this.startPerformanceTracking(operation, metadata);
    
    try {
      const result = await fn();
      this.endPerformanceTracking(trackerId, { success: true });
      return result;
    } catch (error) {
      this.endPerformanceTracking(trackerId, { success: false, error: this.serializeError(error) });
      throw error;
    }
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, duration: number, success: boolean, context?: Record<string, any>): void {
    this.info(`Database: ${operation}`, {
      operation: `db_${operation}`,
      duration,
      success,
      ...context
    });
  }

  /**
   * Log LLM operation
   */
  logLLMOperation(
    operation: string, 
    duration: number, 
    tokens?: { prompt: number; completion: number; total: number },
    success: boolean = true,
    context?: Record<string, any>
  ): void {
    this.info(`LLM: ${operation}`, {
      operation: `llm_${operation}`,
      duration,
      success,
      tokens,
      ...context
    });
  }

  /**
   * Log artifact creation
   */
  logArtifactCreation(
    artifactType: string,
    contractId: string,
    success: boolean,
    duration?: number,
    context?: Record<string, any>
  ): void {
    this.info(`Artifact: ${artifactType} ${success ? 'created' : 'failed'}`, {
      operation: 'artifact_creation',
      artifactType,
      contractId,
      success,
      duration,
      ...context
    });
  }

  /**
   * Log worker lifecycle events
   */
  logWorkerLifecycle(event: 'started' | 'completed' | 'failed' | 'retry', context?: Record<string, any>): void {
    const level = event === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `Worker ${event}`, {
      operation: 'worker_lifecycle',
      event,
      ...context
    });
  }

  /**
   * Create child logger with additional context
   */
  createChildLogger(additionalContext: Record<string, any>): EnhancedStructuredLogger {
    const childLogger = new EnhancedStructuredLogger(this.config);
    childLogger.correlationId = this.correlationId;
    childLogger.workerId = this.workerId;
    childLogger.jobId = this.jobId;
    childLogger.contractId = this.contractId;
    childLogger.tenantId = this.tenantId;
    
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, context?: Record<string, any>) => {
      originalLog(level, message, { ...additionalContext, ...context });
    };
    
    return childLogger;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      workerId: this.workerId,
      jobId: this.jobId,
      contractId: this.contractId,
      tenantId: this.tenantId,
      context
    };

    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.config.enableFile) {
      this.logToFile(logEntry);
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };

    return levels[level] >= levels[this.config.level];
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    if (this.config.enableStructured) {
      console.log(JSON.stringify(entry));
    } else {
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const correlationStr = entry.correlationId ? ` [${entry.correlationId}]` : '';
      console.log(`${entry.timestamp} ${entry.level}${correlationStr}: ${entry.message}${contextStr}`);
    }
  }

  /**
   * Log to file (placeholder - would need file system implementation)
   */
  private logToFile(entry: LogEntry): void {
    // File logging implementation would go here
    // For now, we'll just use console as fallback
    if (process.env.NODE_ENV === 'development') {
      // In development, we might want to write to a file
      // This would require fs module and proper file rotation
    }
  }

  /**
   * Serialize error objects for logging
   */
  private serializeError(error: any): unknown {
    if (error instanceof Error) {
      return {
        ...error,
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }
}

/**
 * Logger Factory
 * Creates loggers with appropriate configuration for different environments
 */
export class LoggerFactory {
  private static loggers: Map<string, EnhancedStructuredLogger> = new Map();

  /**
   * Get or create logger for worker
   */
  static getLogger(workerId: string, config?: Partial<LoggerConfig>): EnhancedStructuredLogger {
    if (!this.loggers.has(workerId)) {
      const loggerConfig = this.getConfigForEnvironment(config);
      const logger = new EnhancedStructuredLogger(loggerConfig);
      logger.setWorkerContext(workerId);
      this.loggers.set(workerId, logger);
    }
    
    return this.loggers.get(workerId)!;
  }

  /**
   * Create logger with job context
   */
  static createJobLogger(
    workerId: string, 
    jobId: string, 
    contractId?: string, 
    tenantId?: string
  ): EnhancedStructuredLogger {
    const baseLogger = this.getLogger(workerId);
    const jobLogger = new EnhancedStructuredLogger(baseLogger['config']);
    
    jobLogger.setCorrelationId(baseLogger.generateCorrelationId());
    jobLogger.setWorkerContext(workerId, jobId, contractId, tenantId);
    
    return jobLogger;
  }

  /**
   * Get configuration for current environment
   */
  private static getConfigForEnvironment(override?: Partial<LoggerConfig>): LoggerConfig {
    const environment = process.env.NODE_ENV || 'development';
    
    const baseConfig: LoggerConfig = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableStructured: true
    };

    const envConfigs: Record<string, Partial<LoggerConfig>> = {
      development: {
        level: LogLevel.DEBUG,
        enableStructured: false // More readable in development
      },
      staging: {
        level: LogLevel.INFO,
        enableStructured: true
      },
      production: {
        level: LogLevel.WARN,
        enableStructured: true,
        enableFile: true
      }
    };

    const envConfig = envConfigs[environment] || {};
    
    return {
      ...baseConfig,
      ...envConfig,
      ...override
    };
  }
}

// Export convenience functions
export const createLogger = (workerId: string, config?: Partial<LoggerConfig>) => 
  LoggerFactory.getLogger(workerId, config);

export const createJobLogger = (workerId: string, jobId: string, contractId?: string, tenantId?: string) =>
  LoggerFactory.createJobLogger(workerId, jobId, contractId, tenantId);