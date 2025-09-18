/**
 * Error Classification Service
 * Comprehensive error classification and handling system
 */

import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ name: 'error-classification' });

export interface ErrorClassification {
  id: string;
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  component: string;
  message: string;
  originalError: Error;
  context: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  stackTrace?: string;
  recoverable: boolean;
  retryable: boolean;
  userFacing: boolean;
}

export enum ErrorType {
  // System Errors
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_ERROR = 'configuration_error',
  RESOURCE_ERROR = 'resource_error',
  
  // Database Errors
  DATABASE_CONNECTION = 'database_connection',
  DATABASE_QUERY = 'database_query',
  DATABASE_CONSTRAINT = 'database_constraint',
  DATABASE_TIMEOUT = 'database_timeout',
  
  // LLM/AI Errors
  LLM_API_ERROR = 'llm_api_error',
  LLM_TIMEOUT = 'llm_timeout',
  LLM_RATE_LIMIT = 'llm_rate_limit',
  LLM_QUOTA_EXCEEDED = 'llm_quota_exceeded',
  LLM_INVALID_RESPONSE = 'llm_invalid_response',
  
  // Worker Errors
  WORKER_FAILURE = 'worker_failure',
  WORKER_TIMEOUT = 'worker_timeout',
  WORKER_QUEUE_FULL = 'worker_queue_full',
  
  // File Processing Errors
  FILE_UPLOAD_ERROR = 'file_upload_error',
  FILE_VALIDATION_ERROR = 'file_validation_error',
  FILE_PROCESSING_ERROR = 'file_processing_error',
  FILE_STORAGE_ERROR = 'file_storage_error',
  
  // Authentication/Authorization Errors
  AUTH_ERROR = 'auth_error',
  PERMISSION_DENIED = 'permission_denied',
  TOKEN_EXPIRED = 'token_expired',
  
  // Validation Errors
  INPUT_VALIDATION = 'input_validation',
  SCHEMA_VALIDATION = 'schema_validation',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
  
  // Network Errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  CONNECTION_ERROR = 'connection_error',
  
  // Unknown/Unclassified
  UNKNOWN_ERROR = 'unknown_error'
}

export enum ErrorCategory {
  INFRASTRUCTURE = 'infrastructure',
  APPLICATION = 'application',
  BUSINESS = 'business',
  SECURITY = 'security',
  EXTERNAL = 'external',
  USER = 'user'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'manual' | 'ignore';
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: string;
  escalationThreshold?: number;
}e
xport interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  matchers: {
    messagePattern?: RegExp;
    codePattern?: RegExp;
    stackPattern?: RegExp;
    componentPattern?: RegExp;
  };
  classification: {
    type: ErrorType;
    category: ErrorCategory;
    severity: ErrorSeverity;
    recoverable: boolean;
    retryable: boolean;
    userFacing: boolean;
  };
  recoveryStrategy: ErrorRecoveryStrategy;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByComponent: Record<string, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  topErrors: Array<{
    type: ErrorType;
    count: number;
    lastOccurrence: Date;
  }>;
}

export class ErrorClassificationService extends EventEmitter {
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private errorHistory: ErrorClassification[] = [];
  private recoveryAttempts = new Map<string, number>();
  private correlationMap = new Map<string, ErrorClassification[]>();

