/**
 * Episodic Memory Integration Helper
 * 
 * Provides helper functions to integrate episodic memory into AI chat:
 * - Retrieve relevant memories based on conversation context
 * - Store new memories from conversations
 * - Format memories for prompt injection
 * - Memory importance scoring
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export interface Memory {
  id: string;
  type: 'insight' | 'preference' | 'fact' | 'decision' | 'interaction';
  content: string;
  importance: number;
  context?: string;
  tags?: string[];
  createdAt: Date;
}

export interface MemoryRetrievalOptions {
  maxMemories?: number;
  minImportance?: number;
  types?: Memory['type'][];
  includeContext?: boolean;
}

export interface MemoryStorageInput {
  userId: string;
  tenantId: string;
  type: Memory['type'];
  content: string;
  context?: string;
  tags?: string[];
  importance?: number;
}

// =============================================================================
// MEMORY RETRIEVAL
// =============================================================================

/**
 * Retrieve relevant memories for a conversation context
 */
export async function retrieveRelevantMemories(
  userId: string,
  tenantId: string,
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  options: MemoryRetrievalOptions = {}
): Promise<Memory[]> {
  const {
    maxMemories = 5,
    minImportance = 0.3,
    types,
  } = options;

  try {
    // Build context string from recent conversation
    const recentContext = conversationHistory
      .slice(-3)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    // Extract key topics from query and context
    const topics = extractTopics(query + ' ' + recentContext);

    // Search for memories by multiple strategies
    const [
      recentMemories,
      topicMemories,
      importantMemories,
    ] = await Promise.all([
      fetchRecentMemories(userId, tenantId, 3),
      fetchMemoriesByTopics(userId, tenantId, topics, maxMemories),
      fetchHighImportanceMemories(userId, tenantId, minImportance, maxMemories),
    ]);

    // Merge and deduplicate
    const allMemories = new Map<string, Memory>();
    [...recentMemories, ...topicMemories, ...importantMemories].forEach(m => {
      allMemories.set(m.id, m);
    });

    // Score and rank memories by relevance to current context
    const scoredMemories = Array.from(allMemories.values()).map(memory => ({
      ...memory,
      relevanceScore: calculateMemoryRelevance(memory, query, topics),
    }));

    // Sort by combined importance and relevance
    scoredMemories.sort((a, b) => {
      const scoreA = a.importance * 0.4 + a.relevanceScore * 0.6;
      const scoreB = b.importance * 0.4 + b.relevanceScore * 0.6;
      return scoreB - scoreA;
    });

    // Filter by type if specified
    let filtered = scoredMemories;
    if (types && types.length > 0) {
      filtered = filtered.filter(m => types.includes(m.type));
    }

    return filtered.slice(0, maxMemories);
  } catch (error) {
    console.error('[EpisodicMemory] Error retrieving memories:', error);
    return [];
  }
}

/**
 * Format memories for injection into AI prompt
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const formatted = memories.map(m => {
    const typeEmoji = getTypeEmoji(m.type);
    const importance = m.importance >= 0.8 ? '⭐' : '';
    return `${typeEmoji}${importance} ${m.content}${m.context ? ` (Context: ${m.context})` : ''}`;
  }).join('\n');

  return `\n---\n📚 Relevant Memory Context:\n${formatted}\n---\n`;
}

// =============================================================================
// MEMORY STORAGE
// =============================================================================

/**
 * Store a new memory from conversation
 */
export async function storeMemory(input: MemoryStorageInput): Promise<Memory | null> {
  const {
    userId,
    tenantId,
    type,
    content,
    context,
    tags = [],
    importance,
  } = input;

  try {
    // Calculate importance if not provided
    const calculatedImportance = importance ?? calculateImportance(type, content, context);

    // Check for duplicate/similar memories
    const isDuplicate = await checkForDuplicateMemory(userId, tenantId, content);
    if (isDuplicate) {
      // Duplicate memory skipped
      return null;
    }

    // Store in database
    const memory = await prisma.aiMemory.create({
      data: {
        userId,
        tenantId,
        type,
        content,
        context: context || null,
        tags,
        importance: calculatedImportance,
        lastAccessedAt: new Date(),
      },
    });

    return {
      id: memory.id,
      type: memory.type as Memory['type'],
      content: memory.content,
      importance: memory.importance,
      context: memory.context || undefined,
      tags: memory.tags,
      createdAt: memory.createdAt,
    };
  } catch (error) {
    console.error('[EpisodicMemory] Error storing memory:', error);
    return null;
  }
}

