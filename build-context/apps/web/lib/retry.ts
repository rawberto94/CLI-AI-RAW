/**
 * Retry Utilities
 * Resilient API calls with exponential backoff and circuit breaker pattern
 * 
 * Cost: $0 - Pure utility functions
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd */
  jitter?: boolean;
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
  /** Custom retry condition */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback on each retry */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  timeout: 30000,
};

/**
 * Check if an error is retryable (network errors, 5xx, rate limits)
 */
function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP response errors
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    // Retry on 429 (rate limit), 502, 503, 504
    return status === 429 || status >= 502;
  }

  // Check error message for common retryable patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket hang up') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    );
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const clampedDelay = Math.min(exponentialDelay, maxDelay);
  
  if (jitter) {
    // Add random jitter between 0 and 50% of the delay
    const jitterAmount = clampedDelay * Math.random() * 0.5;
    return Math.round(clampedDelay + jitterAmount);
  }
  
  return Math.round(clampedDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Retry an async function with exponential backoff
 * 
 * @example
 * const data = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      const result = opts.timeout
        ? await withTimeout(fn(), opts.timeout)
        : await fn();
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = options?.shouldRetry
        ? options.shouldRetry(error, attempt)
        : isRetryableError(error);

      // Don't retry if this was the last attempt or error is not retryable
      if (attempt > opts.maxRetries || !shouldRetry) {
        throw error;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier,
        opts.jitter
      );

      // Call retry callback if provided
      if (options?.onRetry) {
        options.onRetry(error, attempt, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Simple circuit breaker implementation
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  threshold?: number;
  /** Time to wait before trying again (ms) */
  resetTimeout?: number;
  /** Unique identifier for this circuit */
  key: string;
}

/**
 * Execute a function with circuit breaker protection
 * 
 * @example
 * const result = await withCircuitBreaker(
 *   () => callExternalApi(),
 *   { key: 'external-api', threshold: 5, resetTimeout: 60000 }
 * );
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions
): Promise<T> {
  const { key, threshold = 5, resetTimeout = 60000 } = options;
  
  let state = circuitBreakers.get(key);
  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false };
    circuitBreakers.set(key, state);
  }

  // Check if circuit should be half-open (try again after timeout)
  if (state.isOpen && Date.now() - state.lastFailure > resetTimeout) {
    state.isOpen = false;
    state.failures = 0;
  }

  // If circuit is open, fail fast
  if (state.isOpen) {
    throw new Error(`Circuit breaker open for: ${key}`);
  }

  try {
    const result = await fn();
    // Success - reset failures
    state.failures = 0;
    return result;
  } catch (error) {
    // Record failure
    state.failures++;
    state.lastFailure = Date.now();

    // Open circuit if threshold reached
    if (state.failures >= threshold) {
      state.isOpen = true;
    }

    throw error;
  }
}

/**
 * Reset a circuit breaker
 */
export function resetCircuitBreaker(key: string): void {
  circuitBreakers.delete(key);
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(key: string): CircuitBreakerState | undefined {
  return circuitBreakers.get(key);
}

/**
 * Retry with circuit breaker - combines both patterns
 * 
 * @example
 * const data = await retryWithCircuitBreaker(
 *   () => fetch('/api/external').then(r => r.json()),
 *   { 
 *     retry: { maxRetries: 3 },
 *     circuitBreaker: { key: 'external-api', threshold: 5 }
 *   }
 * );
 */
export async function retryWithCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: {
    retry?: RetryOptions;
    circuitBreaker: CircuitBreakerOptions;
  }
): Promise<T> {
  return withCircuitBreaker(
    () => retry(fn, options.retry),
    options.circuitBreaker
  );
}

/**
 * Batch retry - retry multiple operations with shared backoff
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  options?: RetryOptions & { 
    /** Stop on first success */
    stopOnSuccess?: boolean;
    /** Continue even if some fail */
    continueOnError?: boolean;
  }
): Promise<Array<{ success: boolean; result?: T; error?: unknown }>> {
  const results: Array<{ success: boolean; result?: T; error?: unknown }> = [];

  for (const operation of operations) {
    try {
      const result = await retry(operation, options);
      results.push({ success: true, result });
      
      if (options?.stopOnSuccess) {
        break;
      }
    } catch (error) {
      results.push({ success: false, error });
      
      if (!options?.continueOnError) {
        break;
      }
    }
  }

  return results;
}

export default retry;