  constructor() {
    super();
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize default error patterns
   */
  private initializeDefaultPatterns(): void {
    const defaultPatterns: ErrorPattern[] = [
      // Database Errors
      {
        id: 'db-connection-error',
        name: 'Database Connection Error',
        description: 'Database connection failures',
        matchers: {
          messagePattern: /connection.*refused|connect.*timeout|connection.*lost/i,
          codePattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i
        },
        classification: {
          type: ErrorType.DATABASE_CONNECTION,
          category: ErrorCategory.INFRASTRUCTURE,
          severity: ErrorSeverity.HIGH,
          recoverable: true,
          retryable: true,
          userFacing: false
        },
        recoveryStrategy: {
          type: 'retry',
          maxRetries: 3,
          retryDelay: 2000
        }
      },
      
      // LLM API Errors
      {
        id: 'llm-rate-limit',
        name: 'LLM Rate Limit Error',
        description: 'LLM API rate limiting',
        matchers: {
          messagePattern: /rate.*limit|too.*many.*requests|quota.*exceeded/i,
          codePattern: /429|RATE_LIMIT/i
        },
        classification: {
          type: ErrorType.LLM_RATE_LIMIT,
          category: ErrorCategory.EXTERNAL,
          severity: ErrorSeverity.MEDIUM,
          recoverable: true,
          retryable: true,
          userFacing: false
        },
        recoveryStrategy: {
          type: 'retry',
          maxRetries: 5,
          retryDelay: 60000 // 1 minute
        }
      },
      
      // File Processing Errors
      {
        id: 'file-validation-error',
        name: 'File Validation Error',
        description: 'File validation failures',
        matchers: {
          messagePattern: /invalid.*file|unsupported.*format|file.*too.*large/i,
          componentPattern: /file.*validation|upload/i
        },
        classification: {
          type: ErrorType.FILE_VALIDATION_ERROR,
          category: ErrorCategory.USER,
          severity: ErrorSeverity.LOW,
          recoverable: false,
          retryable: false,
          userFacing: true
        },
        recoveryStrategy: {
          type: 'manual'
        }
      },
      
      // Worker Errors
      {
        id: 'worker-timeout',
        name: 'Worker Timeout Error',
        description: 'Worker processing timeouts',
        matchers: {
          messagePattern: /worker.*timeout|processing.*timeout|job.*timeout/i,
          componentPattern: /worker|job|queue/i
        },
        classification: {
          type: ErrorType.WORKER_TIMEOUT,
          category: ErrorCategory.APPLICATION,
          severity: ErrorSeverity.MEDIUM,
          recoverable: true,
          retryable: true,
          userFacing: false
        },
        recoveryStrategy: {
          type: 'retry',
          maxRetries: 2,
          retryDelay: 5000
        }
      },
      
      // Authentication Errors
      {
        id: 'auth-token-expired',
        name: 'Authentication Token Expired',
        description: 'Expired authentication tokens',
        matchers: {
          messagePattern: /token.*expired|unauthorized|invalid.*token/i,
          codePattern: /401|UNAUTHORIZED/i
        },
        classification: {
          type: ErrorType.TOKEN_EXPIRED,
          category: ErrorCategory.SECURITY,
          severity: ErrorSeverity.MEDIUM,
          recoverable: true,
          retryable: false,
          userFacing: true
        },
        recoveryStrategy: {
          type: 'manual'
        }
      },
      
      // Network Errors
      {
        id: 'network-timeout',
        name: 'Network Timeout Error',
        description: 'Network request timeouts',
        matchers: {
          messagePattern: /network.*timeout|request.*timeout|socket.*timeout/i,
          codePattern: /ETIMEDOUT|ESOCKETTIMEDOUT/i
        },
        classification: {
          type: ErrorType.TIMEOUT_ERROR,
          category: ErrorCategory.INFRASTRUCTURE,
          severity: ErrorSeverity.MEDIUM,
          recoverable: true,
          retryable: true,
          userFacing: false
        },
        recoveryStrategy: {
          type: 'retry',
          maxRetries: 3,
          retryDelay: 1000
        }
      }
    ];

    defaultPatterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });

