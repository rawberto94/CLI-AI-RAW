import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { NextRequest } from 'next/server'
import { hybridSearch, crossContractSearch } from '@/lib/rag/advanced-rag.service'
import { getServerTenantId } from '@/lib/tenant-server'
import { getServerSession } from '@/lib/auth'

/**
 * Semantic Search API - Enhanced with Hybrid Search
 * POST /api/search/semantic
 * 
 * Performs semantic/hybrid search across contracts using RAG embeddings
 * Supports both single-contract and cross-contract search
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json()
  const { 
    query, 
    contractId, 
    k = 6,
    mode = 'hybrid',
    rerank = true,
    expandQuery = true,
  } = body

  if (!query) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Query is required', 400)
  }

  const tenantId = await getServerTenantId()

  // Use advanced RAG with hybrid search
  const results = contractId
    ? await hybridSearch(query, {
        mode,
        k,
        rerank,
        expandQuery,
        filters: { contractIds: [contractId], tenantId },
      })
    : await crossContractSearch(query, tenantId, {
        mode,
        k,
        rerank,
        expandQuery,
      })

  return createSuccessResponse(ctx, {
    success: true,
    query,
    contractId,
    mode,
    results: results.map(r => ({
      contractId: r.contractId,
      contractName: r.contractName,
      text: r.text,
      score: r.score,
      chunkIndex: r.chunkIndex,
      matchType: r.matchType,
      relevance: (r.score * 100).toFixed(1) + '%',
      highlights: r.highlights,
    })),
    count: results.length,
    model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
    features: {
      hybridSearch: mode === 'hybrid',
      reranking: rerank,
      queryExpansion: expandQuery,
      crossContract: !contractId,
    },
  })

});

/**
 * GET /api/search/semantic
 * 
 * Returns API documentation
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  return createSuccessResponse(ctx, {
    endpoint: '/api/search/semantic',
    method: 'POST',
    description: 'State-of-the-art hybrid semantic search with RRF, reranking, and query expansion',
    features: [
      'Hybrid Search (BM25 + Vector) with Reciprocal Rank Fusion',
      'Cross-Encoder Reranking for precision',
      'Multi-Query Expansion for better recall',
      'Cross-Contract Search',
      'Semantic Chunking awareness',
    ],
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Natural language search query'
      },
      contractId: {
        type: 'string',
        required: false,
        description: 'Contract ID to search within (omit for cross-contract search)'
      },
      k: {
        type: 'number',
        required: false,
        default: 6,
        description: 'Number of results to return'
      },
      mode: {
        type: 'string',
        required: false,
        default: 'hybrid',
        options: ['hybrid', 'semantic', 'keyword'],
        description: 'Search mode'
      },
      rerank: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Apply cross-encoder reranking'
      },
      expandQuery: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Apply multi-query expansion'
      },
    },
    examples: {
      singleContract: {
        query: 'payment terms and conditions',
        contractId: 'cmh641ydq0001ep2ycwu7sr6f',
        k: 6
      },
      crossContract: {
        query: 'liability and indemnification clauses',
        mode: 'hybrid',
        k: 10,
        rerank: true,
        expandQuery: true
      }
    }
  })
});
