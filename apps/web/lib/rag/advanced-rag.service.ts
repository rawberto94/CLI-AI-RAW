/**
 * State-of-the-Art RAG Service
 * 
 * Features:
 * - Hybrid Search with RRF (Reciprocal Rank Fusion)
 * - Cross-Encoder Reranking
 * - Semantic Chunking by document structure
 * - Multi-Query RAG with query expansion
 * - Cross-Contract Search
 * - Metadata Filtering during vector search
 * - Contextual Retrieval (Anthropic-style chunk contextualization)
 * - Parent Document Retrieval (two-tier chunking)
 * - Semantic Cache (embedding-similarity query cache)
 * - Self-Corrective RAG (CRAG — auto-reformulation on low confidence)
 * - Chunk Relationship Graph (legal concept co-retrieval)
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSemanticCache } from './semantic-cache.service';
import { selfCorrectiveRetrieval } from './self-corrective-rag.service';
import { expandWithGraphContext, getChunkGraph, buildContractGraph } from './chunk-graph.service';
import { contextualizeChunks } from './contextual-retrieval.service';
import { expandToParentChunks, createParentChildChunks } from './parent-document-retrieval.service';
import {
  semanticChunk,
  type SemanticChunk,
  type ChunkMetadata,
  type ChunkingOptions,
} from '@repo/utils/rag/semantic-chunker';
import { progressiveRerank as progressiveRerankService } from './reranker.service';

// Re-export so existing callers (barrel, tests) keep working
export { semanticChunk };

// ============================================================================
// Query Intent → ChunkType Mapping
// ============================================================================

/** Auto-detect relevant chunk types from query intent for pre-filtering */
export function detectChunkTypes(query: string): ('heading' | 'paragraph' | 'list' | 'table' | 'clause')[] | undefined {
  const q = query.toLowerCase();
  const types: Set<'heading' | 'paragraph' | 'list' | 'table' | 'clause'> = new Set();

  // Clause-related queries
  if (/clause|term|condition|obligation|provision|warranty|indemnif|liabilit|terminat|confiden|force.?majeure|non.?compete|governing.?law/i.test(q)) {
    types.add('clause');
    types.add('heading');
  }
  // Table/rate/pricing queries
  if (/table|schedule|rate|pricing|fee|cost|amount|payment.?schedule|milestone|deliverable/i.test(q)) {
    types.add('table');
    types.add('list');
  }
  // Section/overview queries
  if (/section|article|overview|summary|scope|purpose/i.test(q)) {
    types.add('heading');
    types.add('paragraph');
  }
  // If nothing specific detected, return undefined (no filter = search everything)
  return types.size > 0 ? Array.from(types) : undefined;
}

// ============================================================================
// Query Intent Router — intelligent search-mode selection
// ============================================================================

export type RoutedMode = 'semantic' | 'keyword' | 'hybrid';

/**
 * Classify the user query to select the most efficient search mode.
 *
 * Heuristics (zero-LLM, sub-1ms):
 *  • **keyword-only** — exact identifiers, quoted phrases, contract numbers,
 *    party names, date patterns  → BM25 is sufficient, skip vector search
 *  • **semantic-only** — conceptual questions ("what does…", "explain…",
 *    comparative queries)          → vector search excels, skip BM25
 *  • **hybrid** — everything else  → run both + RRF
 *
 * Returns the original `mode` unchanged if the caller explicitly sets it to
 * something other than 'hybrid' (respecting explicit intent).
 */
