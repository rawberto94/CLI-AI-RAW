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
 * 
 * 7. Contextual Retrieval (NEW)
 *    - Anthropic-style chunk contextualization (+49% accuracy)
 *    - Prepends document-level summary to each chunk before embedding
 * 
 * 8. Parent Document Retrieval (NEW)
 *    - Two-tier chunking: small children for matching, large parents for context
 *    - Ensures LLM gets complete surrounding context
 * 
 * 9. Semantic Cache (NEW)
 *    - Embedding-similarity query cache for 60-80% latency reduction
 *    - TTL-based expiry with per-tenant isolation
 * 
 * 10. Self-Corrective RAG / CRAG (NEW)
 *     - LLM grades retrieved chunks for relevance
 *     - Auto-reformulates query on low-confidence results
 * 
 * 11. Chunk Relationship Graph (NEW)
 *     - Legal concept ontology for co-retrieval of related clauses
 *     - Graph traversal for multi-hop reasoning
 */

// Core RAG Service - Main entry point
export {
  hybridSearch,
  crossContractSearch,
  paginatedCrossContractSearch,
  processContractWithSemanticChunking,
  semanticChunk,
  expandQuery,
  type SearchResult,
  type SearchOptions,
  type SearchFilters,
  type RAGChunk,
  type ChunkMetadata,
} from './advanced-rag.service';

// Contextual Retrieval Service
export {
  contextualizeChunks,
  getDocumentSummary,
  generateChunkContext,
  invalidateDocumentSummary,
} from './contextual-retrieval.service';

// Parent Document Retrieval Service
export {
  createParentChildChunks,
  expandToParentChunks,
} from './parent-document-retrieval.service';

// Semantic Cache Service
export {
  getSemanticCache,
  resetSemanticCache,
  cosineSimilarity,
  type SemanticCacheConfig,
  type CacheStats,
} from './semantic-cache.service';

// Self-Corrective RAG (CRAG) Service
export {
  selfCorrectiveRetrieval,
  gradeChunks,
  reformulateQuery,
  type CRAGResult,
  type CRAGConfig,
  type GradedChunk,
  type RelevanceGrade,
} from './self-corrective-rag.service';

// Chunk Relationship Graph Service
export {
  buildContractGraph,
  expandWithGraphContext,
  getChunkGraph,
  resetChunkGraph,
  LEGAL_CONCEPT_GROUPS,
  type ChunkGraph,
  type ChunkNode,
  type ChunkEdge,
  type EdgeType,
  type GraphTraversalOptions,
  type RelatedChunk,
} from './chunk-graph.service';

// Reranking Service
export {
  crossEncoderRerank,
  embeddingBoostRerank,
  semanticRerank,
  mmrRerank,
  hybridRerank,
  progressiveRerank,
  type RerankResult,
  type RerankOptions,
} from './reranker.service';

// RAG Evaluation Service
export {
  evaluateRAGResponse,
  calculateChunkDiversity,
  runBatchEvaluation,
  calculateRecallAtK,
  calculateNDCGAtK,
  calculatePrecisionAtK,
  calculateAveragePrecision,
  calculateMRR,
  computeRetrievalMetrics,
  type RAGEvalResult,
} from './rag-evaluation.service';

// Golden Evaluation Test Set
export {
  GOLDEN_EVAL_SET,
  getGoldenEvalSubset,
  scoreChunkAgainstGolden,
  type GoldenEvalEntry,
} from './golden-eval-set';

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
  stepBackQuery,
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
