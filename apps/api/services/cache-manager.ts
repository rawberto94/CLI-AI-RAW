import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface CacheConfig {
  redis?: {
    url: string;
    prefix?: string;
    maxRetries?: number;
    retryDelay?: number;
  };
  s3?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
  };
  memory?: {
    maxSize: number;
    maxAge: number;
  };
  cdn?: {
    baseUrl: string;
    invalidationEndpoint?: string;
    apiKey?: string;
  };
}

interface CacheEntry {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  tags: string[];
  contentType?: string;
  etag?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
  averageResponseTime: number;
  errorCount: number;
}

interface CacheLayer {
  name: string;
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, value: any, ttl?: number, options?: any): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  getStats(): CacheStats;
}

/**
 * Memory cache layer - fastest but limited capacity
 */
class MemoryCacheLayer implements CacheLayer {
  name = 'memory';
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxAge: number;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    averageResponseTime: 0,
    errorCount: 0
  };
  private responseTimes: number[] = [];

  constructor(maxSize: number = 100 * 1024 * 1024, maxAge: number = 300000) { // 100MB, 5min
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.startCleanupTask();
  }

  async get(key: string): Promise<CacheEntry | null> {
    const start = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check expiration
      if (entry.expiresAt < new Date()) {
        this.cache.delete(key);
        this.stats.size -= entry.size;
        this.stats.misses++;
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = new Date();
      
      this.stats.hits++;
      this.updateResponseTime(Date.now() - start);
      
      return { ...entry }; // Return copy to prevent mutation

    } catch (error) {
      this.stats.errorCount++;
      console.error('Memory cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.maxAge, options: any = {}): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');
      
      // Check if we need to evict entries
      this.ensureCapacity(size);

      const entry: CacheEntry = {
        key,
        value,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttl),
        accessCount: 0,
        lastAccessed: new Date(),
        size,
        tags: options.tags || [],
        contentType: options.contentType,
        etag: this.generateETag(serialized)
      };

      // Remove existing entry if it exists
      const existing = this.cache.get(key);
      if (existing) {
        this.stats.size -= existing.size;
      }

      this.cache.set(key, entry);
      this.stats.size += size;
      this.stats.sets++;

      return true;

    } catch (error) {
      this.stats.errorCount++;
      console.error('Memory cache set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.stats.size -= entry.size;
        this.stats.deletes++;
        return true;
      }
      return false;
    } catch (error) {
      this.stats.errorCount++;
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      this.cache.clear();
      this.stats.size = 0;
      return true;
    } catch (error) {
      this.stats.errorCount++;
      return false;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  /**
   * Evict entries to ensure we don't exceed capacity
   */
  private ensureCapacity(newEntrySize: number): void {
    while (this.stats.size + newEntrySize > this.maxSize && this.cache.size > 0) {
      this.evictLeastUsed();
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLeastUsed(): void {
    let oldestEntry: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey && oldestEntry) {
      this.cache.delete(oldestKey);
      this.stats.size -= oldestEntry.size;
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private startCleanupTask(): void {
    setInterval(() => {
      const now = new Date();
      const toDelete: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          toDelete.push(key);
        }
      }

      toDelete.forEach(key => {
        const entry = this.cache.get(key);
        if (entry) {
          this.cache.delete(key);
          this.stats.size -= entry.size;
        }
      });
    }, 60000); // Clean every minute
  }

  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    const sum = this.responseTimes.reduce((acc, t) => acc + t, 0);
    this.stats.averageResponseTime = sum / this.responseTimes.length;
  }

  private generateETag(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }
}

/**
 * Redis cache layer - distributed and persistent
 */
class RedisCacheLayer implements CacheLayer {
  name = 'redis';
  private client: any = null; // Redis client
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    averageResponseTime: 0,
    errorCount: 0
  };
  private prefix: string;
  private responseTimes: number[] = [];

  constructor(private config: NonNullable<CacheConfig['redis']>) {
    this.prefix = config.prefix || 'cache:';
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      // In real implementation, initialize Redis client
      // this.client = new Redis(this.config.url);
      console.log('Redis cache layer initialized');
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
    }
  }

  async get(key: string): Promise<CacheEntry | null> {
    const start = Date.now();
    
    try {
      // Simulate Redis get operation
      await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));
      
      // For demo purposes, return null (cache miss)
      this.stats.misses++;
      this.updateResponseTime(Date.now() - start);
      
      return null;

    } catch (error) {
      this.stats.errorCount++;
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600, options: any = {}): Promise<boolean> {
    try {
      // Simulate Redis set operation
      await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
      
      this.stats.sets++;
      return true;

    } catch (error) {
      this.stats.errorCount++;
      console.error('Redis cache set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Simulate Redis delete operation
      await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 5));
      
      this.stats.deletes++;
      return true;

    } catch (error) {
      this.stats.errorCount++;
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      // Simulate Redis clear operation
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
      
      return true;

    } catch (error) {
      this.stats.errorCount++;
      return false;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    const sum = this.responseTimes.reduce((acc, t) => acc + t, 0);
    this.stats.averageResponseTime = sum / this.responseTimes.length;
  }
}

