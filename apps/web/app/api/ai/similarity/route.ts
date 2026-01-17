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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

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
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const services = await import('@repo/data-orchestration/services');
    const contractSimilarityService = services.contractSimilarityService;

    const body = await request.json();
    const { action, contractId, contractText, metadata } = body;

    switch (action) {
      case 'generate-embedding': {
        if (!contractId || !contractText) {
          return NextResponse.json(
            { error: 'contractId and contractText are required' },
            { status: 400 }
          );
        }

        const embedding = await contractSimilarityService.generateEmbedding(
          contractId,
          contractText,
          (metadata || {}) as ContractMetadata,
          tenantId
        );

        return NextResponse.json({
          message: 'Embedding generated',
          contractId,
          metadata: embedding.metadata,
          createdAt: embedding.createdAt,
        });
      }

      case 'find-similar': {
        const options: SimilaritySearchOptions = {
          tenantId,
          topK: body.topK || 10,
          minSimilarity: body.minSimilarity || 0.5,
          typeFilter: body.typeFilter,
          industryFilter: body.industryFilter,
          excludeContractIds: body.excludeContractIds,
        };

        let similar;
        
        if (contractId) {
          // Find similar to existing contract
          similar = await contractSimilarityService.findSimilarContracts(contractId, options);
        } else if (contractText) {
          // Find similar by text
          similar = await contractSimilarityService.findSimilarByText(contractText, options);
        } else {
          return NextResponse.json(
            { error: 'Either contractId or contractText is required' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          similar: similar.map((s: { contractId: string; similarity: number; metadata: unknown; matchReasons: string[] }) => ({
            contractId: s.contractId,
            similarity: Math.round(s.similarity * 100) / 100,
            metadata: s.metadata,
            matchReasons: s.matchReasons,
          })),
          count: similar.length,
        });
      }

      case 'recommend-templates': {
        if (!contractText) {
          return NextResponse.json(
            { error: 'contractText is required for template recommendations' },
            { status: 400 }
          );
        }

        const recommendations = await contractSimilarityService.recommendTemplates(
          contractText,
          tenantId
        );

        return NextResponse.json({
          recommendations,
          count: recommendations.length,
        });
      }

      case 'batch-embedding': {
        const contracts = body.contracts as Array<{
          id: string;
          text: string;
          metadata?: ContractMetadata;
        }>;

        if (!contracts || !Array.isArray(contracts)) {
          return NextResponse.json(
            { error: 'contracts array is required' },
            { status: 400 }
          );
        }

        if (contracts.length > 100) {
          return NextResponse.json(
            { error: 'Maximum 100 contracts per batch' },
            { status: 400 }
          );
        }

        const results = await contractSimilarityService.generateBatchEmbeddings({
          contracts: contracts.map(c => ({
            id: c.id,
            text: c.text,
            metadata: c.metadata || {},
          })),
          tenantId,
        });

        return NextResponse.json({
          message: 'Batch embeddings generated',
          count: results.length,
          contracts: results.map((r: { contractId: string; createdAt: Date }) => ({
            contractId: r.contractId,
            createdAt: r.createdAt,
          })),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: generate-embedding, find-similar, recommend-templates, batch-embedding' },
          { status: 400 }
        );
    }

  } catch {
    return NextResponse.json(
      { error: 'Failed to process similarity request' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get similarity stats or clusters
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const services = await import('@repo/data-orchestration/services');
    const contractSimilarityService = services.contractSimilarityService;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      return NextResponse.json({
        embeddingCount: contractSimilarityService.getEmbeddingCount(),
        capabilities: {
          embeddingModel: 'text-embedding-3-small',
          dimensions: 1536,
          maxBatchSize: 100,
          supportedFilters: ['type', 'industry'],
        },
      });
    }

    if (action === 'clusters') {
      const numClusters = parseInt(searchParams.get('numClusters') || '5');
      const clusters = await contractSimilarityService.getContractClusters(
        tenantId,
        numClusters
      );

      return NextResponse.json({
        clusters,
        tenantId,
      });
    }

    // Default: API documentation
    return NextResponse.json({
      endpoints: {
        'POST /api/ai/similarity': {
          actions: {
            'generate-embedding': 'Create embedding for a contract',
            'find-similar': 'Find similar contracts',
            'recommend-templates': 'Get template recommendations',
            'batch-embedding': 'Generate embeddings for multiple contracts',
          },
        },
        'GET /api/ai/similarity?action=stats': 'Get service statistics',
        'GET /api/ai/similarity?action=clusters&tenantId=X': 'Get contract clusters',
      },
      requiredFields: {
        tenantId: 'Required for all operations',
        contractId: 'Required for generate-embedding and find-similar (by ID)',
        contractText: 'Required for generate-embedding and find-similar (by text)',
      },
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch similarity data' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Clear embedding for a contract
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const services = await import('@repo/data-orchestration/services');
    const contractSimilarityService = services.contractSimilarityService;

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');

    if (!contractId) {
      return NextResponse.json(
        { error: 'contractId is required' },
        { status: 400 }
      );
    }

    const cleared = await contractSimilarityService.clearEmbedding(contractId);

    return NextResponse.json({
      message: cleared ? 'Embedding cleared' : 'Embedding not found',
      contractId,
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to clear embedding' },
      { status: 500 }
    );
  }
}
