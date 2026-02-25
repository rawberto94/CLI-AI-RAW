/**
 * Precise Token Counting using js-tiktoken
 * Uses the pure-JS tiktoken implementation (no WASM dependency) for accurate token counting.
 * Drop-in replacement for the native tiktoken package that works with Turbopack.
 */

import { Tiktoken, getEncoding, encodingForModel } from 'js-tiktoken';

// Lightweight logger — avoids pino's thread-stream which is incompatible with Turbopack
const logger = {
  warn: (ctx: Record<string, unknown>, msg: string) => console.warn(`[token-counter] ${msg}`, ctx),
  info: (msg: string) => console.info(`[token-counter] ${msg}`),
};

// Cache encodings to avoid repeated initialization
const encodingCache: Map<string, Tiktoken> = new Map();

// Model to encoding mapping for models not directly supported by js-tiktoken
const MODEL_ENCODING_MAP: Record<string, string> = {
  // GPT-4 variants
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gpt-4-turbo-preview': 'gpt-4-turbo',
  'gpt-4-0125-preview': 'gpt-4-turbo',
  'gpt-4-1106-preview': 'gpt-4-turbo',
  'gpt-4-vision-preview': 'gpt-4-turbo',
  'gpt-4': 'gpt-4',
  'gpt-4-32k': 'gpt-4-32k',
  
  // GPT-3.5 variants
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k': 'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-instruct': 'gpt-3.5-turbo-instruct',
  'gpt-35-turbo': 'gpt-3.5-turbo', // Azure naming
  
  // Text embedding models
  'text-embedding-3-small': 'text-embedding-ada-002',
  'text-embedding-3-large': 'text-embedding-ada-002',
  'text-embedding-ada-002': 'text-embedding-ada-002',
};

// Context window sizes by model
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'text-embedding-3-small': 8191,
  'text-embedding-3-large': 8191,
  'text-embedding-ada-002': 8191,
  // Claude models
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-20241022': 200000,
  'claude-3-opus-20240229': 200000,
};

// Token output limits
export const MODEL_OUTPUT_LIMITS: Record<string, number> = {
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4-turbo': 4096,
  'gpt-4-turbo-preview': 4096,
  'gpt-4': 8192,
  'gpt-4-32k': 8192,
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 4096,
  // Claude models
  'claude-3-5-sonnet-20241022': 8192,
  'claude-3-5-haiku-20241022': 8192,
  'claude-3-opus-20240229': 4096,
};

export interface TokenCountResult {
  tokens: number;
  model: string;
  encoding: string;
}

export interface ConversationTokens {
  total: number;
  messages: number;
  systemPrompt: number;
  perMessage: Array<{ role: string; tokens: number }>;
}

export interface ContextWindowInfo {
  model: string;
  contextWindow: number;
  maxOutput: number;
  availableForInput: number;
  usedTokens: number;
  remainingTokens: number;
  utilizationPercent: number;
}

/**
 * Get tiktoken encoding for a model
 */
function getEncodingForModel(model: string): Tiktoken {
  // Check cache first
  if (encodingCache.has(model)) {
    return encodingCache.get(model)!;
  }

  try {
    // Try to get encoding for the model directly
    const mappedModel = MODEL_ENCODING_MAP[model] ?? model;
    const encoding = encodingForModel(mappedModel);
    encodingCache.set(model, encoding);
    return encoding;
  } catch {
    // Fallback to cl100k_base (used by GPT-4 and GPT-3.5-turbo)
    logger.warn({ model }, 'Model not found, using cl100k_base encoding');
    
    if (!encodingCache.has('cl100k_base')) {
      encodingCache.set('cl100k_base', getEncoding('cl100k_base'));
    }
    return encodingCache.get('cl100k_base')!;
  }
}

/**
 * Count tokens in text using tiktoken
 */
export function countTokens(text: string, model: string = 'gpt-4o'): TokenCountResult {
  const encoding = getEncodingForModel(model);
  const tokens = encoding.encode(text);

  return {
    tokens: tokens.length,
    model,
    encoding: 'cl100k_base',
  };
}

/**
 * Count tokens for an array of texts (batch operation)
 */
export function countTokensBatch(texts: string[], model: string = 'gpt-4o'): number[] {
  const encoding = getEncodingForModel(model);
  return texts.map(text => encoding.encode(text).length);
}

/**
 * Count tokens for a conversation/message array
 * Accounts for message formatting overhead
 */
export function countConversationTokens(
  messages: Array<{ role: string; content: string }>,
  model: string = 'gpt-4o',
  systemPrompt?: string
): ConversationTokens {
  const encoding = getEncodingForModel(model);
  
  let totalTokens = 0;
  let systemPromptTokens = 0;
  const perMessage: Array<{ role: string; tokens: number }> = [];

  // Count system prompt if provided
  if (systemPrompt) {
    systemPromptTokens = encoding.encode(systemPrompt).length;
    // Add overhead for system message formatting
    systemPromptTokens += 4; // <|start|>system<|message|>...<|end|>
    totalTokens += systemPromptTokens;
  }

  // Count each message
  for (const message of messages) {
    const contentTokens = encoding.encode(message.content).length;
    // Add overhead for message formatting (varies by model, using conservative estimate)
    const messageOverhead = 4; // role + formatting tokens
    const messageTokens = contentTokens + messageOverhead;
    
    perMessage.push({
      role: message.role,
      tokens: messageTokens,
    });
    
    totalTokens += messageTokens;
  }

  // Add reply priming tokens
  totalTokens += 3; // <|start|>assistant<|message|>

  return {
    total: totalTokens,
    messages: totalTokens - systemPromptTokens,
    systemPrompt: systemPromptTokens,
    perMessage,
  };
}

