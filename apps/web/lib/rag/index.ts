/**
 * State-of-the-Art RAG System
 * 
 * This module provides a comprehensive RAG (Retrieval-Augmented Generation) system
 * with the following advanced features:
 * 
 * 1. Hybrid Search with RRF (Reciprocal Rank Fusion)
 *    - Combines BM25 keyword search with vector semantic search
 *    - Uses RRF to merge rankings for optimal results
 * 
 * 2. Cross-Encoder Reranking
 *    - Re-scores top results using GPT for precision
 *    - Includes MMR (Maximal Marginal Relevance) for diversity
 * 
 * 3. Semantic Chunking
 *    - Structure-aware document splitting
 *    - Respects section boundaries, headings, and paragraphs
 *    - Preserves legal document structure (articles, clauses, schedules)
 * 
 * 4. Multi-Query Expansion
 *    - HyDE (Hypothetical Document Embeddings) for better matching
 *    - Query variation generation for improved recall
 *    - Legal synonym expansion
 * 
 * 5. Cross-Contract Search
 *    - Search across all contracts for a tenant
 *    - Unified result ranking
 * 
 * 6. Metadata Filtering
 *    - Filter by date, supplier, contract type, status
 *    - Combined with vector search for targeted results
 */

// Core RAG Service - Main entry point
export {
  hybridSearch,
  crossContractSearch,
  processContractWithSemanticChunking,
  semanticChunk,
  expandQuery,
  type SearchResult,
  type SearchOptions,
  type SearchFilters,
  type RAGChunk,
  type ChunkMetadata,
} from './advanced-rag.service';

// Reranking Service
export {
  crossEncoderRerank,
  embeddingBoostRerank,
  semanticRerank,
  mmrRerank,
  hybridRerank,
  type RerankResult,
  type RerankOptions,
} from './reranker.service';

// Semantic Chunking Service
export {
  semanticChunk as advancedSemanticChunk,
  recursiveChunk,
  tokenAwareChunk,
  type SemanticChunk,
  type ChunkingOptions,
} from './semantic-chunker.service';

// Query Expansion Service
export {
  expandQuery as expandQueryAdvanced,
  expandContractQuery,
  decomposeQuery,
  getLegalSynonyms,
  type QueryExpansion,
  type ExpansionOptions,
} from './query-expansion.service';

// Re-indexing Triggers
export {
  triggerContractReindex,
  queueContractReindex,
  checkContractNeedsReindex,
  findContractsNeedingReindex,
  type ReindexOptions,
  type ReindexResult,
} from './reindex-trigger';

// Parallel Multi-Query RAG
export {
  parallelMultiQueryRAG,
  generateHyDE,
  expandQueryVariations,
  expandWithSynonyms,
  multiQueryRRF,
  type ParallelRAGOptions,
  type ParallelRAGResult,
  type SearchResult as ParallelSearchResult,
} from './parallel-rag.service';

/**
 * Quick Start Guide:
 * 
 * 1. Basic Hybrid Search:
 * ```typescript
 * import { hybridSearch } from '@/lib/rag';
 * 
 * const results = await hybridSearch('termination clauses', {
 *   mode: 'hybrid',
 *   k: 10,
 *   rerank: true,
 *   filters: { tenantId: 'tenant-123' },
 * });
 * ```
 * 
 * 2. Cross-Contract Search:
 * ```typescript
 * import { crossContractSearch } from '@/lib/rag';
 * 
 * const results = await crossContractSearch(
 *   'liability provisions',
 *   'tenant-123',
 *   { k: 20, rerank: true }
 * );
 * ```
 * 
 * 3. Process Contract with Semantic Chunking:
 * ```typescript
 * import { processContractWithSemanticChunking } from '@/lib/rag';
 * 
 * const result = await processContractWithSemanticChunking(
 *   'contract-id',
 *   contractText,
 *   { model: 'text-embedding-3-small' }
 * );
 * ```
 * 
 * 4. Expand Query for Better Recall:
 * ```typescript
 * import { expandQueryAdvanced } from '@/lib/rag';
 * 
 * const expansion = await expandQueryAdvanced('payment terms', {
 *   numVariations: 3,
 *   useHyDE: true,
 * });
 * // Returns: { original, variations, hypotheticalAnswer, keywords, intent }
 * ```
 */
