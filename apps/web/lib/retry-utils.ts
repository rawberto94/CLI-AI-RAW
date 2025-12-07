/**
 * Smart Retry Utilities
 * 
 * Provides robust retry mechanisms with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Circuit breaker pattern
 * - Retry budgets
 */

// =====================
// Types
// =====================

interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in ms */
  initialDelay?: number;
  /** Maximum delay in ms */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Add random jitter to delays */
  jitter?: boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Should retry for this error? */
  shouldRetry?: (error: Error) => boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit */
  resetTimeout?: number;
  /** Callback when circuit opens */
  onOpen?: () => void;
  /** Callback when circuit closes */
  onClose?: () => void;
}

type CircuitState = 'closed' | 'open' | 'half-open';

// =====================
// Retry with Exponential Backoff
// =====================

/**
 * Retry a function with exponential backoff
 * 
 * @example
 * const result = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    onRetry,
    shouldRetry = defaultShouldRetry,
    signal,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for abort
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Calculate delay with jitter
      let actualDelay = Math.min(delay, maxDelay);
      if (jitter) {
        actualDelay = actualDelay * (0.5 + Math.random());
      }

      // Notify retry callback
      if (onRetry) {
        onRetry(attempt + 1, lastError, actualDelay);
      }

      // Wait before retry
      await sleep(actualDelay, signal);

      // Increase delay for next attempt
      delay *= backoffMultiplier;
    }
  }

  throw lastError!;
}

/**
 * Default retry condition - retry on network and 5xx errors
 */
function defaultShouldRetry(error: Error): boolean {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  // HTTP errors - only retry 5xx
  if ('status' in error) {
    const status = (error as unknown as { status: number }).status;
    return status >= 500 && status < 600;
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Sleep utility with abort support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }
  });
}

// =====================
// Circuit Breaker
// =====================

/**
 * Circuit breaker to prevent cascading failures
 * 
 * @example
 * const breaker = createCircuitBreaker({ failureThreshold: 5 });
 * 
 * async function fetchData() {
 *   return breaker.call(() => fetch('/api/data'));
 * }
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}) {
  const {
    failureThreshold = 5,
    resetTimeout = 30000,
    onOpen,
    onClose,
  } = options;

  let state: CircuitState = 'closed';
  let failures = 0;
  let lastFailure: number | null = null;
  let successesSinceHalfOpen = 0;

  return {
    get state() {
      return state;
    },

    get failures() {
      return failures;
    },

    async call<T>(fn: () => Promise<T>): Promise<T> {
      // Check circuit state
      if (state === 'open') {
        // Check if we should try half-open
        if (lastFailure && Date.now() - lastFailure >= resetTimeout) {
          state = 'half-open';
          successesSinceHalfOpen = 0;
        } else {
          throw new CircuitOpenError('Circuit breaker is open');
        }
      }

      try {
        const result = await fn();

        // Success - reset or close circuit
        if (state === 'half-open') {
          successesSinceHalfOpen++;
          if (successesSinceHalfOpen >= 2) {
            state = 'closed';
            failures = 0;
            onClose?.();
          }
        } else {
          failures = 0;
        }

        return result;
      } catch (error) {
        failures++;
        lastFailure = Date.now();

        // Open circuit if threshold exceeded
        if (failures >= failureThreshold && state === 'closed') {
          state = 'open';
          onOpen?.();
        }

        // Half-open failure goes back to open
        if (state === 'half-open') {
          state = 'open';
        }

        throw error;
      }
    },

    reset() {
      state = 'closed';
      failures = 0;
      lastFailure = null;
      successesSinceHalfOpen = 0;
    },
  };
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// =====================
// Retry Budget
// =====================

/**
 * Limits retries across multiple operations to prevent overload
 * 
 * @example
 * const budget = createRetryBudget({ maxRetries: 10, windowMs: 60000 });
 * 
 * async function fetchWithBudget() {
 *   return retry(fetchData, {
 *     shouldRetry: (error) => budget.canRetry() && isRetryable(error),
 *     onRetry: () => budget.recordRetry(),
 *   });
 * }
 */
export function createRetryBudget(options: {
  /** Maximum retries allowed in the window */
  maxRetries: number;
  /** Time window in ms */
  windowMs: number;
}) {
  const { maxRetries, windowMs } = options;
  const retryTimestamps: number[] = [];

  return {
    canRetry(): boolean {
      const now = Date.now();
      // Remove old timestamps
      while (retryTimestamps.length > 0 && (retryTimestamps[0] ?? 0) < now - windowMs) {
        retryTimestamps.shift();
      }
      return retryTimestamps.length < maxRetries;
    },

    recordRetry(): void {
      retryTimestamps.push(Date.now());
    },

    get remaining(): number {
      const now = Date.now();
      const recent = retryTimestamps.filter(t => t >= now - windowMs);
      return Math.max(0, maxRetries - recent.length);
    },

    reset(): void {
      retryTimestamps.length = 0;
    },
  };
}

// =====================
// Fetch with Retry
// =====================

/**
 * Fetch wrapper with built-in retry
 * 
 * @example
 * const data = await fetchWithRetry('/api/data', {
 *   retryOptions: { maxRetries: 3 },
 * });
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { retryOptions?: RetryOptions } = {}
): Promise<Response> {
  const { retryOptions, ...fetchOptions } = options;

  return retry(
    async () => {
      const response = await fetch(url, fetchOptions);

      // Throw on 5xx to trigger retry
      if (response.status >= 500) {
        const error = new Error(`HTTP ${response.status}`);
        (error as Error & { status: number }).status = response.status;
        throw error;
      }

      return response;
    },
    {
      ...retryOptions,
      shouldRetry: (error) => {
        // Don't retry on 4xx
        if ('status' in error) {
          const status = (error as unknown as { status: number }).status;
          return status >= 500;
        }
        return defaultShouldRetry(error);
      },
    }
  );
}
