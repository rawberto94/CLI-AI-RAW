/**
 * Batch Processor
 * Optimizes bulk operations by batching requests
 */

interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  concurrency: number;
}

interface BatchItem<T, R> {
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export class BatchProcessor<T, R> {
  private queue: BatchItem<T, R>[] = [];
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private config: BatchConfig;
  private processor: (items: T[]) => Promise<R[]>;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    config?: Partial<BatchConfig>
  ) {
    this.processor = processor;
    this.config = {
      maxBatchSize: config?.maxBatchSize || 100,
      maxWaitTime: config?.maxWaitTime || 50,
      concurrency: config?.concurrency || 5,
    };
  }

  /**
   * Add item to batch queue
   */
  async add(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });

      // Process immediately if batch is full
      if (this.queue.length >= this.config.maxBatchSize) {
        this.flush();
      } else {
        // Schedule processing
        this.scheduleFlush();
      }
    });
  }

  /**
   * Add multiple items to batch queue
   */
  async addMany(items: T[]): Promise<R[]> {
    return Promise.all(items.map(item => this.add(item)));
  }

  /**
   * Schedule batch processing
   */
  private scheduleFlush(): void {
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.flush();
    }, this.config.maxWaitTime);
  }

  /**
   * Process current batch
   */
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0 || this.processing) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.config.maxBatchSize);

    try {
      const items = batch.map(item => item.data);
      const results = await this.processor(items);

      // Resolve all promises
      batch.forEach((item, index) => {
        item.resolve(results[index]!);
      });
    } catch (error) {
      // Reject all promises
      batch.forEach(item => {
        item.reject(error as Error);
      });
    } finally {
      this.processing = false;

      // Process remaining items
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Force immediate processing
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
    };
  }
}

/**
 * Create a batched version of a function
 */
export function createBatchedFunction<T, R>(
  fn: (items: T[]) => Promise<R[]>,
  config?: Partial<BatchConfig>
): (item: T) => Promise<R> {
  const processor = new BatchProcessor(fn, config);
  return (item: T) => processor.add(item);
}

/**
 * Batch database queries
 */
export class QueryBatcher {
  private batchers = new Map<string, BatchProcessor<any, any>>();

  /**
   * Get or create a batcher for a specific query type
   */
  getBatcher<T, R>(
    key: string,
    processor: (items: T[]) => Promise<R[]>,
    config?: Partial<BatchConfig>
  ): BatchProcessor<T, R> {
    if (!this.batchers.has(key)) {
      this.batchers.set(key, new BatchProcessor(processor, config));
    }
    return this.batchers.get(key)!;
  }

  /**
   * Clear all batchers
   */
  clear(): void {
    this.batchers.clear();
  }
}

export const queryBatcher = new QueryBatcher();
