/**
 * Query Batching Optimizer
 * Automatically batches database queries to reduce N+1 problems
 */

import { performanceMonitor } from '../performance/performance-monitor';

interface BatchedQuery<T> {
  ids: Set<string>;
  resolvers: Map<string, (result: T | null) => void>;
  timer: NodeJS.Timeout | null;
}

export class QueryBatcher<T> {
  private batches = new Map<string, BatchedQuery<T>>();
  private batchDelay = 10; // 10ms batching window
  private maxBatchSize = 100;

  constructor(
    private fetcher: (ids: string[]) => Promise<Map<string, T>>,
    private batchKey: string
  ) {}

  /**
   * Load single item (automatically batched)
   */
  async load(id: string): Promise<T | null> {
    return performanceMonitor.measure(`query-batch:${this.batchKey}`, async () => {
      return new Promise<T | null>((resolve) => {
        let batch = this.batches.get(this.batchKey);

        if (!batch) {
          batch = {
            ids: new Set(),
            resolvers: new Map(),
            timer: null,
          };
          this.batches.set(this.batchKey, batch);
        }

        // Add to batch
        batch.ids.add(id);
        batch.resolvers.set(id, resolve);

        // Schedule batch execution
        if (batch.timer) {
          clearTimeout(batch.timer);
        }

        // Execute immediately if batch is full
        if (batch.ids.size >= this.maxBatchSize) {
          this.executeBatch(this.batchKey);
        } else {
          // Otherwise schedule for later
          batch.timer = setTimeout(() => {
            this.executeBatch(this.batchKey);
          }, this.batchDelay);
        }
      });
    });
  }

  /**
   * Load multiple items (automatically batched)
   */
  async loadMany(ids: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    // Load all in parallel (will be automatically batched)
    await Promise.all(
      ids.map(async (id) => {
        const result = await this.load(id);
        results.set(id, result);
      })
    );

    return results;
  }

  /**
   * Execute batch query
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch) return;

    // Clear batch
    this.batches.delete(batchKey);
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    const ids = Array.from(batch.ids);
    
    try {
      // Fetch all items in one query
      const results = await this.fetcher(ids);

      // Resolve all promises
      for (const [id, resolver] of batch.resolvers.entries()) {
        resolver(results.get(id) || null);
      }
    } catch (error) {
      // Reject all promises
      for (const resolver of batch.resolvers.values()) {
        resolver(null);
      }
    }
  }

  /**
   * Clear all pending batches
   */
  clear(): void {
    for (const batch of this.batches.values()) {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
    }
    this.batches.clear();
  }
}

/**
 * Create a batched loader for a specific entity type
 */
export function createBatchLoader<T>(
  fetcher: (ids: string[]) => Promise<Map<string, T>>,
  batchKey: string
): QueryBatcher<T> {
  return new QueryBatcher(fetcher, batchKey);
}

/**
 * DataLoader-style interface for common use cases
 */
export class DataLoader<K, V> {
  private batcher: QueryBatcher<V>;

  constructor(
    batchLoadFn: (keys: K[]) => Promise<Map<K, V>>,
    options?: {
      maxBatchSize?: number;
      batchDelay?: number;
    }
  ) {
    // Convert keys to strings for batching
    const stringFetcher = async (stringKeys: string[]): Promise<Map<string, V>> => {
      const keys = stringKeys.map(k => JSON.parse(k) as K);
      const results = await batchLoadFn(keys);
      
      const stringResults = new Map<string, V>();
      for (const [key, value] of results.entries()) {
        stringResults.set(JSON.stringify(key), value);
      }
      return stringResults;
    };

    this.batcher = new QueryBatcher(stringFetcher, 'dataloader');
    if (options?.maxBatchSize) {
      (this.batcher as any).maxBatchSize = options.maxBatchSize;
    }
    if (options?.batchDelay) {
      (this.batcher as any).batchDelay = options.batchDelay;
    }
  }

  async load(key: K): Promise<V | null> {
    return this.batcher.load(JSON.stringify(key));
  }

  async loadMany(keys: K[]): Promise<Array<V | null>> {
    const stringKeys = keys.map(k => JSON.stringify(k));
    const results = await this.batcher.loadMany(stringKeys);
    return keys.map(k => results.get(JSON.stringify(k)) || null);
  }

  clear(): void {
    this.batcher.clear();
  }
}
