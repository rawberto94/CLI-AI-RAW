/**
 * Request Deduplication & Batching
 * Prevents duplicate API calls and batches similar requests
 * 
 * @example
 * // Deduplicate requests
 * const fetcher = createDeduplicatedFetcher();
 * 
 * // These will share the same request
 * Promise.all([
 *   fetcher('/api/user/123'),
 *   fetcher('/api/user/123'),
 *   fetcher('/api/user/123'),
 * ]); // Only 1 network request made
 * 
 * // Batch requests
 * const batcher = createBatcher<string, User>({
 *   batchFn: (ids) => fetchUsers(ids),
 *   wait: 10,
 *   maxBatchSize: 50,
 * });
 * 
 * // These will be batched into a single request
 * const [user1, user2, user3] = await Promise.all([
 *   batcher.load('id1'),
 *   batcher.load('id2'),
 *   batcher.load('id3'),
 * ]);
 */

// ============================================================================
// Request Deduplication
// ============================================================================

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

/**
 * Create a deduplicated fetcher
 * Requests to the same URL within the TTL will share the same promise
 */
export function createDeduplicatedFetcher(options: {
  ttl?: number; // How long to cache in-flight requests (ms)
  keyFn?: (url: string, init?: RequestInit) => string;
} = {}) {
  const { ttl = 100, keyFn = defaultKeyFn } = options;
  const pending = new Map<string, PendingRequest<Response>>();

  function defaultKeyFn(url: string, init?: RequestInit): string {
    const method = init?.method || 'GET';
    const body = init?.body ? String(init.body) : '';
    return `${method}:${url}:${body}`;
  }

  return async function dedupedFetch(
    url: string,
    init?: RequestInit
  ): Promise<Response> {
    const key = keyFn(url, init);
    const now = Date.now();

    // Check for existing in-flight request
    const existing = pending.get(key);
    if (existing && now - existing.timestamp < ttl) {
      return existing.promise.then(r => r.clone());
    }

    // Make new request
    const promise = fetch(url, init);
    pending.set(key, { promise, timestamp: now });

    try {
      const response = await promise;
      // Keep in cache briefly to handle rapid duplicate calls
      setTimeout(() => pending.delete(key), ttl);
      return response;
    } catch (error) {
      pending.delete(key);
      throw error;
    }
  };
}

// ============================================================================
// Request Batching (DataLoader pattern)
// ============================================================================

interface BatcherOptions<K, V> {
  /** Function to batch-load values for keys */
  batchFn: (keys: K[]) => Promise<(V | Error)[]>;
  /** How long to wait to collect keys (ms) */
  wait?: number;
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Custom cache key function */
  cacheKeyFn?: (key: K) => string;
  /** Enable caching */
  cache?: boolean;
}

interface QueuedRequest<K, V> {
  key: K;
  resolve: (value: V) => void;
  reject: (error: Error) => void;
}

export class Batcher<K, V> {
  private queue: QueuedRequest<K, V>[] = [];
  private cache = new Map<string, V>();
  private scheduledBatch: ReturnType<typeof setTimeout> | null = null;

  constructor(private options: BatcherOptions<K, V>) {
    this.options = {
      wait: 10,
      maxBatchSize: 100,
      cache: true,
      cacheKeyFn: (key) => String(key),
      ...options,
    };
  }

  /**
   * Load a single value by key
   */
  async load(key: K): Promise<V> {
    const cacheKey = this.options.cacheKeyFn!(key);

    // Check cache
    if (this.options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    return new Promise<V>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      this.scheduleBatch();
    });
  }

  /**
   * Load multiple values by keys
   */
  async loadMany(keys: K[]): Promise<(V | Error)[]> {
    return Promise.all(
      keys.map(key =>
        this.load(key).catch(error => error as Error)
      )
    );
  }

  /**
   * Prime the cache with a value
   */
  prime(key: K, value: V): this {
    const cacheKey = this.options.cacheKeyFn!(key);
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, value);
    }
    return this;
  }

  /**
   * Clear the cache
   */
  clear(): this {
    this.cache.clear();
    return this;
  }

  /**
   * Clear a specific key from cache
   */
  clearKey(key: K): this {
    const cacheKey = this.options.cacheKeyFn!(key);
    this.cache.delete(cacheKey);
    return this;
  }

  private scheduleBatch(): void {
    if (this.scheduledBatch !== null) {
      return;
    }

    // Execute immediately if at max batch size
    if (this.queue.length >= this.options.maxBatchSize!) {
      this.executeBatch();
      return;
    }

    // Schedule batch execution
    this.scheduledBatch = setTimeout(() => {
      this.executeBatch();
    }, this.options.wait);
  }

  private async executeBatch(): Promise<void> {
    this.scheduledBatch = null;

    if (this.queue.length === 0) {
      return;
    }

    // Take batch from queue
    const batch = this.queue.splice(0, this.options.maxBatchSize!);
    const keys = batch.map(item => item.key);

    try {
      const results = await this.options.batchFn(keys);

      // Validate results length
      if (results.length !== keys.length) {
        const error = new Error(
          `Batch function must return array of same length as keys. ` +
          `Got ${results.length}, expected ${keys.length}`
        );
        batch.forEach(item => item.reject(error));
        return;
      }

      // Resolve each request
      batch.forEach((item, index) => {
        const result = results[index];
        const cacheKey = this.options.cacheKeyFn!(item.key);

        if (result instanceof Error) {
          item.reject(result);
        } else if (result !== undefined) {
          // Cache successful results
          if (this.options.cache) {
            this.cache.set(cacheKey, result);
          }
          item.resolve(result);
        } else {
          item.reject(new Error(`No result for key: ${String(item.key)}`));
        }
      });
    } catch (error) {
      // Reject all requests on batch failure
      batch.forEach(item => {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      });
    }

    // Process remaining queue
    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }
}

