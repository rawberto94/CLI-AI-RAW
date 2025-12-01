/**
 * Async Utilities
 * Common async patterns and helpers
 */

// ============================================================================
// Promise Utilities
// ============================================================================

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a timeout
 */
export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Execute promises with a concurrency limit
 */
export async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, task] of tasks.entries()) {
    const promise = Promise.resolve().then(async () => {
      results[index] = await task();
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove settled promises
      const settled = executing.filter(p => {
        // Check if promise is settled by racing with resolved promise
        let isSettled = false;
        Promise.race([p, Promise.resolve('pending')]).then(result => {
          isSettled = result !== 'pending';
        });
        return !isSettled;
      });
      executing.length = 0;
      executing.push(...settled);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Execute promises in sequence
 */
export async function pSeries<T>(
  tasks: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

/**
 * Map array with async function and concurrency limit
 */
export async function pMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number = Infinity
): Promise<R[]> {
  const tasks = items.map((item, index) => () => mapper(item, index));
  return pLimit(tasks, concurrency);
}

/**
 * Filter array with async predicate
 */
export async function pFilter<T>(
  items: T[],
  predicate: (item: T, index: number) => Promise<boolean>,
  concurrency: number = Infinity
): Promise<T[]> {
  const results = await pMap(
    items,
    async (item, index) => ({
      item,
      keep: await predicate(item, index),
    }),
    concurrency
  );
  return results.filter(r => r.keep).map(r => r.item);
}

/**
 * Reduce array with async reducer
 */
export async function asyncReduce<T, R>(
  items: T[],
  reducer: (acc: R, item: T, index: number) => Promise<R>,
  initial: R
): Promise<R> {
  let result = initial;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item !== undefined) {
      result = await reducer(result, item, i);
    }
  }
  return result;
}

/**
 * Execute async function and return result or default on error
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return defaultValue;
  }
}

/**
 * Execute async function and return [error, result] tuple
 */
export async function to<T>(
  promise: Promise<T>
): Promise<[Error, null] | [null, T]> {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

export interface RetryOptions {
  /** Maximum number of attempts */
  attempts?: number;
  /** Base delay between retries (ms) */
  delay?: number;
  /** Maximum delay (ms) */
  maxDelay?: number;
  /** Exponential backoff factor */
  factor?: number;
  /** Jitter to add randomness (0-1) */
  jitter?: number;
  /** Should retry on this error? */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Called on each retry */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    delay = 1000,
    maxDelay = 30000,
    factor = 2,
    jitter = 0.1,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === attempts || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      onRetry?.(lastError, attempt);

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(delay * Math.pow(factor, attempt - 1), maxDelay);
      const jitterAmount = baseDelay * jitter * Math.random();
      const actualDelay = baseDelay + jitterAmount;

      await sleep(actualDelay);
    }
  }

  throw lastError!;
}

/**
 * Create a retryable function
 */
export function retryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options?: RetryOptions
): T {
  return ((...args: Parameters<T>) => retry(() => fn(...args), options)) as T;
}

// ============================================================================
// Polling Utilities
// ============================================================================

export interface PollOptions<T> {
  /** Interval between polls (ms) */
  interval: number;
  /** Maximum time to poll (ms) */
  timeout?: number;
  /** Condition to stop polling */
  until: (result: T) => boolean;
  /** Called on each poll */
  onPoll?: (result: T, elapsed: number) => void;
}

/**
 * Poll an async function until a condition is met
 */
export async function poll<T>(
  fn: () => Promise<T>,
  options: PollOptions<T>
): Promise<T> {
  const { interval, timeout, until, onPoll } = options;
  const startTime = Date.now();

  while (true) {
    const result = await fn();
    const elapsed = Date.now() - startTime;

    onPoll?.(result, elapsed);

    if (until(result)) {
      return result;
    }

    if (timeout && elapsed >= timeout) {
      throw new Error(`Polling timed out after ${timeout}ms`);
    }

    await sleep(interval);
  }
}

// ============================================================================
// Debounce & Throttle (Promise-based)
// ============================================================================

/**
 * Debounce an async function
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Deferred<Awaited<ReturnType<T>>> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = defer<Awaited<ReturnType<T>>>();
    }

    const currentDeferred = pendingPromise;

    timeoutId = setTimeout(async () => {
      timeoutId = null;
      pendingPromise = null;

      try {
        const result = await fn(...args);
        currentDeferred.resolve(result as Awaited<ReturnType<T>>);
      } catch (error) {
        currentDeferred.reject(error);
      }
    }, wait);

    return currentDeferred.promise;
  };
}

/**
 * Throttle an async function
 */
export function throttleAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let lastCall = 0;
  let pendingPromise: Promise<Awaited<ReturnType<T>>> | null = null;

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= wait) {
      lastCall = now;
      pendingPromise = fn(...args) as Promise<Awaited<ReturnType<T>>>;
      return pendingPromise;
    }

    if (pendingPromise) {
      return pendingPromise;
    }

    await sleep(wait - timeSinceLastCall);
    lastCall = Date.now();
    pendingPromise = fn(...args) as Promise<Awaited<ReturnType<T>>>;
    return pendingPromise;
  }) as (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
}

// ============================================================================
// Mutex & Semaphore
// ============================================================================

/**
 * Mutex for exclusive access
 */
export class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Semaphore for limited concurrent access
 */
export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  async runWithPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get available(): number {
    return this.permits;
  }

  get waiting(): number {
    return this.queue.length;
  }
}

// ============================================================================
// AbortController Utilities
// ============================================================================

/**
 * Create an abort controller with timeout
 */
export function createAbortController(timeoutMs?: number): {
  controller: AbortController;
  signal: AbortSignal;
  abort: (reason?: string) => void;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  }

  return {
    controller,
    signal: controller.signal,
    abort: (reason?: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      controller.abort(reason ? new Error(reason) : undefined);
    },
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

/**
 * Make a fetch request abortable
 */
export function abortableFetch(
  url: string,
  init?: RequestInit,
  timeoutMs?: number
): { promise: Promise<Response>; abort: () => void } {
  const { controller, signal, abort, cleanup } = createAbortController(timeoutMs);

  const promise = fetch(url, { ...init, signal }).finally(cleanup);

  return { promise, abort };
}
