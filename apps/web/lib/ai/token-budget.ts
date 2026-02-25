/**
 * Token Budget Management
 * 
 * Manages context window limits to prevent overflow in long conversations.
 * Uses tiktoken for accurate token counting and implements smart truncation
 * strategies to preserve the most important context.
 * 
 * @version 1.0.0
 */

import {
  countTokens,
  countConversationTokens,
  MODEL_CONTEXT_WINDOWS,
  MODEL_OUTPUT_LIMITS,
} from './token-counter';

// Lightweight logger — avoids pino's thread-stream which is incompatible with Turbopack
const logger = {
  warn: (ctx: Record<string, unknown>, msg: string) => console.warn(`[token-budget] ${msg}`, ctx),
};

// ============================================================================
// TYPES
// ============================================================================

export interface TokenBudget {
  model: string;
  contextWindow: number;
  maxOutputTokens: number;
  reservedForOutput: number;
  reservedForTools: number;
  reservedForSystem: number;
  availableForContext: number;
}

export interface ContextPriority {
  systemPrompt: number;      // Highest priority (never truncate)
  ragContext: number;        // High priority (recent/relevant)
  recentMessages: number;    // Medium-high (last 3-5 messages)
  olderMessages: number;     // Medium (can summarize)
  memoryContext: number;     // Lower (can be truncated)
  additionalContext: number; // Lowest (truncate first)
}

export interface TruncationResult {
  content: string;
  originalTokens: number;
  truncatedTokens: number;
  truncated: boolean;
  strategy: TruncationStrategy;
}

export type TruncationStrategy = 
  | 'none'           // No truncation needed
  | 'tail'           // Cut from end
  | 'head'           // Cut from beginning
  | 'middle'         // Keep start and end, cut middle
  | 'summarize'      // Replace with summary (requires AI call)
  | 'sample';        // Keep representative samples