/**
 * Extract memories from a conversation turn
 */
export async function extractMemoriesFromConversation(
  userId: string,
  tenantId: string,
  userMessage: string,
  assistantResponse: string
): Promise<Memory[]> {
  const memories: Memory[] = [];

  // Extract user preferences
  const preferences = detectPreferences(userMessage);
  for (const pref of preferences) {
    const stored = await storeMemory({
      userId,
      tenantId,
      type: 'preference',
      content: pref,
      context: 'Detected from conversation',
    });
    if (stored) memories.push(stored);
  }

  // Extract facts/decisions from assistant response
  const facts = detectFacts(assistantResponse);
  for (const fact of facts) {
    const stored = await storeMemory({
      userId,
      tenantId,
      type: 'fact',
      content: fact,
      context: userMessage.slice(0, 100),
    });
    if (stored) memories.push(stored);
  }

  // Store important interactions
  if (isImportantInteraction(userMessage, assistantResponse)) {
    const stored = await storeMemory({
      userId,
      tenantId,
      type: 'interaction',
      content: `User asked: "${userMessage.slice(0, 100)}..." → Response provided about ${detectMainTopic(assistantResponse)}`,
      importance: 0.7,
    });
    if (stored) memories.push(stored);
  }

  return memories;
}

// =============================================================================
// MEMORY DECAY & MAINTENANCE
// =============================================================================

/**
 * Apply time-based decay to memory importance
 */
