import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/ai/graph
 * Query the contract knowledge graph
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const entityId = searchParams.get('entityId');
    const entityType = searchParams.get('entityType');
    const contractId = searchParams.get('contractId');
    const depth = parseInt(searchParams.get('depth') || '2');

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const graphService = (services as any).contractKnowledgeGraphService;

    if (!graphService) {
      return NextResponse.json(
        { error: 'Contract Knowledge Graph service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'stats':
        result = await graphService.getGraphStats(tenantId);
        break;

      case 'entity':
        if (!entityId) {
          return NextResponse.json(
            { error: 'entityId is required' },
            { status: 400 }
          );
        }
        result = await graphService.getEntity(entityId);
        break;

      case 'subgraph':
        if (!entityId) {
          return NextResponse.json(
            { error: 'entityId is required for subgraph query' },
            { status: 400 }
          );
        }
        result = await graphService.getSubgraph(entityId, depth);
        break;

      case 'entities-by-type':
        if (!tenantId || !entityType) {
          return NextResponse.json(
            { error: 'tenantId and entityType are required' },
            { status: 400 }
          );
        }
        result = await graphService.getEntitiesByType(tenantId, entityType);
        break;

      case 'contract-graph':
        if (!contractId) {
          return NextResponse.json(
            { error: 'contractId is required' },
            { status: 400 }
          );
        }
        result = await graphService.getContractGraph(contractId);
        break;

      case 'clusters':
        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId is required for cluster detection' },
            { status: 400 }
          );
        }
        result = await graphService.detectClusters(tenantId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to query knowledge graph', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/graph
 * Build or update contract knowledge graph
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action = 'build', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const graphService = (services as any).contractKnowledgeGraphService;

    if (!graphService) {
      return NextResponse.json(
        { error: 'Contract Knowledge Graph service not available' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'build':
        const { contractId, contractText, existingArtifacts } = data;

        if (!contractId || !contractText) {
          return NextResponse.json(
            { error: 'contractId and contractText are required' },
            { status: 400 }
          );
        }

        result = await graphService.buildContractGraph(
          tenantId,
          contractId,
          contractText,
          existingArtifacts
        );
        break;

      case 'add-entity':
        const { entity } = data;

        if (!entity || !entity.type || !entity.name) {
          return NextResponse.json(
            { error: 'Complete entity object with type and name is required' },
            { status: 400 }
          );
        }

        result = await graphService.addEntity({ ...entity, tenantId });
        break;

      case 'add-relation':
        const { relation } = data;

        if (!relation || !relation.sourceId || !relation.targetId || !relation.type) {
          return NextResponse.json(
            { error: 'Complete relation object with sourceId, targetId, and type is required' },
            { status: 400 }
          );
        }

        result = await graphService.addRelation(relation);
        break;

      case 'find-path':
        const { fromEntityId, toEntityId, maxDepth = 5 } = data;

        if (!fromEntityId || !toEntityId) {
          return NextResponse.json(
            { error: 'fromEntityId and toEntityId are required' },
            { status: 400 }
          );
        }

        result = await graphService.findPaths(fromEntityId, toEntityId, maxDepth);
        break;

      case 'find-similar':
        const { entityId: similarEntityId, limit = 10 } = data;

        if (!similarEntityId) {
          return NextResponse.json(
            { error: 'entityId is required' },
            { status: 400 }
          );
        }

        result = await graphService.findSimilarEntities(similarEntityId, limit);
        break;

      case 'merge-entities':
        const { primaryEntityId, duplicateEntityId } = data;

        if (!primaryEntityId || !duplicateEntityId) {
          return NextResponse.json(
            { error: 'primaryEntityId and duplicateEntityId are required' },
            { status: 400 }
          );
        }

        result = await graphService.mergeEntities(primaryEntityId, duplicateEntityId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to update knowledge graph', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/graph
 * Remove entities or relations from knowledge graph
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const relationId = searchParams.get('relationId');

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const graphService = (services as any).contractKnowledgeGraphService;

    if (!graphService) {
      return NextResponse.json(
        { error: 'Contract Knowledge Graph service not available' },
        { status: 503 }
      );
    }

    if (entityId) {
      await graphService.removeEntity(entityId);
      return NextResponse.json({
        success: true,
        message: `Entity ${entityId} removed`,
      });
    }

    if (relationId) {
      await graphService.removeRelation(relationId);
      return NextResponse.json({
        success: true,
        message: `Relation ${relationId} removed`,
      });
    }

    return NextResponse.json(
      { error: 'Either entityId or relationId is required' },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to delete from knowledge graph', details: String(error) },
      { status: 500 }
    );
  }
}
