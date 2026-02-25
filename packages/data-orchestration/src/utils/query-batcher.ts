/**
 * Query Batcher & Deduplicator
 *
 * Solves two performance problems at the data-access layer:
 *
 * 1. **Request deduplication** – If two callers ask for the same resource
 *    concurrently, only one database/API call is made and both callers
 *    share the same Promise.
 *
 * 2. **Request batching** – Multiple individual requests that arrive
 *    within a short window (default 5 ms) are grouped into a single
 *    batch query, dramatically reducing round-trips.
 *
 * Usage:
 * ```ts
 * import { QueryBatcher } from './query-batcher';
 *
 * const batcher = new QueryBatcher({ batchWindowMs: 10 });
 *
 * // Deduplication:
 * const contract = await batcher.execute('contract:abc', () =>
 *   prisma.contract.findUnique({ where: { id: 'abc' } }),
 * );
 *
 * // Batching:
 * const contract = await batcher.batch('abc', fetchContractsBatch);
 * ```
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('query-batcher');

// ── Core class ───────────────────────────────────────────────────────

export class QueryBatcher {
  /** In-flight dedup map: cacheKey → pending Promise */
  private pending = new Map<string, Promise<unknown>>();

  /** Items queued for the next batch flush */
  private batchQueue = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  /** Timer handle for the batch window */
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Stored batch executor for flush */
  private batchExecutor: ((keys: string[]) => Promise<Map<string, unknown>>) | null = null;

  /** How long to wait before flushing the batch (ms) */
  private readonly batchWindowMs: number;

  constructor(options: { batchWindowMs?: number } = {}) {
    this.batchWindowMs = options.batchWindowMs ?? 5;
  }

  // ── Deduplication ────────────────────────────────────────────────────

  /**
   * Execute `fn` for the given `key`, deduplicating concurrent identical
   * calls so database work only happens once.
   */
  async execute<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const existing = this.pending.get(key);
    if (existing) {
      logger.debug({ key }, 'Dedup: reusing in-flight request');
      return existing as Promise<R>;
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise as Promise<unknown>);
    return promise;
  }

  // ── Batching ─────────────────────────────────────────────────────────

  /**
   * Queue a single key to be fetched via `batchExecutor`.
   *
   * `batchExecutor` receives all keys collected within the batch window
   * and must return a `Map<key, result>`.
   */
  batch<R>(
    key: string,
    batchExecutor: (keys: string[]) => Promise<Map<string, R>>,
  ): Promise<R> {
    // If the same key is already in the queue, return its existing promise
    const existing = this.batchQueue.get(key);
    if (existing) {
      return new Promise<R>((resolve, reject) => {
        const orig = existing;
        // Chain onto original
        this.batchQueue.set(key, {
          resolve: (v: unknown) => { orig.resolve(v); resolve(v as R); },
          reject: (e: Error) => { orig.reject(e); reject(e); },
        });
      });
    }

    this.batchExecutor = batchExecutor as (keys: string[]) => Promise<Map<string, unknown>>;

    return new Promise<R>((resolve, reject) => {
      this.batchQueue.set(key, {
        resolve: (v: unknown) => resolve(v as R),
        reject,
      });
      this.scheduleBatchFlush();
    });
  }

  private scheduleBatchFlush() {
    if (this.batchTimeout) return; // already scheduled

    this.batchTimeout = setTimeout(() => {
      void this.flushBatch();
    }, this.batchWindowMs);
  }

  private async flushBatch() {
    // Snapshot and clear queue
    const batch = new Map(this.batchQueue);
    const executor = this.batchExecutor;
    this.batchQueue.clear();
    this.batchTimeout = null;
    this.batchExecutor = null;

    if (batch.size === 0 || !executor) return;

    const keys = Array.from(batch.keys());
    logger.debug({ count: keys.length }, 'Flushing batch');

    try {
      const results = await executor(keys);

      batch.forEach(({ resolve, reject }, key) => {
        const result = results.get(key);
        if (result !== undefined) {
          resolve(result);
        } else {
          reject(new Error(`No result for key: ${key}`));
        }
      });
    } catch (error) {
      // Reject all promises on batch failure
      const err = error instanceof Error ? error : new Error(String(error));
      batch.forEach(({ reject }) => reject(err));
      logger.error({ error }, 'Batch execution failed');
    }
  }

  // ── Housekeeping ─────────────────────────────────────────────────────

  /** Cancel pending batch and clear in-flight map */
  clear(): void {
    this.pending.clear();
    this.batchQueue.clear();
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /** Number of in-flight dedup entries */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** Number of items waiting in the batch queue */
  get queuedCount(): number {
    return this.batchQueue.size;
  }
}

// ── Pre-built singleton instances ────────────────────────────────────

/** Batcher for contract-level queries (10 ms window) */
export const contractBatcher = new QueryBatcher({ batchWindowMs: 10 });

/** Batcher for artifact queries (20 ms window — lower priority) */
export const artifactBatcher = new QueryBatcher({ batchWindowMs: 20 });
