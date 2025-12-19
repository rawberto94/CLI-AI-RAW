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
 */

import { prisma } from '@/lib/prisma';

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

export interface ChunkMetadata {
  section?: string;
  heading?: string;
  pageNumber?: number;
  chunkType: 'heading' | 'paragraph' | 'list' | 'table' | 'clause';
  startChar: number;
  endChar: number;
  wordCount: number;
}

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
}

// ============================================================================
// Semantic Chunking
// ============================================================================

interface SemanticChunk {
  index: number;
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Semantic chunking - splits text by document structure (headings, sections, paragraphs)
 * rather than fixed character counts
 */
export function semanticChunk(
  text: string,
  options: {
    maxChunkSize?: number;
    minChunkSize?: number;
    overlap?: number;
  } = {}
): SemanticChunk[] {
  const { maxChunkSize = 1500, minChunkSize = 200, overlap = 100 } = options;
  
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;
  
  // Detect document structure patterns
  const headingPattern = /^(?:#{1,6}\s+|(?:\d+\.)+\s+|[A-Z][A-Z\s]{2,}:?\s*$|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/gm;
  const listPattern = /^(?:\s*[-•*]\s+|\s*\d+[.)]\s+)/gm;
  const tablePattern = /\|.*\|/g;
  
  // Split by major sections first
  const sections = text.split(/\n(?=(?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+))/i);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Extract heading if present
    const headingMatch = section.match(headingPattern);
    const heading = headingMatch ? headingMatch[0].trim() : undefined;
    
    // Determine chunk type
    let chunkType: ChunkMetadata['chunkType'] = 'paragraph';
    if (heading) chunkType = 'heading';
    else if (listPattern.test(section)) chunkType = 'list';
    else if (tablePattern.test(section)) chunkType = 'table';
    else if (/clause|term|condition|obligation/i.test(section)) chunkType = 'clause';
    
    // If section is small enough, keep as single chunk
    if (section.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: section.trim(),
        metadata: {
          section: heading,
          heading,
          chunkType,
          startChar: text.indexOf(section),
          endChar: text.indexOf(section) + section.length,
          wordCount: section.split(/\s+/).length,
        },
      });
      continue;
    }
    
    // Split large sections by paragraphs
    const paragraphs = section.split(/\n\n+/);
    let currentChunk = '';
    let chunkStartChar = text.indexOf(section);
    
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      
      // If adding this paragraph would exceed max size, save current chunk
      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length >= minChunkSize) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          metadata: {
            section: heading,
            heading,
            chunkType,
            startChar: chunkStartChar,
            endChar: chunkStartChar + currentChunk.length,
            wordCount: currentChunk.split(/\s+/).length,
          },
        });
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + para;
        chunkStartChar = text.indexOf(currentChunk) || chunkStartChar + currentChunk.length - overlap;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    
    // Save remaining chunk
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        metadata: {
          section: heading,
          heading,
          chunkType,
          startChar: chunkStartChar,
          endChar: chunkStartChar + currentChunk.length,
          wordCount: currentChunk.split(/\s+/).length,
        },
      });
    }
  }
  
  return chunks;
}

