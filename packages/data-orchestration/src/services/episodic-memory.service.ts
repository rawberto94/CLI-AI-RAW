/**
 * Episodic Memory Service
 * 
 * Provides long-term memory for AI interactions, storing and retrieving
 * past conversations, user preferences, and learned patterns.
 * Uses vector embeddings for semantic similarity search.
 * 
 * @version 1.0.0
 */

import { prisma } from '../lib/prisma';
import { Redis } from '@upstash/redis';
import OpenAI from 'openai';


// Initialize Redis for caching
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn('Redis not available for episodic memory');
}

// Initialize OpenAI for embeddings
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch {
  console.warn('OpenAI not available for embeddings');
}

// =============================================================================
// TYPES
// =============================================================================

export interface EpisodicMemory {
  id: string;
  tenantId: string;
  userId: string;
  type: MemoryType;
  content: string;
  context: MemoryContext;
  embedding?: number[];
  importance: number; // 0-1 score
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

export type MemoryType = 
  | 'conversation'
  | 'correction'
  | 'preference'
  | 'pattern'
  | 'fact'
  | 'procedure'
  | 'insight';

export interface MemoryContext {
  contractId?: string;
  contractName?: string;
  artifactType?: string;
  topic?: string;
  entities?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  actionTaken?: string;
  outcome?: 'success' | 'failure' | 'partial';
}

export interface MemoryQuery {
  query: string;
  tenantId: string;
  userId?: string;
  types?: MemoryType[];
  contractId?: string;
  minImportance?: number;
  limit?: number;
  recencyBias?: number; // 0-1, how much to weight recent memories
}

export interface MemorySearchResult {
  memory: EpisodicMemory;
  similarity: number;
  recencyScore: number;
  importanceScore: number;
  combinedScore: number;
}

export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  oldestMemory: Date | null;
  newestMemory: Date | null;
  storageUsedMB: number;
}

// =============================================================================
// IN-MEMORY STORE (for development/fallback)
// =============================================================================

class InMemoryStore {
  private memories: Map<string, EpisodicMemory> = new Map();
  private embeddings: Map<string, number[]> = new Map();

  async store(memory: EpisodicMemory): Promise<void> {
    this.memories.set(memory.id, memory);
    if (memory.embedding) {
      this.embeddings.set(memory.id, memory.embedding);
    }
  }

  async get(id: string): Promise<EpisodicMemory | null> {
    return this.memories.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
    this.embeddings.delete(id);
  }

  async search(query: MemoryQuery, queryEmbedding?: number[]): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    const now = new Date();

    for (const memory of this.memories.values()) {
      // Filter by tenant and optionally user
      if (memory.tenantId !== query.tenantId) continue;
      if (query.userId && memory.userId !== query.userId) continue;
      if (query.types && !query.types.includes(memory.type)) continue;
      if (query.contractId && memory.context.contractId !== query.contractId) continue;
      if (query.minImportance && memory.importance < query.minImportance) continue;

      // Calculate similarity
      let similarity = 0;
      if (queryEmbedding && this.embeddings.has(memory.id)) {
        similarity = this.cosineSimilarity(queryEmbedding, this.embeddings.get(memory.id)!);
      } else {
        // Fallback to keyword matching
        similarity = this.keywordSimilarity(query.query, memory.content);
      }

      // Calculate recency score (exponential decay)
      const ageMs = now.getTime() - memory.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-ageDays / 30); // Half-life of ~30 days

      // Combined score
      const recencyBias = query.recencyBias ?? 0.3;
      const combinedScore = 
        similarity * (1 - recencyBias) + 
        recencyScore * recencyBias * 0.5 + 
        memory.importance * 0.2;

