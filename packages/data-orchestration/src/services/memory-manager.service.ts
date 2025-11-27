/**
 * Memory Manager Service
 * Manages memory usage with cache size limits and resource cleanup
 */

import { EventEmitter } from 'events';

export interface MemoryConfig {
  maxCacheSize?: number; // bytes
  maxCacheEntries?: number;
  cleanupInterval?: number; // milliseconds
  memoryCheckInterval?: number; // milliseconds
  memoryWarningThreshold?: number; // percentage (0-100)
  memoryCriticalThreshold?: number; // percentage (0-100)
  enableAutoCleanup?: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number; // bytes
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl?: number; // milliseconds
}

export interface MemoryStats {
  totalCacheSize: number; // bytes
  totalCacheEntries: number;
  maxCacheSize: number;
  maxCacheEntries: number;
  cacheUtilization: number; // percentage
  oldestEntry?: Date;
  mostAccessedKey?: string;
  leastAccessedKey?: string;
  systemMemory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUtilization: number; // percentage
  };
}

export interface CleanupResult {
  entriesRemoved: number;
  bytesFreed: number;
  duration: number; // milliseconds
}

class MemoryManagerService extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<MemoryConfig>;
  private cleanupTimer?: NodeJS.Timeout;
  private memoryCheckTimer?: NodeJS.Timeout;
  private totalCacheSize: number = 0;

  constructor(config: MemoryConfig = {}) {
    super();
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 50 * 1024 * 1024, // 50 MB (reduced for dev environments)
      maxCacheEntries: config.maxCacheEntries ?? 5000, // Reduced from 10000
      cleanupInterval: config.cleanupInterval ?? 30000, // 30 seconds (more frequent cleanup)
      memoryCheckInterval: config.memoryCheckInterval ?? 15000, // 15 seconds (more frequent checks)
      memoryWarningThreshold: config.memoryWarningThreshold ?? 70, // Lower threshold
      memoryCriticalThreshold: config.memoryCriticalThreshold ?? 85, // Lower critical threshold
      enableAutoCleanup: config.enableAutoCleanup ?? true,
    };

    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
      this.startMemoryCheckTimer();
    }
  }

  /**
   * Set a cache entry
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      // Calculate size
      const size = this.calculateSize(value);

      // Check if adding this entry would exceed limits
      if (this.totalCacheSize + size > this.config.maxCacheSize) {
        // Try to free up space
        this.evictLRU(size);
        
        // Check again
        if (this.totalCacheSize + size > this.config.maxCacheSize) {
          console.warn(`[MemoryManager] Cannot add entry: would exceed max cache size`);
          return false;
        }
      }

      if (this.cache.size >= this.config.maxCacheEntries) {
        // Evict least recently used entry
        this.evictLRU(1);
      }

      // Remove old entry if exists
      const oldEntry = this.cache.get(key);
      if (oldEntry) {
        this.totalCacheSize -= oldEntry.size;
      }

      // Create new entry
      const entry: CacheEntry<T> = {
        key,
        value,
        size,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        ttl,
      };

      this.cache.set(key, entry);
      this.totalCacheSize += size;

      this.emit('cache:set', { key, size });

      return true;
    } catch (error) {
      console.error(`[MemoryManager] Error setting cache entry:`, error);
      return false;
    }
  }

  /**
   * Get a cache entry
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check TTL
    if (entry.ttl) {
      const age = Date.now() - entry.createdAt.getTime();
      if (age > entry.ttl) {
        this.delete(key);
        return undefined;
      }
    }

    // Update access stats
    entry.lastAccessed = new Date();
    entry.accessCount++;

    return entry.value as T;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check TTL
    if (entry.ttl) {
      const age = Date.now() - entry.createdAt.getTime();
      if (age > entry.ttl) {
        this.delete(key);
        return false;
      }
    }

    return true;
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    this.totalCacheSize -= entry.size;
    this.cache.delete(key);

    this.emit('cache:delete', { key, size: entry.size });

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const entriesRemoved = this.cache.size;
    const bytesFreed = this.totalCacheSize;

    this.cache.clear();
    this.totalCacheSize = 0;

    this.emit('cache:clear', { entriesRemoved, bytesFreed });

    console.log(`[MemoryManager] Cache cleared: ${entriesRemoved} entries, ${this.formatBytes(bytesFreed)} freed`);
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(targetBytes: number): number {
    const entries = Array.from(this.cache.values());
    
    // Sort by last accessed (oldest first)
    entries.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    let bytesFreed = 0;
    let entriesRemoved = 0;

    for (const entry of entries) {
      if (bytesFreed >= targetBytes) {
        break;
      }

      this.delete(entry.key);
      bytesFreed += entry.size;
      entriesRemoved++;
    }

    if (entriesRemoved > 0) {
      console.log(`[MemoryManager] Evicted ${entriesRemoved} LRU entries, freed ${this.formatBytes(bytesFreed)}`);
      this.emit('cache:evicted', { entriesRemoved, bytesFreed });
    }

    return bytesFreed;
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): CleanupResult {
    const startTime = Date.now();
    const now = Date.now();
    let entriesRemoved = 0;
    let bytesFreed = 0;

    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.ttl) {
        const age = now - entry.createdAt.getTime();
        if (age > entry.ttl) {
          keysToDelete.push(key);
          bytesFreed += entry.size;
        }
      }
    });

    keysToDelete.forEach(key => {
      this.delete(key);
      entriesRemoved++;
    });

    const duration = Date.now() - startTime;

    if (entriesRemoved > 0) {
      console.log(`[MemoryManager] Cleaned up ${entriesRemoved} expired entries, freed ${this.formatBytes(bytesFreed)}`);
    }

    return { entriesRemoved, bytesFreed, duration };
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const entries = Array.from(this.cache.values());

    // Find oldest entry
    const oldestEntry = entries.length > 0
      ? entries.reduce((oldest, entry) => 
          entry.createdAt < oldest.createdAt ? entry : oldest
        ).createdAt
      : undefined;

    // Find most and least accessed
    const sortedByAccess = [...entries].sort((a, b) => b.accessCount - a.accessCount);
    const mostAccessedKey = sortedByAccess[0]?.key;
    const leastAccessedKey = sortedByAccess[sortedByAccess.length - 1]?.key;

    // Get system memory stats
    const memUsage = process.memoryUsage();
    const systemMemory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUtilization: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };

    return {
      totalCacheSize: this.totalCacheSize,
      totalCacheEntries: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      maxCacheEntries: this.config.maxCacheEntries,
      cacheUtilization: (this.totalCacheSize / this.config.maxCacheSize) * 100,
      oldestEntry,
      mostAccessedKey,
      leastAccessedKey,
      systemMemory,
    };
  }

  /**
   * Check memory pressure and emit warnings
   */
  private checkMemoryPressure(): void {
    const stats = this.getStats();

    if (!stats.systemMemory) {
      return;
    }

    const heapUtilization = stats.systemMemory.heapUtilization;

    if (heapUtilization >= this.config.memoryCriticalThreshold) {
      this.emit('memory:critical', stats);
      console.error(`[MemoryManager] CRITICAL: Heap utilization at ${heapUtilization.toFixed(1)}%`);
      
      // Aggressive cleanup
      this.evictLRU(this.totalCacheSize * 0.3); // Free 30% of cache
    } else if (heapUtilization >= this.config.memoryWarningThreshold) {
      this.emit('memory:warning', stats);
      console.warn(`[MemoryManager] WARNING: Heap utilization at ${heapUtilization.toFixed(1)}%`);
      
      // Moderate cleanup
      this.evictLRU(this.totalCacheSize * 0.1); // Free 10% of cache
    }
  }

  /**
   * Calculate size of value in bytes (approximate)
   */
  private calculateSize(value: any): number {
    try {
      const json = JSON.stringify(value);
      return new Blob([json]).size;
    } catch (error) {
      // Fallback: rough estimate
      return 1024; // 1 KB default
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Start memory check timer
   */
  private startMemoryCheckTimer(): void {
    this.memoryCheckTimer = setInterval(() => {
      this.checkMemoryPressure();
    }, this.config.memoryCheckInterval);
  }

  /**
   * Stop memory check timer
   */
  private stopMemoryCheckTimer(): void {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = undefined;
    }
  }

  /**
   * Shutdown the memory manager
   */
  shutdown(): void {
    console.log('[MemoryManager] Shutting down...');

    this.stopCleanupTimer();
    this.stopMemoryCheckTimer();
    this.clear();

    console.log('[MemoryManager] Shutdown complete');
  }
}

// Export singleton instance
export const memoryManager = new MemoryManagerService({
  maxCacheSize: 100 * 1024 * 1024, // 100 MB
  maxCacheEntries: 10000,
  cleanupInterval: 60000, // 1 minute
  memoryCheckInterval: 30000, // 30 seconds
  memoryWarningThreshold: 80,
  memoryCriticalThreshold: 90,
  enableAutoCleanup: true,
});
