/**
 * Self-Corrective RAG (CRAG)
 * 
 * After initial retrieval + reranking, have the LLM evaluate whether the
 * retrieved chunks actually answer the user's question. If confidence is
 * below a threshold, automatically reformulate the query and retry.
 * 
 * This reduces hallucinations by ensuring the RAG pipeline only proceeds
 * when it has genuinely relevant context.
 * 
 * Flow:
 * 1. Run initial retrieval (vector + keyword + rerank)
 * 2. LLM grades each chunk: RELEVANT / PARTIALLY_RELEVANT / IRRELEVANT
 * 3. If sufficient relevant chunks → proceed to generation
 * 4. If insufficient → reformulate query → retry retrieval (max 1 retry)
 * 5. If still insufficient → mark response with low-confidence flag
 * 
 * Based on: "Corrective Retrieval Augmented Generation" (Yan et al., 2024)
 */

import OpenAI from 'openai';
import type { SearchResult } from './advanced-rag.service';

// ============================================================================
// Types
// ============================================================================

type RelevanceGrade = 'RELEVANT' | 'PARTIALLY_RELEVANT' | 'IRRELEVANT';

interface GradedChunk {
  chunk: SearchResult;
  grade: RelevanceGrade;
  reason: string;
}

interface CRAGResult {
  chunks: SearchResult[];
  confidence: 'high' | 'medium' | 'low';
  wasReformulated: boolean;
  reformulatedQuery?: string;
  gradingDetails: GradedChunk[];
  totalRelevant: number;
  totalPartial: number;
  totalIrrelevant: number;
}

interface CRAGConfig {
  minRelevantChunks: number;     // Min RELEVANT chunks to proceed with high confidence
  minPartialChunks: number;      // Min PARTIALLY_RELEVANT to proceed with medium confidence
  maxRetries: number;            // Max reformulation retries
  enabled: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: CRAGConfig = {
  minRelevantChunks: 2,
  minPartialChunks: 3,
  maxRetries: 1,
  enabled: true,
};

// ============================================================================
// Core Functions
// ============================================================================

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Grade retrieved chunks for relevance to the user's query.
 * Uses a fast model (GPT-4o-mini) to classify each chunk.
 */
export async function gradeChunks(
  query: string,
  chunks: SearchResult[],
): Promise<GradedChunk[]> {
  if (chunks.length === 0) return [];

  // Batch grade up to 10 chunks at once for efficiency
  const batchSize = 10;
  const batches: SearchResult[][] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }

  const allGraded: GradedChunk[] = [];

  for (const batch of batches) {
    const chunkTexts = batch.map((c, i) =>
      `[Chunk ${i + 1}]\n${c.text.slice(0, 500)}`
    ).join('\n\n');

    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are a retrieval quality evaluator for a legal contract management system.
Grade each retrieved chunk for relevance to the user's query.

For each chunk, output exactly one line:
CHUNK_N: GRADE | reason

Where GRADE is one of: RELEVANT, PARTIALLY_RELEVANT, IRRELEVANT

Rules:
- RELEVANT: Chunk directly answers or contains key information for the query
- PARTIALLY_RELEVANT: Chunk has some related info but doesn't directly answer
- IRRELEVANT: Chunk has no useful information for the query

Be strict but fair. Legal context matters — a termination clause IS relevant to a question about ending a contract.`,
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nRetrieved chunks:\n${chunkTexts}`,
          },
        ],
      });

      const text = response.choices[0]?.message?.content || '';
      const lines = text.split('\n').filter(l => l.trim());

      for (let i = 0; i < batch.length; i++) {
        const line = lines[i] || '';
        const grade = parseGrade(line);
        allGraded.push({
          chunk: batch[i]!,
          grade: grade.grade,
          reason: grade.reason,
        });
      }
    } catch (error) {
      // On LLM failure, assume all chunks are relevant (graceful degradation)
      console.warn('[CRAG] Grading failed, assuming relevant:', error);
      for (const chunk of batch) {
        allGraded.push({
          chunk,
          grade: 'RELEVANT',
          reason: 'Grading unavailable — assumed relevant',
        });
      }
    }
  }

  return allGraded;
}

/**
 * Parse a grade line from the LLM response.
 */
function parseGrade(line: string): { grade: RelevanceGrade; reason: string } {
  const upper = line.toUpperCase();

  if (upper.includes('IRRELEVANT')) {
    return { grade: 'IRRELEVANT', reason: extractReason(line) };
  }
  if (upper.includes('PARTIALLY_RELEVANT') || upper.includes('PARTIALLY RELEVANT')) {
    return { grade: 'PARTIALLY_RELEVANT', reason: extractReason(line) };
  }
  if (upper.includes('RELEVANT')) {
    return { grade: 'RELEVANT', reason: extractReason(line) };
  }

  // Default to partially relevant if parsing fails
  return { grade: 'PARTIALLY_RELEVANT', reason: 'Could not parse grade' };
}

function extractReason(line: string): string {
  const pipeIndex = line.indexOf('|');
  if (pipeIndex > -1) return line.slice(pipeIndex + 1).trim();
  const colonIndex = line.lastIndexOf(':');
  if (colonIndex > 10) return line.slice(colonIndex + 1).trim();
  return line.trim();
}

/**
 * Reformulate a query that didn't get enough relevant results.
 * The LLM rewrites the query to be more specific or approach the topic differently.
 */
