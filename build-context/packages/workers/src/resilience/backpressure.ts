/**
 * Backpressure Handler for Queue Management
 * 
 * Monitors queue depth and automatically pauses/resumes workers
 * to prevent memory exhaustion and cascading failures.
 * 
 * Features:
 * - Queue depth monitoring
 * - Automatic worker pausing
 * - Graceful degradation
 * - Health metrics exposure
 */

import pino from 'pino';
// Use any for Queue/Worker types to avoid BullMQ version compatibility issues
type QueueLike = any;
type WorkerLike = any;

const logger = pino({ name: 'backpressure' });

export interface BackpressureConfig {
  highWaterMark: number;    // Queue depth to pause at
  lowWaterMark: number;     // Queue depth to resume at
  checkInterval: number;    // How often to check (ms)
  gracePeriod: number;      // Min time between state changes (ms)
}

export interface QueueHealth {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
  healthStatus: 'healthy' | 'degraded' | 'critical';
}

const DEFAULT_CONFIG: BackpressureConfig = {
  highWaterMark: 1000,
  lowWaterMark: 100,
  checkInterval: 5000,   // 5 seconds
  gracePeriod: 30000,    // 30 seconds
};

/**
 * Backpressure Handler class
 */
export class BackpressureHandler {
  private config: BackpressureConfig;
  private queues: Map<string, { queue: QueueLike; workers: WorkerLike[] }> = new Map();
  private pausedQueues: Set<string> = new Set();
  private lastStateChange: Map<string, number> = new Map();
  private checkIntervalId?: NodeJS.Timeout;
  private isRunning = false;
  private healthHistory: Map<string, QueueHealth[]> = new Map();

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a queue with its workers for monitoring
   */
  register(name: string, queue: QueueLike, workers: WorkerLike[]): void {
    this.queues.set(name, { queue, workers });
    this.healthHistory.set(name, []);
    logger.info({ queue: name, workers: workers.length }, 'Queue registered for backpressure monitoring');
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.checkIntervalId = setInterval(() => this.check(), this.config.checkInterval);
    logger.info({ 
      checkInterval: this.config.checkInterval,
      highWaterMark: this.config.highWaterMark,
      lowWaterMark: this.config.lowWaterMark,
    }, 'Backpressure monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = undefined;
    }
    this.isRunning = false;
    logger.info('Backpressure monitoring stopped');
  }

  /**
   * Check all queues and apply backpressure as needed
   */
  private async check(): Promise<void> {
    for (const [name, { queue, workers }] of this.queues) {
      try {
        const health = await this.getQueueHealth(name, queue);
        this.recordHealth(name, health);

        const waiting = health.waiting + health.delayed;
        const now = Date.now();
        const lastChange = this.lastStateChange.get(name) || 0;
        const canChangeState = now - lastChange >= this.config.gracePeriod;

        if (waiting >= this.config.highWaterMark && !this.pausedQueues.has(name)) {
          if (canChangeState) {
            await this.pauseWorkers(name, workers);
            this.pausedQueues.add(name);
            this.lastStateChange.set(name, now);
          }
        } else if (waiting <= this.config.lowWaterMark && this.pausedQueues.has(name)) {
          if (canChangeState) {
            await this.resumeWorkers(name, workers);
            this.pausedQueues.delete(name);
            this.lastStateChange.set(name, now);
          }
        }

        // Log health status
        if (health.healthStatus !== 'healthy') {
          logger.warn({ queue: name, ...health }, 'Queue health degraded');
        }
      } catch (error) {
        logger.error({ queue: name, error }, 'Error checking queue backpressure');
      }
    }
  }

  /**
   * Get health metrics for a queue
   */
  private async getQueueHealth(name: string, queue: QueueLike): Promise<QueueHealth> {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);

    const total = waiting + delayed;
    let healthStatus: 'healthy' | 'degraded' | 'critical';
    
