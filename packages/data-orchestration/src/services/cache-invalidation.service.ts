/**
 * Cache Invalidation Service
 * Tag-based cache invalidation with intelligent dependency tracking
 */

import { multiLevelCacheService } from './multi-level-cache.service';
import { eventBus, Events } from '../events/event-bus';

export interface CacheTag {
  key: string;
  tags: string[];
  ttl?: number;
}

export class CacheInvalidationService {
  private tagRegistry: Map<string, Set<string>> = new Map(); // tag -> Set of cache keys
  private keyTags: Map<string, Set<string>> = new Map(); // cache key -> Set of tags

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Set cache with tags
   */
  async setWithTags(key: string, value: any, tags: string[], ttl?: number): Promise<void> {
    // Store in cache
    await multiLevelCacheService.set(key, value, ttl);

    // Register tags
    this.registerTags(key, tags);
  }

  /**
   * Register tags for a cache key
   */
  private registerTags(key: string, tags: string[]): void {
    // Store key -> tags mapping
    if (!this.keyTags.has(key)) {
      this.keyTags.set(key, new Set());
    }
    const keyTagSet = this.keyTags.get(key)!;
    
    // Store tag -> keys mapping
    tags.forEach(tag => {
      keyTagSet.add(tag);
      
      if (!this.tagRegistry.has(tag)) {
        this.tagRegistry.set(tag, new Set());
      }
      this.tagRegistry.get(tag)!.add(key);
    });
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateTags(tags: string[]): Promise<number> {
    const keysToInvalidate = new Set<string>();

    // Collect all keys associated with these tags
    tags.forEach(tag => {
      const keys = this.tagRegistry.get(tag);
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key));
      }
    });

    // Invalidate all collected keys
    const promises = Array.from(keysToInvalidate).map(key => 
      this.invalidateKey(key)
    );
    await Promise.all(promises);

    console.log(`[CacheInvalidation] Invalidated ${keysToInvalidate.size} keys for tags:`, tags);
    
    return keysToInvalidate.size;
  }

  /**
   * Invalidate a specific cache key
   */
  private async invalidateKey(key: string): Promise<void> {
    // Remove from cache
    await multiLevelCacheService.delete(key);

    // Clean up tag registry
    const tags = this.keyTags.get(key);
    if (tags) {
      tags.forEach(tag => {
        const keys = this.tagRegistry.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagRegistry.delete(tag);
          }
        }
      });
      this.keyTags.delete(key);
    }
  }

  /**
   * Invalidate all cache
   */
  async invalidateAll(): Promise<void> {
    await multiLevelCacheService.clear();
    this.tagRegistry.clear();
    this.keyTags.clear();
    console.log('[CacheInvalidation] Cleared all cache');
  }

  /**
   * Get cache with automatic tag registration
   */
  async getOrSet(
    key: string,
    factory: () => Promise<any>,
    tags: string[],
    ttl?: number
  ): Promise<any> {
    // Try to get from cache
    const cached = await multiLevelCacheService.get(key);
    if (cached !== null) {
      return cached;
    }

    // Generate value
    const value = await factory();

    // Store with tags
    await this.setWithTags(key, value, tags, ttl);

    return value;
  }

  /**
   * Setup event listeners for automatic invalidation
   */
  private setupEventListeners(): void {
    // Contract events
    eventBus.on(Events.CONTRACT_UPDATED, async (data) => {
      await this.invalidateTags([
        'contracts',
        `contract:${data.contractId}`,
        'analytics',
        'dashboard'
      ]);
    });

    eventBus.on(Events.CONTRACT_METADATA_UPDATED, async (data) => {
      await this.invalidateTags([
        `contract:${data.contractId}`,
        'contracts',
        'analytics'
      ]);
    });

    // Artifact events
    eventBus.on(Events.ARTIFACT_GENERATED, async (data) => {
      await this.invalidateTags([
        `contract:${data.contractId}`,
        `artifact:${data.artifactId}`,
        'artifacts',
        'analytics'
      ]);
    });

    eventBus.on(Events.ARTIFACT_UPDATED, async (data) => {
      await this.invalidateTags([
        `artifact:${data.artifactId}`,
        `contract:${data.contractId}`,
        'artifacts',
        'analytics'
      ]);
    });

    // Rate card events
    eventBus.on(Events.RATE_CARD_CREATED, async (data) => {
      await this.invalidateTags([
        'rate-cards',
        'benchmarks',
        `supplier:${data.supplierName}`,
        `role:${data.roleStandardized}`,
        'analytics',
        'opportunities'
      ]);
    });

    eventBus.on(Events.RATE_CARD_UPDATED, async (data) => {
      await this.invalidateTags([
        'rate-cards',
        `rate-card:${data.id}`,
        'benchmarks',
        `supplier:${data.supplierName}`,
        `role:${data.roleStandardized}`,
        'analytics',
        'opportunities'
      ]);
    });

    eventBus.on(Events.RATE_CARD_IMPORTED, async (data) => {
      await this.invalidateTags([
        'rate-cards',
        'benchmarks',
        'analytics',
        'opportunities'
      ]);
    });

    // Benchmark events
    eventBus.on(Events.BENCHMARK_CALCULATED, async (data) => {
      await this.invalidateTags([
        'benchmarks',
        `benchmark:${data.type}`,
        'analytics',
        'dashboard'
      ]);
    });

    eventBus.on(Events.BENCHMARK_INVALIDATED, async (data) => {
      await this.invalidateTags([
        'benchmarks',
        'analytics',
        'opportunities'
      ]);
    });

    // Processing events
    eventBus.on(Events.PROCESSING_COMPLETED, async (data) => {
      await this.invalidateTags([
        `contract:${data.contractId}`,
        'contracts',
        'analytics'
      ]);
    });
  }

  /**
   * Get statistics about cache tags
   */
  getStats(): { totalTags: number; totalKeys: number; tagDetails: any[] } {
    const tagDetails = Array.from(this.tagRegistry.entries()).map(([tag, keys]) => ({
      tag,
      keyCount: keys.size,
      keys: Array.from(keys)
    }));

    return {
      totalTags: this.tagRegistry.size,
      totalKeys: this.keyTags.size,
      tagDetails
    };
  }
}

export const cacheInvalidationService = new CacheInvalidationService();