export function routeQueryIntent(
  query: string,
  callerMode: RoutedMode = 'hybrid',
): RoutedMode {
  // If the caller explicitly asked for semantic or keyword, respect that
  if (callerMode !== 'hybrid') return callerMode;

  const q = query.trim();

  // ── Keyword signals ──────────────────────────────────────────────────────
  // Quoted exact-match phrase
  if (/^"[^"]+"$/.test(q)) return 'keyword';
  // Contract / reference numbers (e.g. "SOW-2024-001", "PO 12345")
  if (/\b(?:SOW|PO|MSA|NDA|SLA|REF|INV)[\s\-#]?\d{2,}/i.test(q)) return 'keyword';
  // ISO date patterns (2024-01-15, 01/15/2024)
  if (/\b\d{4}[-/]\d{2}[-/]\d{2}\b/.test(q) || /\b\d{2}[-/]\d{2}[-/]\d{4}\b/.test(q)) return 'keyword';
  // Very short queries with no question words — likely exact term lookups
  if (q.split(/\s+/).length <= 2 && !/\?|what|how|why|which|when|where|who|explain|compare|describe|summarize|overview/i.test(q)) {
    return 'keyword';
  }
  // Exact legal clause references (e.g. "Section 4.2", "Article III")
  if (/^(?:section|article|clause|appendix|schedule|exhibit)\s+[\dIVXLCDM.]+$/i.test(q)) return 'keyword';

  // ── Semantic signals ─────────────────────────────────────────────────────
  // Natural-language questions
  if (/^(?:what|how|why|which|when|where|who|can|does|is|are|should|could|would|explain|describe|summarize|compare)\b/i.test(q)) {
    return 'semantic';
  }
  // Conceptual / open-ended phrasing
  if (/\b(?:implications?|obligations?|risks?|consequences?|difference|between|relate|relationship|impact|affect|meaning|purpose)\b/i.test(q)) {
    return 'semantic';
  }

  // ── Default: hybrid ──────────────────────────────────────────────────────
  return 'hybrid';
}

// ============================================================================
// Types
// ============================================================================

export interface RAGChunk {
  id: string;
  contractId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  metadata: ChunkMetadata;
}

// Re-export ChunkMetadata from shared package (single source of truth)
export type { ChunkMetadata, SemanticChunk, ChunkingOptions } from '@repo/utils/rag/semantic-chunker';

export interface SearchResult {
  contractId: string;
  contractName: string;
  supplierName?: string;
  status?: string;
  endDate?: string;
  totalValue?: number;
  chunkIndex: number;
  text: string;
  score: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  metadata: ChunkMetadata;
  highlights?: string[];
}

export interface SearchOptions {
  mode?: 'semantic' | 'keyword' | 'hybrid';
  k?: number;
  minScore?: number;
  filters?: SearchFilters;
  rerank?: boolean;
  expandQuery?: boolean;
}

export interface SearchFilters {
  contractIds?: string[];
  tenantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  suppliers?: string[];
  contractTypes?: string[];
  status?: string[];
  /** Chunk-level pre-filter: only search specific chunk types */
  chunkTypes?: ('heading' | 'paragraph' | 'list' | 'table' | 'clause')[];
  /** Chunk-level pre-filter: only search specific sections */
  sections?: string[];
}

// ============================================================================
// Multi-Query Expansion (HyDE-inspired)
// ============================================================================

/**
 * Generate a Hypothetical Document Embedding (HyDE)
 * Creates a synthetic document that would answer the query, then embeds it.
 * This bridges the vocabulary gap between questions and document text.
 */
async function generateHypotheticalDocument(
  query: string,
  apiKey: string
): Promise<string | null> {
  try {
    const OpenAI = (await import('openai')).OpenAI;
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a realistic 2-3 sentence contract clause that would answer the user's question. Write ONLY the clause text — no explanation, no prefix.

Example query: "What is the termination notice period?"
Example output: "Either party may terminate this Agreement by providing sixty (60) days prior written notice to the other party. In the event of a material breach, the non-breaching party may terminate immediately upon written notice."`,
        },
        { role: 'user', content: query },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content || null;
  } catch {
    return null; // Non-critical — just skip HyDE on failure
  }
}

/**
 * Generate query variations for better recall
 */
export async function expandQuery(
  query: string,
  options?: { apiKey?: string }
): Promise<string[]> {
  const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return [query];
  
  try {
    const OpenAI = (await import('openai')).OpenAI;
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a query expansion assistant for a contract management system.
Generate 4 alternative phrasings of the user's search query to improve search recall.
Return ONLY a JSON array of strings, no explanation.

**Domain-specific expansion rules:**
- "termination" → also search "cancellation", "exit clause", "notice period"
- "payment" → also search "billing", "fees", "compensation", "pricing", "rates"
- "liability" → also search "indemnification", "limitation of liability", "damages"
- "confidential" → also search "NDA", "non-disclosure", "proprietary information"
- "expiration" → also search "term", "renewal", "end date", "contract period"
- "renewal" → also search "auto-renewal", "extension", "rollover"
- "intellectual property" → also search "IP", "patents", "trademarks", "copyrights"
- "SLA" → also search "service level", "performance metrics", "uptime"
- "force majeure" → also search "acts of god", "unforeseen circumstances"
- "breach" → also search "violation", "default", "non-compliance"

**Focus on:**
1. Synonyms and related legal/business terms
2. More specific versions (narrower scope)
3. Broader category versions (wider scope)
4. Common abbreviations or alternate spellings`,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    
    let content = response.choices[0]?.message?.content || '[]';
    // Strip markdown code blocks if present
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const variations = JSON.parse(content) as string[];
    return [query, ...variations.slice(0, 4)];
  } catch {
    return [query];
  }
}

// ============================================================================
// Hybrid Search with RRF
// ============================================================================

interface VectorResult {
  contractId: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

interface KeywordResult {
  contractId: string;
  chunkIndex: number;
  chunkText: string;
  rank: number;
}

/**
 * Perform vector similarity search using pgvector
 */
async function vectorSearch(
  queryEmbedding: number[],
  filters: SearchFilters,
  k: number = 20
): Promise<VectorResult[]> {
  const vectorQuery = `[${queryEmbedding.join(',')}]`;
  
  // Build safe parameterized filter conditions using Prisma.sql
  const conditions: Prisma.Sql[] = [];
  // Track whether we actually need the Contract table JOIN
  let needsContractJoin = false;
  
  if (filters.contractIds?.length) {
    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = filters.contractIds.filter(id => uuidRegex.test(id));
    if (validIds.length > 0) {
      conditions.push(Prisma.sql`ce."contractId" IN (${Prisma.join(validIds)})`);
    }
  }
  if (filters.tenantId) {
    // Use denormalized tenantId on ContractEmbedding directly — avoids JOIN
    conditions.push(Prisma.sql`ce."tenantId" = ${filters.tenantId}`);
  }
  if (filters.dateFrom) {
    needsContractJoin = true;
    conditions.push(Prisma.sql`c."createdAt" >= ${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    needsContractJoin = true;
    conditions.push(Prisma.sql`c."createdAt" <= ${filters.dateTo}`);
  }
  if (filters.status?.length) {
    needsContractJoin = true;
    // Validate status values against allowed list
    const validStatuses = ['DRAFT', 'ACTIVE', 'PENDING', 'EXPIRED', 'TERMINATED', 'PROCESSING', 'READY'];
    const safeStatuses = filters.status.filter(s => validStatuses.includes(s));
    if (safeStatuses.length > 0) {
      conditions.push(Prisma.sql`c."status" IN (${Prisma.join(safeStatuses)})`);
    }
  }
  
  // Chunk-level pre-filters (search directly on ContractEmbedding columns)
  if (filters.chunkTypes?.length) {
    const validTypes = ['heading', 'paragraph', 'list', 'table', 'clause'];
    const safeTypes = filters.chunkTypes.filter(t => validTypes.includes(t));
    if (safeTypes.length > 0) {
      conditions.push(Prisma.sql`ce."chunkType" IN (${Prisma.join(safeTypes)})`);
    }
  }
  if (filters.sections?.length) {
    conditions.push(Prisma.sql`ce."section" IN (${Prisma.join(filters.sections)})`);
  }
  
  const whereClause = conditions.length > 0 
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` 
    : Prisma.empty;
  
  try {
    // Set HNSW ef_search for high recall (95%+), then run vector search
    await prisma.$executeRawUnsafe('SET hnsw.ef_search = 100');
    
    // Only JOIN Contract table when date/status filters are used.
    // tenantId and chunkType filters hit denormalized ContractEmbedding columns directly.
    const joinClause = needsContractJoin
      ? Prisma.sql`JOIN "Contract" c ON c.id = ce."contractId"`
      : Prisma.empty;
    
    // Use halfvec pre-filter when available (50% less memory, ~30% faster)
    // Falls back to full-precision embedding when embeddingHalf is NULL
    const results = await prisma.$queryRaw<VectorResult[]>`
      SELECT 
        ce."contractId",
        ce."chunkIndex",
        ce."chunkText",
        1 - (ce."embedding" <=> ${vectorQuery}::vector) as score
      FROM "ContractEmbedding" ce
      ${joinClause}
      ${whereClause}
      ORDER BY ce."embeddingHalf" <=> ${vectorQuery}::halfvec, score DESC
      LIMIT ${k}
    `;
    
    return results;
  } catch (err) {
    console.error('[RAG] vectorSearch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Perform BM25-style keyword search using PostgreSQL full-text search
 */
async function keywordSearch(
  query: string,
  filters: SearchFilters,
  k: number = 20
): Promise<KeywordResult[]> {
  // Build safe parameterized filter conditions
  const conditions: Prisma.Sql[] = [];
  let needsJoin = false;
  
  if (filters.contractIds?.length) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = filters.contractIds.filter(id => uuidRegex.test(id));
    if (validIds.length > 0) {
      conditions.push(Prisma.sql`ce."contractId" IN (${Prisma.join(validIds)})`);
    }
  }
  if (filters.tenantId) {
    // Use denormalized tenantId on ContractEmbedding directly — avoids JOIN
    conditions.push(Prisma.sql`ce."tenantId" = ${filters.tenantId}`);
  }
  
  const additionalWhere = conditions.length > 0 
    ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` 
    : Prisma.empty;
  
  // Sanitize query for tsquery - remove special characters and create safe search terms
  const sanitizedQuery = query
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 10) // Limit to 10 terms
    .join(' | ');
  
  if (!sanitizedQuery) {
    return [];
  }
  
  try {
    const results = await prisma.$queryRaw<KeywordResult[]>`
      SELECT 
        ce."contractId",
        ce."chunkIndex",
        ce."chunkText",
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', ce."chunkText"), plainto_tsquery('english', ${sanitizedQuery})) DESC) as rank
      FROM "ContractEmbedding" ce
      WHERE to_tsvector('english', ce."chunkText") @@ plainto_tsquery('english', ${sanitizedQuery})
      ${additionalWhere}
      ORDER BY rank ASC
      LIMIT ${k}
    `;
    
    return results;
  } catch (err) {
    console.error('[RAG] keywordSearch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Reciprocal Rank Fusion - combines vector and keyword results
 */
function reciprocalRankFusion(
  vectorResults: VectorResult[],
  keywordResults: KeywordResult[],
  k: number = 60
): Map<string, { score: number; vectorRank?: number; keywordRank?: number }> {
  const scores = new Map<string, { score: number; vectorRank?: number; keywordRank?: number }>();
  
  // Score vector results
  vectorResults.forEach((result, index) => {
    const key = `${result.contractId}:${result.chunkIndex}`;
    const rrf = 1 / (k + index + 1);
    const existing = scores.get(key) || { score: 0 };
    scores.set(key, {
      score: existing.score + rrf,
      vectorRank: index + 1,
      keywordRank: existing.keywordRank,
    });
  });
  
  // Score keyword results
  keywordResults.forEach((result, index) => {
    const key = `${result.contractId}:${result.chunkIndex}`;
    const rrf = 1 / (k + index + 1);
    const existing = scores.get(key) || { score: 0 };
    scores.set(key, {
      score: existing.score + rrf,
      vectorRank: existing.vectorRank,
      keywordRank: index + 1,
    });
  });
  
  return scores;
}

// ============================================================================
// Cross-Encoder Reranking
// ============================================================================

interface RerankedResult {
  contractId: string;
  chunkIndex: number;
  text: string;
  originalScore: number;
  rerankedScore: number;
}

/**
 * Rerank results using Cohere Rerank v3 (primary) or GPT cross-encoder (fallback)
 * Cohere is ~10x cheaper and purpose-built for reranking ($0.10/1000 queries)
 */
async function rerank(
  query: string,
  results: Array<{ contractId: string; chunkIndex: number; text: string; score: number }>,
  options?: { apiKey?: string; topK?: number }
): Promise<RerankedResult[]> {
  const topK = options?.topK || 10;
  
  if (results.length === 0) {
    return results.map(r => ({ ...r, originalScore: r.score, rerankedScore: r.score }));
  }
  
  const candidates = results.slice(0, Math.min(20, results.length));
  
  // Delegate to progressiveRerank — races fast embedding-similarity against
  // Cohere / GPT and returns whichever finishes first (2 s timeout for the slow path).
  try {
    const docs = candidates.map(c => c.text.slice(0, 1000));
    const reranked = await progressiveRerankService(query, docs, {
      topK,
      minScore: 0.1,
      slowPathTimeoutMs: 2000,
      // awaitSlowPath defaults to false → interactive race mode
    });
    
    return reranked.map(r => {
      const original = candidates[r.index]!;
      return {
        contractId: original.contractId,
        chunkIndex: original.chunkIndex,
        text: original.text,
        originalScore: original.score,
        rerankedScore: r.score,
      };
    });
  } catch (err) {
    console.warn('[RAG] Progressive rerank failed, using passthrough:', (err as Error).message);
    return candidates.slice(0, topK).map(r => ({ ...r, originalScore: r.score, rerankedScore: r.score }));
  }
}

// ============================================================================
// Maximal Marginal Relevance (text-overlap variant)
// ============================================================================

/**
 * Lightweight MMR based on Jaccard text overlap — removes near-duplicate chunks
 * without requiring a separate embedding call. λ controls the relevance–diversity trade-off:
 * λ=1.0 means pure relevance, λ=0.0 means pure diversity. Default 0.7 = relevance-biased.
 */
function applyMMRDiversity<T extends { text: string; score: number }>(
  results: T[],
  lambda: number = 0.7
): T[] {
  if (results.length <= 1) return results;
  
  const selected: T[] = [results[0]!];
  const candidates = results.slice(1);
  
  while (selected.length < results.length && candidates.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const relevance = candidate.score;
      
      // Compute max Jaccard similarity to any already-selected result
      let maxSim = 0;
      for (const sel of selected) {
        const sim = jaccardSimilarity(candidate.text, sel.text);
        if (sim > maxSim) maxSim = sim;
      }
      
      // MMR score = λ * relevance - (1-λ) * maxSimilarityToSelected
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMMR) {
        bestMMR = mmr;
        bestIdx = i;
      }
    }
    
    selected.push(candidates.splice(bestIdx, 1)[0]!);
  }
  
  return selected;
}

/** Jaccard similarity on word trigrams — fast proxy for text overlap */
function jaccardSimilarity(a: string, b: string): number {
  const trigramsA = wordTrigrams(a);
  const trigramsB = wordTrigrams(b);
  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;
  
  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }
  return intersection / (trigramsA.size + trigramsB.size - intersection);
}

function wordTrigrams(text: string): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const trigrams = new Set<string>();
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.add(`${words[i]} ${words[i+1]} ${words[i+2]}`);
  }
  return trigrams;
}

// ============================================================================
// Main Search Functions
// ============================================================================

/**
 * State-of-the-art hybrid search with all features
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    mode: callerMode = 'hybrid',
    k = 10,
    minScore = 0.3,
    filters = {},
    rerank: shouldRerank = true,
    expandQuery: shouldExpand = true,
  } = options;
  
  // Step –1: Intelligent query routing — avoid running both search paths
  // when the query strongly signals one mode.
  const mode = routeQueryIntent(query, callerMode);
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return keywordOnlySearch(query, filters, k);
  }
  
  try {
    // Step 0: Auto-detect chunk types from query intent (pre-filter)
    const autoChunkTypes = detectChunkTypes(query);
    const effectiveFilters: SearchFilters = {
      ...filters,
      chunkTypes: filters.chunkTypes || autoChunkTypes,
    };
    
    // Step 0.5: Check semantic cache for similar recent queries
    const OpenAI = (await import('openai')).OpenAI;
    const openai = new OpenAI({ apiKey });
    
    // Generate embedding for cache lookup (we'll reuse it for search too)
    const cacheEmbResponse = await openai.embeddings.create({
      model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      input: [query],
    });
    const primaryQueryEmbedding = cacheEmbResponse.data[0]!.embedding;
    
    const cache = getSemanticCache();
    const tenantId = filters.tenantId || '__global__';
    const cacheHit = cache.lookup(primaryQueryEmbedding, tenantId);
    if (cacheHit) {
      const startTime = Date.now();
      cache.recordLatencySaved(800); // Estimated avg latency saved
      return cacheHit.results;
    }
    
    // Step 1: Query expansion + HyDE (Hypothetical Document Embedding)
    let queries = [query];
    if (shouldExpand && mode !== 'keyword') {
      // Run HyDE and query expansion in parallel for speed
      const [expanded, hydeDoc] = await Promise.all([
        expandQuery(query, { apiKey }),
        generateHypotheticalDocument(query, apiKey),
      ]);
      queries = expanded;
      if (hydeDoc) {
        queries.push(hydeDoc); // Add hypothetical document as an additional "query"
      }
    }
    
    // Step 2: Generate embeddings for additional query variations (reuse primary)
    const additionalQueries = queries.slice(1); // Skip first — we already have it
    let queryEmbeddings = [primaryQueryEmbedding];
    
    if (additionalQueries.length > 0) {
      const embeddingsResponse = await openai.embeddings.create({
        model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
        input: additionalQueries,
      });
      queryEmbeddings.push(...embeddingsResponse.data.map(d => d.embedding));
    }
    
    // Step 3: Perform searches based on mode
    let vectorResults: VectorResult[] = [];
    let keywordResults: KeywordResult[] = [];
    
    if (mode === 'semantic' || mode === 'hybrid') {
      // Search with each query variation and merge results
      const allVectorResults = await Promise.all(
        queryEmbeddings.map(emb => vectorSearch(emb, effectiveFilters, k * 2))
      );
      
      // Deduplicate and keep best scores
      const vectorMap = new Map<string, VectorResult>();
      allVectorResults.flat().forEach(r => {
        const key = `${r.contractId}:${r.chunkIndex}`;
        const existing = vectorMap.get(key);
        if (!existing || r.score > existing.score) {
          vectorMap.set(key, r);
        }
      });
      
      vectorResults = Array.from(vectorMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, k * 2);
    }
    
    if (mode === 'keyword' || mode === 'hybrid') {
      keywordResults = await keywordSearch(query, effectiveFilters, k * 2);
    }
    
    // Step 4: Combine results with RRF (for hybrid mode)
    let combinedResults: Array<{ contractId: string; chunkIndex: number; text: string; score: number; matchType: 'semantic' | 'keyword' | 'hybrid' }>;
    
    if (mode === 'hybrid') {
      const rrfScores = reciprocalRankFusion(vectorResults, keywordResults);
      
      // Create result map for quick lookup
      const resultMap = new Map<string, { text: string; contractId: string; chunkIndex: number }>();
      vectorResults.forEach(r => resultMap.set(`${r.contractId}:${r.chunkIndex}`, { text: r.chunkText, contractId: r.contractId, chunkIndex: r.chunkIndex }));
      keywordResults.forEach(r => resultMap.set(`${r.contractId}:${r.chunkIndex}`, { text: r.chunkText, contractId: r.contractId, chunkIndex: r.chunkIndex }));
      
      combinedResults = Array.from(rrfScores.entries())
        .map(([key, scoreInfo]) => {
          const result = resultMap.get(key)!;
          const matchType: 'semantic' | 'keyword' | 'hybrid' = 
            scoreInfo.vectorRank && scoreInfo.keywordRank ? 'hybrid' :
            scoreInfo.vectorRank ? 'semantic' : 'keyword';
          return {
            ...result,
            score: scoreInfo.score,
            matchType,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, k * 2);
    } else if (mode === 'semantic') {
      combinedResults = vectorResults.map(r => ({
        contractId: r.contractId,
        chunkIndex: r.chunkIndex,
        text: r.chunkText,
        score: r.score,
        matchType: 'semantic' as const,
      }));
    } else {
      combinedResults = keywordResults.map(r => ({
        contractId: r.contractId,
        chunkIndex: r.chunkIndex,
        text: r.chunkText,
        score: 1 / r.rank,
        matchType: 'keyword' as const,
      }));
    }
    
    // Step 5: Rerank top results
    let finalResults = combinedResults;
    if (shouldRerank && combinedResults.length > 0) {
      const reranked = await rerank(query, combinedResults, { apiKey, topK: k });
      finalResults = reranked.map(r => ({
        contractId: r.contractId,
        chunkIndex: r.chunkIndex,
        text: r.text,
        score: r.rerankedScore,
        matchType: combinedResults.find(c => c.contractId === r.contractId && c.chunkIndex === r.chunkIndex)?.matchType || 'hybrid',
      }));
    }
    
    // Step 5.5: MMR Diversity — remove near-duplicate chunks
    // Uses a lightweight text-overlap MMR to ensure result diversity without
    // needing embeddings (which would require another API call)
    finalResults = applyMMRDiversity(finalResults, 0.7);
    
    // Step 5.6: Self-Corrective RAG (CRAG) — validate retrieval quality
    // Grades chunks for relevance; auto-reformulates query if results are poor
    if (process.env.RAG_CRAG_ENABLED !== 'false') {
      try {
        const cragSearchFn = async (reformulated: string) => {
          // Re-run vector search with the reformulated query
          const reformEmb = await openai.embeddings.create({
            model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
            input: [reformulated],
          });
          const reformResults = await vectorSearch(reformEmb.data[0]!.embedding, effectiveFilters, k * 2);
          return reformResults.map(r => ({
            contractId: r.contractId,
            chunkText: r.chunkText,
            section: '',
            similarity: r.score,
            matchType: 'semantic' as const,
          }));
        };

        // Convert to SearchResult-like shape for CRAG
        const forCrag = finalResults.map(r => ({
          contractId: r.contractId,
          chunkText: r.text,
          section: '',
          similarity: r.score,
          matchType: r.matchType,
        }));
        
        const cragResult = await selfCorrectiveRetrieval(query, forCrag as any, cragSearchFn as any);
        
        // If CRAG filtered chunks, update finalResults
        if (cragResult.chunks.length > 0 && cragResult.confidence !== 'low') {
          finalResults = cragResult.chunks.map((c: any) => ({
            contractId: c.contractId,
            chunkIndex: c.chunkIndex || 0,
            text: c.chunkText || c.text,
            score: c.similarity || c.score || 0.5,
            matchType: c.matchType || 'hybrid',
          }));
        }
      } catch (cragErr) {
        console.warn('[RAG] CRAG validation skipped:', cragErr);
        // Continue with unvalidated results — graceful degradation
      }
    }
    
    // Step 5.7: Chunk Relationship Graph — co-retrieve related legal concepts
    if (process.env.RAG_GRAPH_ENABLED !== 'false') {
      try {
        const graphResults = expandWithGraphContext(
          getChunkGraph(),
          finalResults.map(r => ({
            contractId: r.contractId,
            chunkText: r.text,
            section: '',
            similarity: r.score,
            matchType: r.matchType,
          })) as any,
          { maxHops: 1, maxRelated: 3, minWeight: 0.4 },
        );
        
        // Add graph-expanded results (they come with lower scores)
        if (graphResults.length > finalResults.length) {
          const extraResults = (graphResults as any[]).slice(finalResults.length);
          for (const extra of extraResults) {
            finalResults.push({
              contractId: extra.contractId,
              chunkIndex: extra.chunkIndex || 0,
              text: extra.chunkText || extra.text || '',
              score: extra.similarity || extra.score || 0.3,
              matchType: 'hybrid' as any,
            });
          }
        }
      } catch (graphErr) {
        console.warn('[RAG] Graph expansion skipped:', graphErr);
      }
    }
    
    // Step 5.8: Parent Document Retrieval — expand child matches to parent context
    // If chunks were stored with parent-child relationships, expand top child hits
    // to their parent chunk for richer context in the final answer.
    if (process.env.RAG_PARENT_DOC_ENABLED !== 'false') {
      try {
        const expanded = await expandToParentChunks(
          finalResults.map(r => ({
            contractId: r.contractId,
            chunkIndex: r.chunkIndex,
            text: r.text,
            score: r.score,
            section: '',
            matchType: r.matchType,
          })),
          k,
        );
        if (expanded.length > 0) {
          finalResults = expanded.map(e => ({
            contractId: e.contractId,
            chunkIndex: e.chunkIndex ?? 0,
            text: e.text,
            score: e.score ?? 0.5,
            matchType: (e as any).matchType || 'hybrid',
          }));
        }
      } catch (parentErr) {
        console.warn('[RAG] Parent-doc retrieval skipped:', parentErr);
      }
    }
    
    // Step 6: Fetch contract metadata and format results
    const contractIds = [...new Set(finalResults.map(r => r.contractId))];
    const contracts = await prisma.contract.findMany({
      where: { id: { in: contractIds } },
      select: { 
        id: true, 
        fileName: true,
        supplierName: true,
        status: true,
        endDate: true,
        totalValue: true,
        autoRenewalEnabled: true,
      },
    });
    
    type ContractMeta = (typeof contracts)[number];
    const contractMap = new Map<string, ContractMeta>(
      contracts.map((c): [string, ContractMeta] => [c.id, c])
    );
    
    // Apply importance boosting based on contract metadata
    const boostedResults = finalResults.map(r => {
      const contract = contractMap.get(r.contractId);
      let boostFactor = 1.0;
      
      if (contract) {
        // Boost high-value contracts
        const totalVal = contract.totalValue ? Number(contract.totalValue) : 0;
        if (totalVal >= 500000) boostFactor *= 1.15;
        else if (totalVal >= 100000) boostFactor *= 1.08;
        
        // Boost contracts expiring soon (more urgency)
        if (contract.endDate) {
          const daysUntilExpiry = Math.floor((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) boostFactor *= 1.2;
          else if (daysUntilExpiry > 30 && daysUntilExpiry <= 90) boostFactor *= 1.1;
        }
        
        // Boost active contracts
        if (contract.status === 'ACTIVE') boostFactor *= 1.05;
        
        // Boost auto-renewal contracts (important to monitor)
        if (contract.autoRenewalEnabled) boostFactor *= 1.05;
      }
      
      return {
        ...r,
        score: Math.min(r.score * boostFactor, 1.0), // Cap at 1.0
        contractMeta: contract,
      };
    }).sort((a, b) => b.score - a.score);
    
    const searchResults = boostedResults
      .filter(r => r.score >= minScore)
      .slice(0, k)
      .map(r => ({
        contractId: r.contractId,
        contractName: r.contractMeta?.fileName || 'Unknown',
        supplierName: r.contractMeta?.supplierName || undefined,
        status: r.contractMeta?.status || undefined,
        endDate: r.contractMeta?.endDate?.toISOString() || undefined,
        totalValue: r.contractMeta?.totalValue ? Number(r.contractMeta.totalValue) : undefined,
        chunkIndex: r.chunkIndex,
        text: r.text,
        score: r.score,
        matchType: r.matchType,
        metadata: {
          chunkType: 'paragraph' as const,
          startChar: 0,
          endChar: r.text.length,
          wordCount: r.text.split(/\s+/).length,
        },
        highlights: extractHighlights(r.text, query),
      }));
    
    // Step 7: Store results in semantic cache for future similar queries
    if (searchResults.length > 0) {
      try {
        cache.store(query, primaryQueryEmbedding, tenantId, searchResults as any);
      } catch {
        // Cache store failure is non-critical
      }
    }
    
    return searchResults;
      
  } catch (error: any) {
    // If OpenAI fails (429 quota, network error, etc.), fall back to keyword-only search
    // instead of silently returning empty results
    const errorMsg = error?.message || 'Unknown error';
    console.warn(`[RAG] Hybrid search failed: ${errorMsg.substring(0, 200)}. Falling back to keyword-only search.`);
    
    try {
      // Fall back to keyword search on ContractEmbedding.chunkText
      const keywordFallback = await keywordOnlySearch(query, filters, k);
      if (keywordFallback.length > 0) return keywordFallback;
      
      // If no ContractEmbedding chunks exist, search Contract.rawText directly
      return rawTextFallbackSearch(query, filters, k);
    } catch {
      return [];
    }
  }
}

/**
 * Fallback keyword-only search when no API key available
 */
async function keywordOnlySearch(
  query: string,
  filters: SearchFilters,
  k: number
): Promise<SearchResult[]> {
  const results = await keywordSearch(query, filters, k);
  
  // If keyword search on chunks returns nothing, try rawText fallback
  if (results.length === 0) {
    return rawTextFallbackSearch(query, filters, k);
  }
  
  const contractIds = [...new Set(results.map(r => r.contractId))];
  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds } },
    select: { id: true, fileName: true },
  });
  
  const contractMap = new Map(contracts.map(c => [c.id, c.fileName]));
  
  return results.map(r => ({
    contractId: r.contractId,
    contractName: contractMap.get(r.contractId) || 'Unknown',
    chunkIndex: r.chunkIndex,
    text: r.chunkText,
    score: 1 / r.rank,
    matchType: 'keyword' as const,
    metadata: {
      chunkType: 'paragraph' as const,
      startChar: 0,
      endChar: r.chunkText.length,
      wordCount: r.chunkText.split(/\s+/).length,
    },
    highlights: extractHighlights(r.chunkText, query),
  }));
}

/**
 * Last-resort fallback: search Contract.rawText directly when no ContractEmbedding chunks exist.
 * This enables search even when OpenAI is unavailable and no chunks have been stored.
 */
async function rawTextFallbackSearch(
  query: string,
  filters: SearchFilters,
  k: number
): Promise<SearchResult[]> {
  try {
    const where: any = {
      rawText: { not: null },
      NOT: { rawText: '' },
    };
    
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.contractIds?.length) where.id = { in: filters.contractIds };
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.contractTypes?.length) where.contractType = { in: filters.contractTypes };
    
    // Use PostgreSQL full-text search on rawText
    const contracts = await prisma.$queryRaw<Array<{
      id: string;
      fileName: string;
      rawText: string;
      rank: number;
    }>>`
      SELECT c.id, c."fileName", 
             substring(c."rawText" from 1 for 2000) as "rawText",
             ts_rank_cd(to_tsvector('english', c."rawText"), plainto_tsquery('english', ${query})) as rank
      FROM "Contract" c
      WHERE c."rawText" IS NOT NULL 
        AND length(c."rawText") > 50
        AND to_tsvector('english', c."rawText") @@ plainto_tsquery('english', ${query})
        ${filters.tenantId ? Prisma.sql`AND c."tenantId" = ${filters.tenantId}` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT ${k}
    `;
    
    return contracts.map((c, i) => ({
      contractId: c.id,
      contractName: c.fileName || 'Unknown',
      chunkIndex: 0,
      text: c.rawText,
      score: Math.min(c.rank, 1.0),
      matchType: 'keyword' as const,
      metadata: {
        chunkType: 'paragraph' as const,
        startChar: 0,
        endChar: c.rawText.length,
        wordCount: c.rawText.split(/\s+/).length,
      },
      highlights: extractHighlights(c.rawText, query),
    }));
  } catch (error) {
    console.warn('[RAG] rawText fallback search failed:', error);
    return [];
  }
}

/**
 * Cross-contract semantic search
 */
export async function crossContractSearch(
  query: string,
  tenantId: string,
  options: Omit<SearchOptions, 'filters'> & { filters?: Omit<SearchFilters, 'contractIds'> } = {}
): Promise<SearchResult[]> {
  return hybridSearch(query, {
    ...options,
    filters: {
      ...options.filters,
      tenantId,
    },
  });
}

/**
 * Extract highlights from text based on query
 */
function extractHighlights(text: string, query: string): string[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const highlights: string[] = [];
  
  for (const term of queryTerms) {
    const regex = new RegExp(`\\b${term}\\w*\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      highlights.push(...matches);
    }
  }
  
  return [...new Set(highlights)].slice(0, 5);
}

// ============================================================================
// Embedding Generation with Semantic Chunks
// ============================================================================

/**
 * Process a contract with semantic chunking and generate embeddings
 */
export async function processContractWithSemanticChunking(
  contractId: string,
  text: string,
  options?: { apiKey?: string; model?: string }
): Promise<{ chunksCreated: number; embeddingsGenerated: number }> {
  const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
  const model = options?.model || process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';
  
  if (!apiKey) {
    throw new Error('OpenAI API key required for embedding generation');
  }
  
  // Step 1: Semantic chunking
  const chunks = semanticChunk(text);
  
  if (chunks.length === 0) {
    return { chunksCreated: 0, embeddingsGenerated: 0 };
  }
  
  // Step 1.5: Contextual Retrieval — prepend document context to each chunk
  // This adds a 1-2 sentence summary prefix per chunk (+49% retrieval accuracy)
  let contextualizedChunks = chunks;
  try {
    const contextualized = await contextualizeChunks(contractId, text, 
      chunks.map(c => ({ text: c.text, section: c.metadata.section || '', chunkIndex: c.index }))
    );
    contextualizedChunks = chunks.map((chunk, i) => ({
      ...chunk,
      text: contextualized[i]?.text || chunk.text,
    }));
  } catch (ctxErr) {
    console.warn('[RAG] Contextual retrieval skipped:', ctxErr);
    // Continue with original chunks — graceful degradation
  }
  
  // Step 2: Generate embeddings in batches
  const OpenAI = (await import('openai')).OpenAI;
  const openai = new OpenAI({ apiKey });
  
  const BATCH_SIZE = 32;
  const embeddings: number[][] = [];
  
  for (let i = 0; i < contextualizedChunks.length; i += BATCH_SIZE) {
    const batch = contextualizedChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);
    
    const response = await openai.embeddings.create({ model, input: texts });
    embeddings.push(...response.data.map(d => d.embedding));
  }
  
  // Step 3: Store in database with metadata
  const pgvector = await import('pgvector/utils');
  const toSql = pgvector.toSql;
  
  // Delete existing embeddings
  await prisma.contractEmbedding.deleteMany({ where: { contractId } });
  
  // Create new embeddings with metadata
  const records = contextualizedChunks.map((chunk, i) => ({
    contractId,
    chunkIndex: chunk.index,
    chunkText: chunk.text,
    embedding: toSql(embeddings[i]),
    chunkType: chunk.metadata.chunkType,
    section: chunk.metadata.section,
  }));
  
  // Insert in batches using fully parameterized queries (no string interpolation)
  const INSERT_BATCH = 50;
  for (let batchStart = 0; batchStart < records.length; batchStart += INSERT_BATCH) {
    const batch = records.slice(batchStart, batchStart + INSERT_BATCH);
    // Build a parameterized values list: each row uses 6 parameters
    const paramParts: string[] = [];
    const params: unknown[] = [];
    for (let idx = 0; idx < batch.length; idx++) {
      const offset = idx * 6;
      paramParts.push(
        `(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::vector, $${offset + 5}, $${offset + 6}, NOW(), NOW())`
      );
      const r = batch[idx]!;
      params.push(r.contractId, r.chunkIndex, r.chunkText, r.embedding, r.chunkType, r.section ?? null);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ContractEmbedding" ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "createdAt", "updatedAt") VALUES ${paramParts.join(', ')}`,
      ...params,
    );
  }
  
  // Step 4: Build chunk relationship graph for this contract
  try {
    buildContractGraph(
      getChunkGraph(),
      contractId,
      contextualizedChunks.map((chunk, i) => ({
        text: chunk.text,
        section: chunk.metadata.section || '',
        index: chunk.index,
        embedding: embeddings[i],
      })),
    );
  } catch (graphErr) {
    console.warn('[RAG] Graph building skipped:', graphErr);
  }
  
  // Step 5: Invalidate semantic cache for this contract's tenant
  try {
    getSemanticCache().invalidateContract(contractId);
  } catch {
    // Non-critical
  }
  
  // Step 6: Track embedding version in ContractMetadata (idempotency + observability)
  try {
    await prisma.contractMetadata.upsert({
      where: { contractId },
      update: {
        ragSyncedAt: new Date(),
        embeddingVersion: model,
        embeddingCount: embeddings.length,
        lastEmbeddingAt: new Date(),
      },
      create: {
        contractId,
        tenantId: (await prisma.contract.findUnique({ where: { id: contractId }, select: { tenantId: true } }))?.tenantId ?? 'unknown',
        updatedBy: 'system',
        ragSyncedAt: new Date(),
        embeddingVersion: model,
        embeddingCount: embeddings.length,
        lastEmbeddingAt: new Date(),
      },
    });
  } catch (metaErr) {
    console.warn('[RAG] ContractMetadata version tracking failed (non-fatal):', metaErr);
  }
  
  return {
    chunksCreated: contextualizedChunks.length,
    embeddingsGenerated: embeddings.length,
  };
}

const advancedRagService = {
  semanticChunk,
  expandQuery,
  hybridSearch,
  crossContractSearch,
  processContractWithSemanticChunking,
  rerank,
  detectChunkTypes,
  generateHypotheticalDocument,
};
export default advancedRagService;