    if (total >= this.config.highWaterMark) {
      healthStatus = 'critical';
    } else if (total >= this.config.lowWaterMark) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'healthy';
    }

    return {
      name,
      waiting,
      active,
      delayed,
      failed,
      completed,
      paused: this.pausedQueues.has(name),
      healthStatus,
    };
  }

  /**
   * Record health history
   */
  private recordHealth(name: string, health: QueueHealth): void {
    const history = this.healthHistory.get(name) || [];
    history.push(health);
    
    // Keep last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    this.healthHistory.set(name, history);
  }

  /**
   * Pause workers for a queue
   */
  private async pauseWorkers(name: string, workers: WorkerLike[]): Promise<void> {
    logger.warn({ queue: name, workers: workers.length }, 'Pausing workers due to backpressure');
    
    await Promise.all(workers.map(async (worker) => {
      try {
        await worker.pause();
      } catch (error) {
        logger.error({ queue: name, error }, 'Failed to pause worker');
      }
    }));
  }

  /**
   * Resume workers for a queue
   */
  private async resumeWorkers(name: string, workers: WorkerLike[]): Promise<void> {
    logger.info({ queue: name, workers: workers.length }, 'Resuming workers after backpressure relief');
    
    await Promise.all(workers.map(async (worker) => {
      try {
        worker.resume();
      } catch (error) {
        logger.error({ queue: name, error }, 'Failed to resume worker');
      }
    }));
  }

  /**
   * Get all queue health metrics
   */
  async getAllHealth(): Promise<QueueHealth[]> {
    const health: QueueHealth[] = [];
    
    for (const [name, { queue }] of this.queues) {
      try {
        health.push(await this.getQueueHealth(name, queue));
      } catch (error) {
        logger.error({ queue: name, error }, 'Failed to get queue health');
      }
    }
    
    return health;
  }

  /**
   * Get health history for a queue
   */
  getHealthHistory(name: string): QueueHealth[] {
    return this.healthHistory.get(name) || [];
  }

  /**
   * Force pause a queue
   */
  async forcePause(name: string): Promise<void> {
    const entry = this.queues.get(name);
    if (entry) {
      await this.pauseWorkers(name, entry.workers);
      this.pausedQueues.add(name);
    }
  }

  /**
   * Force resume a queue
   */
  async forceResume(name: string): Promise<void> {
    const entry = this.queues.get(name);
    if (entry) {
      await this.resumeWorkers(name, entry.workers);
      this.pausedQueues.delete(name);
    }
  }

  /**
   * Check if a queue is paused
   */
  isPaused(name: string): boolean {
    return this.pausedQueues.has(name);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let backpressureHandler: BackpressureHandler | null = null;

/**
 * Get the global backpressure handler
 */
export function getBackpressureHandler(config?: Partial<BackpressureConfig>): BackpressureHandler {
  if (!backpressureHandler) {
    backpressureHandler = new BackpressureHandler(config);
  }
  return backpressureHandler;
}

// ============================================================================
// RATE LIMITER FOR PRODUCERS
// ============================================================================

export interface RateLimiterConfig {
  maxRequests: number;    // Max requests per window
  windowMs: number;       // Window size in ms
  retryAfter?: number;    // Suggested retry delay when limited
}

const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  maxRequests: 100,
  windowMs: 60000,  // 1 minute
  retryAfter: 5000, // 5 seconds
};

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private tokens: number;
  private lastRefill: number;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config };
    this.tokens = this.config.maxRequests;
    this.lastRefill = Date.now();
  }

  /**
   * Check if a request can proceed
   */
  canProceed(): boolean {
    this.refill();
    return this.tokens > 0;
  }

  /**
   * Consume a token (call after canProceed returns true)
   */
  consume(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /**
   * Get remaining tokens
   */
  remaining(): number {
    this.refill();
    return Math.max(0, this.tokens);
  }

  /**
   * Get time until next token is available
   */
  getRetryAfter(): number {
    if (this.tokens > 0) return 0;
    return this.config.retryAfter || this.config.windowMs / this.config.maxRequests;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    if (elapsed >= this.config.windowMs) {
      // Full refill
      this.tokens = this.config.maxRequests;
      this.lastRefill = now;
    } else {
      // Partial refill
      const tokensToAdd = Math.floor(
        (elapsed / this.config.windowMs) * this.config.maxRequests
      );
      if (tokensToAdd > 0) {
        this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxRequests);
        this.lastRefill = now - (elapsed % (this.config.windowMs / this.config.maxRequests));
      }
    }
  }
}

/**
 * Error thrown when rate limited
 */
export class RateLimitedError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}ms`);
    this.name = 'RateLimitedError';
  }
}

/**
 * Wrap a function with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config?: Partial<RateLimiterConfig>
): T {
  const limiter = new RateLimiter(config);
  
  return (async (...args: Parameters<T>) => {
    if (!limiter.consume()) {
      throw new RateLimitedError(limiter.getRetryAfter());
    }
    return fn(...args);
  }) as T;
}
