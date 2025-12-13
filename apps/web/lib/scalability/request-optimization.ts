/**
 * Request Deduplication & Batching
 * Prevents duplicate API calls and batches similar requests
 */

type PendingRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
};

// ============================================================================
// Request Deduplication
// ============================================================================

const pendingRequests = new Map<string, PendingRequest<unknown>>();
const REQUEST_DEDUP_WINDOW = 100; // ms

/**
 * Deduplicate identical requests within a time window
 * If the same request is made multiple times, only one network call is made
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  windowMs: number = REQUEST_DEDUP_WINDOW
): Promise<T> {
  const existing = pendingRequests.get(key);
  const now = Date.now();

  // If there's an existing request within the window, return it
  if (existing && now - existing.timestamp < windowMs) {
    return existing.promise as Promise<T>;
  }

  // Create new request
  const promise = requestFn().finally(() => {
    // Clean up after request completes
    setTimeout(() => {
      const current = pendingRequests.get(key);
      if (current?.promise === promise) {
        pendingRequests.delete(key);
      }
    }, windowMs);
  });

  pendingRequests.set(key, { promise, timestamp: now });
  return promise;
}

/**
 * Generate a cache key for a request
 */
export function generateRequestKey(
  method: string,
  url: string,
  body?: unknown
): string {
  const bodyHash = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyHash}`;
}

// ============================================================================
// Request Batching
// ============================================================================

type BatchedRequest<T, R> = {
  params: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
};

interface BatchConfig<T, R> {
  /** Maximum number of requests to batch */
  maxBatchSize: number;
  /** Maximum time to wait before executing batch (ms) */
  maxWaitTime: number;
  /** Function to execute the batched request */
  batchFn: (params: T[]) => Promise<R[]>;
}

/**
 * Creates a batcher that collects individual requests and executes them in batches
 */
export function createBatcher<T, R>(config: BatchConfig<T, R>) {
  let batch: BatchedRequest<T, R>[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const executeBatch = async () => {
    if (batch.length === 0) return;

    const currentBatch = batch;
    batch = [];
    timer = null;

    try {
      const params = currentBatch.map((req) => req.params);
      const results = await config.batchFn(params);

      // Resolve each request with its corresponding result
      currentBatch.forEach((req, index) => {
        if (results[index] !== undefined) {
          req.resolve(results[index]);
        } else {
          req.reject(new Error('Missing result in batch response'));
        }
      });
    } catch (error) {
      // Reject all requests in the batch
      currentBatch.forEach((req) => {
        req.reject(error instanceof Error ? error : new Error(String(error)));
      });
    }
  };

  const scheduleExecution = () => {
    if (timer) return;
    timer = setTimeout(executeBatch, config.maxWaitTime);
  };

  return {
    /**
     * Add a request to the batch
     */
    add(params: T): Promise<R> {
      return new Promise((resolve, reject) => {
        batch.push({ params, resolve, reject });

        if (batch.length >= config.maxBatchSize) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          executeBatch();
        } else {
          scheduleExecution();
        }
      });
    },

    /**
     * Force execute the current batch immediately
     */
    flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return executeBatch();
    },

    /**
     * Get the current batch size
     */
    get size(): number {
      return batch.length;
    },
  };
}

// ============================================================================
// Request Queue with Rate Limiting
// ============================================================================

interface QueueConfig {
  /** Maximum concurrent requests */
  concurrency: number;
  /** Minimum delay between requests (ms) */
  minDelay: number;
  /** Maximum requests per time window */
  maxRequestsPerWindow?: number;
  /** Time window for rate limiting (ms) */
  windowMs?: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
}

/**
 * Creates a request queue with rate limiting and priority support
 */
export function createRequestQueue(config: QueueConfig) {
  const queue: QueuedRequest<unknown>[] = [];
  let activeRequests = 0;
  let lastRequestTime = 0;
  const requestTimestamps: number[] = [];

  const canProcessRequest = (): boolean => {
    // Check concurrency limit
    if (activeRequests >= config.concurrency) {
      return false;
    }

    // Check rate limit
    if (config.maxRequestsPerWindow && config.windowMs) {
      const now = Date.now();
      const windowStart = now - config.windowMs;
      const recentRequests = requestTimestamps.filter((t) => t > windowStart);
      if (recentRequests.length >= config.maxRequestsPerWindow) {
        return false;
      }
    }

    // Check minimum delay
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < config.minDelay) {
      return false;
    }

    return true;
  };

  const processQueue = async () => {
    while (queue.length > 0 && canProcessRequest()) {
      // Sort by priority (higher = more important)
      queue.sort((a, b) => b.priority - a.priority);

      const request = queue.shift();
      if (!request) continue;

      activeRequests++;
      lastRequestTime = Date.now();
      requestTimestamps.push(lastRequestTime);

      // Clean old timestamps
      if (config.windowMs) {
        const cutoff = Date.now() - config.windowMs;
        while (requestTimestamps.length > 0 && requestTimestamps[0]! < cutoff) {
          requestTimestamps.shift();
        }
      }

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        activeRequests--;
        // Process next items after a small delay
        setTimeout(processQueue, config.minDelay);
      }
    }
  };

  return {
    /**
     * Add a request to the queue
     */
    enqueue<T>(fn: () => Promise<T>, priority: number = 0): Promise<T> {
      return new Promise((resolve, reject) => {
        queue.push({
          fn: fn as () => Promise<unknown>,
          resolve: resolve as (value: unknown) => void,
          reject,
          priority,
        });
        processQueue();
      });
    },

    /**
     * Get queue statistics
     */
    getStats() {
      return {
        queueLength: queue.length,
        activeRequests,
        lastRequestTime,
        requestsInWindow: requestTimestamps.length,
      };
    },

    /**
     * Clear the queue (pending requests will be rejected)
     */
    clear() {
      while (queue.length > 0) {
        const request = queue.shift();
        if (request) {
          request.reject(new Error('Queue cleared'));
        }
      }
    },
  };
}

// ============================================================================
// Singleton Request Queue for API calls
// ============================================================================

let globalQueue: ReturnType<typeof createRequestQueue> | null = null;

export function getGlobalRequestQueue() {
  if (!globalQueue) {
    globalQueue = createRequestQueue({
      concurrency: 6, // Match browser's max concurrent connections
      minDelay: 50, // 50ms between requests
      maxRequestsPerWindow: 100, // Max 100 requests per 10 seconds
      windowMs: 10000,
    });
  }
  return globalQueue;
}
