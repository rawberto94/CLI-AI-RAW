/**
 * Circuit Breaker Pattern for External Services
 * 
 * Prevents cascading failures when external services (OpenAI, S3, etc.) are unavailable.
 * Implements the standard states: CLOSED → OPEN → HALF_OPEN → CLOSED
 * 
 * Features:
 * - Configurable failure thresholds
 * - Exponential backoff for recovery attempts
 * - Fallback function support
 * - Event emission for monitoring
 */

import pino from 'pino';

const logger = pino({ name: 'circuit-breaker' });

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation, requests pass through
  OPEN = 'OPEN',           // Failing, requests are rejected immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;     // Number of failures before opening
  successThreshold: number;     // Number of successes in half-open to close
  timeout: number;              // ms to wait before trying half-open
  maxTimeout: number;           // Maximum timeout with exponential backoff
  monitoringPeriod: number;     // ms window for counting failures
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,        // 30 seconds
  maxTimeout: 300000,    // 5 minutes max
  monitoringPeriod: 60000, // 1 minute window
};

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private openedAt?: Date;
  private nextAttempt?: Date;
  private currentTimeout: number;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private recentFailures: number[] = []; // Timestamps of recent failures

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentTimeout = this.config.timeout;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.totalRequests++;
    this.cleanupOldFailures();

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info({ circuit: this.config.name }, 'Circuit entering HALF_OPEN state');
      } else {
        logger.debug({ circuit: this.config.name, nextAttempt: this.nextAttempt }, 'Circuit OPEN, rejecting request');
        if (fallback) {
          return fallback();
        }
        throw new CircuitOpenError(this.config.name, this.nextAttempt);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // After onFailure, circuit may have transitioned to OPEN
      if (fallback) {
        const stats = this.getStats();
        if (stats.state === CircuitState.OPEN) {
          return fallback();
        }
      }
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private onSuccess(): void {
    this.lastSuccess = new Date();
    this.totalSuccesses++;
    this.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.close();
      }
    } else {
      this.failures = Math.max(0, this.failures - 1); // Decay failures on success
    }
  }

  /**
   * Record a failed operation
   */
  private onFailure(error: unknown): void {
    this.lastFailure = new Date();
    this.totalFailures++;
    this.consecutiveFailures++;
    this.recentFailures.push(Date.now());

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
    } else {
      // State is CLOSED
      this.failures++;
      if (this.failures >= this.config.failureThreshold) {
        this.open();
      }
    }

    logger.warn({
      circuit: this.config.name,
      state: this.state,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      error: error instanceof Error ? error.message : String(error),
    }, 'Circuit breaker recorded failure');
  }

  /**
   * Open the circuit (start rejecting requests)
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.openedAt = new Date();
    this.nextAttempt = new Date(Date.now() + this.currentTimeout);
    this.successes = 0;
    
    // Exponential backoff
    this.currentTimeout = Math.min(
      this.currentTimeout * 2,
      this.config.maxTimeout
    );

    logger.warn({
      circuit: this.config.name,
      timeout: this.currentTimeout,
      nextAttempt: this.nextAttempt,
    }, 'Circuit OPENED');
  }

  /**
   * Close the circuit (resume normal operation)
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.currentTimeout = this.config.timeout; // Reset timeout
    this.openedAt = undefined;
    this.nextAttempt = undefined;

    logger.info({ circuit: this.config.name }, 'Circuit CLOSED');
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  /**
   * Clean up old failures outside the monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.recentFailures = this.recentFailures.filter(ts => ts > cutoff);
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Force the circuit to close (manual override)
   */
  forceClose(): void {
    this.close();
    logger.info({ circuit: this.config.name }, 'Circuit force closed');
  }

  /**
   * Force the circuit to open (manual override)
   */
  forceOpen(): void {
    this.open();
    logger.info({ circuit: this.config.name }, 'Circuit force opened');
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly nextAttempt?: Date
  ) {
    super(`Circuit ${circuitName} is OPEN. Next attempt: ${nextAttempt?.toISOString() || 'unknown'}`);
    this.name = 'CircuitOpenError';
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker({ name, ...config }));
  }
  return circuitBreakers.get(name)!;
}

/**
 * Pre-configured circuit breakers for common services
 */
export const circuits = {
  openai: () => getCircuitBreaker('openai', {
    failureThreshold: 3,
    timeout: 60000,  // 1 minute (OpenAI can be slow to recover)
    maxTimeout: 600000, // 10 minutes max
  }),
  
  s3: () => getCircuitBreaker('s3', {
    failureThreshold: 5,
    timeout: 30000,
  }),
  
  redis: () => getCircuitBreaker('redis', {
    failureThreshold: 3,
    timeout: 5000,   // Redis should recover fast
    maxTimeout: 60000,
  }),
  
  database: () => getCircuitBreaker('database', {
    failureThreshold: 5,
    timeout: 10000,
    maxTimeout: 120000,
  }),
  
  webhook: () => getCircuitBreaker('webhook', {
    failureThreshold: 10,  // Webhooks can be flaky
    timeout: 30000,
  }),
};

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitStats(): Record<string, CircuitStats> {
  const stats: Record<string, CircuitStats> = {};
  for (const [name, cb] of circuitBreakers) {
    stats[name] = cb.getStats();
  }
  return stats;
}

/**
 * Decorator for wrapping functions with circuit breaker
 */
export function withCircuitBreaker(circuitName: string, config?: Partial<CircuitBreakerConfig>) {
  const cb = getCircuitBreaker(circuitName, config);
  
  return function <T extends (...args: any[]) => Promise<any>>(
    target: T,
    fallback?: T
  ): T {
    return (async (...args: any[]) => {
      return cb.execute(
        () => target(...args),
        fallback ? () => fallback(...args) : undefined
      );
    }) as T;
  };
}
