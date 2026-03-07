/**
 * Scalability Utilities - Central Export
 * 
 * This module provides patterns and utilities for building
 * scalable, resilient frontend applications.
 */

// ============================================================================
// Circuit Breaker Pattern
// ============================================================================
export {
  CircuitBreaker,
  CircuitOpenError,
  getCircuitBreaker,
  getAllCircuitStats,
  resetAllCircuits,
  type CircuitState,
  type CircuitBreakerOptions,
} from './circuit-breaker';

// ============================================================================
// Request Optimization
// ============================================================================
export {
  // Deduplication
  deduplicateRequest,
  generateRequestKey,
  // Batching
  createBatcher,
  // Queue
  createRequestQueue,
  getGlobalRequestQueue,
} from './request-optimization';

// ============================================================================
// Lazy Loading
// ============================================================================
export {
  lazyComponent,
  withPreload,
  preloadComponent,
  HeavyComponents,
  setupRoutePreloading,
} from './lazy-components';

// ============================================================================
// Connection Health Monitoring
// ============================================================================
export {
  ConnectionHealthMonitor,
  getHealthMonitor,
  useEndpointHealth,
  useAllEndpointHealth,
  setupDefaultHealthChecks,
  getOverallSystemHealth,
  type HealthStatus,
  type EndpointHealth,
  type HealthCheckConfig,
  type HealthMonitorOptions,
} from './connection-health';

// ============================================================================
// Memory Management
// ============================================================================
export {
  // Caches
  LRUCache,
  WeakCache,
  getCacheManager,
  useCache,
  
  // Memory monitoring
  getMemoryInfo,
  getMemoryPressure,
  type MemoryPressureLevel,
  
  // Prefetching
  getPrefetchManager,
  prefetch,
  
  // Types
  type CacheConfig,
  type CacheStats,
  type CacheEntry,
  type PrefetchConfig,
} from './memory-management';

// ============================================================================
// Re-export from architecture
// ============================================================================
export {
  // Service Base
  BaseService,
  createSingleton,
  registerService,
  getService,
  hasService,
} from '@/lib/service-base';

export {
  // Event System
  TypedEventEmitter,
  eventBus,
  useEvent,
  useEmit,
} from '@/lib/event-emitter';

// ============================================================================
// Scalability Best Practices
// ============================================================================

/**
 * @fileoverview
 * 
 * ## Scalability Patterns Implemented
 * 
 * ### 1. Circuit Breaker Pattern
 * Prevents cascading failures when external services are down.
 * - Automatically opens circuit after consecutive failures
 * - Half-open state allows gradual recovery
 * - Configurable thresholds and timeouts
 * 
 * ```typescript
 * const breaker = getCircuitBreaker('api-service');
 * const result = await breaker.execute(() => fetch('/api/data'));
 * ```
 * 
 * ### 2. Request Deduplication
 * Prevents duplicate API calls for the same data.
 * - Merges concurrent identical requests
 * - Configurable dedup window
 * 
 * ```typescript
 * const data = await deduplicateRequest(
 *   generateRequestKey('GET', '/api/contracts'),
 *   () => fetch('/api/contracts').then(r => r.json())
 * );
 * ```
 * 
 * ### 3. Request Batching
 * Combines multiple small requests into batch calls.
 * - Reduces network overhead
 * - Configurable batch size and wait time
 * 
 * ```typescript
 * const batcher = createBatcher({
 *   maxBatchSize: 10,
 *   maxWaitTime: 50,
 *   batchFn: async (ids) => fetch('/api/batch', {
 *     method: 'POST',
 *     body: JSON.stringify({ ids })
 *   }).then(r => r.json())
 * });
 * 
 * // Individual calls are automatically batched
 * const item1 = await batcher.add('id-1');
 * const item2 = await batcher.add('id-2');
 * ```
 * 
 * ### 4. Request Queue with Rate Limiting
 * Controls the rate of outgoing requests.
 * - Prevents overwhelming the server
 * - Priority-based execution
 * - Configurable concurrency and rate limits
 * 
 * ```typescript
 * const queue = getGlobalRequestQueue();
 * const result = await queue.enqueue(
 *   () => fetch('/api/data').then(r => r.json()),
 *   1 // priority
 * );
 * ```
 * 
 * ### 5. Lazy Component Loading
 * Reduces initial bundle size by loading components on demand.
 * - Automatic error boundaries
 * - Loading states
 * - Preload on idle or interaction
 * 
 * ```typescript
 * const HeavyChart = lazyComponent(
 *   () => import('@/components/HeavyChart'),
 *   { preloadOnIdle: true }
 * );
 * ```
 * 
 * ## Performance Monitoring
 * 
 * Use these utilities to monitor application health:
 * 
 * ```typescript
 * // Check circuit breaker states
 * const circuitStats = getAllCircuitStats();
 * 
 * // Check request queue status
 * const queueStats = getGlobalRequestQueue().getStats();
 * ```
 */
