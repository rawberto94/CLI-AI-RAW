/**
 * Semantic Cache Service
 * 
 * Caches RAG queries and responses using semantic similarity to reduce
 * API costs and latency. Uses embeddings to find similar past queries.
 * 
 * Features:
 * - Semantic similarity matching (not just exact match)
 * - TTL-based expiration
 * - LRU eviction when cache is full
 * - Configurable similarity threshold
 * 
 * @version 1.0.0
 */

import { Redis } from '@upstash/redis';
import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

// =============================================================================
// TYPES
// =============================================================================

export interface CacheEntry {
  query: string;
  embedding: number[];
  response: CachedResponse;
  createdAt: number;
  hitCount: number;
  lastAccessed: number;
}

export interface CachedResponse {
  content: string;
  sources: string[];
  ragResults?: Array<{
    contractId: string;
    contractName: string;
    score: number;
    text: string;
  }>;
  metadata: {
    intent?: string;
    confidence: number;
    tokensUsed: number;
  };
}

export interface CacheConfig {
  maxEntries: number;
  ttlSeconds: number;
  similarityThreshold: number;
  enabled: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  avgHitCount: number;
}

// =============================================================================
// SEMANTIC CACHE SERVICE
// =============================================================================

export class SemanticCacheService {
  private redis: Redis | null = null;
  private openai: OpenAI | null = null;
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    avgHitCount: 0,
  };

  // In-memory fallback cache
  private memoryCache: Map<string, CacheEntry> = new Map();

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxEntries: config?.maxEntries ?? 1000,
      ttlSeconds: config?.ttlSeconds ?? 3600, // 1 hour default
      similarityThreshold: config?.similarityThreshold ?? 0.92, // High threshold for precision
      enabled: config?.enabled ?? true,
    };

    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize Redis (Upstash)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }

    // Initialize OpenAI for embeddings
    if (hasAIClientConfig()) {
      this.openai = createOpenAIClient();
    }
  }

  /**
   * Check cache for semantically similar query
   */
  async get(query: string, tenantId: string): Promise<CachedResponse | null> {
    if (!this.config.enabled || !this.openai) {
      return null;
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.getEmbedding(query);
      if (!queryEmbedding) return null;

      // Get all cache entries for this tenant
      const entries = await this.getCacheEntries(tenantId);
      
      // Find best semantic match
      let bestMatch: CacheEntry | null = null;
      let bestSimilarity = 0;

      for (const entry of entries) {
        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
        
        if (similarity > bestSimilarity && similarity >= this.config.similarityThreshold) {
          bestSimilarity = similarity;
          bestMatch = entry;
        }
      }

      if (bestMatch) {
        // Update hit count and last accessed
        this.stats.hits++;
        bestMatch.hitCount++;
        bestMatch.lastAccessed = Date.now();
        await this.updateCacheEntry(tenantId, bestMatch);

        this.updateHitRate();
        return bestMatch.response;
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      console.error('[SemanticCache] Get error:', error);
      return null;
    }
  }

  /**
   * Store response in cache
   */
  async set(
    query: string,
    response: CachedResponse,
    tenantId: string
  ): Promise<void> {
    if (!this.config.enabled || !this.openai) {
      return;
    }

    try {
      // Generate embedding for the query
      const embedding = await this.getEmbedding(query);
      if (!embedding) return;

      const entry: CacheEntry = {
        query,
        embedding,
        response,
        createdAt: Date.now(),
        hitCount: 0,
        lastAccessed: Date.now(),
      };

      // Check if we need to evict old entries
      const entries = await this.getCacheEntries(tenantId);
      if (entries.length >= this.config.maxEntries) {
        await this.evictLRU(tenantId, entries);
      }

      // Store the entry
      await this.storeCacheEntry(tenantId, entry);
      this.stats.totalEntries++;
    } catch (error) {
      console.error('[SemanticCache] Set error:', error);
    }
  }

  /**
   * Invalidate cache for a tenant (e.g., when contracts change)
   */
  async invalidate(tenantId: string, contractId?: string): Promise<void> {
    try {
      if (this.redis) {
        if (contractId) {
          // Only invalidate entries related to this contract
          const entries = await this.getCacheEntries(tenantId);
          for (const entry of entries) {
            const hasContract = entry.response.ragResults?.some(
              r => r.contractId === contractId
            );
            if (hasContract) {
              await this.deleteCacheEntry(tenantId, entry.query);
            }
          }
        } else {
          // Invalidate all entries for tenant
          await this.redis.del(`semantic-cache:${tenantId}`);
        }
      } else {
        // Memory cache
        if (contractId) {
          for (const [key, entry] of this.memoryCache.entries()) {
            if (key.startsWith(tenantId) && 
                entry.response.ragResults?.some(r => r.contractId === contractId)) {
              this.memoryCache.delete(key);
            }
          }
        } else {
          for (const key of this.memoryCache.keys()) {
            if (key.startsWith(tenantId)) {
              this.memoryCache.delete(key);
            }
          }
        }
      }
    } catch (error) {
      console.error('[SemanticCache] Invalidate error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 256, // Smaller dimension for cache efficiency
      });
      return response.data[0].embedding;
    } catch {
      return null;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async getCacheEntries(tenantId: string): Promise<CacheEntry[]> {
    if (this.redis) {
      const data = await this.redis.hgetall(`semantic-cache:${tenantId}`);
      if (!data) return [];
      
      const entries: CacheEntry[] = [];
      const expiredKeys: string[] = [];
      
      for (const [key, v] of Object.entries(data)) {
        const entry = typeof v === 'string' ? JSON.parse(v) : v;
        const age = Date.now() - entry.createdAt;
        if (age < this.config.ttlSeconds * 1000) {
          entries.push(entry);
        } else {
          expiredKeys.push(key);
        }
      }
      
      // Proactively clean up expired entries from Redis
      if (expiredKeys.length > 0) {
        this.redis.hdel(`semantic-cache:${tenantId}`, ...expiredKeys).catch(() => {});
      }
      
      return entries;
    } else {
      // Memory cache fallback
      const entries: CacheEntry[] = [];
      const expiredKeys: string[] = [];
      for (const [key, entry] of this.memoryCache.entries()) {
        if (key.startsWith(tenantId)) {
          const age = Date.now() - entry.createdAt;
          if (age < this.config.ttlSeconds * 1000) {
            entries.push(entry);
          } else {
            expiredKeys.push(key);
          }
        }
      }
      // Clean up expired in-memory entries
      for (const key of expiredKeys) {
        this.memoryCache.delete(key);
      }
      return entries;
    }
  }

  private async storeCacheEntry(tenantId: string, entry: CacheEntry): Promise<void> {
    const key = this.generateKey(entry.query);
    
    if (this.redis) {
      await this.redis.hset(
        `semantic-cache:${tenantId}`,
        { [key]: JSON.stringify(entry) }
      );
      // Only set TTL if the hash is newly created (TTL = -1 means no expiry set).
      // We do NOT reset TTL on every write — individual entry expiration is
      // handled in getCacheEntries() by filtering on entry.createdAt.
      // The hash-level TTL serves as a safety net to avoid unbounded growth.
      const ttl = await this.redis.ttl(`semantic-cache:${tenantId}`);
      if (ttl < 0) {
        // No TTL set yet — set a generous outer bound (2x entry TTL)
        await this.redis.expire(
          `semantic-cache:${tenantId}`,
          this.config.ttlSeconds * 2
        );
      }
    } else {
      this.memoryCache.set(`${tenantId}:${key}`, entry);
    }
  }

  private async updateCacheEntry(tenantId: string, entry: CacheEntry): Promise<void> {
    await this.storeCacheEntry(tenantId, entry);
  }

  private async deleteCacheEntry(tenantId: string, query: string): Promise<void> {
    const key = this.generateKey(query);
    
    if (this.redis) {
      await this.redis.hdel(`semantic-cache:${tenantId}`, key);
    } else {
      this.memoryCache.delete(`${tenantId}:${key}`);
    }
  }

  private async evictLRU(tenantId: string, entries: CacheEntry[]): Promise<void> {
    // Sort by last accessed (oldest first)
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest 10%
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      await this.deleteCacheEntry(tenantId, entries[i].query);
    }
  }

  private generateKey(query: string): string {
    // FNV-1a 64-bit-ish hash — much lower collision rate than 32-bit djb2.
    // Uses two independent 32-bit accumulators to produce a 16-hex-char key.
    let h1 = 0x811c9dc5 | 0;
    let h2 = 0x01000193 | 0;
    for (let i = 0; i < query.length; i++) {
      const c = query.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x811c9dc5);
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `q_${hex1}${hex2}`;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const semanticCache = new SemanticCacheService();

// Export default config for reference
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 1000,
  ttlSeconds: 3600,
  similarityThreshold: 0.92,
  enabled: true,
};
