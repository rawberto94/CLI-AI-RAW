/**
 * Memory Management Utilities
 * Provides tools for efficient memory usage and cache management
 */

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  maxSize: number;          // Maximum number of entries
  maxMemoryMB?: number;     // Maximum memory usage in MB
  ttlMs?: number;           // Default TTL in milliseconds
  onEvict?: (key: string, value: unknown) => void;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  estimatedMemoryMB: number;
}

export interface CacheEntry<T> {
  value: T;
  size: number;           // Estimated size in bytes
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  expiresAt?: number;
}

// ============================================================================
// LRU Cache with Size Limits
// ============================================================================

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private config: Required<CacheConfig>;
  private stats = { hits: 0, misses: 0 };
  private currentMemory = 0;

  constructor(config: CacheConfig) {
    this.config = {
      maxSize: config.maxSize,
      maxMemoryMB: config.maxMemoryMB ?? 50,
      ttlMs: config.ttlMs ?? 5 * 60 * 1000, // 5 minutes default
      onEvict: config.onEvict ?? (() => {}),
    };
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update access info
    entry.accessedAt = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    // Calculate estimated size
    const size = this.estimateSize(value);

    // If already exists, update
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentMemory -= existing.size;
      this.cache.delete(key);
    }

    // Evict if necessary
    this.evictIfNeeded(size);

    const entry: CacheEntry<V> = {
      value,
      size,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      expiresAt: ttlMs !== undefined
        ? Date.now() + ttlMs
        : this.config.ttlMs
          ? Date.now() + this.config.ttlMs
          : undefined,
    };

    this.cache.set(key, entry);
    this.currentMemory += size;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemory -= entry.size;
      this.config.onEvict(String(key), entry.value);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    for (const [key, entry] of this.cache) {
      this.config.onEvict(String(key), entry.value);
    }
    this.cache.clear();
    this.currentMemory = 0;
    this.stats = { hits: 0, misses: 0 };
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      estimatedMemoryMB: this.currentMemory / (1024 * 1024),
    };
  }

  // Get all keys (for iteration)
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  // Prune expired entries
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  private evictIfNeeded(newSize: number): void {
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

    // Evict until we have room
    while (
      (this.cache.size >= this.config.maxSize ||
        this.currentMemory + newSize > maxMemoryBytes) &&
      this.cache.size > 0
    ) {
      // Get oldest entry (first in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }
  }

  private estimateSize(value: unknown): number {
    if (value === null || value === undefined) {
      return 8;
    }

    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }

    if (typeof value === 'number') {
      return 8;
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 16);
    }

    if (typeof value === 'object') {
      let size = 16; // Object overhead
      for (const key in value) {
        size += key.length * 2; // Key
        size += this.estimateSize((value as Record<string, unknown>)[key]); // Value
      }
      return size;
    }

    return 8; // Default
  }
}

// ============================================================================
// Weak Reference Cache (for large objects)
// ============================================================================

export class WeakCache<K extends object, V> {
  private cache: WeakMap<K, V> = new WeakMap();
  private keyRegistry: FinalizationRegistry<string>;
  private stats = { hits: 0, misses: 0 };
  private keyCount = 0;