export async function applyMemoryDecay(
  userId: string,
  tenantId: string,
  decayRate: number = 0.95
): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Decay memories not accessed recently
    const result = await prisma.aiMemory.updateMany({
      where: {
        userId,
        tenantId,
        lastAccessedAt: { lt: thirtyDaysAgo },
        importance: { gt: 0.2 },
      },
      data: {
        importance: {
          multiply: decayRate,
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error('[EpisodicMemory] Error applying decay:', error);
    return 0;
  }
}

/**
 * Consolidate similar memories
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function consolidateMemories(
  _userId: string,
  _tenantId: string
): Promise<number> {
  // This would use embeddings to find similar memories and merge them
  // For now, return 0 as this requires more complex implementation
  return 0;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function fetchRecentMemories(
  userId: string,
  tenantId: string,
  limit: number
): Promise<Memory[]> {
  try {
    const memories = await prisma.aiMemory.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return memories.map(m => ({
      id: m.id,
      type: m.type as Memory['type'],
      content: m.content,
      importance: m.importance,
      context: m.context || undefined,
      tags: m.tags,
      createdAt: m.createdAt,
    }));
  } catch {
    return [];
  }
}

async function fetchMemoriesByTopics(
  userId: string,
  tenantId: string,
  topics: string[],
  limit: number
): Promise<Memory[]> {
  if (topics.length === 0) return [];

  try {
    const memories = await prisma.aiMemory.findMany({
      where: {
        userId,
        tenantId,
        OR: topics.map(topic => ({
          content: { contains: topic, mode: 'insensitive' as const },
        })),
      },
      orderBy: { importance: 'desc' },
      take: limit,
    });

    return memories.map(m => ({
      id: m.id,
      type: m.type as Memory['type'],
      content: m.content,
      importance: m.importance,
      context: m.context || undefined,
      tags: m.tags,
      createdAt: m.createdAt,
    }));
  } catch {
    return [];
  }
}

async function fetchHighImportanceMemories(
  userId: string,
  tenantId: string,
  minImportance: number,
  limit: number
): Promise<Memory[]> {
  try {
    const memories = await prisma.aiMemory.findMany({
      where: {
        userId,
        tenantId,
        importance: { gte: minImportance },
      },
      orderBy: { importance: 'desc' },
      take: limit,
    });

    return memories.map(m => ({
      id: m.id,
      type: m.type as Memory['type'],
      content: m.content,
      importance: m.importance,
      context: m.context || undefined,
      tags: m.tags,
      createdAt: m.createdAt,
    }));
  } catch {
    return [];
  }
}

async function checkForDuplicateMemory(
  userId: string,
  tenantId: string,
  content: string
): Promise<boolean> {
  try {
    const existing = await prisma.aiMemory.findFirst({
      where: {
        userId,
        tenantId,
        content: { contains: content.slice(0, 50), mode: 'insensitive' },
      },
    });
    return !!existing;
  } catch {
    return false;
  }
}

function extractTopics(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'can', 'may', 'might', 'must', 'shall', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
    'and', 'but', 'or', 'so', 'yet', 'not', 'no', 'yes', 'my', 'your',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10);
}

function calculateMemoryRelevance(
  memory: Memory,
  query: string,
  topics: string[]
): number {
  const memoryLower = memory.content.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;

  // Topic overlap
  const topicMatches = topics.filter(t => memoryLower.includes(t)).length;
  score += (topicMatches / Math.max(topics.length, 1)) * 0.5;

  // Direct query term matches
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 3);
  const queryMatches = queryTerms.filter(t => memoryLower.includes(t)).length;
  score += (queryMatches / Math.max(queryTerms.length, 1)) * 0.3;

  // Recency bonus
  const ageInDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - ageInDays / 30); // Decay over 30 days
  score += recencyScore * 0.2;

  return Math.min(1, score);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateImportance(
  type: Memory['type'],
  content: string,
  _context?: string
): number {
  let baseImportance = {
    decision: 0.9,
    insight: 0.8,
    preference: 0.7,
    fact: 0.6,
    interaction: 0.4,
  }[type] || 0.5;

  // Adjust based on content length (longer = potentially more important)
  if (content.length > 200) baseImportance += 0.05;
  if (content.length > 500) baseImportance += 0.05;

  // Adjust based on specific keywords
  const importantKeywords = ['critical', 'important', 'must', 'always', 'never', 'required', 'deadline'];
  const hasImportantKeywords = importantKeywords.some(k => content.toLowerCase().includes(k));
  if (hasImportantKeywords) baseImportance += 0.1;

  return Math.min(1, baseImportance);
}

function getTypeEmoji(type: Memory['type']): string {
  return {
    insight: '💡',
    preference: '🎯',
    fact: '📋',
    decision: '✅',
    interaction: '💬',
  }[type] || '📌';
}

function detectPreferences(text: string): string[] {
  const preferences: string[] = [];
  const patterns = [
    /i (?:prefer|like|want|need|always|never)\s+(.{10,50})/gi,
    /please (?:always|never)\s+(.{10,50})/gi,
    /i don't (?:like|want)\s+(.{10,50})/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      preferences.push(match[0].trim());
    }
  }

  return preferences.slice(0, 2);
}

function detectFacts(text: string): string[] {
  const facts: string[] = [];
  
  // Detect date-based facts
  const datePattern = /(?:deadline|due|expires?|valid until)[:\s]+\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/gi;
  const dateMatches = text.match(datePattern);
  if (dateMatches) facts.push(...dateMatches);

  // Detect monetary facts
  const moneyPattern = /(?:total|value|amount|cost|price)[:\s]+\$[\d,]+(?:\.\d{2})?/gi;
  const moneyMatches = text.match(moneyPattern);
  if (moneyMatches) facts.push(...moneyMatches);

  return facts.slice(0, 3);
}

function detectMainTopic(text: string): string {
  const topics = extractTopics(text);
  return topics.slice(0, 3).join(', ') || 'general information';
}

function isImportantInteraction(userMessage: string, assistantResponse: string): boolean {
  const importantIndicators = [
    'summarize', 'explain', 'analyze', 'compare', 'recommend',
    'decision', 'deadline', 'urgent', 'critical', 'important',
  ];

  const combinedText = (userMessage + ' ' + assistantResponse).toLowerCase();
  return importantIndicators.some(indicator => combinedText.includes(indicator));
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  extractTopics,
  calculateMemoryRelevance,
  calculateImportance,
  formatMemoriesForPrompt,
};
