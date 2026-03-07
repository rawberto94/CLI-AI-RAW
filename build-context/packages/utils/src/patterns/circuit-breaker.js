"use strict";
/**
 * Circuit Breaker Pattern Implementation
 * Protects external service calls from cascading failures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseCircuitBreaker = exports.storageCircuitBreaker = exports.mistralCircuitBreaker = exports.openAICircuitBreaker = exports.circuitBreakerRegistry = exports.CircuitBreaker = exports.CircuitBreakerError = exports.CircuitState = void 0;
exports.withCircuitBreaker = withCircuitBreaker;
exports.wrapWithCircuitBreaker = wrapWithCircuitBreaker;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN"; // Testing if service recovered
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreakerError extends Error {
    state;
    metrics;
    constructor(message, state, metrics) {
        super(message);
        this.state = state;
        this.metrics = metrics;
        this.name = 'CircuitBreakerError';
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
class CircuitBreaker {
    name;
    options;
    state = CircuitState.CLOSED;
    failures = 0;
    successes = 0;
    consecutiveSuccesses = 0;
    consecutiveFailures = 0;
    totalRequests = 0;
    lastFailureTime;
    lastSuccessTime;
    openedAt;
    resetTimer;
    constructor(name, options) {
        this.name = name;
        this.options = options;
    }
    /**
     * Execute a function through the circuit breaker
     */
    async execute(fn) {
        this.totalRequests++;
        // Check if circuit is open
        if (this.state === CircuitState.OPEN) {
            throw new CircuitBreakerError(`Circuit breaker ${this.name} is OPEN. Service unavailable.`, this.state, this.getMetrics());
        }
        try {
            // Execute with optional timeout
            const result = this.options.requestTimeout
                ? await this.executeWithTimeout(fn, this.options.requestTimeout)
                : await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
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
    async executeWithTimeout(fn, timeout) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)),
        ]);
    }
    /**
     * Handle successful execution
     */
    onSuccess() {
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
    onFailure(error) {
        this.failures++;
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        this.lastFailureTime = new Date();
        this.options.onFailure?.(error, this.getMetrics());
        if (this.state === CircuitState.HALF_OPEN) {
            // Single failure in half-open state opens the circuit again
            this.transitionTo(CircuitState.OPEN);
        }
        else if (this.state === CircuitState.CLOSED) {
            if (this.consecutiveFailures >= this.options.failureThreshold) {
                this.transitionTo(CircuitState.OPEN);
            }
        }
    }
    /**
     * Transition to a new state
     */
    transitionTo(newState) {
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
    getMetrics() {
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
    getState() {
        return this.state;
    }
    /**
     * Force circuit to open (for testing or manual intervention)
     */
    forceOpen() {
        this.transitionTo(CircuitState.OPEN);
    }
    /**
     * Force circuit to close (for testing or manual intervention)
     */
    forceClose() {
        this.transitionTo(CircuitState.CLOSED);
    }
    /**
     * Reset all metrics and state
     */
    reset() {
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
exports.CircuitBreaker = CircuitBreaker;
/**
 * Circuit Breaker Registry - manages multiple circuit breakers
 */
class CircuitBreakerRegistry {
    circuits = new Map();
    /**
     * Get or create a circuit breaker
     */
    get(name, options) {
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
    has(name) {
        return this.circuits.has(name);
    }
    /**
     * Get all circuit breaker metrics
     */
    getAllMetrics() {
        const metrics = {};
        for (const [name, circuit] of this.circuits) {
            metrics[name] = circuit.getMetrics();
        }
        return metrics;
    }
    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const circuit of this.circuits.values()) {
            circuit.reset();
        }
    }
}
// Global registry instance
exports.circuitBreakerRegistry = new CircuitBreakerRegistry();
/**
 * Pre-configured circuit breakers for common services
 */
exports.openAICircuitBreaker = exports.circuitBreakerRegistry.get('openai', {
    failureThreshold: 5,
    successThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    requestTimeout: 120000, // 2 minutes for AI calls
    isFailure: (error) => {
        // Don't count rate limits as failures (we should handle separately)
        if (error.message.includes('rate limit'))
            return false;
        // Don't count validation errors as failures
        if (error.message.includes('Invalid request'))
            return false;
        return true;
    },
    onStateChange: (from, to, metrics) => {
        console.log(`[CircuitBreaker] OpenAI: ${from} -> ${to}`, {
            failures: metrics.failures,
            successes: metrics.successes,
        });
    },
});
exports.mistralCircuitBreaker = exports.circuitBreakerRegistry.get('mistral', {
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
exports.storageCircuitBreaker = exports.circuitBreakerRegistry.get('storage', {
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
exports.databaseCircuitBreaker = exports.circuitBreakerRegistry.get('database', {
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
function withCircuitBreaker(circuitName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const circuit = exports.circuitBreakerRegistry.get(circuitName);
            return circuit.execute(() => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
/**
 * Utility function to wrap any async function with a circuit breaker
 */
function wrapWithCircuitBreaker(fn, circuit) {
    return (async (...args) => {
        return circuit.execute(() => fn(...args));
    });
}
