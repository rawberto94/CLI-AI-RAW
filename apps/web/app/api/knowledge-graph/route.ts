import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

import { knowledgeGraphService } from '@repo/data-orchestration/services/knowledge-graph.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Knowledge Graph API
 * 
 * GET /api/knowledge-graph?action=build&contractIds=id1,id2
 * GET /api/knowledge-graph?action=find_related&entity=Company%20Name
 * GET /api/knowledge-graph?action=entity_network&entity=Company%20Name
 * POST /api/knowledge-graph (action: extract_entities, contractId)
 */

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'build': {
        // Build knowledge graph for tenant
        const contractIdsParam = searchParams.get('contractIds');
        const contractIds = contractIdsParam ? contractIdsParam.split(',') : undefined;

        const graph = await knowledgeGraphService.buildKnowledgeGraph(tenantId, contractIds);

        return NextResponse.json({
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
          return NextResponse.json({ error: 'Entity parameter required' }, { status: 400 });
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

        return NextResponse.json({
          success: true,
          entity,
          contracts,
        });
      }

      case 'entity_network': {
        // Get network of related entities
        const entity = searchParams.get('entity');
        if (!entity) {
          return NextResponse.json({ error: 'Entity parameter required' }, { status: 400 });
        }

        const network = await knowledgeGraphService.getEntityNetwork(tenantId, entity);

        return NextResponse.json({
          success: true,
          network,
        });
      }

      case 'similar_clauses': {
        // Find similar clauses across contracts
        const clauseText = searchParams.get('clause');
        if (!clauseText) {
          return NextResponse.json({ error: 'Clause parameter required' }, { status: 400 });
        }

        const similarClauses = await knowledgeGraphService.findSimilarClauses(tenantId, clauseText);

        return NextResponse.json({
          success: true,
          similarClauses,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const body = await req.json();
    const { action, contractId, text } = body;

    switch (action) {
      case 'extract_entities': {
        if (!contractId) {
          return NextResponse.json({ error: 'Contract ID required' }, { status: 400 });
        }

        // Fetch contract text
        const contract = await prisma.contract.findUnique({
          where: { id: contractId },
          include: { artifacts: true },
        });

        if (!contract) {
          return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        // Get text from contract rawText or artifacts
        const overviewArtifact = contract.artifacts.find((a) => a.type === 'OVERVIEW');
        const contractText = text || contract.rawText || (overviewArtifact?.data as any)?.fullText || '';

        if (!contractText) {
          return NextResponse.json({ error: 'No contract text available' }, { status: 400 });
        }

        const entities = await knowledgeGraphService.extractEntities(contractText, contractId);

        return NextResponse.json({
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
          return NextResponse.json({ error: 'Contract IDs array required' }, { status: 400 });
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

        return NextResponse.json({
          success: true,
          results,
          totalContracts: contractIds.length,
          processedContracts: results.length,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
