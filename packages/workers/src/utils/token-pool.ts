/**
 * Token-aware concurrency pool
 *
 * Bounds both the number of in-flight LLM calls and the outbound token-per-minute
 * rate. This prevents one slow call from stalling the whole batch and avoids
 * blasting the API with enough tokens to trigger 429 + retry-after penalties.
 */

export interface TokenPoolOptions {
  /** Maximum number of concurrent calls */
  concurrency: number;
  /** Token-per-minute budget */
  tokensPerMinute: number;
}

interface PoolTask<T> {
  tokens: number;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export class TokenAwarePool {
  private concurrency: number;
  private maxTokens: number;
  private refillRatePerMs: number;
  private tokensAvailable: number;
  private lastRefillAt: number;
  private running: number;
  private queue: Array<PoolTask<any>>;

  constructor(options: TokenPoolOptions) {
    this.concurrency = Math.max(1, options.concurrency);
    this.maxTokens = Math.max(1, options.tokensPerMinute);
    this.refillRatePerMs = this.maxTokens / 60_000;
    this.tokensAvailable = this.maxTokens;
    this.lastRefillAt = Date.now();
    this.running = 0;
    this.queue = [];
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    if (elapsed > 0) {
      this.tokensAvailable = Math.min(
        this.maxTokens,
        this.tokensAvailable + elapsed * this.refillRatePerMs
      );
      this.lastRefillAt = now;
    }
  }

  private pump(): void {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.refill();

    // Find the first task that can afford its token budget. If a task at the
    // front can't afford it, we wait for it (FIFO) rather than reordering and
    // starving large tasks.
    const task = this.queue[0];
    if (!task || task.tokens > this.tokensAvailable) {
      // Schedule a re-check when the front task should have enough tokens.
      if (task) {
        const deficit = task.tokens - this.tokensAvailable;
        const waitMs = Math.ceil(deficit / this.refillRatePerMs);
        setTimeout(() => this.pump(), Math.min(waitMs, 1000));
      }
      return;
    }

    this.queue.shift();
    this.running++;
    this.tokensAvailable -= task.tokens;

    Promise.resolve()
      .then(() => task.fn())
      .then(
        (value) => {
          this.running--;
          this.pump();
          task.resolve(value);
        },
        (error) => {
          this.running--;
          this.pump();
          task.reject(error);
        }
      );
  }

  /**
   * Execute `fn` when both a concurrency slot and the requested token budget are
   * available. `tokens` should be a rough estimate of prompt + completion tokens.
   */
  execute<T>(tokens: number, fn: () => Promise<T>): Promise<T> {
    const normalizedTokens = Math.max(0, Math.ceil(tokens));
    return new Promise((resolve, reject) => {
      this.queue.push({ tokens: normalizedTokens, fn, resolve, reject });
      this.pump();
    });
  }

  /**
   * Current pool status for debugging/monitoring.
   */
  status(): { running: number; queued: number; tokensAvailable: number; maxTokens: number } {
    this.refill();
    return {
      running: this.running,
      queued: this.queue.length,
      tokensAvailable: Math.floor(this.tokensAvailable),
      maxTokens: this.maxTokens,
    };
  }
}

/**
 * Rough token estimate: 1 token ≈ 4 characters. Good enough for pacing;
 * actual TPM will be slightly different but this prevents overshoot.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
