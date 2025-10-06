/**
 * Comprehensive Error Handling and Recovery Service
 * Handles processing errors with retry logic and recovery mechanisms
 */

import { EventEmitter } from 'events';

export interface ProcessingError {
  id: string;
  jobId: string;
  stage: string;
  error: Error;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  recoverable: boolean;
  context: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface RecoveryAction {
  type: 'retry' | 'skip' | 'manual' | 'fallback';
  description: string;
  automated: boolean;
  handler?: () => Promise<any>;
}

export class ErrorHandler extends EventEmitter {
  private errors = new Map<string, ProcessingError>();
  private retryQueues = new Map<string, NodeJS.Timeout>();
  
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'TEMPORARY_FAILURE',
      'RATE_LIMIT_ERROR',
      'SERVICE_UNAVAILABLE'
    ]
  };

  constructor() {
    super();
  }

  /**
   * Handle a processing error
   */
  async handleError(
    jobId: string,
    stage: string,
    error: Error,
    context: Record<string, any> = {},
    retryConfig?: Partial<RetryConfig>
  ): Promise<RecoveryAction> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    const errorId = `${jobId}_${stage}_${Date.now()}`;
    
    const processingError: ProcessingError = {
      id: errorId,
      jobId,
      stage,
      error,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: config.maxRetries,
      recoverable: this.isRecoverable(error, config),
      context
    };

    this.errors.set(errorId, processingError);
    this.emit('error:occurred', processingError);

    // Determine recovery action
    const action = await this.determineRecoveryAction(processingError, config);
    
    // Execute recovery action
    if (action.automated && action.handler) {
      try {
        await action.handler();
        this.emit('error:recovered', processingError, action);
      } catch (recoveryError) {
        this.emit('error:recovery_failed', processingError, recoveryError);
        return { type: 'manual', description: 'Automatic recovery failed, manual intervention required', automated: false };
      }
    }

    return action;
  }

  /**
   * Retry a failed operation
   */
  async retryOperation(
    errorId: string,
    operation: () => Promise<any>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<any> {
    const processingError = this.errors.get(errorId);
    if (!processingError) {
      throw new Error(`Error ${errorId} not found`);
    }

    const config = { ...this.defaultRetryConfig, ...retryConfig };
    
    if (processingError.retryCount >= processingError.maxRetries) {
      throw new Error(`Maximum retries (${processingError.maxRetries}) exceeded for ${errorId}`);
    }

    processingError.retryCount++;
    this.emit('error:retry_attempt', processingError);

    try {
      const result = await this.executeWithTimeout(operation, 30000); // 30 second timeout
      this.emit('error:retry_success', processingError);
      return result;
    } catch (error) {
      this.emit('error:retry_failed', processingError, error);
      
      if (processingError.retryCount < processingError.maxRetries) {
        // Schedule next retry with exponential backoff
        const delay = this.calculateBackoffDelay(processingError.retryCount, config);
        await this.scheduleRetry(errorId, operation, delay, retryConfig);
      } else {
        throw new Error(`All retries exhausted for ${errorId}: ${error.message}`);
      }
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byStage: Record<string, number>;
    byType: Record<string, number>;
    recoverable: number;
    unrecoverable: number;
  } {
    const errors = Array.from(this.errors.values());
    
    const byStage: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let recoverable = 0;
    let unrecoverable = 0;

    errors.forEach(error => {
      byStage[error.stage] = (byStage[error.stage] || 0) + 1;
      byType[error.error.name] = (byType[error.error.name] || 0) + 1;
      
      if (error.recoverable) {
        recoverable++;
      } else {
        unrecoverable++;
      }
    });

    return {
      total: errors.length,
      byStage,
      byType,
      recoverable,
      unrecoverable
    };
  }

  /**
   * Get errors for a specific job
   */
  getJobErrors(jobId: string): ProcessingError[] {
    return Array.from(this.errors.values()).filter(error => error.jobId === jobId);
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(olderThan: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)): number {
    let cleared = 0;
    
    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < olderThan) {
        this.errors.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverable(error: Error, config: RetryConfig): boolean {
    // Check if error type is in retryable list
    if (config.retryableErrors.includes(error.name)) {
      return true;
    }

    // Check error message for recoverable patterns
    const recoverablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /rate limit/i,
      /service unavailable/i,
      /try again/i
    ];

    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Determine the appropriate recovery action
   */
  private async determineRecoveryAction(
    processingError: ProcessingError,
    config: RetryConfig
  ): Promise<RecoveryAction> {
    if (!processingError.recoverable) {
      return {
        type: 'manual',
        description: 'Error is not recoverable, manual intervention required',
        automated: false
      };
    }

    if (processingError.retryCount >= processingError.maxRetries) {
      return {
        type: 'manual',
        description: 'Maximum retries exceeded, manual intervention required',
        automated: false
      };
    }

    // Determine action based on error type and stage
    switch (processingError.stage) {
      case 'text_extraction':
        return this.getTextExtractionRecoveryAction(processingError);
      
      case 'financial_analysis':
      case 'risk_assessment':
      case 'compliance_check':
      case 'clause_extraction':
        return this.getAnalysisRecoveryAction(processingError);
      
      case 'search_indexing':
        return this.getSearchIndexingRecoveryAction(processingError);
      
      default:
        return {
          type: 'retry',
          description: 'Retry operation with exponential backoff',
          automated: true,
          handler: async () => {
            const delay = this.calculateBackoffDelay(processingError.retryCount + 1, config);
            await this.delay(delay);
          }
        };
    }
  }

  /**
   * Get recovery action for text extraction errors
   */
  private getTextExtractionRecoveryAction(error: ProcessingError): RecoveryAction {
    if (error.error.message.includes('OCR')) {
      return {
        type: 'fallback',
        description: 'OCR failed, fallback to direct text extraction',
        automated: true,
        handler: async () => {
          // Implement fallback text extraction without OCR
          console.log('Falling back to direct text extraction');
        }
      };
    }

    if (error.error.message.includes('file format')) {
      return {
        type: 'manual',
        description: 'Unsupported file format, manual conversion required',
        automated: false
      };
    }

    return {
      type: 'retry',
      description: 'Retry text extraction with different parameters',
      automated: true
    };
  }

  /**
   * Get recovery action for analysis errors
   */
  private getAnalysisRecoveryAction(error: ProcessingError): RecoveryAction {
    if (error.error.message.includes('insufficient data')) {
      return {
        type: 'fallback',
        description: 'Use simplified analysis due to insufficient data',
        automated: true,
        handler: async () => {
          // Implement simplified analysis
          console.log('Using simplified analysis approach');
        }
      };
    }

    return {
      type: 'retry',
      description: 'Retry analysis with adjusted parameters',
      automated: true
    };
  }

  /**
   * Get recovery action for search indexing errors
   */
  private getSearchIndexingRecoveryAction(error: ProcessingError): RecoveryAction {
    if (error.error.message.includes('embedding')) {
      return {
        type: 'fallback',
        description: 'Use keyword-based indexing instead of embeddings',
        automated: true,
        handler: async () => {
          // Implement keyword-based fallback
          console.log('Using keyword-based indexing fallback');
        }
      };
    }

    return {
      type: 'retry',
      description: 'Retry search indexing',
      automated: true
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Schedule a retry operation
   */
  private async scheduleRetry(
    errorId: string,
    operation: () => Promise<any>,
    delay: number,
    retryConfig?: Partial<RetryConfig>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          await this.retryOperation(errorId, operation, retryConfig);
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          this.retryQueues.delete(errorId);
        }
      }, delay);

      this.retryQueues.set(errorId, timeout);
    });
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create circuit breaker for repeated failures
   */
  createCircuitBreaker(
    operation: () => Promise<any>,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    } = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    }
  ) {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (...args: any[]) => {
      const now = Date.now();

      // Reset failure count if monitoring period has passed
      if (now - lastFailureTime > options.monitoringPeriod) {
        failures = 0;
      }

      // Check circuit breaker state
      if (state === 'OPEN') {
        if (now - lastFailureTime > options.resetTimeout) {
          state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit breaker is OPEN - operation blocked');
        }
      }

      try {
        const result = await operation.apply(this, args);
        
        // Reset on success
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= options.failureThreshold) {
          state = 'OPEN';
          this.emit('circuit_breaker:opened', { failures, error });
        }

        throw error;
      }
    };
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();