export interface BudgetAllocation {
  systemPrompt: TruncationResult;
  ragContext: TruncationResult;
  conversationHistory: TruncationResult;
  memoryContext: TruncationResult;
  additionalContext: TruncationResult;
  totalUsed: number;
  totalAvailable: number;
  withinBudget: boolean;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_BUDGET_CONFIG = {
  // Reserve tokens for expected output
  outputReservePercent: 0.15, // 15% of context for output
  
  // Reserve tokens for potential tool calls
  toolReserveTokens: 500,
  
  // Minimum tokens to keep for each component
  minSystemPromptTokens: 500,
  minRagContextTokens: 1000,
  minConversationTokens: 500,
  
  // Priority weights (higher = more important to preserve)
  priorities: {
    systemPrompt: 100,
    ragContext: 80,
    recentMessages: 70,
    olderMessages: 40,
    memoryContext: 30,
    additionalContext: 20,
  } as ContextPriority,
  
  // Number of recent messages to always preserve
  preserveRecentMessages: 4,
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate available token budget for a model
 */
export function calculateBudget(model: string = 'gpt-4o-mini'): TokenBudget {
  const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 128000;
  const maxOutputTokens = MODEL_OUTPUT_LIMITS[model] || 4096;
  
  const reservedForOutput = Math.min(
    maxOutputTokens,
    Math.floor(contextWindow * DEFAULT_BUDGET_CONFIG.outputReservePercent)
  );
  const reservedForTools = DEFAULT_BUDGET_CONFIG.toolReserveTokens;
  const reservedForSystem = DEFAULT_BUDGET_CONFIG.minSystemPromptTokens;
  
  const availableForContext = contextWindow - reservedForOutput - reservedForTools;
  
  return {
    model,
    contextWindow,
    maxOutputTokens,
    reservedForOutput,
    reservedForTools,
    reservedForSystem,
    availableForContext,
  };
}

/**
 * Truncate text to fit within token budget using specified strategy
 */
export function truncateToFit(
  text: string,
  maxTokens: number,
  model: string = 'gpt-4o-mini',
  strategy: TruncationStrategy = 'tail'
): TruncationResult {
  const currentTokens = countTokens(text, model).tokens;
  
  if (currentTokens <= maxTokens) {
    return {
      content: text,
      originalTokens: currentTokens,
      truncatedTokens: currentTokens,
      truncated: false,
      strategy: 'none',
    };
  }

  let truncatedContent: string;
  
  switch (strategy) {
    case 'head':
      // Keep the end, cut the beginning
      truncatedContent = truncateFromHead(text, maxTokens, model);
      break;
      
    case 'middle':
      // Keep start and end, cut middle
      truncatedContent = truncateMiddle(text, maxTokens, model);
      break;
      
    case 'sample':
      // Keep representative samples
      truncatedContent = sampleContent(text, maxTokens, model);
      break;
      
    case 'tail':
    default:
      // Keep the beginning, cut the end
      truncatedContent = truncateFromTail(text, maxTokens, model);
      break;
  }

  const truncatedTokens = countTokens(truncatedContent, model).tokens;
  
  return {
    content: truncatedContent,
    originalTokens: currentTokens,
    truncatedTokens,
    truncated: true,
    strategy,
  };
}

/**
 * Truncate from the end of text (keep beginning)
 */
function truncateFromTail(text: string, maxTokens: number, model: string): string {
  const words = text.split(/\s+/);
  let result = '';
  let tokens = 0;
  
  for (const word of words) {
    const testText = result ? `${result} ${word}` : word;
    const testTokens = countTokens(testText, model).tokens;
    
    if (testTokens > maxTokens - 20) { // Leave buffer for truncation marker
      break;
    }
    
    result = testText;
    tokens = testTokens;
  }
  
  return result + '... [truncated]';
}

/**
 * Truncate from the beginning of text (keep end)
 */
function truncateFromHead(text: string, maxTokens: number, model: string): string {
  const words = text.split(/\s+/);
  let result = '';
  let tokens = 0;
  
  for (let i = words.length - 1; i >= 0; i--) {
    const testText = result ? `${words[i]} ${result}` : words[i];
    const testTokens = countTokens(testText, model).tokens;
    
    if (testTokens > maxTokens - 20) {
      break;
    }
    
    result = testText;
    tokens = testTokens;
  }
  
  return '[truncated]... ' + result;
}

/**
 * Truncate middle of text (keep beginning and end)
 */
function truncateMiddle(text: string, maxTokens: number, model: string): string {
  const halfTokens = Math.floor((maxTokens - 30) / 2); // 30 tokens for markers
  
  const words = text.split(/\s+/);
  const midPoint = Math.floor(words.length / 2);
  
  // Get beginning
  let beginning = '';
  for (let i = 0; i < midPoint; i++) {
    const testText = beginning ? `${beginning} ${words[i]}` : words[i];
    if (countTokens(testText, model).tokens > halfTokens) break;
    beginning = testText;
  }
  
  // Get ending
  let ending = '';
  for (let i = words.length - 1; i > midPoint; i--) {
    const testText = ending ? `${words[i]} ${ending}` : words[i];
    if (countTokens(testText, model).tokens > halfTokens) break;
    ending = testText;
  }
  
  return `${beginning}\n\n[... middle content truncated ...]\n\n${ending}`;
}

/**
 * Sample representative content from text
 */
function sampleContent(text: string, maxTokens: number, model: string): string {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  if (paragraphs.length <= 3) {
    return truncateFromTail(text, maxTokens, model);
  }
  
  // Take first, a middle sample, and last paragraphs
  const samples = [
    paragraphs[0],
    paragraphs[Math.floor(paragraphs.length / 2)],
    paragraphs[paragraphs.length - 1],
  ];
  
  const tokensPerSample = Math.floor((maxTokens - 50) / samples.length);
  
  const truncatedSamples = samples.map(p => 
    truncateFromTail(p, tokensPerSample, model).replace('... [truncated]', '')
  );
  
  return truncatedSamples.join('\n\n[...]\n\n') + '\n\n[content sampled]';
}

/**
 * Truncate conversation history, preserving recent messages
 */
export function truncateConversation(
  messages: ConversationMessage[],
  maxTokens: number,
  model: string = 'gpt-4o-mini',
  preserveRecent: number = DEFAULT_BUDGET_CONFIG.preserveRecentMessages
): { messages: ConversationMessage[]; truncated: boolean; originalCount: number } {
  const originalCount = messages.length;
  
  // Always preserve system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  
  // Calculate system message tokens
  const systemTokens = systemMessages.reduce(
    (sum, m) => sum + countTokens(m.content, model).tokens + 4, // +4 for role overhead
    0
  );
  
  const availableForMessages = maxTokens - systemTokens;
  
  // Start with recent messages (they have highest priority)
  const recentMessages = nonSystemMessages.slice(-preserveRecent);
  const olderMessages = nonSystemMessages.slice(0, -preserveRecent);
  
  const result: ConversationMessage[] = [...systemMessages];
  let usedTokens = systemTokens;
  
  // First add recent messages (must keep)
  for (const msg of recentMessages) {
    const msgTokens = countTokens(msg.content, model).tokens + 4;
    result.push(msg);
    usedTokens += msgTokens;
  }
  
  // Then add older messages from most recent backwards until budget exhausted
  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const msg = olderMessages[i];
    const msgTokens = countTokens(msg.content, model).tokens + 4;
    
    if (usedTokens + msgTokens > availableForMessages) {
      // Can't fit any more, insert summary placeholder
      if (i > 0) {
        result.splice(systemMessages.length, 0, {
          role: 'system',
          content: `[Earlier conversation with ${i + 1} messages omitted for brevity]`,
        });
      }
      break;
    }
    
    // Insert at beginning of non-system messages
    result.splice(systemMessages.length, 0, msg);
    usedTokens += msgTokens;
  }
  
  return {
    messages: result,
    truncated: result.length < originalCount,
    originalCount,
  };
}

/**
 * Allocate token budget across all context components
 */
export function allocateBudget(
  model: string,
  components: {
    systemPrompt: string;
    ragContext: string;
    conversationHistory: ConversationMessage[];
    memoryContext?: string;
    additionalContext?: string;
  }
): BudgetAllocation {
  const budget = calculateBudget(model);
  const priorities = DEFAULT_BUDGET_CONFIG.priorities;
  
  // Calculate current token usage
  const systemTokens = countTokens(components.systemPrompt, model).tokens;
  const ragTokens = countTokens(components.ragContext, model).tokens;
  const conversationTokens = components.conversationHistory.reduce(
    (sum, m) => sum + countTokens(m.content, model).tokens + 4,
    0
  );
  const memoryTokens = components.memoryContext 
    ? countTokens(components.memoryContext, model).tokens 
    : 0;
  const additionalTokens = components.additionalContext
    ? countTokens(components.additionalContext, model).tokens
    : 0;
  
  const totalNeeded = systemTokens + ragTokens + conversationTokens + memoryTokens + additionalTokens;
  const available = budget.availableForContext;
  
  // If within budget, no truncation needed
  if (totalNeeded <= available) {
    return {
      systemPrompt: { content: components.systemPrompt, originalTokens: systemTokens, truncatedTokens: systemTokens, truncated: false, strategy: 'none' },
      ragContext: { content: components.ragContext, originalTokens: ragTokens, truncatedTokens: ragTokens, truncated: false, strategy: 'none' },
      conversationHistory: { content: JSON.stringify(components.conversationHistory), originalTokens: conversationTokens, truncatedTokens: conversationTokens, truncated: false, strategy: 'none' },
      memoryContext: { content: components.memoryContext || '', originalTokens: memoryTokens, truncatedTokens: memoryTokens, truncated: false, strategy: 'none' },
      additionalContext: { content: components.additionalContext || '', originalTokens: additionalTokens, truncatedTokens: additionalTokens, truncated: false, strategy: 'none' },
      totalUsed: totalNeeded,
      totalAvailable: available,
      withinBudget: true,
    };
  }
  
  // Need to truncate - calculate allocation based on priorities
  logger.warn({ totalNeeded, available, overflow: totalNeeded - available }, 'Context exceeds budget, truncating');
  
  // Allocate proportionally based on priority weights
  const totalPriority = priorities.systemPrompt + priorities.ragContext + 
    priorities.recentMessages + priorities.memoryContext + priorities.additionalContext;
  
  // System prompt: never truncate below minimum
  const systemAllocation = Math.max(
    DEFAULT_BUDGET_CONFIG.minSystemPromptTokens,
    Math.floor((available * priorities.systemPrompt) / totalPriority)
  );
  
  // RAG context: high priority
  const ragAllocation = Math.max(
    DEFAULT_BUDGET_CONFIG.minRagContextTokens,
    Math.floor((available * priorities.ragContext) / totalPriority)
  );
  
  // Conversation: preserve recent, summarize old
  const conversationAllocation = Math.max(
    DEFAULT_BUDGET_CONFIG.minConversationTokens,
    Math.floor((available * priorities.recentMessages) / totalPriority)
  );
  
  // Memory and additional: whatever's left
  const remainingAfterCore = available - systemAllocation - ragAllocation - conversationAllocation;
  const memoryAllocation = components.memoryContext 
    ? Math.floor(remainingAfterCore * 0.6)
    : 0;
  const additionalAllocation = remainingAfterCore - memoryAllocation;
  
  // Apply truncation
  const systemResult = truncateToFit(components.systemPrompt, systemAllocation, model, 'tail');
  const ragResult = truncateToFit(components.ragContext, ragAllocation, model, 'sample');
  const conversationResult = truncateConversation(
    components.conversationHistory, 
    conversationAllocation, 
    model
  );
  const memoryResult = components.memoryContext
    ? truncateToFit(components.memoryContext, memoryAllocation, model, 'tail')
    : { content: '', originalTokens: 0, truncatedTokens: 0, truncated: false, strategy: 'none' as const };
  const additionalResult = components.additionalContext
    ? truncateToFit(components.additionalContext, additionalAllocation, model, 'tail')
    : { content: '', originalTokens: 0, truncatedTokens: 0, truncated: false, strategy: 'none' as const };
  
  const totalUsed = systemResult.truncatedTokens + ragResult.truncatedTokens + 
    conversationResult.messages.reduce((sum, m) => sum + countTokens(m.content, model).tokens + 4, 0) +
    memoryResult.truncatedTokens + additionalResult.truncatedTokens;
  
  return {
    systemPrompt: systemResult,
    ragContext: ragResult,
    conversationHistory: {
      content: JSON.stringify(conversationResult.messages),
      originalTokens: conversationTokens,
      truncatedTokens: totalUsed - systemResult.truncatedTokens - ragResult.truncatedTokens - memoryResult.truncatedTokens - additionalResult.truncatedTokens,
      truncated: conversationResult.truncated,
      strategy: conversationResult.truncated ? 'head' : 'none',
    },
    memoryContext: memoryResult,
    additionalContext: additionalResult,
    totalUsed,
    totalAvailable: available,
    withinBudget: totalUsed <= available,
  };
}

/**
 * Check if adding content would exceed budget
 */
export function wouldExceedBudget(
  currentTokens: number,
  additionalContent: string,
  model: string = 'gpt-4o-mini'
): { wouldExceed: boolean; currentUsage: number; additionalTokens: number; limit: number } {
  const budget = calculateBudget(model);
  const additionalTokens = countTokens(additionalContent, model).tokens;
  const newTotal = currentTokens + additionalTokens;
  
  return {
    wouldExceed: newTotal > budget.availableForContext,
    currentUsage: currentTokens,
    additionalTokens,
    limit: budget.availableForContext,
  };
}

/**
 * Get budget utilization stats
 */
export function getBudgetStats(
  usedTokens: number,
  model: string = 'gpt-4o-mini'
): { used: number; available: number; percentage: number; status: 'ok' | 'warning' | 'critical' } {
  const budget = calculateBudget(model);
  const percentage = (usedTokens / budget.availableForContext) * 100;
  
  let status: 'ok' | 'warning' | 'critical';
  if (percentage < 70) {
    status = 'ok';
  } else if (percentage < 90) {
    status = 'warning';
  } else {
    status = 'critical';
  }
  
  return {
    used: usedTokens,
    available: budget.availableForContext,
    percentage: Math.round(percentage * 10) / 10,
    status,
  };
}

export default {
  calculateBudget,
  truncateToFit,
  truncateConversation,
  allocateBudget,
  wouldExceedBudget,
  getBudgetStats,
};
