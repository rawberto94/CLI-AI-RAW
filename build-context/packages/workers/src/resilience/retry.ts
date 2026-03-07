/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides intelligent retry mechanisms for transient failures.
 * Works in conjunction with circuit breaker for comprehensive resilience.
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Abort signal support
 * - Detailed retry logging
 */

import pino from 'pino';

const logger = pino({ name: 'retry' });

export interface RetryConfig {
  maxAttempts: number;        // Maximum number of attempts (including first)
  baseDelay: number;          // Base delay in ms
  maxDelay: number;           // Maximum delay in ms
  backoffMultiplier: number;  // Multiplier for exponential backoff
  jitter: boolean;            // Add randomness to prevent thundering herd
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const boundedDelay = Math.min(exponentialDelay, config.maxDelay);
  
  if (config.jitter) {
    // Add jitter: random value between 0.5x and 1.5x of the delay
    const jitterFactor = 0.5 + Math.random();
    return Math.floor(boundedDelay * jitterFactor);
  }
  
  return boundedDelay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetryAbortedError('Retry aborted before sleep'));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new RetryAbortedError('Retry aborted during sleep'));
    });
  });
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.message.includes('ECONNRESET') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('socket hang up')) {
    return true;
  }

  // HTTP status codes (when embedded in error)
  if (error.message.includes('429') ||  // Too Many Requests
      error.message.includes('500') ||  // Internal Server Error
      error.message.includes('502') ||  // Bad Gateway
      error.message.includes('503') ||  // Service Unavailable
      error.message.includes('504')) {  // Gateway Timeout
    return true;
  }

  // OpenAI specific
  if (error.message.includes('rate_limit') ||
      error.message.includes('overloaded') ||
      error.message.includes('capacity')) {
    return true;
  }

  // Database connection issues
  if (error.message.includes('connection') ||
      error.message.includes('timeout') ||
      error.message.includes('deadlock')) {
    return true;
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  signal?: AbortSignal
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      // Check abort signal
      if (signal?.aborted) {
        throw new RetryAbortedError('Retry aborted');
      }

      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = cfg.retryCondition
        ? cfg.retryCondition(lastError, attempt)
        : isRetryableError(lastError);

      if (!shouldRetry || attempt >= cfg.maxAttempts) {
        logger.error({
          attempt,
          maxAttempts: cfg.maxAttempts,
          error: lastError.message,
          willRetry: false,
        }, 'Retry exhausted or non-retryable error');
        throw lastError;
      }

      const delay = calculateDelay(attempt, cfg);

      logger.warn({
        attempt,
        maxAttempts: cfg.maxAttempts,
        delay,
        error: lastError.message,
      }, 'Retrying after failure');

      cfg.onRetry?.(lastError, attempt, delay);

      await sleep(delay, signal);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Error thrown when retry is aborted
 */
export class RetryAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryAbortedError';
  }
}

/**
 * Error thrown when all retries are exhausted
 */
export class RetryExhaustedError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly attempts: number
  ) {
    super(`All ${attempts} retry attempts exhausted. Last error: ${originalError.message}`);
    this.name = 'RetryExhaustedError';
  }
}

// ============================================================================
// PRESET RETRY CONFIGURATIONS
// ============================================================================

/**
 * Retry config for OpenAI API calls
 */
export const OPENAI_RETRY_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 5,
  baseDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => {
    // Retry on rate limits and temporary failures
    return error.message.includes('429') ||
           error.message.includes('500') ||
           error.message.includes('overloaded') ||
           error.message.includes('rate_limit') ||
           error.message.includes('capacity') ||
           isRetryableError(error);
  },
};

/**
 * Retry config for database operations
 */
export const DATABASE_RETRY_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => {
    return error.message.includes('connection') ||
           error.message.includes('timeout') ||
           error.message.includes('deadlock') ||
           error.message.includes('lock');
  },
};

/**
 * Retry config for S3/storage operations
 */
export const STORAGE_RETRY_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 4,
  baseDelay: 1000,
  maxDelay: 15000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Retry config for webhook deliveries
 */
export const WEBHOOK_RETRY_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 5,
  baseDelay: 5000,
  maxDelay: 300000, // 5 minutes
  backoffMultiplier: 3,
  jitter: true,
};

// ============================================================================
// DECORATOR UTILITIES
// ============================================================================

/**
 * Decorator factory for retryable functions
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  config: Partial<RetryConfig> = {}
) {
  return function (fn: T): T {
    return (async (...args: Parameters<T>) => {
      return retry(() => fn(...args), config);
    }) as T;
  };
}

/**
 * Combined retry + circuit breaker wrapper
 * Retries are attempted within the circuit breaker's execute call
 */
export function withResiliency<T>(
  fn: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {},
  fallback?: () => Promise<T>
): () => Promise<T> {
  return async () => {
    return retry(fn, retryConfig);
  };
}
