import { createHash } from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum number of items in cache
}

interface CacheItem<T> {
  value: T;
  expires: number;
  lastAccessed: number;
}

export class InMemoryCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || 3600; // 1 hour default
    this.maxSize = options.maxSize || 1000;
  }

  private getKey(namespace: string, key: string): string {
    const hash = createHash('md5').update(`${namespace}:${key}`).digest('hex');
    return `${namespace}:${hash}`;
  }

  private isExpired(item: CacheItem<T>): boolean {
    return Date.now() > item.expires;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    if (this.cache.size <= this.maxSize) return;

    // Sort by last accessed time and remove oldest
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    const toRemove = entries.slice(0, this.cache.size - this.maxSize);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  get(namespace: string, key: string): T | null {
    this.evictExpired();
    
    const cacheKey = this.getKey(namespace, key);
    const item = this.cache.get(cacheKey);
    
    if (!item || this.isExpired(item)) {
      if (item) this.cache.delete(cacheKey);
      return null;
    }
    
    // Update last accessed time
    item.lastAccessed = Date.now();
    return item.value;
  }

  set(namespace: string, key: string, value: T, ttl?: number): void {
    this.evictExpired();
    this.evictLRU();
    
    const finalTTL = ttl || this.defaultTTL;
    const cacheKey = this.getKey(namespace, key);
    const now = Date.now();
    
    this.cache.set(cacheKey, {
      value,
      expires: now + (finalTTL * 1000),
      lastAccessed: now
    });
  }

  has(namespace: string, key: string): boolean {
    return this.get(namespace, key) !== null;
  }

  delete(namespace: string, key: string): boolean {
    const cacheKey = this.getKey(namespace, key);
    return this.cache.delete(cacheKey);
  }

  clear(namespace?: string): void {
    if (namespace) {
      const prefix = `${namespace}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  size(namespace?: string): number {
    if (namespace) {
      const prefix = `${namespace}:`;
      return Array.from(this.cache.keys()).filter(key => key.startsWith(prefix)).length;
    }
    return this.cache.size;
  }

  keys(namespace?: string): string[] {
    if (namespace) {
      const prefix = `${namespace}:`;
      return Array.from(this.cache.keys())
        .filter(key => key.startsWith(prefix))
        .map(key => key.replace(prefix, ''));
    }
    return Array.from(this.cache.keys());
  }

  stats() {
    const now = Date.now();
    let expired = 0;
    let valid = 0;
    
    for (const item of this.cache.values()) {
      if (now > item.expires) {
        expired++;
      } else {
        valid++;
      }
    }
    
    return {
      total: this.cache.size,
      valid,
      expired,
      maxSize: this.maxSize,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : null
    };
  }
}

// Global cache instance
export const appCache = new InMemoryCache({
  ttl: parseInt(process.env.CACHE_TTL || '3600'),
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
});

// Specialized caches for different data types
export const artifactCache = new InMemoryCache({
  ttl: 7200, // 2 hours for artifacts
  maxSize: 500
});

export const contractCache = new InMemoryCache({
  ttl: 1800, // 30 minutes for contract metadata
  maxSize: 1000
});

export const analysisCache = new InMemoryCache({
  ttl: 3600, // 1 hour for analysis results
  maxSize: 200
});

// Cache decorators and utilities
export function cached<T extends any[], R>(
  namespace: string,
  ttl?: number,
  keyGenerator?: (...args: T) => string
) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: T) {
      const cacheKey = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      // Try to get from cache
      const cached = appCache.get(namespace, cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Store in cache
      appCache.set(namespace, cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

// Cache warming utilities
export async function warmCache() {
  console.log('Warming cache...');
  
  // Warm up frequently accessed data
  try {
    // Example: Pre-cache common contract queries
    // This would be implemented based on your specific use cases
    console.log('Cache warming completed');
  } catch (error) {
    console.error('Cache warming failed:', error);
  }
}

// Cache monitoring
export function getCacheMetrics() {
  return {
    app: appCache.stats(),
    artifacts: artifactCache.stats(),
    contracts: contractCache.stats(),
    analysis: analysisCache.stats()
  };
}

// Cache cleanup job
export function startCacheCleanup(intervalMs = 300000) { // 5 minutes
  setInterval(() => {
    try {
      // Force cleanup of expired items
      appCache.get('_cleanup', '_trigger'); // This will trigger evictExpired
      artifactCache.get('_cleanup', '_trigger');
      contractCache.get('_cleanup', '_trigger');
      analysisCache.get('_cleanup', '_trigger');
      
      console.log('Cache cleanup completed', getCacheMetrics());
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }, intervalMs);
}

// Start cleanup on module load
if (process.env.NODE_ENV === 'production') {
  startCacheCleanup();
}
