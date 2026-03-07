/**
 * Resilience Module Exports
 * 
 * Comprehensive resilience patterns for worker infrastructure:
 * - Circuit Breaker: Prevents cascading failures
 * - Retry: Exponential backoff for transient failures
 * - Backpressure: Queue depth management
 * - Priority Queue: Job prioritization and escalation
 */

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  getCircuitBreaker,
  circuits,
  getAllCircuitStats,
  withCircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitStats,
} from './circuit-breaker';

// Retry with Exponential Backoff
export {
  retry,
  RetryAbortedError,
  RetryExhaustedError,
  withRetry,
  withResiliency,
  OPENAI_RETRY_CONFIG,
  DATABASE_RETRY_CONFIG,
  STORAGE_RETRY_CONFIG,
  WEBHOOK_RETRY_CONFIG,
  type RetryConfig,
} from './retry';

// Backpressure Handling
export {
  BackpressureHandler,
  getBackpressureHandler,
  RateLimiter,
  RateLimitedError,
  withRateLimit,
  type BackpressureConfig,
  type QueueHealth,
  type RateLimiterConfig,
} from './backpressure';

// Priority Queue
export {
  PriorityQueueManager,
  JobPriority,
  inferPriority,
  buildJobOptions,
  getPriorityName,
  type PriorityJobOptions,
  type PriorityQueueConfig,
} from './priority-queue';
