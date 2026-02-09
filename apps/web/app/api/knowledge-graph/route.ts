import { NextRequest } from 'next/server';
import { knowledgeGraphService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * Knowledge Graph API
 * 
 * GET /api/knowledge-graph?action=build&contractIds=id1,id2
 * GET /api/knowledge-graph?action=find_related&entity=Company%20Name
 * GET /api/knowledge-graph?action=entity_network&entity=Company%20Name
 * POST /api/knowledge-graph (action: extract_entities, contractId)
 */

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'No tenant ID found', 400);
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'build': {
      // Build knowledge graph for tenant
      const contractIdsParam = searchParams.get('contractIds');
      const contractIds = contractIdsParam ? contractIdsParam.split(',') : undefined;

      const graph = await knowledgeGraphService.buildKnowledgeGraph(tenantId, contractIds);

      return createSuccessResponse(ctx, {
        success: true,
        graph,
        stats: {
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          nodeTypes: [...new Set(graph.nodes.map((n) => n.type))],
        },
      });
    }

    case 'find_related': {
      // Find contracts related to an entity
      const entity = searchParams.get('entity');
      if (!entity) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Entity parameter required', 400);
      }

      const contractIds = await knowledgeGraphService.findRelatedContracts(tenantId, entity);

      // Fetch contract details
      const contracts = await prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          supplierName: true,
          totalValue: true,
          status: true,
        },
      });

      return createSuccessResponse(ctx, {
        success: true,
        entity,
        contracts,
      });
    }

    case 'entity_network': {
      // Get network of related entities
      const entity = searchParams.get('entity');
      if (!entity) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Entity parameter required', 400);
      }

      const network = await knowledgeGraphService.getEntityNetwork(tenantId, entity);

      return createSuccessResponse(ctx, {
        success: true,
        network,
      });
    }

    case 'similar_clauses': {
      // Find similar clauses across contracts
      const clauseText = searchParams.get('clause');
      if (!clauseText) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Clause parameter required', 400);
      }

      const similarClauses = await knowledgeGraphService.findSimilarClauses(tenantId, clauseText);

      return createSuccessResponse(ctx, {
        success: true,
        similarClauses,
      });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'No tenant ID found', 400);
  }

  const body = await req.json();
  const { action, contractId, text } = body;

  switch (action) {
    case 'extract_entities': {
      if (!contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID required', 400);
      }

      // Fetch contract text
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: { artifacts: true },
      });

      if (!contract) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
      }

      // Get text from contract rawText or artifacts
      const overviewArtifact = contract.artifacts.find((a) => a.type === 'OVERVIEW');
      const contractText = text || contract.rawText || (overviewArtifact?.data as any)?.fullText || '';

      if (!contractText) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'No contract text available', 400);
      }

      const entities = await knowledgeGraphService.extractEntities(contractText, contractId);

      return createSuccessResponse(ctx, {
        success: true,
        contractId,
        entities,
        count: entities.length,
      });
    }

    case 'batch_extract': {
      // Extract entities from multiple contracts
      const { contractIds } = body;
      if (!contractIds || !Array.isArray(contractIds)) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract IDs array required', 400);
      }

      const results = [];

      for (const cid of contractIds) {
        try {
          const contract = await prisma.contract.findUnique({
            where: { id: cid },
            include: { artifacts: true },
          });

          if (contract) {
            const overviewArtifact = contract.artifacts.find((a) => a.type === 'OVERVIEW');
            const contractText = contract.rawText || (overviewArtifact?.data as any)?.fullText || '';
            if (contractText) {
              const entities = await knowledgeGraphService.extractEntities(contractText, cid);
              results.push({ contractId: cid, entities, count: entities.length });
            }
          }
        } catch {
          // Skip failed contracts
        }
      }

      return createSuccessResponse(ctx, {
        success: true,
        results,
        totalContracts: contractIds.length,
        processedContracts: results.length,
      });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
