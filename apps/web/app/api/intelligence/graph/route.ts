/**
 * Knowledge Graph API — Build and query contract entity graph
 *
 * GET /api/intelligence/graph — Returns nodes + edges from real contract data
 *
 * Builds a live knowledge graph from:
 *  - Contracts (nodes) with supplier/party relationships (edges)
 *  - Contract metadata for clause/risk/obligation nodes
 *  - Linked-contract relationships
 *
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext, createSuccessResponse } from '@/lib/api-middleware';

interface GraphNode {
  id: string;
  label: string;
  type: 'contract' | 'supplier' | 'clause' | 'risk' | 'obligation' | 'category';
  group: string;
  weight: number;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  label: string;
}

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;

  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    take: 200,
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      supplierName: true,
      clientName: true,
      status: true,
      contractType: true,
      category: true,
      totalValue: true,
      expirationRisk: true,
      metadata: true,
      parentContractId: true,
    },
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const supplierMap = new Map<string, string>(); // supplier name → node id
  const categoryMap = new Map<string, string>(); // category → node id

  for (const c of contracts) {
    // Contract node
    const meta = (c.metadata || {}) as Record<string, unknown>;
    nodes.push({
      id: c.id,
      label: c.contractTitle || c.fileName || 'Untitled',
      type: 'contract',
      group: c.contractType || 'general',
      weight: c.totalValue ? Math.log10(Number(c.totalValue) + 1) : 1,
      metadata: {
        status: c.status,
        value: c.totalValue,
        risk: c.expirationRisk,
        type: c.contractType,
      },
    });

    // Supplier node + edge
    const supplier = c.supplierName || c.clientName;
    if (supplier) {
      const normalizedSupplier = supplier.trim().toLowerCase();
      if (!supplierMap.has(normalizedSupplier)) {
        const supplierId = `supplier-${normalizedSupplier.replace(/\s+/g, '-')}`;
        supplierMap.set(normalizedSupplier, supplierId);
        nodes.push({
          id: supplierId,
          label: supplier,
          type: 'supplier',
          group: 'suppliers',
          weight: 2,
          metadata: {},
        });
      }
      edges.push({
        id: `e-${c.id}-${supplierMap.get(normalizedSupplier)}`,
        source: c.id,
        target: supplierMap.get(normalizedSupplier)!,
        type: 'party_to',
        weight: 1,
        label: 'counterparty',
      });
    }

    // Category node + edge
    const category = c.contractType || c.category;
    if (category) {
      const normalizedCat = category.trim().toLowerCase();
      if (!categoryMap.has(normalizedCat)) {
        const catId = `cat-${normalizedCat.replace(/\s+/g, '-')}`;
        categoryMap.set(normalizedCat, catId);
        nodes.push({
          id: catId,
          label: category,
          type: 'category',
          group: 'categories',
          weight: 3,
          metadata: {},
        });
      }
      edges.push({
        id: `e-${c.id}-${categoryMap.get(normalizedCat)}`,
        source: c.id,
        target: categoryMap.get(normalizedCat)!,
        type: 'categorized_as',
        weight: 0.5,
        label: 'type',
      });
    }

    // Parent-child relationship
    if (c.parentContractId) {
      edges.push({
        id: `e-parent-${c.id}`,
        source: c.parentContractId,
        target: c.id,
        type: 'parent_of',
        weight: 2,
        label: 'parent',
      });
    }

    // Risk nodes
    if (c.expirationRisk === 'HIGH' || c.expirationRisk === 'CRITICAL') {
      const riskId = `risk-${c.id}`;
      nodes.push({
        id: riskId,
        label: `${c.expirationRisk} Risk`,
        type: 'risk',
        group: 'risks',
        weight: c.expirationRisk === 'CRITICAL' ? 4 : 2,
        metadata: { level: c.expirationRisk },
      });
      edges.push({
        id: `e-${c.id}-${riskId}`,
        source: c.id,
        target: riskId,
        type: 'has_risk',
        weight: 2,
        label: 'risk',
      });
    }
  }

  // Update supplier node weights based on contract count
  const supplierContractCounts = new Map<string, number>();
  for (const e of edges) {
    if (e.type === 'party_to') {
      supplierContractCounts.set(e.target, (supplierContractCounts.get(e.target) || 0) + 1);
    }
  }
  for (const node of nodes) {
    if (node.type === 'supplier') {
      node.weight = supplierContractCounts.get(node.id) || 1;
      node.metadata.contractCount = node.weight;
    }
  }

  return createSuccessResponse(ctx, { nodes, edges, stats: { contracts: contracts.length, suppliers: supplierMap.size, categories: categoryMap.size } });
});
