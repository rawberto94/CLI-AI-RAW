/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by temporarily disabling failing services
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Number of successes in half-open state to close the circuit */
  successThreshold: number;
  /** Time in ms before attempting to close an open circuit */
  resetTimeout: number;
  /** Time window in ms for counting failures */
  failureWindow: number;
  /** Optional callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  failureTimestamps: number[];
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 30000, // 30 seconds
  failureWindow: 60000, // 1 minute
};

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private options: CircuitBreakerOptions;
  private readonly name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      failureTimestamps: [],
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.isOpen()) {
      // Check if we should transition to half-open
      if (Date.now() >= this.state.nextAttemptTime) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(this.name, this.state.nextAttemptTime);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if the circuit is currently open
   */
  isOpen(): boolean {
    return this.state.state === 'OPEN';
  }

  /**
   * Get the current state of the circuit
   */
  getState(): CircuitState {
    return this.state.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state.state,
      failures: this.state.failures,
      successes: this.state.successes,
      lastFailureTime: this.state.lastFailureTime,
      nextAttemptTime: this.state.nextAttemptTime,
    };
  }

  /**
   * Force reset the circuit to closed state
   */
  reset(): void {
    this.state = {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      failureTimestamps: [],
    };
  }

  /**
   * Check if a request can be made (circuit is not open, or ready for half-open test)
   */
  canRequest(): boolean {
    if (this.state.state === 'CLOSED' || this.state.state === 'HALF_OPEN') {
      return true;
    }
    // Circuit is OPEN - check if it's time to try half-open
    if (Date.now() >= this.state.nextAttemptTime) {
      this.transitionTo('HALF_OPEN');
      return true;
    }
    return false;
  }

  /**
   * Record a successful request (public wrapper for onSuccess)
   */
  recordSuccess(): void {
    this.onSuccess();
  }

  /**
   * Record a failed request (public wrapper for onFailure)
   */
  recordFailure(): void {
    this.onFailure();
  }

  private onSuccess(): void {
    if (this.state.state === 'HALF_OPEN') {
      this.state.successes++;
      if (this.state.successes >= this.options.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.state.failures = 0;
      this.state.failureTimestamps = [];
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.state.failures++;
    this.state.lastFailureTime = now;
    this.state.failureTimestamps.push(now);

    // Clean old failures outside the window
    this.state.failureTimestamps = this.state.failureTimestamps.filter(
      (timestamp) => now - timestamp < this.options.failureWindow
    );

    if (this.state.state === 'HALF_OPEN') {
      // Any failure in half-open state opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state.state === 'CLOSED') {
      // Check if we've hit the threshold
      if (this.state.failureTimestamps.length >= this.options.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state;
    if (oldState === newState) return;

    this.state.state = newState;

    switch (newState) {
      case 'OPEN':
        this.state.nextAttemptTime = Date.now() + this.options.resetTimeout;
        this.state.successes = 0;
        break;
      case 'HALF_OPEN':
        this.state.successes = 0;
        break;
      case 'CLOSED':
        this.state.failures = 0;
        this.state.successes = 0;
        this.state.failureTimestamps = [];
        break;
    }

    this.options.onStateChange?.(oldState, newState);
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[CircuitBreaker:${this.name}] ${oldState} -> ${newState}`);
    }
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  readonly circuitName: string;
  readonly nextAttemptTime: number;
  readonly retryAfter: number;

  constructor(circuitName: string, nextAttemptTime: number) {
    const retryAfter = Math.max(0, nextAttemptTime - Date.now());
    super(`Circuit breaker '${circuitName}' is open. Retry after ${Math.ceil(retryAfter / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.nextAttemptTime = nextAttemptTime;
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Circuit Breaker Registry
// ============================================================================

const circuitRegistry = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  if (!circuitRegistry.has(name)) {
    circuitRegistry.set(name, new CircuitBreaker(name, options));
  }
  return circuitRegistry.get(name)!;
}

/**
 * Get all circuit breakers and their states
 */
export function getAllCircuitStats() {
  const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
  for (const [name, breaker] of circuitRegistry) {
    stats[name] = breaker.getStats();
  }
  return stats;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuits(): void {
  for (const breaker of circuitRegistry.values()) {
    breaker.reset();
  }
}
