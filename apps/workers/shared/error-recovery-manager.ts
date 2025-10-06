/**
 * Error Recovery Manager
 * Provides comprehensive error handling and recovery strategies
 */

// Error category enum
export enum ErrorCategory {
  CONFIGURATION = 'configuration',
  DEPENDENCY = 'dependency',
  VALIDATION = 'validation',
  PROCESSING = 'processing',
  EXTERNAL = 'external',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit'
}

// Error severity enum
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Recovery strategy interface
export interface RecoveryStrategy {
  name: string;
  canHandle: (error: ProcessingError) => boolean;
  execute: (error: ProcessingError, context: any) => Promise<any>;
  priority: number;
  maxRetries: number;
}

// Processing error interface
export interface ProcessingError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: Record<string, any>;
  suggestions: string[];
  retryable: boolean;
  originalError?: any;
  timestamp: Date;
  correlationId?: string;
}

// Recovery result interface
export interface RecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: ProcessingError;
  strategyUsed?: string;
  attemptsUsed: number;
  fallbackUsed: boolean;
  processingTime: number;
}

// Circuit breaker state
export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

/**
 * Error Recovery Manager
 * Handles error categorization, recovery strategies, and circuit breaking
 */
export class ErrorRecoveryManager {
  private recoveryStrategies: RecoveryStrategy[] = [];
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorHistory: ProcessingError[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Execute operation with comprehensive error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    recoveryStrategies: RecoveryStrategy[],
    context: any = {}
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now();
    let lastError: ProcessingError | null = null;
    let attemptsUsed = 0;
    let strategyUsed: string | undefined;
    let fallbackUsed = false;

    // Add custom strategies to the list
    const allStrategies = [...this.recoveryStrategies, ...recoveryStrategies]
      .sort((a, b) => b.priority - a.priority);

    try {
      // Try primary operation first
      attemptsUsed++;
      const result = await operation();
      
      return {
        success: true,
        data: result,
        attemptsUsed,
        fallbackUsed: false,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      lastError = this.categorizeError(error, context);
      this.recordError(lastError);
    }

    // Try recovery strategies
    for (const strategy of allStrategies) {
      if (!strategy.canHandle(lastError!)) {
        continue;
      }

      // Check circuit breaker
      if (this.isCircuitOpen(strategy.name)) {
        console.warn(`Circuit breaker open for strategy: ${strategy.name}`);
        continue;
      }

      for (let retry = 0; retry < strategy.maxRetries; retry++) {
        try {
          attemptsUsed++;
          console.log(`Attempting recovery with strategy: ${strategy.name}, retry: ${retry + 1}`);
          
          const result = await strategy.execute(lastError!, context);
          strategyUsed = strategy.name;
          fallbackUsed = true;
          
          // Reset circuit breaker on success
          this.resetCircuitBreaker(strategy.name);
          
          return {
            success: true,
            data: result,
            strategyUsed,
            attemptsUsed,
            fallbackUsed,
            processingTime: Date.now() - startTime
          };
        } catch (recoveryError) {
          lastError = this.categorizeError(recoveryError, { 
            ...context, 
            recoveryStrategy: strategy.name,
            retryAttempt: retry + 1
          });
          this.recordError(lastError);
          this.recordCircuitBreakerFailure(strategy.name);
          
          // Wait before retry
          if (retry < strategy.maxRetries - 1) {
            await this.delay(Math.pow(2, retry) * 1000);
          }
        }
      }
    }

    return {
      success: false,
      error: lastError!,
      attemptsUsed,
      fallbackUsed,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Handle LLM failure with fallback
   */
  async handleLLMFailure<T>(
    fallback: () => Promise<T>,
    context: string,
    error?: any
  ): Promise<T> {
    console.warn(`LLM operation failed for ${context}, using fallback:`, error);
    
    const processingError = this.categorizeError(error || new Error('LLM operation failed'), {
      context,
      operation: 'llm_fallback'
    });
    
    this.recordError(processingError);
    
    try {
      return await fallback();
    } catch (fallbackError) {
      const fallbackProcessingError = this.categorizeError(fallbackError, {
        context,
        operation: 'llm_fallback_failed'
      });
      this.recordError(fallbackProcessingError);
      throw new Error(`Both LLM and fallback failed for ${context}: ${error}, ${fallbackError}`);
    }
  }

  /**
   * Handle database failure with mock fallback
   */
  async handleDatabaseFailure<T>(
    operation: () => Promise<T>,
    mockFallback: () => Promise<T>,
    context: string = 'database operation'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Database operation failed for ${context}, using mock fallback:`, error);
      
      const processingError = this.categorizeError(error, {
        context,
        operation: 'database_fallback'
      });
      
      this.recordError(processingError);
      
      try {
        return await mockFallback();
      } catch (fallbackError) {
        const fallbackProcessingError = this.categorizeError(fallbackError, {
          context,
          operation: 'database_fallback_failed'
        });
        this.recordError(fallbackProcessingError);
        throw new Error(`Both database and mock fallback failed for ${context}: ${error}, ${fallbackError}`);
      }
    }
  }

  /**
   * Categorize error based on type and context
   */
  categorizeError(error: any, context: any = {}): ProcessingError {
    let category = ErrorCategory.PROCESSING;
    let severity = ErrorSeverity.MEDIUM;
    let retryable = true;
    let suggestions: string[] = [];

    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || 'UNKNOWN_ERROR';

    // Categorize based on error patterns
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.HIGH;
      suggestions.push('Check network connectivity', 'Verify service endpoints');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      category = ErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      suggestions.push('Increase timeout values', 'Check service performance');
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      category = ErrorCategory.RATE_LIMIT;
      severity = ErrorSeverity.LOW;
      suggestions.push('Implement rate limiting', 'Add retry with backoff');
    } else if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.MEDIUM;
      retryable = false;
      suggestions.push('Check data format', 'Validate input parameters');
    } else if (errorMessage.includes('configuration') || errorMessage.includes('config')) {
      category = ErrorCategory.CONFIGURATION;
      severity = ErrorSeverity.HIGH;
      retryable = false;
      suggestions.push('Check configuration settings', 'Verify environment variables');
    } else if (errorMessage.includes('not found') || errorMessage.includes('missing')) {
      category = ErrorCategory.DEPENDENCY;
      severity = ErrorSeverity.HIGH;
      suggestions.push('Check dependencies', 'Verify file paths');
    }

    return {
      code: errorCode,
      message: errorMessage,
      category,
      severity,
      context,
      suggestions,
      retryable,
      originalError: error,
      timestamp: new Date(),
      correlationId: context.correlationId
    };
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: ProcessingError[];
  } {
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    for (const error of this.errorHistory) {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }

    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: this.errorHistory.slice(-10)
    };
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Retry strategy for network errors
    this.addRecoveryStrategy({
      name: 'network-retry',
      canHandle: (error) => error.category === ErrorCategory.NETWORK,
      execute: async (error, context) => {
        await this.delay(2000);
        throw new Error('Retry needed - network error recovery');
      },
      priority: 8,
      maxRetries: 3
    });

    // Timeout retry strategy
    this.addRecoveryStrategy({
      name: 'timeout-retry',
      canHandle: (error) => error.category === ErrorCategory.TIMEOUT,
      execute: async (error, context) => {
        await this.delay(1000);
        throw new Error('Retry needed - timeout recovery');
      },
      priority: 7,
      maxRetries: 2
    });

    // Rate limit backoff strategy
    this.addRecoveryStrategy({
      name: 'rate-limit-backoff',
      canHandle: (error) => error.category === ErrorCategory.RATE_LIMIT,
      execute: async (error, context) => {
        await this.delay(5000);
        throw new Error('Retry needed - rate limit recovery');
      },
      priority: 6,
      maxRetries: 3
    });

    // Dependency fallback strategy
    this.addRecoveryStrategy({
      name: 'dependency-fallback',
      canHandle: (error) => error.category === ErrorCategory.DEPENDENCY,
      execute: async (error, context) => {
        console.log('Using dependency fallback for:', error.message);
        return { fallback: true, message: 'Using fallback implementation' };
      },
      priority: 5,
      maxRetries: 1
    });
  }

  /**
   * Circuit breaker management
   */
  private isCircuitOpen(strategyName: string): boolean {
    const state = this.circuitBreakers.get(strategyName);
    if (!state) return false;

    if (state.isOpen) {
      // Check if we should try again
      if (Date.now() > state.nextRetryTime) {
        state.isOpen = false;
        state.failureCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private recordCircuitBreakerFailure(strategyName: string): void {
    let state = this.circuitBreakers.get(strategyName);
    if (!state) {
      state = { isOpen: false, failureCount: 0, lastFailureTime: 0, nextRetryTime: 0 };
      this.circuitBreakers.set(strategyName, state);
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    // Open circuit after 5 failures
    if (state.failureCount >= 5) {
      state.isOpen = true;
      state.nextRetryTime = Date.now() + (60000 * Math.pow(2, Math.min(state.failureCount - 5, 5))); // Exponential backoff
      console.warn(`Circuit breaker opened for strategy: ${strategyName}`);
    }
  }

  private resetCircuitBreaker(strategyName: string): void {
    const state = this.circuitBreakers.get(strategyName);
    if (state) {
      state.isOpen = false;
      state.failureCount = 0;
      state.lastFailureTime = 0;
      state.nextRetryTime = 0;
    }
  }

  /**
   * Record error in history
   */
  private recordError(error: ProcessingError): void {
    this.errorHistory.push(error);
    
    // Maintain history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
let errorRecoveryManager: ErrorRecoveryManager | null = null;

/**
 * Get shared error recovery manager instance
 */
export function getErrorRecoveryManager(): ErrorRecoveryManager {
  if (!errorRecoveryManager) {
    errorRecoveryManager = new ErrorRecoveryManager();
  }
  return errorRecoveryManager;
}

/**
 * Convenience functions
 */
export const executeWithRecovery = <T>(
  operation: () => Promise<T>,
  strategies: RecoveryStrategy[] = [],
  context: any = {}
) => getErrorRecoveryManager().executeWithRecovery(operation, strategies, context);

export const handleLLMFailure = <T>(
  fallback: () => Promise<T>,
  context: string,
  error?: any
) => getErrorRecoveryManager().handleLLMFailure(fallback, context, error);

export const handleDatabaseFailure = <T>(
  operation: () => Promise<T>,
  mockFallback: () => Promise<T>,
  context?: string
) => getErrorRecoveryManager().handleDatabaseFailure(operation, mockFallback, context);