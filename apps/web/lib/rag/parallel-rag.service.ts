/**
 * Parallel Multi-Query RAG Service
 * 
 * Runs multiple query variations in parallel for better recall:
 * - Original query
 * - HyDE (Hypothetical Document Embeddings)
 * - Query expansion variations
 * - Legal synonym expansion
 * 
 * Results are fused using Multi-Query RRF (Reciprocal Rank Fusion)
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { createOpenAIClient, createEmbeddingClient, getOpenAIApiKey } from '@/lib/openai-client';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface ParallelRAGOptions {
  tenantId?: string;
  k?: number;
  minScore?: number;
  useHyDE?: boolean;
  useExpansion?: boolean;
  useSynonyms?: boolean;
  /** Chunk-level pre-filter: only search specific chunk types */
  chunkTypes?: ('heading' | 'paragraph' | 'list' | 'table' | 'clause')[];
}

export interface ParallelRAGResult {
  results: SearchResult[];
  queryVariations: string[];
  timingsMs: {
    total: number;
    hyde: number;
    expansion: number;
    search: number;
    fusion: number;
  };
}

export interface SearchResult {
  contractId: string;
  contractName: string;
  supplierName?: string;
  text: string;
  score: number;
  matchType: 'hybrid' | 'semantic' | 'keyword';
  sources: string[]; // Which query variations found this result
}

// =============================================================================
// LEGAL DOMAIN SYNONYMS
// =============================================================================

const LEGAL_SYNONYMS: Record<string, string[]> = {
  termination: ['cancellation', 'cessation', 'ending', 'discontinuation', 'exit'],
  liability: ['responsibility', 'obligation', 'exposure', 'accountability', 'damages'],
  indemnification: ['indemnity', 'hold harmless', 'compensation', 'reimbursement'],
  confidentiality: ['non-disclosure', 'NDA', 'proprietary', 'secret', 'private'],
  payment: ['compensation', 'remuneration', 'fee', 'consideration', 'billing', 'invoice'],
  renewal: ['extension', 'continuation', 'rollover', 'auto-renewal'],
  warranty: ['guarantee', 'assurance', 'representation', 'promise'],
  breach: ['violation', 'default', 'non-compliance', 'infringement'],
  force_majeure: ['act of god', 'unforeseeable circumstances', 'extraordinary event'],
  intellectual_property: ['IP', 'patents', 'copyrights', 'trademarks', 'trade secrets'],
  sla: ['service level', 'performance metrics', 'uptime', 'availability'],
  dispute: ['controversy', 'disagreement', 'conflict', 'arbitration', 'litigation'],
  assignment: ['transfer', 'delegation', 'conveyance'],
  compliance: ['regulatory', 'conformity', 'adherence', 'governance'],
  expiration: ['expiry', 'end date', 'term end', 'contract end'],
};

// =============================================================================
// MAIN PARALLEL RAG FUNCTION
// =============================================================================