    logger.info({ 
      patternCount: defaultPatterns.length 
    }, 'Initialized default error patterns');
  }

  /**
   * Classify an error
   */
  classifyError(
    error: Error,
    context: {
      component?: string;
      correlationId?: string;
      userId?: string;
      tenantId?: string;
      additionalContext?: Record<string, any>;
    } = {}
  ): ErrorClassification {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find matching pattern
    const matchingPattern = this.findMatchingPattern(error, context.component);
    
    const classification: ErrorClassification = {
      id: errorId,
      type: matchingPattern?.classification.type || ErrorType.UNKNOWN_ERROR,
      category: matchingPattern?.classification.category || ErrorCategory.APPLICATION,
      severity: matchingPattern?.classification.severity || ErrorSeverity.MEDIUM,
      component: context.component || 'unknown',
      message: error.message,
      originalError: error,
      context: {
        ...context.additionalContext,
        pattern: matchingPattern?.id,
        recoveryStrategy: matchingPattern?.recoveryStrategy
      },
      timestamp: new Date(),
      correlationId: context.correlationId,
      userId: context.userId,
      tenantId: context.tenantId,
      stackTrace: error.stack,
      recoverable: matchingPattern?.classification.recoverable || false,
      retryable: matchingPattern?.classification.retryable || false,
      userFacing: matchingPattern?.classification.userFacing || false
    };

    // Store error
    this.storeError(classification);
    
    // Emit error event
    this.emit('error_classified', classification);
    
    logger.error({
      errorId: classification.id,
      type: classification.type,
      category: classification.category,
      severity: classification.severity,
      component: classification.component,
      message: classification.message,
      correlationId: classification.correlationId
    }, 'Error classified');

    return classification;
  }

  /**
   * Find matching error pattern
   */
  private findMatchingPattern(error: Error, component?: string): ErrorPattern | null {
    for (const pattern of this.errorPatterns.values()) {
      const { matchers } = pattern;
      
      // Check message pattern
      if (matchers.messagePattern && !matchers.messagePattern.test(error.message)) {
        continue;
      }
      
      // Check code pattern (if error has a code property)
      if (matchers.codePattern && 'code' in error) {
        const code = (error as any).code;
        if (code && !matchers.codePattern.test(code)) {
          continue;
        }
      }
      
      // Check stack pattern
      if (matchers.stackPattern && error.stack && !matchers.stackPattern.test(error.stack)) {
        continue;
      }
      
      // Check component pattern
      if (matchers.componentPattern && component && !matchers.componentPattern.test(component)) {
        continue;
      }
      
      return pattern;
    }
    
    return null;
  }

  /**
   * Store error in history
   */
  private storeError(classification: ErrorClassification): void {
    this.errorHistory.push(classification);
    
    // Group by correlation ID
    if (classification.correlationId) {
      if (!this.correlationMap.has(classification.correlationId)) {
        this.correlationMap.set(classification.correlationId, []);
      }
      this.correlationMap.get(classification.correlationId)!.push(classification);
    }
    
    // Keep only recent errors (last 24 hours)
    const cutoff = Date.now() - 86400000;
    this.errorHistory = this.errorHistory.filter(e => e.timestamp.getTime() > cutoff);
    
    // Clean up correlation map
    for (const [correlationId, errors] of this.correlationMap.entries()) {
      const recentErrors = errors.filter(e => e.timestamp.getTime() > cutoff);
      if (recentErrors.length === 0) {
        this.correlationMap.delete(correlationId);
      } else {
        this.correlationMap.set(correlationId, recentErrors);
      }
    }
  }

  /**
   * Attempt error recovery
   */
  async attemptRecovery(classification: ErrorClassification): Promise<{
    success: boolean;
    strategy: string;
    attempts: number;
    message: string;
  }> {
    if (!classification.recoverable) {
      return {
        success: false,
        strategy: 'none',
        attempts: 0,
        message: 'Error is not recoverable'
      };
    }

    const recoveryStrategy = classification.context.recoveryStrategy as ErrorRecoveryStrategy;
    if (!recoveryStrategy) {
      return {
        success: false,
        strategy: 'none',
        attempts: 0,
        message: 'No recovery strategy defined'
      };
    }

    const attemptKey = `${classification.type}-${classification.component}`;
    const currentAttempts = this.recoveryAttempts.get(attemptKey) || 0;

    logger.info({
      errorId: classification.id,
      strategy: recoveryStrategy.type,
      attempt: currentAttempts + 1,
      maxRetries: recoveryStrategy.maxRetries
    }, 'Attempting error recovery');

    try {
      const result = await this.executeRecoveryStrategy(recoveryStrategy, classification, currentAttempts);
      
      if (result.success) {
        this.recoveryAttempts.delete(attemptKey);
        this.emit('recovery_success', { classification, result });
      } else {
        this.recoveryAttempts.set(attemptKey, currentAttempts + 1);
        this.emit('recovery_failed', { classification, result });
      }

      return result;

    } catch (error) {
      const result = {
        success: false,
        strategy: recoveryStrategy.type,
        attempts: currentAttempts + 1,
        message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      this.recoveryAttempts.set(attemptKey, currentAttempts + 1);
      this.emit('recovery_failed', { classification, result, error });

      return result;
    }
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(
    strategy: ErrorRecoveryStrategy,
    classification: ErrorClassification,
    currentAttempts: number
  ): Promise<{
    success: boolean;
    strategy: string;
    attempts: number;
    message: string;
  }> {
    switch (strategy.type) {
      case 'retry':
        return this.executeRetryStrategy(strategy, classification, currentAttempts);
      
      case 'fallback':
        return this.executeFallbackStrategy(strategy, classification);
      
      case 'circuit_breaker':
        return this.executeCircuitBreakerStrategy(strategy, classification);
      
      case 'manual':
        return {
          success: false,
          strategy: 'manual',
          attempts: currentAttempts + 1,
          message: 'Manual intervention required'
        };
      
      case 'ignore':
        return {
          success: true,
          strategy: 'ignore',
          attempts: currentAttempts + 1,
          message: 'Error ignored as per strategy'
        };
      
      default:
        return {
          success: false,
          strategy: 'unknown',
          attempts: currentAttempts + 1,
          message: 'Unknown recovery strategy'
        };
    }
  }

  /**
   * Execute retry strategy
   */
  private async executeRetryStrategy(
    strategy: ErrorRecoveryStrategy,
    classification: ErrorClassification,
    currentAttempts: number
  ): Promise<{
    success: boolean;
    strategy: string;
    attempts: number;
    message: string;
  }> {
    const maxRetries = strategy.maxRetries || 3;
    const retryDelay = strategy.retryDelay || 1000;

    if (currentAttempts >= maxRetries) {
      return {
        success: false,
        strategy: 'retry',
        attempts: currentAttempts + 1,
        message: `Max retries (${maxRetries}) exceeded`
      };
    }

    // Wait before retry
    if (retryDelay > 0) {
      await this.sleep(retryDelay);
    }

    // Simulate retry logic (in real implementation, this would retry the original operation)
    const retrySuccess = Math.random() > 0.3; // 70% success rate for simulation

    return {
      success: retrySuccess,
      strategy: 'retry',
      attempts: currentAttempts + 1,
      message: retrySuccess ? 'Retry successful' : 'Retry failed'
    };
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallbackStrategy(
    strategy: ErrorRecoveryStrategy,
    classification: ErrorClassification
  ): Promise<{
    success: boolean;
    strategy: string;
    attempts: number;
    message: string;
  }> {
    const fallbackAction = strategy.fallbackAction || 'default_fallback';
    
    // Simulate fallback execution
    await this.sleep(500);
    
    return {
      success: true,
      strategy: 'fallback',
      attempts: 1,
      message: `Fallback action executed: ${fallbackAction}`
    };
  }

  /**
   * Execute circuit breaker strategy
   */
  private async executeCircuitBreakerStrategy(
    strategy: ErrorRecoveryStrategy,
    classification: ErrorClassification
  ): Promise<{
    success: boolean;
    strategy: string;
    attempts: number;
    message: string;
  }> {
    try {
      const { circuitBreakerManager } = await import('./circuit-breaker.service');
      
      const circuitName = `${classification.component}-${classification.type}`;
      const isOpen = circuitBreakerManager.isCircuitOpen(circuitName);
      
      if (isOpen) {
        return {
          success: false,
          strategy: 'circuit_breaker',
          attempts: 1,
          message: 'Circuit breaker is open'
        };
      }
      
      return {
        success: true,
        strategy: 'circuit_breaker',
        attempts: 1,
        message: 'Circuit breaker allowed operation'
      };
      
    } catch (error) {
      return {
        success: false,
        strategy: 'circuit_breaker',
        attempts: 1,
        message: 'Circuit breaker service unavailable'
      };
    }
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(timeRange: number = 3600000): ErrorMetrics {
    const cutoff = Date.now() - timeRange;
    const recentErrors = this.errorHistory.filter(e => e.timestamp.getTime() > cutoff);

    const errorsByType: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    const errorsByCategory: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    const errorsByComponent: Record<string, number> = {};

    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
    });

    // Calculate top errors
    const errorTypeCounts = Object.entries(errorsByType).map(([type, count]) => ({
      type: type as ErrorType,
      count,
      lastOccurrence: recentErrors
        .filter(e => e.type === type)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp || new Date()
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    return {
      totalErrors: recentErrors.length,
      errorsByType,
      errorsByCategory,
      errorsBySeverity,
      errorsByComponent,
      recoverySuccessRate: 0.75, // Simulated - would calculate from actual recovery attempts
      averageRecoveryTime: 2500, // Simulated - would calculate from actual recovery times
      topErrors: errorTypeCounts
    };
  }

  /**
   * Get errors by correlation ID
   */
  getErrorsByCorrelation(correlationId: string): ErrorClassification[] {
    return this.correlationMap.get(correlationId) || [];
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 100): ErrorClassification[] {
    return this.errorHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Add custom error pattern
   */
  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.set(pattern.id, pattern);
    logger.info({ patternId: pattern.id }, 'Custom error pattern added');
  }

  /**
   * Remove error pattern
   */
  removeErrorPattern(patternId: string): boolean {
    const removed = this.errorPatterns.delete(patternId);
    if (removed) {
      logger.info({ patternId }, 'Error pattern removed');
    }
    return removed;
  }

  /**
   * Get all error patterns
   */
  getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values());
  }

  /**
   * Health check for error classification service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    totalPatterns: number;
    recentErrors: number;
    recoverySuccessRate: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp.getTime() < 3600000
    ).length;

    if (recentErrors > 1000) {
      issues.push(`High error rate: ${recentErrors} errors in the last hour`);
    }

    const criticalErrors = this.errorHistory.filter(
      e => e.severity === ErrorSeverity.CRITICAL && 
           Date.now() - e.timestamp.getTime() < 3600000
    ).length;

    if (criticalErrors > 10) {
      issues.push(`High critical error rate: ${criticalErrors} critical errors in the last hour`);
    }

    const metrics = this.getErrorMetrics();

    return {
      healthy: issues.length === 0,
      totalPatterns: this.errorPatterns.size,
      recentErrors,
      recoverySuccessRate: metrics.recoverySuccessRate,
      issues
    };
  }

  /**
   * Utility function for sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the error classification service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down error classification service');
    this.removeAllListeners();
    logger.info('Error classification service shutdown complete');
  }
}

export const errorClassificationService = new ErrorClassificationService();