// ============================================================================
// Multi-Query Expansion (HyDE-inspired)
// ============================================================================

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
  } catch (error) {
    console.error('Query expansion failed:', error);
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
  
  // Build filter conditions
  const conditions: string[] = [];
  if (filters.contractIds?.length) {
    conditions.push(`ce."contractId" IN (${filters.contractIds.map(id => `'${id}'`).join(',')})`);
  }
  if (filters.tenantId) {
    conditions.push(`c."tenantId" = '${filters.tenantId}'`);
  }
  if (filters.dateFrom) {
    conditions.push(`c."createdAt" >= '${filters.dateFrom.toISOString()}'`);
  }
  if (filters.dateTo) {
    conditions.push(`c."createdAt" <= '${filters.dateTo.toISOString()}'`);
  }
  if (filters.status?.length) {
    conditions.push(`c."status" IN (${filters.status.map(s => `'${s}'`).join(',')})`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  try {
    const results = await prisma.$queryRawUnsafe<VectorResult[]>(`
      SELECT 
        ce."contractId",
        ce."chunkIndex",
        ce."chunkText",
        1 - (ce."embedding" <=> '${vectorQuery}'::vector) as score
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON c.id = ce."contractId"
      ${whereClause}
      ORDER BY score DESC
      LIMIT ${k}
    `);
    
    return results;
  } catch (error) {
    console.error('Vector search error:', error);
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
  // Build filter conditions
  const conditions: string[] = [];
  if (filters.contractIds?.length) {
    conditions.push(`ce."contractId" IN (${filters.contractIds.map(id => `'${id}'`).join(',')})`);
  }
  if (filters.tenantId) {
    conditions.push(`c."tenantId" = '${filters.tenantId}'`);
  }
  
  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  
  // Escape query for tsquery
  const tsQuery = query
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(' | ');
  
  try {
    const results = await prisma.$queryRawUnsafe<KeywordResult[]>(`
      SELECT 
        ce."contractId",
        ce."chunkIndex",
        ce."chunkText",
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', ce."chunkText"), plainto_tsquery('english', '${tsQuery}')) DESC) as rank
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON c.id = ce."contractId"
      WHERE to_tsvector('english', ce."chunkText") @@ plainto_tsquery('english', '${tsQuery}')
      ${whereClause}
      ORDER BY rank ASC
      LIMIT ${k}
    `);
    
    return results;
  } catch (error) {
    console.error('Keyword search error:', error);
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
 * Rerank results using a cross-encoder approach via GPT
 * (In production, use Cohere Rerank or a local cross-encoder model)
 */
async function rerank(
  query: string,
  results: Array<{ contractId: string; chunkIndex: number; text: string; score: number }>,
  options?: { apiKey?: string; topK?: number }
): Promise<RerankedResult[]> {
  const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
  const topK = options?.topK || 10;
  
  if (!apiKey || results.length === 0) {
    return results.map(r => ({ ...r, originalScore: r.score, rerankedScore: r.score }));
  }
  
  // Take top candidates for reranking (reranking is expensive)
  const candidates = results.slice(0, Math.min(20, results.length));
  
  try {
    const OpenAI = (await import('openai')).OpenAI;
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a relevance scoring assistant. Given a query and document passages, rate each passage's relevance from 0.0 to 1.0.
Return ONLY a JSON array of numbers in the same order as the passages.
Consider:
- Semantic relevance to the query
- Specificity of information
- Completeness of answer
- Legal/contractual context match`,
        },
        {
          role: 'user',
          content: `Query: "${query}"

Passages:
${candidates.map((c, i) => `[${i}] ${c.text.slice(0, 500)}`).join('\n\n')}

Return relevance scores as JSON array:`,
        },
      ],
      temperature: 0,
      max_tokens: 200,
    });
    
    let content = response.choices[0]?.message?.content || '[]';
    // Strip markdown code blocks if present
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const scores = JSON.parse(content) as number[];
    
    const reranked = candidates.map((c, i) => ({
      ...c,
      originalScore: c.score,
      rerankedScore: scores[i] ?? c.score,
    }));
    
    // Sort by reranked score
    reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);
    
    return reranked.slice(0, topK);
  } catch (error) {
    console.error('Reranking failed:', error);
    return results.slice(0, topK).map(r => ({ ...r, originalScore: r.score, rerankedScore: r.score }));
  }
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
    mode = 'hybrid',
    k = 10,
    minScore = 0.3,
    filters = {},
    rerank: shouldRerank = true,
    expandQuery: shouldExpand = true,
  } = options;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('No OpenAI API key, falling back to keyword search');
    return keywordOnlySearch(query, filters, k);
  }
  
  try {
    // Step 1: Query expansion
    let queries = [query];
    if (shouldExpand && mode !== 'keyword') {
      queries = await expandQuery(query, { apiKey });
      console.log(`📝 Expanded query into ${queries.length} variations`);
    }
    
    // Step 2: Generate embeddings for all query variations
    const OpenAI = (await import('openai')).OpenAI;
    const openai = new OpenAI({ apiKey });
    
    const embeddingsResponse = await openai.embeddings.create({
      model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
      input: queries,
    });
    
    const queryEmbeddings = embeddingsResponse.data.map(d => d.embedding);
    
    // Step 3: Perform searches based on mode
    let vectorResults: VectorResult[] = [];
    let keywordResults: KeywordResult[] = [];
    
    if (mode === 'semantic' || mode === 'hybrid') {
      // Search with each query variation and merge results
      const allVectorResults = await Promise.all(
        queryEmbeddings.map(emb => vectorSearch(emb, filters, k * 2))
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
      keywordResults = await keywordSearch(query, filters, k * 2);
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
      console.log(`🔄 Reranking ${combinedResults.length} results`);
      const reranked = await rerank(query, combinedResults, { apiKey, topK: k });
      finalResults = reranked.map(r => ({
        contractId: r.contractId,
        chunkIndex: r.chunkIndex,
        text: r.text,
        score: r.rerankedScore,
        matchType: combinedResults.find(c => c.contractId === r.contractId && c.chunkIndex === r.chunkIndex)?.matchType || 'hybrid',
      }));
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
    
    const contractMap = new Map(contracts.map(c => [c.id, c]));
    
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
    
    return boostedResults
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
      
  } catch (error) {
    console.error('Hybrid search error:', error);
    return [];
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
  console.log(`📄 Semantic chunking contract: ${contractId}`);
  const chunks = semanticChunk(text);
  console.log(`📦 Created ${chunks.length} semantic chunks`);
  
  if (chunks.length === 0) {
    return { chunksCreated: 0, embeddingsGenerated: 0 };
  }
  
  // Step 2: Generate embeddings in batches
  const OpenAI = (await import('openai')).OpenAI;
  const openai = new OpenAI({ apiKey });
  
  const BATCH_SIZE = 32;
  const embeddings: number[][] = [];
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);
    
    console.log(`🌐 Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
    
    const response = await openai.embeddings.create({ model, input: texts });
    embeddings.push(...response.data.map(d => d.embedding));
  }
  
  // Step 3: Store in database with metadata
  const pgvector = await import('pgvector/utils');
  const toSql = pgvector.toSql;
  
  // Delete existing embeddings
  await prisma.contractEmbedding.deleteMany({ where: { contractId } });
  
  // Create new embeddings with metadata
  const records = chunks.map((chunk, i) => ({
    contractId,
    chunkIndex: chunk.index,
    chunkText: chunk.text,
    embedding: toSql(embeddings[i]),
    chunkType: chunk.metadata.chunkType,
    section: chunk.metadata.section,
  }));
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ContractEmbedding" ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "createdAt", "updatedAt")
    VALUES ${records.map((r, i) => 
      `(gen_random_uuid(), '${r.contractId}', ${r.chunkIndex}, $${i * 2 + 1}, '${r.embedding}'::vector, $${i * 2 + 2}, ${r.section ? `'${r.section}'` : 'NULL'}, NOW(), NOW())`
    ).join(', ')}
  `, ...records.flatMap(r => [r.chunkText, r.chunkType]));
  
  console.log(`✅ Stored ${records.length} embeddings with semantic metadata`);
  
  return {
    chunksCreated: chunks.length,
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
};
export default advancedRagService;
