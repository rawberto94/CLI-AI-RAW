/**
 * Parallel Processor
 * Optimizes loops and iterations with parallel processing
 */

import { performanceMonitor } from '../performance/performance-monitor';

export class ParallelProcessor {
  /**
   * Process array in parallel with concurrency limit
   */
  async mapParallel<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    concurrency: number = 10
  ): Promise<R[]> {
    return performanceMonitor.measure('parallel:map', async () => {
      const results: R[] = new Array(items.length);
      const executing: Promise<void>[] = [];

      for (let i = 0; i < items.length; i++) {
        const promise = processor(items[i]!, i).then(result => {
          results[i] = result;
        });

        executing.push(promise);

        if (executing.length >= concurrency) {
          await Promise.race(executing);
          executing.splice(
            executing.findIndex(p => p === promise),
            1
          );
        }
      }

      await Promise.all(executing);
      return results;
    });
  }

  /**
   * Process array in batches
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    return performanceMonitor.measure('parallel:batch', async () => {
      const results: R[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await processor(batch);
        results.push(...batchResults);
      }

      return results;
    });
  }

  /**
   * Filter array in parallel
   */
  async filterParallel<T>(
    items: T[],
    predicate: (item: T, index: number) => Promise<boolean>,
    concurrency: number = 10
  ): Promise<T[]> {
    return performanceMonitor.measure('parallel:filter', async () => {
      const results = await this.mapParallel(
        items,
        async (item, index) => ({
          item,
          keep: await predicate(item, index),
        }),
        concurrency
      );

      return results.filter(r => r.keep).map(r => r.item);
    });
  }

  /**
   * Reduce array in parallel (where possible)
   */
  async reduceParallel<T, R>(
    items: T[],
    reducer: (acc: R, item: T, index: number) => Promise<R>,
    initialValue: R,
    chunkSize: number = 100
  ): Promise<R> {
    return performanceMonitor.measure('parallel:reduce', async () => {
      // Process in chunks
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
      }

      // Reduce each chunk in parallel
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          let acc = initialValue;
          for (let i = 0; i < chunk.length; i++) {
            acc = await reducer(acc, chunk[i]!, i);
          }
          return acc;
        })
      );

      // Combine chunk results
      let finalResult = initialValue;
      for (const chunkResult of chunkResults) {
        finalResult = await reducer(finalResult, chunkResult as any, 0);
      }

      return finalResult;
    });
  }

  /**
   * Process with retry logic
   */
  async processWithRetry<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      concurrency?: number;
    } = {}
  ): Promise<Array<{ item: T; result?: R; error?: Error }>> {
    const { maxRetries = 3, retryDelay = 1000, concurrency = 10 } = options;

    return this.mapParallel(
      items,
      async (item) => {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await processor(item);
            return { item, result };
          } catch (error) {
            lastError = error as Error;
            
            if (attempt < maxRetries) {
              // Exponential backoff
              await new Promise(resolve =>
                setTimeout(resolve, retryDelay * Math.pow(2, attempt))
              );
            }
          }
        }

        return { item, error: lastError };
      },
      concurrency
    );
  }

  /**
   * Process with progress tracking
   */
  async processWithProgress<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onProgress: (completed: number, total: number) => void,
    concurrency: number = 10
  ): Promise<R[]> {
    let completed = 0;
    const total = items.length;

    const wrappedProcessor = async (item: T, index: number): Promise<R> => {
      const result = await processor(item, index);
      completed++;
      onProgress(completed, total);
      return result;
    };

    return this.mapParallel(items, wrappedProcessor, concurrency);
  }

  /**
   * Process with timeout
   */
  async processWithTimeout<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    timeout: number,
    concurrency: number = 10
  ): Promise<Array<{ item: T; result?: R; timedOut?: boolean }>> {
    return this.mapParallel(
      items,
      async (item) => {
        try {
          const result = await Promise.race([
            processor(item),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), timeout)
            ),
          ]);
          return { item, result };
        } catch (error) {
          return { item, timedOut: true };
        }
      },
      concurrency
    );
  }
}

export const parallelProcessor = new ParallelProcessor();

/**
 * Utility functions for common parallel operations
 */

export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 10
): Promise<R[]> {
  return parallelProcessor.mapParallel(items, fn, concurrency);
}

export async function parallelFilter<T>(
  items: T[],
  predicate: (item: T, index: number) => Promise<boolean>,
  concurrency: number = 10
): Promise<T[]> {
  return parallelProcessor.filterParallel(items, predicate, concurrency);
}

export async function batchProcess<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 100
): Promise<R[]> {
  return parallelProcessor.batchProcess(items, processor, batchSize);
}
