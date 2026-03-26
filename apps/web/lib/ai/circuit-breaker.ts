/**
 * Circuit Breaker for AI service calls.
 * 
 * Prevents cascading failures by tracking error rates and
 * temporarily blocking requests when the failure threshold is exceeded.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are rejected immediately
 * - HALF_OPEN: Testing if service recovered, allows limited requests
 */

interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 60_000 = 1 min) */
  resetTimeoutMs?: number;
  /** Number of successes needed to close from half-open (default: 2) */
  successThreshold?: number;
  /** Window in ms to count failures (default: 120_000 = 2 min) */
  windowMs?: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  openedAt: number | null;
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: { timestamp: number; error: string }[] = [];
  private halfOpenSuccesses = 0;
  private openedAt: number | null = null;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly windowMs: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60_000;
    this.successThreshold = options.successThreshold ?? 2;
    this.windowMs = options.windowMs ?? 120_000;
  }

  /** Check if a request should be allowed */
  canExecute(): { allowed: boolean; reason?: string; state: CircuitState } {
    this.pruneOldFailures();

    if (this.state === 'CLOSED') {
      return { allowed: true, state: 'CLOSED' };
    }

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenSuccesses = 0;
        return { allowed: true, state: 'HALF_OPEN' };
      }
      const retryIn = Math.ceil((this.resetTimeoutMs - elapsed) / 1000);
      return {
        allowed: false,
        reason: `AI service circuit breaker is OPEN — too many recent failures. Retry in ${retryIn}s.`,
        state: 'OPEN',
      };
    }

    // HALF_OPEN — allow limited requests
    return { allowed: true, state: 'HALF_OPEN' };
  }

  /** Record a successful call */
  recordSuccess(): void {
    this.lastSuccess = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failures = [];
        this.openedAt = null;
      }
    }
  }

  /** Record a failed call */
  recordFailure(error: string): void {
    const now = Date.now();
    this.lastFailure = now;
    this.failures.push({ timestamp: now, error: error.slice(0, 200) });

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open immediately re-opens
      this.state = 'OPEN';
      this.openedAt = now;
      return;
    }

    this.pruneOldFailures();
    if (this.failures.length >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }

  /** Check if error is a transient failure worth tracking */
  isTransientError(error: unknown): boolean {
    const msg = (error as Error)?.message || String(error);
    // Don't count deployment/config errors as transient
    if (msg.includes('DeploymentNotFound') || msg.includes('does not exist') || msg.includes('model_not_found')) {
      return false;
    }
    // Count rate limits, timeouts, and server errors as transient
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') ||
           msg.includes('timeout') || msg.includes('AbortError') ||
           msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') ||
           msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');
  }

  /** Get current stats */
  getStats(): CircuitStats {
    this.pruneOldFailures();
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.halfOpenSuccesses,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
    };
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.windowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }
}

// Shared circuit breakers per service
const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a named service.
 * Breakers are singletons per name within the process.
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    breakers.set(name, breaker);
  }
  return breaker;
}

/**
 * Execute a function with circuit breaker protection.
 * Throws immediately if circuit is open.
 */
export async function withCircuitBreaker<T>(
  breakerName: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<T> {
  const breaker = getCircuitBreaker(breakerName, options);
  const check = breaker.canExecute();
  
  if (!check.allowed) {
    throw new Error(check.reason || 'Circuit breaker is open');
  }

  try {
    const result = await fn();
    breaker.recordSuccess();
    return result;
  } catch (error) {
    if (breaker.isTransientError(error)) {
      breaker.recordFailure((error as Error).message || String(error));
    }
    throw error;
  }
}

export { CircuitBreaker };
