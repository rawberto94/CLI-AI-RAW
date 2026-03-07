/**
 * Retry Utility with Exponential Backoff
 * Handles transient failures with intelligent retry strategies
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in ms before first retry */
  initialDelay: number;
  /** Maximum delay in ms between retries */
  maxDelay: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: Error, attempt: number) => boolean;
  /** Called before each retry attempt */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Called when all retries exhausted */
  onExhausted?: (error: Error, attempts: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Default retry predicate - retries on common transient errors
 */
export function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes('econnreset')) return true;
  if (message.includes('econnrefused')) return true;
  if (message.includes('etimedout')) return true;
  if (message.includes('epipe')) return true;
  if (message.includes('network')) return true;
  if (message.includes('socket hang up')) return true;
  
  // Timeout errors
  if (message.includes('timeout')) return true;
  if (message.includes('timed out')) return true;
  
  // Rate limiting
  if (message.includes('rate limit')) return true;
  if (message.includes('too many requests')) return true;
  if (message.includes('429')) return true;
  
  // Service unavailable
  if (message.includes('503')) return true;
  if (message.includes('502')) return true;
  if (message.includes('504')) return true;
  if (message.includes('service unavailable')) return true;
  if (message.includes('temporarily unavailable')) return true;
  
  // Database transient errors
  if (message.includes('deadlock')) return true;
  if (message.includes('lock wait timeout')) return true;
  if (message.includes('connection pool')) return true;
  
  // AWS/Cloud transient errors
  if (message.includes('throttl')) return true;
  if (message.includes('capacity')) return true;
  
  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number = 2,
  jitter: boolean = true
): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  
  // Cap at max delay
  delay = Math.min(delay, maxDelay);
  
  // Add jitter (0-30% random variation)
  if (jitter) {
    const jitterFactor = 1 + (Math.random() * 0.3);
    delay = Math.floor(delay * jitterFactor);
  }
  
  return delay;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    isRetryable: defaultIsRetryable,
    ...options,
  };

  let lastError: Error = new Error('No attempts made');
  const startTime = Date.now();

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isRetryable = config.isRetryable!(lastError, attempt);
      const hasMoreAttempts = attempt < config.maxAttempts;

      if (!isRetryable || !hasMoreAttempts) {
        if (!hasMoreAttempts) {
          config.onExhausted?.(lastError, attempt);
        }
        throw lastError;
      }

      // Calculate delay
      const delay = calculateBackoffDelay(
        attempt,
        config.initialDelay,
        config.maxDelay,
        config.backoffMultiplier,
        config.jitter
      );

      config.onRetry?.(lastError, attempt, delay);

      // Wait before retry
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry with detailed result (doesn't throw)
 */
export async function retryWithResult<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const result = await retry(fn, {
      ...options,
      onRetry: (error, attempt, delay) => {
        attempts = attempt;
        options.onRetry?.(error, attempt, delay);
      },
    });

    return {
      success: true,
      result,
      attempts: attempts + 1,
      totalTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: attempts + 1,
      totalTime: Date.now() - startTime,
    };
  }
}

/**
 * Retry decorator for class methods
 */
export function withRetry(options: Partial<RetryOptions> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of any async function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return retry(() => fn(...args), options);
  }) as T;
}

/**
 * Retry with specific strategy for OpenAI API
 */
export async function retryOpenAI<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, {
    maxAttempts: 4,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2.5,
    isRetryable: (error) => {
      const message = error.message.toLowerCase();
      // Retry rate limits and overloaded
      if (message.includes('rate limit')) return true;
      if (message.includes('overloaded')) return true;
      if (message.includes('capacity')) return true;
      // Retry server errors
      if (message.includes('500')) return true;
      if (message.includes('502')) return true;
      if (message.includes('503')) return true;
      // Retry network errors
      if (message.includes('network')) return true;
      if (message.includes('timeout')) return true;
      return defaultIsRetryable(error);
    },
  });
}

/**
 * Retry with specific strategy for database operations
 */
export async function retryDatabase<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
    isRetryable: (error) => {
      const message = error.message.toLowerCase();
      // Retry connection issues
      if (message.includes('connection')) return true;
      if (message.includes('pool')) return true;
      // Retry transient errors
      if (message.includes('deadlock')) return true;
      if (message.includes('lock wait')) return true;
      if (message.includes('too many connections')) return true;
      return false;
    },
  });
}

/**
 * Retry with specific strategy for storage operations
 */
export async function retryStorage<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 10000,
    isRetryable: (error) => {
      const message = error.message.toLowerCase();
      // Retry network issues
      if (message.includes('network')) return true;
      if (message.includes('timeout')) return true;
      if (message.includes('econnreset')) return true;
      // Retry server errors
      if (message.includes('500')) return true;
      if (message.includes('503')) return true;
      return false;
    },
  });
}

/**
 * Batch retry - retry a batch of operations with partial success handling
 */
export async function batchRetry<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: Partial<RetryOptions> & {
    concurrency?: number;
    stopOnFailure?: boolean;
  } = {}
): Promise<{
  successful: Array<{ item: T; result: R }>;
  failed: Array<{ item: T; error: Error }>;
}> {
  const concurrency = options.concurrency || 5;
  const stopOnFailure = options.stopOnFailure || false;

  const successful: Array<{ item: T; result: R }> = [];
  const failed: Array<{ item: T; error: Error }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    if (stopOnFailure && failed.length > 0) break;

    const batch = items.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const result = await retryWithResult(() => fn(item), options);
        return { item, result };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.result.success) {
          successful.push({
            item: result.value.item,
            result: result.value.result.result!,
          });
        } else {
          failed.push({
            item: result.value.item,
            error: result.value.result.error!,
          });
        }
      }
    }
  }

  return { successful, failed };
}
