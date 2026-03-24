/**
 * Contextual Retrieval Service
 * 
 * Implements the Anthropic-style "Contextual Retrieval" technique:
 * Before embedding each chunk, we prepend a short document-level summary
 * that gives the chunk context about WHERE it sits in the document.
 * 
 * This has been shown to improve retrieval accuracy by ~49% because
 * isolated chunks often lose critical context (e.g., "Section 5.2"
 * doesn't tell you which contract or what topic without context).
 * 
 * Pipeline:
 *   rawText → semantic chunking → contextualizeChunks() → embed contextualized text
 *                                       ↓
 *                             LLM generates 2-3 sentence
 *                             context prefix per chunk
 */

import OpenAI from 'openai';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';

const openai = createOpenAIClient();

export interface ContextualizedChunk {
  originalText: string;
  contextPrefix: string;
  contextualizedText: string;
  chunkIndex: number;
  section?: string;
  chunkType?: string;
}

/**
 * Generate a concise document summary for context injection.
 * Cached per contractId to avoid redundant LLM calls.
 */
const documentSummaryCache = new Map<string, string>();

export async function getDocumentSummary(
  contractId: string,
  rawText: string,
): Promise<string> {
  const cached = documentSummaryCache.get(contractId);
  if (cached) return cached;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Summarize this contract in 3-4 sentences. Include: document type, parties involved, primary subject matter, and key terms. Be factual and concise.`,
        },
        {
          role: 'user',
          content: rawText.slice(0, 6000), // First ~6K chars is enough for document overview
        },
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const summary = response.choices[0]?.message?.content || '';
    documentSummaryCache.set(contractId, summary);

    // Evict old entries to prevent memory leak
    if (documentSummaryCache.size > 500) {
      const firstKey = documentSummaryCache.keys().next().value;
      if (firstKey) documentSummaryCache.delete(firstKey);
    }

    return summary;
  } catch {
    return ''; // Graceful degradation — embed without context
  }
}

/**
 * Generate a context prefix for a single chunk.
 * The prefix explains what the chunk is about relative to the whole document.
 */
export async function generateChunkContext(
  chunk: { text: string; chunkIndex: number; section?: string; chunkType?: string },
  documentSummary: string,
  totalChunks: number,
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are contextualizing a chunk from a contract document for a retrieval system.
Given the document summary and a specific chunk, write a 1-2 sentence context prefix that:
1. Identifies which part of the document this chunk is from
2. Provides enough context so the chunk can be understood in isolation
3. Mentions the contract type and relevant party names if applicable

Return ONLY the context prefix — no explanation, no quotes.

Example:
"This chunk is from the termination provisions (Section 8) of a Master Services Agreement between Acme Corp and Beta Inc. It specifies the conditions under which either party may terminate the agreement."`,
        },
        {
          role: 'user',
          content: `Document Summary: ${documentSummary}

Chunk ${chunk.chunkIndex + 1} of ${totalChunks}${chunk.section ? ` (Section: ${chunk.section})` : ''}${chunk.chunkType ? ` [Type: ${chunk.chunkType}]` : ''}:
${chunk.text.slice(0, 1000)}`,
        },
      ],
      temperature: 0,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch {
    // Fallback: use a simple heuristic context prefix
    const parts = [`Chunk ${chunk.chunkIndex + 1} of ${totalChunks}`];
    if (chunk.section) parts.push(`from section "${chunk.section}"`);
    if (chunk.chunkType) parts.push(`(${chunk.chunkType})`);
    return parts.join(' ') + '.';
  }
}

/**
 * Contextualize an array of chunks by prepending document-level context.
 * 
 * Processes chunks in batches (5 concurrent) to stay within rate limits
 * while being fast enough for real-time use.
 */
export async function contextualizeChunks(
  contractId: string,
  rawText: string,
  chunks: Array<{ text: string; chunkIndex: number; section?: string; chunkType?: string }>,
): Promise<ContextualizedChunk[]> {
  if (chunks.length === 0) return [];

  // Step 1: Get document summary (cached per contractId)
  const documentSummary = await getDocumentSummary(contractId, rawText);
  if (!documentSummary) {
    // No summary available — return chunks as-is
    return chunks.map(c => ({
      originalText: c.text,
      contextPrefix: '',
      contextualizedText: c.text,
      chunkIndex: c.chunkIndex,
      section: c.section,
      chunkType: c.chunkType,
    }));
  }

  // Step 2: Generate context prefixes in batches of 5
  const BATCH_SIZE = 5;
  const results: ContextualizedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const contexts = await Promise.all(
      batch.map(chunk => generateChunkContext(chunk, documentSummary, chunks.length)),
    );

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]!;
      const contextPrefix = contexts[j] || '';
      results.push({
        originalText: chunk.text,
        contextPrefix,
        contextualizedText: contextPrefix
          ? `[Context: ${contextPrefix}]\n\n${chunk.text}`
          : chunk.text,
        chunkIndex: chunk.chunkIndex,
        section: chunk.section,
        chunkType: chunk.chunkType,
      });
    }
  }

  return results;
}

/**
 * Clear the document summary cache for a specific contract.
 * Call this when a contract's rawText changes (re-indexing).
 */
export function invalidateDocumentSummary(contractId: string): void {
  documentSummaryCache.delete(contractId);
}

export default {
  contextualizeChunks,
  getDocumentSummary,
  generateChunkContext,
  invalidateDocumentSummary,
};