/**
 * S3/CDN cache layer - for large static assets
 */
class S3CacheLayer implements CacheLayer {
  name = 's3';
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    averageResponseTime: 0,
    errorCount: 0
  };
  private responseTimes: number[] = [];

  constructor(private config: NonNullable<CacheConfig['s3']>) {}

  async get(key: string): Promise<CacheEntry | null> {
    const start = Date.now();
    
    try {
      // Simulate S3 get operation
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      
      // For demo purposes, return null (cache miss)
      this.stats.misses++;
      this.updateResponseTime(Date.now() - start);
      
      return null;

    } catch (error) {
      this.stats.errorCount++;
      console.error('S3 cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 86400, options: any = {}): Promise<boolean> {
    try {
      // Simulate S3 put operation
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      this.stats.sets++;
      return true;

    } catch (error) {
      this.stats.errorCount++;
      console.error('S3 cache set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Simulate S3 delete operation
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      
      this.stats.deletes++;
      return true;

    } catch (error) {
      this.stats.errorCount++;
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      // S3 doesn't have a clear all operation
      // This would require listing and deleting objects
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;

    } catch (error) {
      this.stats.errorCount++;
      return false;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    const sum = this.responseTimes.reduce((acc, t) => acc + t, 0);
    this.stats.averageResponseTime = sum / this.responseTimes.length;
  }
}

/**
 * Multi-tier cache manager that coordinates between different cache layers
 */
export class MultiTierCacheManager extends EventEmitter {
  private layers: CacheLayer[] = [];
  private globalStats = {
    requests: 0,
    hits: 0,
    misses: 0,
    layerHits: { memory: 0, redis: 0, s3: 0 },
    averageResponseTime: 0
  };
  private responseTimes: number[] = [];

  constructor(config: CacheConfig) {
    super();
    this.initializeLayers(config);
  }

  /**
   * Initialize cache layers based on configuration
   */
  private initializeLayers(config: CacheConfig): void {
    // Add memory cache layer (L1 - fastest)
    if (config.memory) {
      this.layers.push(new MemoryCacheLayer(config.memory.maxSize, config.memory.maxAge));
    }

    // Add Redis cache layer (L2 - distributed)
    if (config.redis) {
      this.layers.push(new RedisCacheLayer(config.redis));
    }

    // Add S3 cache layer (L3 - persistent, large files)
    if (config.s3) {
      this.layers.push(new S3CacheLayer(config.s3));
    }

    console.log(`Initialized multi-tier cache with ${this.layers.length} layers:`, 
                this.layers.map(l => l.name).join(', '));
  }

  /**
   * Get value from cache, checking layers in order
   */
  async get(key: string): Promise<any> {
    const start = Date.now();
    this.globalStats.requests++;

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      
      try {
        const entry = await layer.get(key);
        
        if (entry && entry.value) {
          // Cache hit - promote to higher layers
          await this.promoteToHigherLayers(key, entry, i);
          
          this.globalStats.hits++;
          this.globalStats.layerHits[layer.name as keyof typeof this.globalStats.layerHits]++;
          this.updateResponseTime(Date.now() - start);
          
          this.emit('cacheHit', {
            key,
            layer: layer.name,
            layerIndex: i,
            responseTime: Date.now() - start
          });
          
          return entry.value;
        }
      } catch (error) {
        console.error(`Error getting from ${layer.name} cache:`, error);
        // Continue to next layer
      }
    }

    // Cache miss across all layers
    this.globalStats.misses++;
    this.updateResponseTime(Date.now() - start);
    
    this.emit('cacheMiss', {
      key,
      responseTime: Date.now() - start
    });
    
    return null;
  }

  /**
   * Set value in cache across appropriate layers
   */
  async set(key: string, value: any, options: {
    ttl?: number;
    layers?: string[];
    tags?: string[];
    contentType?: string;
  } = {}): Promise<boolean> {
    const {
      ttl = 3600,
      layers = this.layers.map(l => l.name),
      tags = [],
      contentType
    } = options;

    const results: boolean[] = [];

    for (const layer of this.layers) {
      if (layers.includes(layer.name)) {
        try {
          // Adjust TTL based on layer
          let layerTtl = ttl;
          if (layer.name === 'memory') {
            layerTtl = Math.min(ttl, 300); // Max 5 minutes for memory
          } else if (layer.name === 's3') {
            layerTtl = Math.max(ttl, 3600); // Min 1 hour for S3
          }

          const success = await layer.set(key, value, layerTtl, {
            tags,
            contentType
          });
          
          results.push(success);
          
          if (success) {
            this.emit('cacheSet', {
              key,
              layer: layer.name,
              ttl: layerTtl,
              size: JSON.stringify(value).length
            });
          }
        } catch (error) {
          console.error(`Error setting in ${layer.name} cache:`, error);
          results.push(false);
        }
      }
    }

    return results.some(r => r); // Return true if at least one layer succeeded
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key: string): Promise<boolean> {
    const results: boolean[] = [];

    for (const layer of this.layers) {
      try {
        const success = await layer.delete(key);
        results.push(success);
        
        if (success) {
          this.emit('cacheDelete', {
            key,
            layer: layer.name
          });
        }
      } catch (error) {
        console.error(`Error deleting from ${layer.name} cache:`, error);
        results.push(false);
      }
    }

    return results.some(r => r);
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<boolean> {
    const results: boolean[] = [];

    for (const layer of this.layers) {
      try {
        const success = await layer.clear();
        results.push(success);
        
        if (success) {
          this.emit('cacheClear', {
            layer: layer.name
          });
        }
      } catch (error) {
        console.error(`Error clearing ${layer.name} cache:`, error);
        results.push(false);
      }
    }

    return results.every(r => r); // Return true only if all layers succeeded
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<boolean> {
    // This would require maintaining tag->key mappings
    // For now, just emit an event
    this.emit('tagInvalidation', { tag });
    
    console.log(`Cache invalidation requested for tag: ${tag}`);
    return true;
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): {
    global: typeof this.globalStats & { hitRate: number };
    layers: Array<{ name: string; stats: CacheStats }>;
  } {
    const total = this.globalStats.hits + this.globalStats.misses;
    const hitRate = total > 0 ? (this.globalStats.hits / total) * 100 : 0;

    return {
      global: {
        ...this.globalStats,
        hitRate
      },
      layers: this.layers.map(layer => ({
        name: layer.name,
        stats: layer.getStats()
      }))
    };
  }

  /**
   * Get cache by key with metadata
   */
  async getWithMetadata(key: string): Promise<{
    value: any;
    metadata: {
      layer: string;
      createdAt: Date;
      expiresAt: Date;
      accessCount: number;
      etag?: string;
    };
  } | null> {
    for (const layer of this.layers) {
      try {
        const entry = await layer.get(key);
        if (entry && entry.value) {
          return {
            value: entry.value,
            metadata: {
              layer: layer.name,
              createdAt: entry.createdAt,
              expiresAt: entry.expiresAt,
              accessCount: entry.accessCount,
              etag: entry.etag
            }
          };
        }
      } catch (error) {
        console.error(`Error getting metadata from ${layer.name} cache:`, error);
      }
    }
    
    return null;
  }

  /**
   * Warm cache with data
   */
  async warmCache(data: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const promises = data.map(item => 
      this.set(item.key, item.value, { ttl: item.ttl })
    );
    
    await Promise.allSettled(promises);
    
    this.emit('cacheWarmed', {
      itemCount: data.length
    });
  }

  /**
   * Promote cache entry to higher (faster) layers
   */
  private async promoteToHigherLayers(key: string, entry: CacheEntry, foundAtLayer: number): Promise<void> {
    if (foundAtLayer === 0) return; // Already at highest layer

    const promotionPromises: Promise<boolean>[] = [];

    for (let i = 0; i < foundAtLayer; i++) {
      const higherLayer = this.layers[i];
      
      // Calculate appropriate TTL for this layer
      let promotionTtl = Math.max(0, entry.expiresAt.getTime() - Date.now());
      
      if (higherLayer.name === 'memory') {
        promotionTtl = Math.min(promotionTtl, 300000); // Max 5 minutes for memory
      }

      promotionPromises.push(
        higherLayer.set(key, entry.value, promotionTtl, {
          tags: entry.tags,
          contentType: entry.contentType
        })
      );
    }

    await Promise.allSettled(promotionPromises);
    
    this.emit('cachePromotion', {
      key,
      fromLayer: this.layers[foundAtLayer].name,
      toLayerCount: foundAtLayer
    });
  }

  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    const sum = this.responseTimes.reduce((acc, t) => acc + t, 0);
    this.globalStats.averageResponseTime = sum / this.responseTimes.length;
  }
}

/**
 * Create a cache manager with default configuration
 */
export function createCacheManager(): MultiTierCacheManager {
  const config: CacheConfig = {
    memory: {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 300000 // 5 minutes
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      prefix: 'contract-cache:'
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      bucket: process.env.S3_BUCKET || 'cache',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin'
    },
    cdn: {
      baseUrl: process.env.CDN_BASE_URL || 'https://cdn.example.com'
    }
  };

  return new MultiTierCacheManager(config);
}

// Export singleton instance
export const cacheManager = createCacheManager();

// Cache decorators for easy integration
export function cached(ttl: number = 3600, layers: string[] = ['memory', 'redis']) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cacheManager.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute method
      const result = await method.apply(this, args);

      // Store in cache
      await cacheManager.set(cacheKey, result, { ttl, layers });

      return result;
    };

    return descriptor;
  };
}