export async function reformulateQuery(
  originalQuery: string,
  irrelevantChunks: string[],
): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `You are a query reformulation assistant for a legal contract search system.
The original query did not retrieve sufficiently relevant results.
Rewrite the query to be more specific, use legal terminology, and approach the topic from a different angle.
Output ONLY the reformulated query, nothing else.`,
        },
        {
          role: 'user',
          content: `Original query: "${originalQuery}"

Some irrelevant chunks that were retrieved:
${irrelevantChunks.slice(0, 3).map(c => `- ${c.slice(0, 200)}`).join('\n')}

Reformulate the query to get better results:`,
        },
      ],
    });

    const reformulated = response.choices[0]?.message?.content?.trim();
    return reformulated || originalQuery;
  } catch (error) {
    console.warn('[CRAG] Query reformulation failed:', error);
    return originalQuery;
  }
}

/**
 * Run the full CRAG pipeline:
 * 1. Grade chunks
 * 2. Assess confidence
 * 3. Reformulate if needed
 * 
 * @param query - The user's search query
 * @param chunks - Retrieved chunks from hybrid search
 * @param searchFn - Function to re-run search with reformulated query
 * @param config - CRAG configuration overrides
 */
export async function selfCorrectiveRetrieval(
  query: string,
  chunks: SearchResult[],
  searchFn?: (reformulatedQuery: string) => Promise<SearchResult[]>,
  config?: Partial<CRAGConfig>,
): Promise<CRAGResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.enabled || chunks.length === 0) {
    return {
      chunks,
      confidence: chunks.length > 0 ? 'medium' : 'low',
      wasReformulated: false,
      gradingDetails: [],
      totalRelevant: chunks.length,
      totalPartial: 0,
      totalIrrelevant: 0,
    };
  }

  // Step 1: Grade chunks
  const graded = await gradeChunks(query, chunks);

  const relevant = graded.filter(g => g.grade === 'RELEVANT');
  const partial = graded.filter(g => g.grade === 'PARTIALLY_RELEVANT');
  const irrelevant = graded.filter(g => g.grade === 'IRRELEVANT');

  // Step 2: Assess confidence
  if (relevant.length >= cfg.minRelevantChunks) {
    // High confidence — keep only relevant and partially relevant chunks
    const filteredChunks = [...relevant, ...partial].map(g => g.chunk);
    return {
      chunks: filteredChunks,
      confidence: 'high',
      wasReformulated: false,
      gradingDetails: graded,
      totalRelevant: relevant.length,
      totalPartial: partial.length,
      totalIrrelevant: irrelevant.length,
    };
  }

  if (relevant.length + partial.length >= cfg.minPartialChunks) {
    // Medium confidence — keep relevant and partial, note the uncertainty
    const filteredChunks = [...relevant, ...partial].map(g => g.chunk);
    return {
      chunks: filteredChunks,
      confidence: 'medium',
      wasReformulated: false,
      gradingDetails: graded,
      totalRelevant: relevant.length,
      totalPartial: partial.length,
      totalIrrelevant: irrelevant.length,
    };
  }

  // Step 3: Low confidence — try reformulation if we have a search function
  if (searchFn && cfg.maxRetries > 0) {
    const irrelevantTexts = irrelevant.map(g => g.chunk.text);
    const reformulatedQuery = await reformulateQuery(query, irrelevantTexts);

    if (reformulatedQuery !== query) {
      const newChunks = await searchFn(reformulatedQuery);
      const newGraded = await gradeChunks(reformulatedQuery, newChunks);

      const newRelevant = newGraded.filter(g => g.grade === 'RELEVANT');
      const newPartial = newGraded.filter(g => g.grade === 'PARTIALLY_RELEVANT');
      const newIrrelevant = newGraded.filter(g => g.grade === 'IRRELEVANT');

      // Merge best chunks from both attempts, deduplicating by chunkText prefix
      const allGood = [
        ...relevant.map(g => g.chunk),
        ...partial.map(g => g.chunk),
        ...newRelevant.map(g => g.chunk),
        ...newPartial.map(g => g.chunk),
      ];
      const deduped = deduplicateChunks(allGood);

      const totalRel = relevant.length + newRelevant.length;
      const totalPar = partial.length + newPartial.length;

      return {
        chunks: deduped,
        confidence: totalRel >= cfg.minRelevantChunks ? 'high' : totalRel + totalPar >= cfg.minPartialChunks ? 'medium' : 'low',
        wasReformulated: true,
        reformulatedQuery,
        gradingDetails: [...graded, ...newGraded],
        totalRelevant: totalRel,
        totalPartial: totalPar,
        totalIrrelevant: irrelevant.length + newIrrelevant.length,
      };
    }
  }

  // No reformulation possible or didn't help — return what we have with low confidence
  const bestChunks = [...relevant, ...partial].map(g => g.chunk);
  return {
    chunks: bestChunks.length > 0 ? bestChunks : chunks.slice(0, 3), // Fall back to top 3
    confidence: 'low',
    wasReformulated: false,
    gradingDetails: graded,
    totalRelevant: relevant.length,
    totalPartial: partial.length,
    totalIrrelevant: irrelevant.length,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function deduplicateChunks(chunks: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return chunks.filter(chunk => {
    const key = chunk.text.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type { CRAGResult, CRAGConfig, GradedChunk, RelevanceGrade };

export default {
  gradeChunks,
  reformulateQuery,
  selfCorrectiveRetrieval,
};