/**
 * Estimate tokens quickly without tiktoken (for non-critical paths)
 * Uses ~4 chars per token average for English text
 */
export function estimateTokens(text: string): number {
  // More accurate estimation considering:
  // - Average token length in English is ~4 characters
  // - Punctuation and special chars are often single tokens
  // - Numbers are tokenized digit by digit
  
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  const punctuation = (text.match(/[.,!?;:'"()\[\]{}]/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).join('').length;
  
  // Formula: base word tokens + punctuation + individual number digits
  const estimatedTokens = Math.ceil(
    (charCount - punctuation - numbers) / 4 + 
    punctuation + 
    numbers +
    wordCount * 0.1 // Small overhead for word boundaries
  );
  
  return estimatedTokens;
}

/**
 * Get context window information for a model
 */
export function getContextWindowInfo(
  model: string,
  usedTokens: number = 0
): ContextWindowInfo {
  const contextWindow = MODEL_CONTEXT_WINDOWS[model] ?? 8192;
  const maxOutput = MODEL_OUTPUT_LIMITS[model] ?? 4096;
  const availableForInput = contextWindow - maxOutput;
  const remainingTokens = Math.max(0, availableForInput - usedTokens);
  const utilizationPercent = (usedTokens / availableForInput) * 100;

  return {
    model,
    contextWindow,
    maxOutput,
    availableForInput,
    usedTokens,
    remainingTokens,
    utilizationPercent: Math.round(utilizationPercent * 100) / 100,
  };
}

/**
 * Check if text fits within context window
 */
export function fitsInContextWindow(
  text: string,
  model: string = 'gpt-4o',
  reserveOutput: number = 4096
): { fits: boolean; tokens: number; available: number; overflow: number } {
  const { tokens } = countTokens(text, model);
  const contextWindow = MODEL_CONTEXT_WINDOWS[model] ?? 128000;
  const available = contextWindow - reserveOutput;
  const fits = tokens <= available;
  const overflow = fits ? 0 : tokens - available;

  return { fits, tokens, available, overflow };
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  model: string = 'gpt-4o',
  suffix: string = '... [truncated]'
): { text: string; truncated: boolean; originalTokens: number; finalTokens: number } {
  const { tokens: originalTokens } = countTokens(text, model);
  
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens, finalTokens: originalTokens };
  }

  const encoding = getEncodingForModel(model);
  const { tokens: suffixTokens } = countTokens(suffix, model);
  const targetTokens = maxTokens - suffixTokens;

  // Encode and slice
  const encoded = encoding.encode(text);
  const truncatedEncoded = encoded.slice(0, targetTokens);
  
  // Decode back to text
  const truncatedText = encoding.decode(truncatedEncoded);
  
  // Clean up any partial characters at the end
  const cleanText = truncatedText.replace(/[\uFFFD\uD800-\uDFFF]$/, '');
  
  const finalText = cleanText + suffix;
  const { tokens: finalTokens } = countTokens(finalText, model);

  return {
    text: finalText,
    truncated: true,
    originalTokens,
    finalTokens,
  };
}

/**
 * Split text into chunks that fit within token limit
 */
export function splitByTokenLimit(
  text: string,
  maxTokensPerChunk: number,
  model: string = 'gpt-4o',
  overlap: number = 100
): Array<{ text: string; tokens: number; index: number }> {
  const { tokens: totalTokens } = countTokens(text, model);
  
  if (totalTokens <= maxTokensPerChunk) {
    return [{ text, tokens: totalTokens, index: 0 }];
  }

  const encoding = getEncodingForModel(model);
  const encoded = encoding.encode(text);
  const chunks: Array<{ text: string; tokens: number; index: number }> = [];
  
  let currentIndex = 0;
  let chunkIndex = 0;

  while (currentIndex < encoded.length) {
    // Determine chunk end
    const chunkEnd = Math.min(currentIndex + maxTokensPerChunk, encoded.length);
    const chunkEncoded = encoded.slice(currentIndex, chunkEnd);
    
    // Decode chunk
    const chunkText = encoding.decode(chunkEncoded);
    
    chunks.push({
      text: chunkText.trim(),
      tokens: chunkEncoded.length,
      index: chunkIndex,
    });
    
    // Move to next chunk with overlap
    currentIndex = chunkEnd - overlap;
    chunkIndex++;
    
    // Prevent infinite loop
    if (currentIndex >= encoded.length - overlap) {
      break;
    }
  }

  return chunks;
}

/**
 * Clean up encoding cache (call on process exit)
 */
export function cleanupEncodings(): void {
  // js-tiktoken has no WASM to free; just clear the cache
  encodingCache.clear();
  logger.info('Token encoding cache cleared');
}

// Export types
export type { Tiktoken };
