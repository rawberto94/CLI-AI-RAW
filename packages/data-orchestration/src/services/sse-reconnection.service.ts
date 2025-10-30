/**
 * SSE Reconnection Service
 * Implements automatic reconnection with exponential backoff and jitter
 */

export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  jitterRange: number; // milliseconds
  backoffMultiplier: number;
}

export interface ReconnectionState {
  attempts: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  isReconnecting: boolean;
  totalReconnections: number;
}

export class SSEReconnectionService {
  private config: ReconnectionConfig;
  private state: ReconnectionState;
  private reconnectTimer?: NodeJS.Timeout;
  private onReconnect?: () => void;
  private onMaxAttemptsReached?: () => void;

  constructor(
    config: Partial<ReconnectionConfig> = {},
    callbacks: {
      onReconnect?: () => void;
      onMaxAttemptsReached?: () => void;
    } = {}
  ) {
    this.config = {
      maxAttempts: config.maxAttempts ?? 10,
      baseDelay: config.baseDelay ?? 1000, // 1 second
      maxDelay: config.maxDelay ?? 30000, // 30 seconds
      jitterRange: config.jitterRange ?? 1000, // 1 second
      backoffMultiplier: config.backoffMultiplier ?? 2,
    };

    this.state = {
      attempts: 0,
      isReconnecting: false,
      totalReconnections: 0,
    };

    this.onReconnect = callbacks.onReconnect;
    this.onMaxAttemptsReached = callbacks.onMaxAttemptsReached;
  }

  /**
   * Calculate delay for next reconnection attempt with exponential backoff and jitter
   */
  calculateDelay(attemptNumber: number): number {
    // Exponential backoff: baseDelay * (multiplier ^ attempt)
    const exponentialDelay = this.config.baseDelay * Math.pow(
      this.config.backoffMultiplier,
      attemptNumber
    );

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterRange;

    return cappedDelay + jitter;
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect(): boolean {
    // Check if already reconnecting
    if (this.state.isReconnecting) {
      console.log('[Reconnection] Already reconnecting, skipping...');
      return false;
    }

    // Check if max attempts reached
    if (this.state.attempts >= this.config.maxAttempts) {
      console.log('[Reconnection] Max attempts reached');
      this.state.isReconnecting = false;
      this.onMaxAttemptsReached?.();
      return false;
    }

    // Calculate delay
    const delay = this.calculateDelay(this.state.attempts);
    const nextAttempt = new Date(Date.now() + delay);

    this.state.isReconnecting = true;
    this.state.nextAttempt = nextAttempt;

    console.log(
      `[Reconnection] Scheduling attempt ${this.state.attempts + 1}/${this.config.maxAttempts} in ${Math.round(delay)}ms`
    );

    // Schedule reconnection
    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);

    return true;
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    this.state.attempts++;
    this.state.lastAttempt = new Date();

    console.log(`[Reconnection] Attempting reconnection (${this.state.attempts}/${this.config.maxAttempts})`);

    // Call reconnection callback
    this.onReconnect?.();
  }

  /**
   * Handle successful reconnection
   */
  onSuccess(): void {
    console.log('[Reconnection] Successfully reconnected');
    
    this.state.totalReconnections++;
    this.state.attempts = 0;
    this.state.isReconnecting = false;
    this.state.lastAttempt = undefined;
    this.state.nextAttempt = undefined;

    // Clear any pending timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Handle failed reconnection attempt
   */
  onFailure(): void {
    console.log(`[Reconnection] Attempt ${this.state.attempts} failed`);
    
    this.state.isReconnecting = false;

    // Schedule next attempt if not at max
    if (this.state.attempts < this.config.maxAttempts) {
      this.scheduleReconnect();
    } else {
      console.log('[Reconnection] Max attempts reached, giving up');
      this.onMaxAttemptsReached?.();
    }
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    console.log('[Reconnection] Resetting state');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.state = {
      attempts: 0,
      isReconnecting: false,
      totalReconnections: this.state.totalReconnections,
    };
  }

  /**
   * Cancel any pending reconnection
   */
  cancel(): void {
    console.log('[Reconnection] Cancelling reconnection');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.state.isReconnecting = false;
  }

  /**
   * Get current reconnection state
   */
  getState(): Readonly<ReconnectionState> {
    return { ...this.state };
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<ReconnectionConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReconnectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Check if should attempt reconnection
   */
  shouldReconnect(): boolean {
    return this.state.attempts < this.config.maxAttempts;
  }

  /**
   * Get time until next reconnection attempt
   */
  getTimeUntilNextAttempt(): number | null {
    if (!this.state.nextAttempt) {
      return null;
    }

    const now = Date.now();
    const nextAttemptTime = this.state.nextAttempt.getTime();
    const timeUntil = nextAttemptTime - now;

    return Math.max(0, timeUntil);
  }
}
