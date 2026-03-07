/**
 * Contract Similarity API
 * 
 * Find similar contracts and get recommendations:
 * - Embedding-based similarity search
 * - Template recommendations
 * - Contract clustering insights
 * 
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

interface ContractMetadata {
  title?: string;
  type?: string;
  subType?: string;
  partyCount?: number;
  valueRange?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'moderate' | 'complex';
  industry?: string;
  language?: string;
  wordCount?: number;
  sections?: string[];
  keywords?: string[];
  extractionQuality?: number;
}

interface SimilaritySearchOptions {
  tenantId: string;
  topK?: number;
  minSimilarity?: number;
  typeFilter?: string;
  industryFilter?: string;
  excludeContractIds?: string[];
}

/**
 * POST - Generate embedding or find similar contracts
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const services = await import('data-orchestration/services');
    const contractSimilarityService = services.contractSimilarityService;

    const body = await request.json();
    const { action, contractId, contractText, metadata } = body;

    switch (action) {
      case 'generate-embedding': {
        if (!contractId || !contractText) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and contractText are required', 400);
        }

        const embedding = await contractSimilarityService.generateEmbedding(
          contractId,
          contractText,
          (metadata || {}) as ContractMetadata,
          tenantId
        );

        return createSuccessResponse(ctx, {
          message: 'Embedding generated',
          contractId,
          metadata: embedding.metadata,
          createdAt: embedding.createdAt });
      }

      case 'find-similar': {
        const options: SimilaritySearchOptions = {
          tenantId,
          topK: body.topK || 10,
          minSimilarity: body.minSimilarity || 0.5,
          typeFilter: body.typeFilter,
          industryFilter: body.industryFilter,
          excludeContractIds: body.excludeContractIds };

        let similar;
        
        if (contractId) {
          // Find similar to existing contract
          similar = await contractSimilarityService.findSimilarContracts(contractId, options);
        } else if (contractText) {
          // Find similar by text
          similar = await contractSimilarityService.findSimilarByText(contractText, options);
        } else {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Either contractId or contractText is required', 400);
        }

        return createSuccessResponse(ctx, {
          similar: similar.map((s: { contractId: string; similarity: number; metadata: unknown; matchReasons: string[] }) => ({
            contractId: s.contractId,
            similarity: Math.round(s.similarity * 100) / 100,
            metadata: s.metadata,
            matchReasons: s.matchReasons })),
          count: similar.length });
      }

      case 'recommend-templates': {
        if (!contractText) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractText is required for template recommendations', 400);
        }

        const recommendations = await contractSimilarityService.recommendTemplates(
          contractText,
          tenantId
        );

        return createSuccessResponse(ctx, {
          recommendations,
          count: recommendations.length });
      }

      case 'batch-embedding': {
        const contracts = body.contracts as Array<{
          id: string;
          text: string;
          metadata?: ContractMetadata;
        }>;

        if (!contracts || !Array.isArray(contracts)) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contracts array is required', 400);
        }

        if (contracts.length > 100) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Maximum 100 contracts per batch', 400);
        }

        const results = await contractSimilarityService.generateBatchEmbeddings({
          contracts: contracts.map(c => ({
            id: c.id,
            text: c.text,
            metadata: c.metadata || {} })),
          tenantId });

        return createSuccessResponse(ctx, {
          message: 'Batch embeddings generated',
          count: results.length,
          contracts: results.map((r: { contractId: string; createdAt: Date }) => ({
            contractId: r.contractId,
            createdAt: r.createdAt })) });
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: generate-embedding, find-similar, recommend-templates, batch-embedding', 400);
    }

  });

/**
 * GET - Get similarity stats or clusters
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const services = await import('data-orchestration/services');
    const contractSimilarityService = services.contractSimilarityService;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      return createSuccessResponse(ctx, {
        embeddingCount: contractSimilarityService.getEmbeddingCount(),
        capabilities: {
          embeddingModel: 'text-embedding-3-small',
          dimensions: 1536,
          maxBatchSize: 100,
          supportedFilters: ['type', 'industry'] } });
    }

    if (action === 'clusters') {
      const numClusters = parseInt(searchParams.get('numClusters') || '5');
      const clusters = await contractSimilarityService.getContractClusters(
        tenantId,
        numClusters
      );

      return createSuccessResponse(ctx, {
        clusters,
        tenantId });
    }

    // Default: API documentation
    return createSuccessResponse(ctx, {
      endpoints: {
        'POST /api/ai/similarity': {
          actions: {
            'generate-embedding': 'Create embedding for a contract',
            'find-similar': 'Find similar contracts',
            'recommend-templates': 'Get template recommendations',
            'batch-embedding': 'Generate embeddings for multiple contracts' } },
        'GET /api/ai/similarity?action=stats': 'Get service statistics',
        'GET /api/ai/similarity?action=clusters&tenantId=X': 'Get contract clusters' },
      requiredFields: {
        tenantId: 'Required for all operations',
        contractId: 'Required for generate-embedding and find-similar (by ID)',
        contractText: 'Required for generate-embedding and find-similar (by text)' } });

  });

/**
 * DELETE - Clear embedding for a contract
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
    const services = await import('data-orchestration/services');
    const contractSimilarityService = services.contractSimilarityService;

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
    }

    const cleared = await contractSimilarityService.clearEmbedding(contractId);

    return createSuccessResponse(ctx, {
      message: cleared ? 'Embedding cleared' : 'Embedding not found',
      contractId });

  });