/**
 * Create a batcher instance
 */
export function createBatcher<K, V>(
  options: BatcherOptions<K, V>
): Batcher<K, V> {
  return new Batcher(options);
}

// ============================================================================
// Request Queue (Sequential Processing)
// ============================================================================

interface QueueOptions {
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Delay between requests (ms) */
  delay?: number;
  /** Retry failed requests */
  retries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
}

interface QueuedTask {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  retries: number;
}

export class RequestQueue {
  private queue: QueuedTask[] = [];
  private running = 0;
  private options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    this.options = {
      concurrency: 4,
      delay: 0,
      retries: 0,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Add a request to the queue
   */
  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        retries: 0,
      });
      this.process();
    });
  }

  /**
   * Add multiple requests
   */
  addAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(fns.map(fn => this.add(fn)));
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Get running count
   */
  get pending(): number {
    return this.running;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach(task => {
      task.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Pause processing
   */
  pause(): void {
    // Implementation could track paused state
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.process();
  }

  private async process(): Promise<void> {
    while (this.running < this.options.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;

      this.executeTask(task).finally(() => {
        this.running--;
        this.process();
      });

      // Add delay between requests
      if (this.options.delay > 0 && this.queue.length > 0) {
        await this.sleep(this.options.delay);
      }
    }
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      if (task.retries < this.options.retries) {
        // Retry with delay
        task.retries++;
        await this.sleep(this.options.retryDelay);
        this.queue.unshift(task);
      } else {
        task.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a request queue
 */
export function createRequestQueue(options?: QueueOptions): RequestQueue {
  return new RequestQueue(options);
}

// ============================================================================
// SWR-like Cache
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleAt: number;
  expiresAt: number;
}

interface SWROptions {
  /** Time until data is considered stale (ms) */
  staleTime?: number;
  /** Time until data expires (ms) */
  cacheTime?: number;
  /** Revalidate on mount */
  revalidateOnMount?: boolean;
  /** Revalidate on focus */
  revalidateOnFocus?: boolean;
}

export class SWRCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private fetchers = new Map<string, Promise<T>>();
  private options: Required<SWROptions>;

  constructor(options: SWROptions = {}) {
    this.options = {
      staleTime: 0,
      cacheTime: 5 * 60 * 1000, // 5 minutes
      revalidateOnMount: true,
      revalidateOnFocus: true,
      ...options,
    };
  }

  /**
   * Get data with stale-while-revalidate strategy
   */
  async get(
    key: string,
    fetcher: () => Promise<T>,
    options?: Partial<SWROptions>
  ): Promise<{ data: T; isStale: boolean; isRevalidating: boolean }> {
    const opts = { ...this.options, ...options };
    const now = Date.now();
    const cached = this.cache.get(key);

    // If data exists and not expired
    if (cached && now < cached.expiresAt) {
      const isStale = now >= cached.staleAt;
      let isRevalidating = false;

      // Revalidate in background if stale
      if (isStale && !this.fetchers.has(key)) {
        isRevalidating = true;
        this.revalidate(key, fetcher, opts).catch(() => {});
      }

      return { data: cached.data, isStale, isRevalidating };
    }

    // Fetch fresh data
    const data = await this.revalidate(key, fetcher, opts);
    return { data, isStale: false, isRevalidating: false };
  }

  /**
   * Revalidate (refetch) data
   */
  async revalidate(
    key: string,
    fetcher: () => Promise<T>,
    options?: Partial<SWROptions>
  ): Promise<T> {
    const opts = { ...this.options, ...options };

    // Check for existing in-flight request
    const existing = this.fetchers.get(key);
    if (existing) {
      return existing;
    }

    // Create fetch promise
    const fetchPromise = (async () => {
      try {
        const data = await fetcher();
        const now = Date.now();

        this.cache.set(key, {
          data,
          timestamp: now,
          staleAt: now + opts.staleTime,
          expiresAt: now + opts.cacheTime,
        });

        return data;
      } finally {
        this.fetchers.delete(key);
      }
    })();

    this.fetchers.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Mutate cache data
   */
  mutate(key: string, data: T | ((current: T | undefined) => T)): void {
    const now = Date.now();
    const current = this.cache.get(key);

    const newData = typeof data === 'function'
      ? (data as (current: T | undefined) => T)(current?.data)
      : data;

    this.cache.set(key, {
      data: newData,
      timestamp: now,
      staleAt: now + this.options.staleTime,
      expiresAt: now + this.options.cacheTime,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Create an SWR cache instance
 */
export function createSWRCache<T>(options?: SWROptions): SWRCache<T> {
  return new SWRCache(options);
}

// ============================================================================
// Exports
// ============================================================================

export const deduplicatedFetch = createDeduplicatedFetcher();
