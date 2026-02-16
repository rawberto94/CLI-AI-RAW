/**
 * Advanced RAG API - State-of-the-Art Hybrid Search
 * 
 * POST /api/rag/search - Hybrid search with RRF, reranking, query expansion
 * GET /api/rag/search - API documentation
 */

import { NextRequest } from 'next/server';
import { hybridSearch, crossContractSearch, SearchOptions } from '@/lib/rag/advanced-rag.service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const {
      query,
      contractId,
      mode = 'hybrid',
      k = 10,
      minScore = 0.3,
      rerank = true,
      expandQuery = true,
      filters = {} } = body;

    if (!query || typeof query !== 'string') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Query is required and must be a string', 400);
    }

    const searchOptions: SearchOptions = {
      mode,
      k,
      minScore,
      rerank,
      expandQuery,
      filters: {
        ...filters,
        tenantId,
        contractIds: contractId ? [contractId] : filters.contractIds } };

    // Use cross-contract or single contract search
    const results = contractId
      ? await hybridSearch(query, searchOptions)
      : await crossContractSearch(query, tenantId, searchOptions);

    const processingTime = Date.now() - startTime;

    return createSuccessResponse(ctx, {
      query,
      mode,
      results: results.map(r => ({
        contractId: r.contractId,
        contractName: r.contractName,
        chunkIndex: r.chunkIndex,
        text: r.text,
        score: Math.round(r.score * 1000) / 1000,
        matchType: r.matchType,
        relevance: `${Math.round(r.score * 100)}%`,
        highlights: r.highlights,
        metadata: r.metadata })),
      count: results.length,
      processingTime,
      options: {
        mode,
        k,
        rerank,
        expandQuery,
        minScore } });

  } catch (error) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500);
  }
});

export const GET = withAuthApiHandler(async (_request, ctx) => {
  return createSuccessResponse(ctx, {
    endpoint: '/api/rag/search',
    method: 'POST',
    description: 'State-of-the-art hybrid search with RRF, cross-encoder reranking, and query expansion',
    features: [
      'Hybrid Search (BM25 + Vector) with Reciprocal Rank Fusion',
      'Cross-Encoder Reranking for precision',
      'Multi-Query Expansion for better recall',
      'Semantic Chunking by document structure',
      'Cross-Contract Search',
      'Metadata Filtering',
    ],
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Natural language search query' },
      contractId: {
        type: 'string',
        required: false,
        description: 'Search within specific contract (omit for cross-contract search)' },
      mode: {
        type: 'string',
        required: false,
        default: 'hybrid',
        options: ['hybrid', 'semantic', 'keyword'],
        description: 'Search mode' },
      k: {
        type: 'number',
        required: false,
        default: 10,
        description: 'Number of results to return' },
      minScore: {
        type: 'number',
        required: false,
        default: 0.3,
        description: 'Minimum relevance score (0-1)' },
      rerank: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Apply cross-encoder reranking' },
      expandQuery: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Apply multi-query expansion' },
      filters: {
        type: 'object',
        required: false,
        description: 'Filter criteria',
        properties: {
          contractIds: 'array of contract IDs',
          dateFrom: 'ISO date string',
          dateTo: 'ISO date string',
          suppliers: 'array of supplier names',
          contractTypes: 'array of contract types',
          status: 'array of status values' } } },
    examples: {
      basic: {
        query: 'liability clauses' },
      advanced: {
        query: 'termination for convenience with 30 day notice',
        mode: 'hybrid',
        k: 5,
        rerank: true,
        expandQuery: true,
        filters: {
          status: ['ACTIVE'] } } } });
});