      results.push({
        memory,
        similarity,
        recencyScore,
        importanceScore: memory.importance,
        combinedScore,
      });
    }

    // Sort by combined score and limit
    return results
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, query.limit || 10);
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

  private keywordSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    let matches = 0;
    for (const word of queryWords) {
      if (contentWords.has(word)) matches++;
    }
    return matches / Math.max(queryWords.length, 1);
  }

  getStats(tenantId: string): MemoryStats {
    const tenantMemories = Array.from(this.memories.values()).filter(m => m.tenantId === tenantId);
    const byType: Record<MemoryType, number> = {
      conversation: 0,
      correction: 0,
      preference: 0,
      pattern: 0,
      fact: 0,
      procedure: 0,
      insight: 0,
    };
    
    let totalImportance = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const memory of tenantMemories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      totalImportance += memory.importance;
      if (!oldest || memory.createdAt < oldest) oldest = memory.createdAt;
      if (!newest || memory.createdAt > newest) newest = memory.createdAt;
    }

    return {
      totalMemories: tenantMemories.length,
      byType,
      avgImportance: tenantMemories.length > 0 ? totalImportance / tenantMemories.length : 0,
      oldestMemory: oldest,
      newestMemory: newest,
      storageUsedMB: JSON.stringify([...this.memories.values()]).length / (1024 * 1024),
    };
  }
}

// =============================================================================
// EPISODIC MEMORY SERVICE
// =============================================================================

export class EpisodicMemoryService {
  private static instance: EpisodicMemoryService;
  private store: InMemoryStore;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';

  private constructor() {
    this.store = new InMemoryStore();
  }

  public static getInstance(): EpisodicMemoryService {
    if (!EpisodicMemoryService.instance) {
      EpisodicMemoryService.instance = new EpisodicMemoryService();
    }
    return EpisodicMemoryService.instance;
  }

  // ============================================
  // EMBEDDING GENERATION
  // ============================================

  private async generateEmbedding(text: string): Promise<number[] | undefined> {
    if (!openai) return undefined;

    try {
      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text.slice(0, 8000), // Limit input size
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return undefined;
    }
  }

  // ============================================
  // MEMORY MANAGEMENT
  // ============================================

  /**
   * Store a new episodic memory
   */
  async remember(params: {
    tenantId: string;
    userId: string;
    type: MemoryType;
    content: string;
    context?: MemoryContext;
    importance?: number;
    metadata?: Record<string, any>;
    expiresAt?: Date;
  }): Promise<EpisodicMemory> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(params.content);
    
    // Calculate importance if not provided
    const importance = params.importance ?? this.calculateImportance(params);

    const memory: EpisodicMemory = {
      id,
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      content: params.content,
      context: params.context || {},
      embedding,
      importance,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      expiresAt: params.expiresAt,
      metadata: params.metadata || {},
    };

    await this.store.store(memory);

    // Cache in Redis if available
    if (redis) {
      await redis.set(`memory:${id}`, JSON.stringify(memory), { ex: this.CACHE_TTL });
    }