  constructor() {
    // Track when keys are garbage collected
    this.keyRegistry = new FinalizationRegistry(() => {
      this.keyCount--;
    });
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      this.stats.hits++;
      return this.cache.get(key);
    }
    this.stats.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    if (!this.cache.has(key)) {
      this.keyCount++;
      this.keyRegistry.register(key, 'tracked');
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    if (this.cache.has(key)) {
      this.keyCount--;
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  getStats(): { hits: number; misses: number; hitRate: number; approximateSize: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      approximateSize: this.keyCount,
    };
  }
}

// ============================================================================
// Memory Pressure Detection
// ============================================================================

export type MemoryPressureLevel = 'none' | 'moderate' | 'critical';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function getMemoryInfo(): MemoryInfo | null {
  if (typeof window === 'undefined') return null;
  
  const perf = performance as Performance & { memory?: MemoryInfo };
  if (!perf.memory) return null;
  
  return {
    usedJSHeapSize: perf.memory.usedJSHeapSize,
    totalJSHeapSize: perf.memory.totalJSHeapSize,
    jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
  };
}

export function getMemoryPressure(): MemoryPressureLevel {
  const info = getMemoryInfo();
  if (!info) return 'none';

  const usage = info.usedJSHeapSize / info.jsHeapSizeLimit;

  if (usage > 0.9) return 'critical';
  if (usage > 0.7) return 'moderate';
  return 'none';
}

// ============================================================================
// Cache Manager (Global)
// ============================================================================

class CacheManager {
  private caches: Map<string, LRUCache<unknown, unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Set up periodic cleanup
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Every minute
    }
  }

  register<K, V>(name: string, config: CacheConfig): LRUCache<K, V> {
    const cache = new LRUCache<K, V>(config);
    this.caches.set(name, cache as LRUCache<unknown, unknown>);
    return cache;
  }

  get<K, V>(name: string): LRUCache<K, V> | undefined {
    return this.caches.get(name) as LRUCache<K, V> | undefined;
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  cleanup(): void {
    const pressure = getMemoryPressure();

    for (const [name, cache] of this.caches) {
      // Always prune expired entries
      cache.prune();

      // If under memory pressure, clear caches more aggressively
      if (pressure === 'critical') {
        cache.clear();
      } else if (pressure === 'moderate') {
        // Clear half the cache
        const entries = Array.from(cache.keys());
        const toRemove = entries.slice(0, Math.floor(entries.length / 2));
        for (const key of toRemove) {
          cache.delete(key);
        }
      }
    }
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAll();
    this.caches.clear();
  }
}

// Singleton
let cacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}

// ============================================================================
// React Hook for Cache
// ============================================================================

import { useMemo, useCallback } from 'react';

export function useCache<K, V>(name: string, config: CacheConfig) {
  const cache = useMemo(() => {
    const manager = getCacheManager();
    let existing = manager.get<K, V>(name);
    if (!existing) {
      existing = manager.register<K, V>(name, config);
    }
    return existing;
  }, [name, config]);

  const get = useCallback((key: K) => cache.get(key), [cache]);
  const set = useCallback((key: K, value: V, ttlMs?: number) => cache.set(key, value, ttlMs), [cache]);
  const remove = useCallback((key: K) => cache.delete(key), [cache]);
  const clear = useCallback(() => cache.clear(), [cache]);
  const stats = useCallback(() => cache.getStats(), [cache]);

  return { get, set, remove, clear, stats };
}

// ============================================================================
// Prefetch Manager
// ============================================================================

export interface PrefetchConfig {
  maxConcurrent?: number;
  priority?: 'high' | 'normal' | 'low';
  ttlMs?: number;
}

class PrefetchManager {
  private pending = new Map<string, Promise<unknown>>();
  private cache = new LRUCache<string, unknown>({
    maxSize: 100,
    maxMemoryMB: 20,
    ttlMs: 5 * 60 * 1000,
  });
  private activeFetches = 0;
  private maxConcurrent = 3;

  async prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: PrefetchConfig = {}
  ): Promise<T> {
    // Return cached if available
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    // Return pending if already fetching
    const pending = this.pending.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Wait if at max concurrent
    while (this.activeFetches >= (config.maxConcurrent ?? this.maxConcurrent)) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Start fetch
    this.activeFetches++;
    const promise = fetcher()
      .then(data => {
        this.cache.set(key, data, config.ttlMs);
        return data;
      })
      .finally(() => {
        this.activeFetches--;
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      cacheStats: this.cache.getStats(),
      pendingCount: this.pending.size,
      activeFetches: this.activeFetches,
    };
  }
}

let prefetchManager: PrefetchManager | null = null;

export function getPrefetchManager(): PrefetchManager {
  if (!prefetchManager) {
    prefetchManager = new PrefetchManager();
  }
  return prefetchManager;
}

export function prefetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  config?: PrefetchConfig
): Promise<T> {
  return getPrefetchManager().prefetch(key, fetcher, config);
}
