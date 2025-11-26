/**
 * Circuit Breaker Pattern Implementation
 * Protects external service calls from cascading failures
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation, requests pass through
  OPEN = 'OPEN',         // Failure threshold exceeded, requests blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Number of successes in half-open state before closing */
  successThreshold: number;
  /** Time in ms before attempting recovery (moving to half-open) */
  resetTimeout: number;
  /** Time in ms for request timeout */
  requestTimeout?: number;
  /** Custom function to determine if error should count as failure */
  isFailure?: (error: Error) => boolean;
  /** Called when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, metrics: CircuitMetrics) => void;
  /** Called on each failure */
  onFailure?: (error: Error, metrics: CircuitMetrics) => void;
}

export interface CircuitMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  openedAt?: Date;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState,
    public readonly metrics: CircuitMetrics
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private openedAt?: Date;
  private resetTimer?: NodeJS.Timeout;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {}

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      throw new CircuitBreakerError(
        `Circuit breaker ${this.name} is OPEN. Service unavailable.`,
        this.state,
        this.getMetrics()
      );
    }

    try {
      // Execute with optional timeout
      const result = this.options.requestTimeout
        ? await this.executeWithTimeout(fn, this.options.requestTimeout)
        : await fn();

      this.onSuccess();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Check if this error should count as failure
      const shouldCountAsFailure = this.options.isFailure
        ? this.options.isFailure(err)
        : true;

      if (shouldCountAsFailure) {
        this.onFailure(err);
      }

      throw error;
    }
  }

  /**
   * Execute with timeout wrapper
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    this.options.onFailure?.(error, this.getMetrics());

    if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open state opens the circuit again
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      if (this.consecutiveFailures >= this.options.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    // Clear any existing reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    // Handle state-specific logic
    switch (newState) {
      case CircuitState.OPEN:
        this.openedAt = new Date();
        // Schedule transition to half-open
        this.resetTimer = setTimeout(() => {
          this.transitionTo(CircuitState.HALF_OPEN);
        }, this.options.resetTimeout);
        break;

      case CircuitState.HALF_OPEN:
        // Reset counters for testing phase
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures = 0;
        break;

      case CircuitState.CLOSED:
        // Reset all counters
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures = 0;
        this.openedAt = undefined;
        break;
    }

    this.options.onStateChange?.(oldState, newState, this.getMetrics());
  }

  /**
   * Get current circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Reset all metrics and state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.totalRequests = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.openedAt = undefined;
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
}

/**
 * Circuit Breaker Registry - manages multiple circuit breakers
 */
class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let circuit = this.circuits.get(name);
    
    if (!circuit && options) {
      circuit = new CircuitBreaker(name, options);
      this.circuits.set(name, circuit);
    }
    
    if (!circuit) {
      throw new Error(`Circuit breaker '${name}' not found and no options provided`);
    }
    
    return circuit;
  }

  /**
   * Check if a circuit breaker exists
   */
  has(name: string): boolean {
    return this.circuits.has(name);
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Record<string, CircuitMetrics> {
    const metrics: Record<string, CircuitMetrics> = {};
    
    for (const [name, circuit] of this.circuits) {
      metrics[name] = circuit.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Pre-configured circuit breakers for common services
 */
export const openAICircuitBreaker = circuitBreakerRegistry.get('openai', {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  requestTimeout: 120000, // 2 minutes for AI calls
  isFailure: (error) => {
    // Don't count rate limits as failures (we should handle separately)
    if (error.message.includes('rate limit')) return false;
    // Don't count validation errors as failures
    if (error.message.includes('Invalid request')) return false;
    return true;
  },
  onStateChange: (from, to, metrics) => {
    console.log(`[CircuitBreaker] OpenAI: ${from} -> ${to}`, {
      failures: metrics.failures,
      successes: metrics.successes,
    });
  },
});

export const mistralCircuitBreaker = circuitBreakerRegistry.get('mistral', {
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeout: 30000,
  requestTimeout: 60000, // 1 minute for OCR
  onStateChange: (from, to, metrics) => {
    console.log(`[CircuitBreaker] Mistral: ${from} -> ${to}`, {
      failures: metrics.failures,
      successes: metrics.successes,
    });
  },
});

export const storageCircuitBreaker = circuitBreakerRegistry.get('storage', {
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeout: 10000, // 10 seconds
  requestTimeout: 30000,
  onStateChange: (from, to, metrics) => {
    console.log(`[CircuitBreaker] Storage: ${from} -> ${to}`, {
      failures: metrics.failures,
      successes: metrics.successes,
    });
  },
});

export const databaseCircuitBreaker = circuitBreakerRegistry.get('database', {
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeout: 5000, // 5 seconds - database should recover quickly
  requestTimeout: 10000,
  onStateChange: (from, to, metrics) => {
    console.log(`[CircuitBreaker] Database: ${from} -> ${to}`, {
      failures: metrics.failures,
      successes: metrics.successes,
    });
  },
});

/**
 * Decorator for applying circuit breaker to class methods
 */
export function withCircuitBreaker(circuitName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const circuit = circuitBreakerRegistry.get(circuitName);
      return circuit.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Utility function to wrap any async function with a circuit breaker
 */
export function wrapWithCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  circuit: CircuitBreaker
): T {
  return (async (...args: Parameters<T>) => {
    return circuit.execute(() => fn(...args));
  }) as T;
}