export async function parallelMultiQueryRAG(
  query: string,
  options: ParallelRAGOptions = {}
): Promise<ParallelRAGResult> {
  const {
    tenantId,
    k = 10,
    minScore = 0.3,
    useHyDE = true,
    useExpansion = true,
    useSynonyms = true,
  } = options;

  const startTime = Date.now();
  const timings = { total: 0, hyde: 0, expansion: 0, search: 0, fusion: 0 };

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return {
      results: [],
      queryVariations: [query],
      timingsMs: { total: 0, hyde: 0, expansion: 0, search: 0, fusion: 0 },
    };
  }

  const openai = createOpenAIClient(apiKey);
  const embedClient = createEmbeddingClient();

  try {
    // ========================================
    // STEP 1: GENERATE QUERY VARIATIONS IN PARALLEL
    // ========================================
    const queryGenerationStart = Date.now();

    const [hydeResult, expandedQueries, synonymQueries] = await Promise.all([
      useHyDE ? generateHyDE(query, openai) : Promise.resolve(null),
      useExpansion ? expandQueryVariations(query, openai) : Promise.resolve([]),
      useSynonyms ? Promise.resolve(expandWithSynonyms(query)) : Promise.resolve([]),
    ]);

    timings.hyde = useHyDE ? Date.now() - queryGenerationStart : 0;
    timings.expansion = useExpansion ? Date.now() - queryGenerationStart : 0;

    // Collect all unique query variations
    const allQueries = [
      query, // Original query always included
      ...(hydeResult ? [hydeResult] : []),
      ...expandedQueries,
      ...synonymQueries,
    ].filter((q, i, arr) => arr.indexOf(q) === i); // Deduplicate

    // ========================================
    // STEP 2: GENERATE EMBEDDINGS FOR ALL QUERIES
    // ========================================
    const embDims = parseInt(process.env.RAG_EMBED_DIMENSIONS || '1024', 10);
    const embModel = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';
    const embCreateParams: Record<string, unknown> = {
      model: embModel,
      input: allQueries,
    };
    if (embDims > 0 && embModel.includes('text-embedding-3')) embCreateParams.dimensions = embDims;
    const embeddingsResponse = await embedClient.embeddings.create(
      embCreateParams as any,
      { signal: AbortSignal.timeout(10_000) },
    );

    const queryEmbeddings = embeddingsResponse.data.map(d => d.embedding);

    // ========================================
    // STEP 3: RUN ALL SEARCHES IN PARALLEL
    // ========================================
    const searchStart = Date.now();

    const searchPromises = queryEmbeddings.map((embedding, idx) =>
      vectorSearch(embedding, tenantId, k * 2, options.chunkTypes).then(results => ({
        queryIndex: idx,
        queryText: allQueries[idx],
        results,
      }))
    );

    // Also run keyword search on original query
    const keywordPromise = keywordSearch(query, tenantId, k * 2).then(results => ({
      queryIndex: -1, // Mark as keyword search
      queryText: query,
      results,
    }));

    const allSearchResults = await Promise.all([...searchPromises, keywordPromise]);
    timings.search = Date.now() - searchStart;

    // ========================================
    // STEP 4: MULTI-QUERY RRF FUSION
    // ========================================
    const fusionStart = Date.now();

    const fusedResults = multiQueryRRF(allSearchResults, allQueries);
    timings.fusion = Date.now() - fusionStart;

    // ========================================
    // STEP 5: FETCH CONTRACT METADATA
    // ========================================
    const topResults = fusedResults.slice(0, k);
    const contractIds = [...new Set(topResults.map(r => r.contractId))];

    const contracts = await prisma.contract.findMany({
      where: { id: { in: contractIds }, ...(tenantId ? { tenantId } : {}) },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        supplierName: true,
        status: true,
      },
    });

    const contractMap = new Map(contracts.map(c => [c.id, c]));

    const enrichedResults: SearchResult[] = topResults
      .filter(r => r.score >= minScore)
      .map(r => {
        const contract = contractMap.get(r.contractId);
        return {
          contractId: r.contractId,
          contractName: contract?.contractTitle || contract?.fileName || 'Unknown Contract',
          supplierName: contract?.supplierName || undefined,
          text: r.text,
          score: r.score,
          matchType: r.matchType,
          sources: r.sources,
        };
      });

    timings.total = Date.now() - startTime;

    return {
      results: enrichedResults,
      queryVariations: allQueries,
      timingsMs: timings,
    };
  } catch (error) {
    console.warn('[ParallelRAG] Vector search failed, falling back to keyword-only:', (error as Error).message);
    // Fallback: keyword-only search when OpenAI is unavailable (quota, key issues)
    try {
      const keywordResults = await keywordSearch(query, tenantId, k * 2);
      if (keywordResults.length > 0) {
        const contractIds = [...new Set(keywordResults.map(r => r.contractId))];
        const contracts = await prisma.contract.findMany({
          where: { id: { in: contractIds }, ...(tenantId ? { tenantId } : {}) },
          select: { id: true, contractTitle: true, fileName: true, supplierName: true, status: true },
        });
        const contractMap = new Map(contracts.map(c => [c.id, c]));
        return {
          results: keywordResults.slice(0, k).map(r => {
            const contract = contractMap.get(r.contractId);
            return {
              contractId: r.contractId,
              contractName: contract?.contractTitle || contract?.fileName || 'Unknown',
              supplierName: contract?.supplierName || undefined,
              text: r.text,
              score: 1 / (60 + r.rank + 1),
              matchType: 'keyword' as const,
              sources: ['keyword-fallback'],
            };
          }),
          queryVariations: [query],
          timingsMs: { total: Date.now() - startTime, hyde: 0, expansion: 0, search: 0, fusion: 0 },
        };
      }
    } catch (fallbackError) {
      console.error('[ParallelRAG] Keyword fallback also failed:', fallbackError);
    }
    
    // Last resort: rawText search — use full-text search on the tsvector column
    // and return enough text for meaningful context (16KB instead of 2KB)
    try {
      const tenantFilter = tenantId ? Prisma.sql`AND "tenantId" = ${tenantId}` : Prisma.empty;
      const rawResults = await prisma.$queryRaw<Array<{ id: string; contractTitle: string | null; fileName: string; supplierName: string | null; rawText: string }>>`
        SELECT id, "contractTitle", filename as "fileName", "supplierName", LEFT("rawText", 16000) as "rawText"
        FROM "Contract"
        WHERE "rawText" IS NOT NULL
          AND to_tsvector('english', "rawText") @@ plainto_tsquery('english', ${query})
          ${tenantFilter}
        ORDER BY ts_rank_cd(to_tsvector('english', "rawText"), plainto_tsquery('english', ${query})) DESC
        LIMIT ${k}
      `;
      if (rawResults.length > 0) {
        return {
          results: rawResults.map((r, i) => ({
            contractId: r.id,
            contractName: r.contractTitle || r.fileName || 'Unknown',
            supplierName: r.supplierName || undefined,
            text: r.rawText,
            score: 1 / (60 + i + 1),
            matchType: 'keyword' as const,
            sources: ['rawtext-fallback'],
          })),
          queryVariations: [query],
          timingsMs: { total: Date.now() - startTime, hyde: 0, expansion: 0, search: 0, fusion: 0 },
        };
      }
    } catch (rawError) {
      console.error('[ParallelRAG] rawText fallback also failed:', rawError);
    }
    
    return {
      results: [],
      queryVariations: [query],
      timingsMs: { total: Date.now() - startTime, hyde: 0, expansion: 0, search: 0, fusion: 0 },
    };
  }
}

