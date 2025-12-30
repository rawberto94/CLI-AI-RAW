type BreakerState = {
  failures: number;
  openedAt?: number;
};

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private state: BreakerState = { failures: 0 };

  constructor(options?: { failureThreshold?: number; cooldownMs?: number }) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.cooldownMs = options?.cooldownMs ?? 30_000;
  }

  canExecute(): boolean {
    if (!this.state.openedAt) return true;
    const elapsed = Date.now() - this.state.openedAt;
    return elapsed >= this.cooldownMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error('Circuit breaker open');
    }

    try {
      const result = await fn();
      this.state.failures = 0;
      this.state.openedAt = undefined;
      return result;
    } catch (error) {
      this.state.failures += 1;
      if (this.state.failures >= this.failureThreshold) {
        this.state.openedAt = Date.now();
      }
      throw error;
    }
  }
}