    return memory;
  }

  /**
   * Calculate importance score based on memory characteristics
   */
  private calculateImportance(params: {
    type: MemoryType;
    content: string;
    context?: MemoryContext;
  }): number {
    let score = 0.5; // Base score

    // Type weights
    const typeWeights: Record<MemoryType, number> = {
      correction: 0.9,   // User corrections are very important
      preference: 0.8,   // User preferences matter
      insight: 0.7,      // Insights are valuable
      pattern: 0.6,      // Patterns are useful
      fact: 0.5,         // Facts are baseline
      procedure: 0.5,    // Procedures are baseline
      conversation: 0.3, // Conversations are less critical to remember long-term
    };
    score = typeWeights[params.type] || 0.5;

    // Boost for contract-specific memories
    if (params.context?.contractId) {
      score = Math.min(1, score + 0.1);
    }

    // Boost for successful outcomes
    if (params.context?.outcome === 'success') {
      score = Math.min(1, score + 0.1);
    }

    // Boost for longer, more detailed content
    if (params.content.length > 500) {
      score = Math.min(1, score + 0.05);
    }

    return score;
  }

  /**
   * Recall memories based on a query
   */
  async recall(query: MemoryQuery): Promise<MemorySearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query.query);
    
    // Search memories
    const results = await this.store.search(query, queryEmbedding);
    
    // Update access counts for retrieved memories
    for (const result of results) {
      result.memory.accessCount++;
      result.memory.lastAccessed = new Date();
      await this.store.store(result.memory);
    }

    return results;
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(id: string): Promise<EpisodicMemory | null> {
    // Check Redis cache first
    if (redis) {
      const cached = await redis.get(`memory:${id}`);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }
    }

    return this.store.get(id);
  }

  /**
   * Forget a specific memory
   */
  async forget(id: string): Promise<void> {
    await this.store.delete(id);
    if (redis) {
      await redis.del(`memory:${id}`);
    }
  }

  /**
   * Consolidate and clean up old memories
   */
  async consolidate(tenantId: string): Promise<{
    consolidated: number;
    deleted: number;
  }> {
    // This would typically:
    // 1. Merge similar memories
    // 2. Delete low-importance old memories
    // 3. Summarize conversation memories
    // For now, returning placeholder
    return { consolidated: 0, deleted: 0 };
  }

  // ============================================
  // SPECIALIZED MEMORY OPERATIONS
  // ============================================

  /**
   * Remember a user correction for learning
   */
  async rememberCorrection(params: {
    tenantId: string;
    userId: string;
    contractId: string;
    artifactType: string;
    originalValue: any;
    correctedValue: any;
    fieldPath: string;
  }): Promise<EpisodicMemory> {
    const content = `User corrected ${params.fieldPath} from "${JSON.stringify(params.originalValue)}" to "${JSON.stringify(params.correctedValue)}" in ${params.artifactType} artifact.`;

    return this.remember({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'correction',
      content,
      context: {
        contractId: params.contractId,
        artifactType: params.artifactType,
        actionTaken: 'field_correction',
      },
      importance: 0.9,
      metadata: {
        fieldPath: params.fieldPath,
        originalValue: params.originalValue,
        correctedValue: params.correctedValue,
      },
    });
  }

  /**
   * Remember a user preference
   */
  async rememberPreference(params: {
    tenantId: string;
    userId: string;
    preferenceType: string;
    value: any;
    context?: string;
  }): Promise<EpisodicMemory> {
    const content = `User prefers ${params.preferenceType}: ${JSON.stringify(params.value)}. ${params.context || ''}`;

    return this.remember({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'preference',
      content,
      importance: 0.8,
      metadata: {
        preferenceType: params.preferenceType,
        value: params.value,
      },
    });
  }

  /**
   * Remember a conversation turn
   */
  async rememberConversation(params: {
    tenantId: string;
    userId: string;
    userMessage: string;
    assistantResponse: string;
    intent?: string;
    entities?: string[];
    contractId?: string;
  }): Promise<EpisodicMemory> {
    const content = `User: ${params.userMessage}\nAssistant: ${params.assistantResponse.slice(0, 500)}`;

    return this.remember({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'conversation',
      content,
      context: {
        contractId: params.contractId,
        topic: params.intent,
        entities: params.entities,
      },
      importance: 0.3,
      metadata: {
        userMessage: params.userMessage,
        assistantResponse: params.assistantResponse,
        intent: params.intent,
      },
      // Conversations expire after 30 days
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  /**
   * Remember a discovered pattern
   */
  async rememberPattern(params: {
    tenantId: string;
    userId: string;
    patternType: string;
    description: string;
    examples: string[];
    contractCategory?: string;
  }): Promise<EpisodicMemory> {
    const content = `Pattern discovered (${params.patternType}): ${params.description}. Examples: ${params.examples.join(', ')}`;

    return this.remember({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'pattern',
      content,
      importance: 0.7,
      metadata: {
        patternType: params.patternType,
        examples: params.examples,
        contractCategory: params.contractCategory,
      },
    });
  }

  /**
   * Remember an insight from analysis
   */
  async rememberInsight(params: {
    tenantId: string;
    userId: string;
    insight: string;
    confidence: number;
    source: 'ai' | 'user' | 'system';
    relatedContracts?: string[];
  }): Promise<EpisodicMemory> {
    return this.remember({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'insight',
      content: params.insight,
      importance: Math.min(1, 0.5 + params.confidence * 0.3),
      metadata: {
        confidence: params.confidence,
        source: params.source,
        relatedContracts: params.relatedContracts,
      },
    });
  }

  // ============================================
  // CONTEXT BUILDING
  // ============================================

  /**
   * Build context from relevant memories for AI prompts
   */
  async buildContext(params: {
    tenantId: string;
    userId: string;
    currentQuery: string;
    contractId?: string;
    maxMemories?: number;
  }): Promise<string> {
    const memories = await this.recall({
      query: params.currentQuery,
      tenantId: params.tenantId,
      userId: params.userId,
      contractId: params.contractId,
      limit: params.maxMemories || 5,
      recencyBias: 0.3,
    });

    if (memories.length === 0) {
      return '';
    }

    const contextParts: string[] = ['## Relevant Memory Context:'];

    for (const result of memories) {
      const memory = result.memory;
      const typeLabel = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
      contextParts.push(`\n### ${typeLabel} (relevance: ${Math.round(result.combinedScore * 100)}%):`);
      contextParts.push(memory.content);
    }

    return contextParts.join('\n');
  }

  /**
   * Get user-specific preferences and patterns
   */
  async getUserProfile(tenantId: string, userId: string): Promise<{
    preferences: EpisodicMemory[];
    patterns: EpisodicMemory[];
    recentCorrections: EpisodicMemory[];
  }> {
    const [preferences, patterns, corrections] = await Promise.all([
      this.recall({
        query: 'user preferences settings',
        tenantId,
        userId,
        types: ['preference'],
        limit: 10,
      }),
      this.recall({
        query: 'learned patterns behaviors',
        tenantId,
        userId,
        types: ['pattern'],
        limit: 10,
      }),
      this.recall({
        query: 'recent corrections edits',
        tenantId,
        userId,
        types: ['correction'],
        limit: 5,
        recencyBias: 0.8,
      }),
    ]);

    return {
      preferences: preferences.map(r => r.memory),
      patterns: patterns.map(r => r.memory),
      recentCorrections: corrections.map(r => r.memory),
    };
  }

  // ============================================
  // STATS & ANALYTICS
  // ============================================

  /**
   * Get memory statistics for a tenant
   */
  getStats(tenantId: string): MemoryStats {
    return this.store.getStats(tenantId);
  }
}

// =============================================================================
// FACTORY FUNCTION & SINGLETON
// =============================================================================

export function getEpisodicMemoryService(): EpisodicMemoryService {
  return EpisodicMemoryService.getInstance();
}

// Export singleton instance
export const episodicMemoryService = getEpisodicMemoryService();

// =============================================================================
// MEMORY MIDDLEWARE
// =============================================================================

/**
 * Middleware to automatically remember interactions
 */
export async function withMemory<T>(
  fn: () => Promise<T>,
  params: {
    tenantId: string;
    userId: string;
    type: MemoryType;
    describeInteraction: (result: T) => string;
    context?: MemoryContext;
  }
): Promise<T> {
  const memoryService = getEpisodicMemoryService();
  const result = await fn();
  
  // Store memory in background
  memoryService.remember({
    tenantId: params.tenantId,
    userId: params.userId,
    type: params.type,
    content: params.describeInteraction(result),
    context: params.context,
  }).catch(err => console.error('Failed to store memory:', err));

  return result;
}
