/**
 * Conversation Memory Service
 * Provides multi-turn conversation support with context retention
 */

import { PrismaClient } from '@prisma/client';
import { Redis } from '@upstash/redis';

const prisma = new PrismaClient();

// Redis client for fast conversation access (optional fallback to DB)
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  // Redis not available, using database fallback for conversation memory
}

// ============================================
// TYPES
// ============================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    action?: string;
    entities?: Record<string, unknown>;
    executedAction?: boolean;
    actionResult?: unknown;
  };
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  tenantId: string;
  messages: ConversationMessage[];
  state: {
    lastTopic?: string;
    lastIntent?: string;
    lastEntities?: Record<string, unknown>;
    referenceContext?: {
      lastContractId?: string;
      lastContractName?: string;
      lastSupplierName?: string;
      lastCategory?: string;
      lastSearchResults?: string[];
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityResolution {
  type: 'contract' | 'supplier' | 'category' | 'pronoun';
  originalText: string;
  resolvedValue: string;
  confidence: number;
}

// ============================================
// CONVERSATION MEMORY SERVICE
// ============================================

class ConversationMemoryService {
  private static instance: ConversationMemoryService;
  private readonly CONTEXT_WINDOW_SIZE = 10; // Last N messages
  private readonly CACHE_TTL = 3600; // 1 hour in Redis

  private constructor() {}

  public static getInstance(): ConversationMemoryService {
    if (!ConversationMemoryService.instance) {
      ConversationMemoryService.instance = new ConversationMemoryService();
    }
    return ConversationMemoryService.instance;
  }

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  async createConversation(userId: string, tenantId: string): Promise<string> {
    const conversationId = `conv_${userId}_${Date.now()}`;

    const conversation: ConversationContext = {
      conversationId,
      userId,
      tenantId,
      messages: [],
      state: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in Redis if available
    if (redis) {
      await redis.set(conversationId, JSON.stringify(conversation), { ex: this.CACHE_TTL });
    }

    // Also store in database for persistence
    // Note: Would need to add Conversation model to Prisma schema
    // For now, storing in user metadata or separate table

    return conversationId;
  }

  async getConversation(conversationId: string): Promise<ConversationContext | null> {
    // Try Redis first
    if (redis) {
      const cached = await redis.get(conversationId);
      if (cached && typeof cached === 'string') {
        return JSON.parse(cached);
      }
    }

    // Fall back to database
    // Would need Conversation model
    return null;
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: ConversationMessage['metadata']
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return;

    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date(),
      metadata,
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Update state based on message
    if (role === 'assistant' && metadata) {
      if (metadata.intent) conversation.state.lastIntent = metadata.intent;
      if (metadata.action) conversation.state.lastTopic = metadata.action;
      if (metadata.entities) conversation.state.lastEntities = metadata.entities;
    }

    // Keep only last N messages in context window
    if (conversation.messages.length > this.CONTEXT_WINDOW_SIZE) {
      conversation.messages = conversation.messages.slice(-this.CONTEXT_WINDOW_SIZE);
    }

    // Update storage
    if (redis) {
      await redis.set(conversationId, JSON.stringify(conversation), { ex: this.CACHE_TTL });
    }
  }

  async updateReferenceContext(
    conversationId: string,
    references: Partial<ConversationContext['state']['referenceContext']>
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return;

    conversation.state.referenceContext = {
      ...conversation.state.referenceContext,
      ...references,
    };
    conversation.updatedAt = new Date();

    if (redis) {
      await redis.set(conversationId, JSON.stringify(conversation), { ex: this.CACHE_TTL });
    }
  }

  // ============================================
  // CONTEXT RETRIEVAL
  // ============================================

  async getRecentMessages(conversationId: string, count: number = 5): Promise<ConversationMessage[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return [];

    return conversation.messages.slice(-count);
  }

  async getContextSummary(conversationId: string): Promise<string> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation || conversation.messages.length === 0) {
      return 'No previous conversation context.';
    }

    const recentMessages = conversation.messages.slice(-5);
    const summary = recentMessages
      .map((m) => `${m.role}: ${m.content.substring(0, 100)}...`)
      .join('\n');

    const state = conversation.state;
    let contextInfo = '\n\nContext:\n';
    if (state.lastTopic) contextInfo += `- Last topic: ${state.lastTopic}\n`;
    if (state.referenceContext?.lastContractName) {
      contextInfo += `- Last contract: ${state.referenceContext.lastContractName}\n`;
    }
    if (state.referenceContext?.lastSupplierName) {
      contextInfo += `- Last supplier: ${state.referenceContext.lastSupplierName}\n`;
    }

    return summary + contextInfo;
  }

  // ============================================
  // REFERENCE RESOLUTION
  // ============================================

  async resolveReferences(
    conversationId: string,
    currentMessage: string,
    tenantId: string
  ): Promise<{ resolvedMessage: string; resolutions: EntityResolution[] }> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return { resolvedMessage: currentMessage, resolutions: [] };
    }

    const resolutions: EntityResolution[] = [];
    let resolvedMessage = currentMessage;

    // Resolve pronouns and references
    const patterns = [
      { pattern: /\b(it|that contract|this contract|the contract)\b/gi, type: 'contract' as const },
      { pattern: /\b(they|that supplier|this supplier|the supplier)\b/gi, type: 'supplier' as const },
      { pattern: /\b(same category|that category|this category)\b/gi, type: 'category' as const },
    ];

    for (const { pattern, type } of patterns) {
      const matches = currentMessage.match(pattern);
      if (matches) {
        let resolvedValue: string | undefined;

        switch (type) {
          case 'contract':
            resolvedValue = conversation.state.referenceContext?.lastContractName;
            break;
          case 'supplier':
            resolvedValue = conversation.state.referenceContext?.lastSupplierName;
            break;
          case 'category':
            resolvedValue = conversation.state.referenceContext?.lastCategory;
            break;
        }

        if (resolvedValue) {
          matches.forEach((match) => {
            resolvedMessage = resolvedMessage.replace(match, resolvedValue!);
            resolutions.push({
              type,
              originalText: match,
              resolvedValue: resolvedValue!,
              confidence: 0.9,
            });
          });
        }
      }
    }

    // Handle follow-up questions
    const followUpPatterns = [
      { pattern: /^(and|also|what about|how about)\s+/i, needsContext: true },
      { pattern: /^(show me|list|find)\s+(more|another|other)/i, needsContext: true },
    ];

    for (const { pattern, needsContext } of followUpPatterns) {
      if (pattern.test(currentMessage) && needsContext) {
        const lastIntent = conversation.state.lastIntent;
        if (lastIntent) {
          // Prepend context hint
          resolvedMessage = `[Following up on ${lastIntent}] ${resolvedMessage}`;
        }
      }
    }

    return { resolvedMessage, resolutions };
  }

  // ============================================
  // CLARIFICATION DETECTION
  // ============================================

  async needsClarification(
    conversationId: string,
    userMessage: string,
    detectedEntities: Array<{ type: string; confidence: number; value: string }>
  ): Promise<{ needs: boolean; question?: string; options?: unknown[] }> {
    // Check if entities are ambiguous
    const ambiguousSupplier = detectedEntities.find(
      (e) => e.type === 'supplier' && e.confidence < 0.7
    );

    if (ambiguousSupplier) {
      // Search for similar suppliers
      // This would need a fuzzy match against supplier names
      return {
        needs: true,
        question: `I found multiple suppliers matching "${ambiguousSupplier.value}". Which one did you mean?`,
        options: [], // Would populate with actual matches
      };
    }

    // Check if action needs more parameters
    const conversation = await this.getConversation(conversationId);
    if (conversation?.state.lastIntent === 'action') {
      // Check if critical entities are missing
      // Example: renew contract without specifying which contract
    }

    return { needs: false };
  }

  // ============================================
  // PROACTIVE SUGGESTIONS
  // ============================================

  async generateSuggestions(conversationId: string, tenantId: string): Promise<string[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return [];

    const suggestions: string[] = [];
    const state = conversation.state;

    // Based on last topic
    if (state.lastTopic === 'list_expiring') {
      suggestions.push('Would you like to renew any of these contracts?');
      suggestions.push('Show me the contract details for one of these');
    }

    if (state.referenceContext?.lastContractName) {
      suggestions.push(`What are the key terms of ${state.referenceContext.lastContractName}?`);
      suggestions.push(`Show me all contracts with ${state.referenceContext.lastSupplierName}`);
    }

    if (state.lastIntent === 'analytics') {
      suggestions.push('Show me cost savings opportunities');
      suggestions.push('What are our top suppliers by spend?');
    }

    return suggestions;
  }

  // ============================================
  // CONVERSATION CLEANUP
  // ============================================

  async endConversation(conversationId: string): Promise<void> {
    if (redis) {
      await redis.del(conversationId);
    }
    // Mark as ended in database if using persistent storage
  }

  async cleanupOldConversations(olderThanHours: number = 24): Promise<number> {
    // Would need to implement based on storage mechanism
    return 0;
  }
}

export const conversationMemoryService = ConversationMemoryService.getInstance();
