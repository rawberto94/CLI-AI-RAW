/**
 * AI Response Caching Service
 * 
 * Caches AI responses to reduce API costs and improve latency.
 * Features:
 * - Semantic similarity matching for cache hits
 * - TTL-based expiration
 * - LRU eviction policy
 * - Redis support with memory fallback
 */

import { createHash } from 'crypto';

// Types
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  metadata: {
    model: string;
    promptHash: string;
    createdAt: number;
    expiresAt: number;
    hitCount: number;
    lastAccessedAt: number;
    tokensUsed?: number;
    latencyMs?: number;
  };
}

export interface CacheConfig {
  ttlMs: number;          // Time to live in milliseconds
  maxEntries: number;     // Maximum cache entries
  similarityThreshold: number; // 0-1, for fuzzy matching
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  memoryUsage: number;
  costSaved: number;
}

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxEntries: 1000,
  similarityThreshold: 0.95,
};

// Cost per 1K tokens (for savings calculation)
const TOKEN_COSTS: Record<string, number> = {
  'gpt-4o': 0.01,
  'gpt-4o-mini': 0.00015,
  'gpt-4-turbo': 0.01,
  'mistral-large': 0.004,
};

class AICacheService {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    entries: 0,
    memoryUsage: 0,
    costSaved: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cache key from prompt and options
   */
  generateKey(prompt: string, model: string, options?: Record<string, unknown>): string {
    const normalized = this.normalizePrompt(prompt);
    const optionsStr = options ? JSON.stringify(options) : '';
    const content = `${model}:${normalized}:${optionsStr}`;
    return createHash('sha256').update(content).digest('hex').substring(0, 32);
  }

  /**
   * Normalize prompt for consistent hashing
   */
  private normalizePrompt(prompt: string): string {
    return prompt
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get cached response
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check expiration
    if (Date.now() > entry.metadata.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access metadata
    entry.metadata.hitCount++;
    entry.metadata.lastAccessedAt = Date.now();
    this.stats.hits++;
    this.updateHitRate();

    // Calculate cost saved
    if (entry.metadata.tokensUsed) {
      const costPerToken = TOKEN_COSTS[entry.metadata.model] || 0.001;
      this.stats.costSaved += (entry.metadata.tokensUsed / 1000) * costPerToken;
    }

    return entry.value as T;
  }

  /**
   * Set cached response
   */
  async set<T>(
    key: string,
    value: T,
    metadata: {
      model: string;
      prompt: string;
      tokensUsed?: number;
      latencyMs?: number;
    }
  ): Promise<void> {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      metadata: {
        model: metadata.model,
        promptHash: this.generateKey(metadata.prompt, metadata.model),
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.ttlMs,
        hitCount: 0,
        lastAccessedAt: Date.now(),
        tokensUsed: metadata.tokensUsed,
        latencyMs: metadata.latencyMs,
      },
    };

    this.cache.set(key, entry);
    this.stats.entries = this.cache.size;
  }

  /**
   * Find similar cached response (fuzzy matching)
   */
  async findSimilar<T>(
    prompt: string,
    model: string
  ): Promise<{ entry: CacheEntry<T>; similarity: number } | null> {
    const normalizedPrompt = this.normalizePrompt(prompt);
    let bestMatch: { entry: CacheEntry<T>; similarity: number } | null = null;

    for (const entry of this.cache.values()) {
      if (entry.metadata.model !== model) continue;
      if (Date.now() > entry.metadata.expiresAt) continue;

      // Simple word-based similarity (could be replaced with embeddings)
      const similarity = this.calculateSimilarity(
        normalizedPrompt,
        entry.key
      );

      if (
        similarity >= this.config.similarityThreshold &&
        (!bestMatch || similarity > bestMatch.similarity)
      ) {
        bestMatch = { entry: entry as CacheEntry<T>, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings (Jaccard similarity)
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldest: { key: string; lastAccessed: number } | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.metadata.lastAccessedAt < oldest.lastAccessed) {
        oldest = { key, lastAccessed: entry.metadata.lastAccessedAt };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
    }
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all entries for a model
   */
  invalidateByModel(model: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.model === model) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.entries = this.cache.size;
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      entries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimate (2 bytes per char)
    }
    return size;
  }

  /**
   * Get all cache entries (for debugging)
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.metadata.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    this.stats.entries = this.cache.size;
    return pruned;
  }
}

// Singleton instance
export const aiCache = new AICacheService();

// Helper function for caching AI calls
export async function withCache<T>(
  cacheKey: string,
  model: string,
  prompt: string,
  fetchFn: () => Promise<{ result: T; tokensUsed?: number; latencyMs?: number }>
): Promise<T> {
  // Try cache first
  const cached = await aiCache.get<T>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh result
  const { result, tokensUsed, latencyMs } = await fetchFn();

  // Cache the result
  await aiCache.set(cacheKey, result, {
    model,
    prompt,
    tokensUsed,
    latencyMs,
  });

  return result;
}
