/**
 * Error Handler Service
 * Centralized error handling with recovery and logging
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { errorClassificationService, ErrorClassification } from './error-classification.service';

const logger = pino({ name: 'error-handler' });

export interface ErrorHandlerConfig {
  enableRecovery: boolean;
  enableUserNotification: boolean;
  enableMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxRecoveryAttempts: number;
  recoveryTimeout: number;
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  component: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: {
    id: string;
    type: string;
    message: string;
    userMessage?: string;
    code?: string;
    details?: Record<string, any>;
    timestamp: string;
    correlationId?: string;
  };
  recovery?: {
    attempted: boolean;
    successful: boolean;
    strategy: string;
    attempts: number;
  };
}

export class ErrorHandlerService extends EventEmitter {
  private config: ErrorHandlerConfig;
  private errorCounts = new Map<string, number>();
  private lastErrorTime = new Map<string, Date>();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = {
      enableRecovery: true,
      enableUserNotification: true,
      enableMetrics: true,
      logLevel: 'error',
      maxRecoveryAttempts: 3,
      recoveryTimeout: 30000,
      ...config
    };
  }

  /**
   * Handle error with classification and recovery
   */
  async handleError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorResponse> {
    const startTime = Date.now();
    
    // Generate correlation ID if not provided
    const correlationId = context.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Classify the error
      const classification = errorClassificationService.classifyError(error, {
        component: context.component,
        correlationId,
        userId: context.userId,
        tenantId: context.tenantId,
        additionalContext: {
          operation: context.operation,
          ...context.metadata
        }
      });

      // Track error frequency
      this.trackErrorFrequency(classification);

      // Attempt recovery if enabled and error is recoverable
      let recoveryResult = null;
      if (this.config.enableRecovery && classification.recoverable) {
        recoveryResult = await this.attemptRecovery(classification);
      }

      // Generate user-friendly message
      const userMessage = this.generateUserMessage(classification);

      // Create error response
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          id: classification.id,
          type: classification.type,
          message: classification.userFacing ? userMessage : classification.message,
          userMessage: classification.userFacing ? userMessage : undefined,
          code: this.getErrorCode(classification),
          details: this.getErrorDetails(classification),
          timestamp: classification.timestamp.toISOString(),
          correlationId: classification.correlationId
        },
        recovery: recoveryResult ? {
          attempted: true,
          successful: recoveryResult.success,
          strategy: recoveryResult.strategy,
          attempts: recoveryResult.attempts
        } : undefined
      };

      // Log error
      this.logError(classification, recoveryResult, Date.now() - startTime);

      // Emit error event
      this.emit('error_handled', {
        classification,
        recovery: recoveryResult,
        response: errorResponse,
        context
      });

      // Send notifications if enabled
      if (this.config.enableUserNotification && this.shouldNotifyUser(classification)) {
        this.sendUserNotification(classification, context);
      }

      return errorResponse;

    } catch (handlingError) {
      // Error in error handling - create fallback response
      logger.error({
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error',
        context
      }, 'Error occurred while handling error');

      return {
        success: false,
        error: {
          id: `fallback-${Date.now()}`,
          type: 'system_error',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          correlationId
        }
      };
    }
  }

  /**
   * Track error frequency for pattern detection
   */
  private trackErrorFrequency(classification: ErrorClassification): void {
    const key = `${classification.type}-${classification.component}`;
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);
    this.lastErrorTime.set(key, classification.timestamp);

    // Check for error spikes
    if (currentCount > 10) {
      const lastTime = this.lastErrorTime.get(key);
      if (lastTime && Date.now() - lastTime.getTime() < 300000) { // 5 minutes
        this.emit('error_spike_detected', {
          errorType: classification.type,
          component: classification.component,
          count: currentCount,
          timeWindow: '5 minutes'
        });
      }
    }
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(classification: ErrorClassification): Promise<{
    success: boolean;
    strategy: string;
    attempts: number;
    message: string;
  } | null> {
    try {
      const recoveryResult = await Promise.race([
        errorClassificationService.attemptRecovery(classification),
        this.createTimeoutPromise(this.config.recoveryTimeout)
      ]);

      return recoveryResult;
    } catch (error) {
      logger.warn({
        errorId: classification.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Recovery attempt failed');

      return {
        success: false,
        strategy: 'timeout',
        attempts: 1,
        message: 'Recovery attempt timed out'
      };
    }
  }

  /**
   * Create timeout promise for recovery attempts
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Recovery timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(classification: ErrorClassification): string {
    const messageMap: Record<string, string> = {
      'file_validation_error': 'The uploaded file is invalid. Please check the file format and try again.',
      'file_upload_error': 'There was a problem uploading your file. Please try again.',
      'auth_error': 'Authentication failed. Please log in again.',
      'token_expired': 'Your session has expired. Please log in again.',
      'permission_denied': 'You do not have permission to perform this action.',
      'database_connection': 'We are experiencing technical difficulties. Please try again in a few moments.',
      'llm_rate_limit': 'Our AI service is currently busy. Please try again in a few minutes.',
      'worker_timeout': 'Processing is taking longer than expected. Please check back later.',
      'network_error': 'Network connection issue. Please check your connection and try again.',
      'system_error': 'An unexpected error occurred. Our team has been notified.'
    };

    return messageMap[classification.type] || 'An error occurred while processing your request.';
  }

  /**
   * Get error code for API responses
   */
  private getErrorCode(classification: ErrorClassification): string {
    const codeMap: Record<string, string> = {
      'file_validation_error': 'INVALID_FILE',
      'file_upload_error': 'UPLOAD_FAILED',
      'auth_error': 'AUTH_FAILED',
      'token_expired': 'TOKEN_EXPIRED',
      'permission_denied': 'ACCESS_DENIED',
      'database_connection': 'SERVICE_UNAVAILABLE',
      'llm_rate_limit': 'RATE_LIMITED',
      'worker_timeout': 'PROCESSING_TIMEOUT',
      'network_error': 'NETWORK_ERROR',
      'system_error': 'INTERNAL_ERROR'
    };

    return codeMap[classification.type] || 'UNKNOWN_ERROR';
  }

  /**
   * Get error details for debugging
   */
  private getErrorDetails(classification: ErrorClassification): Record<string, any> | undefined {
    if (classification.userFacing) {
      return undefined; // Don't expose internal details to users
    }

    return {
      component: classification.component,
      category: classification.category,
      severity: classification.severity,
      recoverable: classification.recoverable,
      retryable: classification.retryable,
      pattern: classification.context.pattern
    };
  }

  /**
   * Log error with appropriate level
   */
  private logError(
    classification: ErrorClassification,
    recoveryResult: any,
    handlingTime: number
  ): void {
    const logData = {
      errorId: classification.id,
      type: classification.type,
      category: classification.category,
      severity: classification.severity,
      component: classification.component,
      message: classification.message,
      correlationId: classification.correlationId,
      userId: classification.userId,
      tenantId: classification.tenantId,
      recoverable: classification.recoverable,
      recovery: recoveryResult ? {
        attempted: true,
        successful: recoveryResult.success,
        strategy: recoveryResult.strategy
      } : { attempted: false },
      handlingTime
    };

    switch (classification.severity) {
      case 'critical':
        logger.fatal(logData, 'Critical error occurred');
        break;
      case 'high':
        logger.error(logData, 'High severity error occurred');
        break;
      case 'medium':
        logger.warn(logData, 'Medium severity error occurred');
        break;
      case 'low':
        logger.info(logData, 'Low severity error occurred');
        break;
      default:
        logger.error(logData, 'Error occurred');
    }
  }

  /**
   * Determine if user should be notified
   */
  private shouldNotifyUser(classification: ErrorClassification): boolean {
    // Notify for critical errors or user-facing errors
    return classification.severity === 'critical' || 
           classification.userFacing ||
           classification.category === 'security';
  }

  /**
   * Send user notification
   */
  private sendUserNotification(
    classification: ErrorClassification,
    context: ErrorContext
  ): void {
    // In a real implementation, this would send notifications via email, SMS, etc.
    this.emit('user_notification_required', {
      classification,
      context,
      message: this.generateUserMessage(classification)
    });

    logger.info({
      errorId: classification.id,
      userId: context.userId,
      tenantId: context.tenantId,
      severity: classification.severity
    }, 'User notification sent');
  }

  /**
   * Create Express/Fastify error handler middleware
   */
  createMiddleware() {
    return async (error: Error, request: any, reply: any, next?: any) => {
      const context: ErrorContext = {
        requestId: request.id || request.headers['x-request-id'],
        userId: request.user?.id || request.headers['x-user-id'],
        tenantId: request.tenant?.id || request.headers['x-tenant-id'],
        component: 'api',
        operation: `${request.method} ${request.url}`,
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          method: request.method,
          url: request.url,
          params: request.params,
          query: request.query
        }
      };

      const errorResponse = await this.handleError(error, context);

      // Set appropriate HTTP status code
      const statusCode = this.getHttpStatusCode(errorResponse.error.type);
      
      if (reply.status) {
        // Fastify
        reply.status(statusCode).send(errorResponse);
      } else if (reply.status) {
        // Express
        reply.status(statusCode).json(errorResponse);
      }

      if (next) {
        next();
      }
    };
  }

  /**
   * Get HTTP status code for error type
   */
  private getHttpStatusCode(errorType: string): number {
    const statusMap: Record<string, number> = {
      'auth_error': 401,
      'token_expired': 401,
      'permission_denied': 403,
      'file_validation_error': 400,
      'input_validation': 400,
      'schema_validation': 400,
      'business_rule_violation': 400,
      'file_upload_error': 400,
      'llm_rate_limit': 429,
      'worker_queue_full': 503,
      'database_connection': 503,
      'network_error': 503,
      'timeout_error': 504,
      'worker_timeout': 504,
      'system_error': 500
    };

    return statusMap[errorType] || 500;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByComponent: Record<string, number>;
    recentErrorRate: number;
    topErrors: Array<{ type: string; count: number; lastOccurrence: Date }>;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Get recent error counts
    const recentErrors = Array.from(this.errorCounts.entries())
      .filter(([key]) => {
        const lastTime = this.lastErrorTime.get(key);
        return lastTime && lastTime.getTime() > oneHourAgo;
      });

    const totalErrors = recentErrors.reduce((sum, [, count]) => sum + count, 0);

    const errorsByType: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};

    recentErrors.forEach(([key, count]) => {
      const [type, component] = key.split('-');
      errorsByType[type] = (errorsByType[type] || 0) + count;
      errorsByComponent[component] = (errorsByComponent[component] || 0) + count;
    });

    const topErrors = recentErrors
      .map(([key, count]) => {
        const [type] = key.split('-');
        return {
          type,
          count,
          lastOccurrence: this.lastErrorTime.get(key) || new Date()
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorsByType,
      errorsByComponent,
      recentErrorRate: totalErrors / 60, // Errors per minute
      topErrors
    };
  }

  /**
   * Health check for error handler service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    recentErrors: number;
    errorRate: number;
    recoveryEnabled: boolean;
    issues: string[];
  }> {
    const stats = this.getErrorStatistics();
    const issues: string[] = [];

    if (stats.recentErrorRate > 10) {
      issues.push(`High error rate: ${stats.recentErrorRate.toFixed(2)} errors/minute`);
    }

    const criticalErrors = Object.entries(stats.errorsByType)
      .filter(([type]) => type.includes('critical') || type.includes('system'))
      .reduce((sum, [, count]) => sum + count, 0);

    if (criticalErrors > 5) {
      issues.push(`High critical error count: ${criticalErrors} in the last hour`);
    }

    return {
      healthy: issues.length === 0,
      recentErrors: stats.totalErrors,
      errorRate: stats.recentErrorRate,
      recoveryEnabled: this.config.enableRecovery,
      issues
    };
  }

  /**
   * Shutdown the error handler service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down error handler service');
    this.removeAllListeners();
    logger.info('Error handler service shutdown complete');
  }
}

export const errorHandlerService = new ErrorHandlerService({
  enableRecovery: true,
  enableUserNotification: true,
  enableMetrics: true,
  logLevel: 'error',
  maxRecoveryAttempts: 3,
  recoveryTimeout: 30000
});