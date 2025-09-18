/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern for external service calls
 */

import pino from 'pino';

const logger = pino({ name: 'circuit-breaker' });

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  recoveryTimeout: number;       // Time to wait before trying again (ms)
  monitoringPeriod: number;      // Time window for failure counting (ms)
  successThreshold: number;      // Successes needed to close from half-open
  timeout: number;               // Request timeout (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private requests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      successThreshold: 3,
      timeout: 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.requests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info({ name: this.name }, 'Circuit breaker moving to half-open state');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Next attempt at ${this.nextAttemptTime?.toISOString()}`);
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Circuit breaker timeout after ${this.config.timeout}ms for ${this.name}`));
      }, this.config.timeout);

      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.reset();
        logger.info({ name: this.name }, 'Circuit breaker closed after successful recovery');
      }
    } else {
      this.failures = 0; // Reset failure count on success in closed state
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
      logger.warn({ name: this.name }, 'Circuit breaker opened from half-open due to failure');
    } else if (this.state === CircuitState.CLOSED && this.failures >= this.config.failureThreshold) {
      this.open();
      logger.warn({ 
        name: this.name, 
        failures: this.failures, 
        threshold: this.config.failureThreshold 
      }, 'Circuit breaker opened due to failure threshold');
    }
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  /**
   * Reset the circuit breaker to closed state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = undefined;
  }

  /**
   * Check if we should attempt to reset from open state
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? Date.now() >= this.nextAttemptTime.getTime() : false;
  }

  /**
   * Force open the circuit breaker
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    logger.warn({ name: this.name }, 'Circuit breaker forced open');
  }

  /**
   * Force close the circuit breaker
   */
  forceClose(): void {
    this.reset();
    logger.info({ name: this.name }, 'Circuit breaker forced closed');
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED || 
           (this.state === CircuitState.HALF_OPEN && this.successes > 0);
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(name: string, fn: () => Promise<T>, config?: Partial<CircuitBreakerConfig>): Promise<T> {
    const breaker = this.getBreaker(name, config);
    return breaker.execute(fn);
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): { healthy: string[]; unhealthy: string[] } {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, breaker] of this.breakers) {
      if (breaker.isHealthy()) {
        healthy.push(name);
      } else {
        unhealthy.push(name);
      }
    }

    return { healthy, unhealthy };
  }

  /**
   * Force open all circuit breakers
   */
  forceOpenAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceOpen();
    }
    logger.warn('All circuit breakers forced open');
  }

  /**
   * Force close all circuit breakers
   */
  forceCloseAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceClose();
    }
    logger.info('All circuit breakers forced closed');
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();