// =============================================================================
// QUERY VARIATION GENERATORS
// =============================================================================

/**
 * Generate a hypothetical document that would answer the query (HyDE)
 */
async function generateHyDE(query: string, openai: OpenAI): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are generating a hypothetical contract clause that would answer the user's question. Write a realistic 2-3 sentence contract excerpt. Do NOT explain or prefix it - just write the clause text directly.`,
        },
        { role: 'user', content: query },
      ],
      temperature: 0.5,
      max_tokens: 200,
    }, { signal: AbortSignal.timeout(10_000) });

    return response.choices[0]?.message?.content || null;
  } catch {
    return null;
  }
}

/**
 * Generate query variations using GPT
 */
async function expandQueryVariations(query: string, openai: OpenAI): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate 3 alternative phrasings of this contract search query. Return ONLY a JSON array of strings, no explanation.
          
Focus on:
1. Different terminology (legal vs business)
2. More specific or more general versions
3. Different question structures`,
        },
        { role: 'user', content: query },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }, { signal: AbortSignal.timeout(10_000) });

    let content = response.choices[0]?.message?.content || '[]';
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Expand query with legal domain synonyms
 */
function expandWithSynonyms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const expansions: string[] = [];

  for (const [term, synonyms] of Object.entries(LEGAL_SYNONYMS)) {
    if (lowerQuery.includes(term)) {
      // Create variations with each synonym
      for (const synonym of synonyms.slice(0, 2)) {
        expansions.push(query.replace(new RegExp(term, 'gi'), synonym));
      }
    }
    // Check if any synonym is in the query
    for (const synonym of synonyms) {
      if (lowerQuery.includes(synonym.toLowerCase())) {
        expansions.push(query.replace(new RegExp(synonym, 'gi'), term));
        break;
      }
    }
  }

  return expansions.slice(0, 3); // Limit to 3 synonym expansions
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

interface VectorSearchResult {
  contractId: string;
  chunkIndex: number;
  text: string;
  score: number;
}

interface KeywordSearchResult {
  contractId: string;
  chunkIndex: number;
  text: string;
  rank: number;
}

async function vectorSearch(
  embedding: number[],
  tenantId: string | undefined,
  k: number,
  chunkTypes?: ('heading' | 'paragraph' | 'list' | 'table' | 'clause')[]
): Promise<VectorSearchResult[]> {
  const vectorStr = `[${embedding.join(',')}]`;

  try {
    const conditions: Prisma.Sql[] = [];
    if (tenantId) {
      conditions.push(Prisma.sql`c."tenantId" = ${tenantId}`);
    }
    if (chunkTypes?.length) {
      const validTypes = ['heading', 'paragraph', 'list', 'table', 'clause'];
      const safeTypes = chunkTypes.filter(t => validTypes.includes(t));
      if (safeTypes.length > 0) {
        conditions.push(Prisma.sql`ce."chunkType" IN (${Prisma.join(safeTypes)})`);
      }
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    // Set HNSW ef_search for high recall (95%+)
    await prisma.$executeRaw`SET hnsw.ef_search = 100`;

    const results = await prisma.$queryRaw<VectorSearchResult[]>`
      SELECT 
        ce."contractId",
        ce."chunkIndex",
        ce."chunkText" as text,
        1 - (ce."embedding" <=> ${vectorStr}::vector) as score
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON c.id = ce."contractId"
      ${whereClause}
      ORDER BY score DESC
      LIMIT ${k}
    `;

    return results;
  } catch (error) {
    console.error('[ParallelRAG] vectorSearch failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function keywordSearch(
  query: string,
  tenantId: string | undefined,
  k: number
): Promise<KeywordSearchResult[]> {
  // Prepare search query for PostgreSQL full-text search
  const searchTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(' & ');

  if (!searchTerms) return [];

  try {
    const whereClause = tenantId
      ? Prisma.sql`AND c."tenantId" = ${tenantId}`
      : Prisma.empty;

    const results = await prisma.$queryRaw<KeywordSearchResult[]>`
      SELECT 
        ce."contractId",
        ce."chunkIndex",
        ce."chunkText" as text,
        ts_rank(to_tsvector('english', ce."chunkText"), plainto_tsquery('english', ${query})) as rank
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON c.id = ce."contractId"
      WHERE to_tsvector('english', ce."chunkText") @@ plainto_tsquery('english', ${query})
      ${whereClause}
      ORDER BY rank DESC
      LIMIT ${k}
    `;

    return results.map((r, i) => ({ ...r, rank: i + 1 }));
  } catch (error) {
    console.error('[ParallelRAG] keywordSearch failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

// =============================================================================
// MULTI-QUERY RRF FUSION
// =============================================================================

interface FusedResult {
  contractId: string;
  chunkIndex: number;
  text: string;
  score: number;
  matchType: 'hybrid' | 'semantic' | 'keyword';
  sources: string[];
}

function multiQueryRRF(
  searchResults: Array<{
    queryIndex: number;
    queryText: string;
    results: Array<{ contractId: string; chunkIndex: number; text: string; score?: number; rank?: number }>;
  }>,
  queryTexts: string[],
  k: number = 60 // RRF constant
): FusedResult[] {
  const scoreMap = new Map<string, {
    contractId: string;
    chunkIndex: number;
    text: string;
    rrfScore: number;
    sources: Set<string>;
    hasVector: boolean;
    hasKeyword: boolean;
  }>();

  for (const { queryIndex, results } of searchResults) {
    const isKeywordSearch = queryIndex === -1;
    const sourceName = isKeywordSearch ? 'keyword' : `query_${queryIndex}`;

    results.forEach((result, rank) => {
      const key = `${result.contractId}:${result.chunkIndex}`;
      const rrfContribution = 1 / (k + rank + 1);

      const existing = scoreMap.get(key);
      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.sources.add(sourceName);
        if (isKeywordSearch) existing.hasKeyword = true;
        else existing.hasVector = true;
      } else {
        scoreMap.set(key, {
          contractId: result.contractId,
          chunkIndex: result.chunkIndex,
          text: result.text,
          rrfScore: rrfContribution,
          sources: new Set([sourceName]),
          hasVector: !isKeywordSearch,
          hasKeyword: isKeywordSearch,
        });
      }
    });
  }

  // Convert to array and sort by RRF score
  // Normalize scores to [0, 1] range — raw RRF sums can exceed 1.0
  // when a chunk appears across multiple query variations.
  const items = Array.from(scoreMap.values());
  const maxScore = items.reduce((max, item) => Math.max(max, item.rrfScore), 0);

  return items
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(item => ({
      contractId: item.contractId,
      chunkIndex: item.chunkIndex,
      text: item.text,
      score: maxScore > 0 ? item.rrfScore / maxScore : 0,
      matchType: item.hasVector && item.hasKeyword ? 'hybrid' :
                 item.hasVector ? 'semantic' : 'keyword',
      sources: Array.from(item.sources),
    }));
}

// =============================================================================
// EXPORTS
// =============================================================================

export { generateHyDE, expandQueryVariations, expandWithSynonyms, multiQueryRRF };
