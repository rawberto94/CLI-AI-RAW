/**
 * Contract Hierarchy API
 * 
 * Advanced tree operations for contract relationships:
 * - Full hierarchy building with multi-level parent/child support
 * - Amendment chain tracking
 * - Visual layout generation for UI
 * - Impact analysis and cascade operations
 * - Breadcrumb navigation
 * 
 * GET /api/contracts/[id]/hierarchy?action=tree - Get full tree
 * GET /api/contracts/[id]/hierarchy?action=ancestors - Get ancestry chain
 * GET /api/contracts/[id]/hierarchy?action=descendants - Get all descendants
 * GET /api/contracts/[id]/hierarchy?action=siblings - Get siblings
 * GET /api/contracts/[id]/hierarchy?action=amendments - Get amendment chain
 * GET /api/contracts/[id]/hierarchy?action=impact - Get impact analysis
 * GET /api/contracts/[id]/hierarchy?action=layout - Get visual layout
 * GET /api/contracts/[id]/hierarchy?action=ui-data - Get UI-ready data
 * POST /api/contracts/[id]/hierarchy?action=cascade - Execute cascade operation
 * POST /api/contracts/[id]/hierarchy?action=amend - Create amendment
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { contractHierarchyService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation schemas
const getHierarchySchema = z.object({
  action: z.enum([
    'tree',
    'ancestors',
    'descendants',
    'siblings',
    'amendments',
    'impact',
    'layout',
    'ui-data',
    'breadcrumb',
    'family',
  ]).default('tree'),
  maxDepth: z.coerce.number().min(1).max(10).optional().default(3),
  includeSiblings: z.coerce.boolean().optional().default(true),
  minConfidence: z.coerce.number().min(0).max(1).optional().default(0.6),
  view: z.enum(['tree', 'timeline', 'cluster', 'minimap']).optional().default('tree'),
  expandLevel: z.coerce.number().optional().default(2),
  orientation: z.enum(['vertical', 'horizontal', 'radial']).optional().default('vertical'),
  operation: z.enum(['terminate', 'renew', 'amend', 'expire']).optional(),
});

const cascadeOperationSchema = z.object({
  action: z.literal('cascade'),
  operationType: z.enum(['notify', 'update_status', 'extend_dates', 'terminate']),
  targetFilter: z.enum(['children', 'descendants', 'siblings', 'family']),
  params: z.record(z.any()).optional().default({}),
  dryRun: z.boolean().optional().default(true),
});

const createAmendmentSchema = z.object({
  action: z.literal('amend'),
  title: z.string(),
  description: z.string().optional(),
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.string(),
    newValue: z.string(),
    type: z.enum(['added', 'modified', 'removed']),
    significance: z.enum(['critical', 'major', 'minor']),
  })).optional().default([]),
  effectiveDate: z.string().datetime().optional(),
});

/**
 * GET /api/contracts/[id]/hierarchy
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  
  const validated = getHierarchySchema.safeParse({
    action: searchParams.get('action') || 'tree',
    maxDepth: searchParams.get('maxDepth') || undefined,
    includeSiblings: searchParams.get('includeSiblings') || undefined,
    minConfidence: searchParams.get('minConfidence') || undefined,
    view: searchParams.get('view') || undefined,
    expandLevel: searchParams.get('expandLevel') || undefined,
    orientation: searchParams.get('orientation') || undefined,
    operation: searchParams.get('operation') || undefined,
  });

  if (!validated.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validated.error.message, 400);
  }

  const params = validated.data;
  
  // Extract contract ID from URL
  const urlParts = request.url.split('/');
  const contractId = urlParts[urlParts.indexOf('contracts') + 1];

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    switch (params.action) {
      case 'tree': {
        const tree = await contractHierarchyService.buildTree(contractId, tenantId, {
          maxDepth: params.maxDepth,
          includeSiblings: params.includeSiblings,
          minConfidence: params.minConfidence,
        });

        return createSuccessResponse(ctx, {
          tree: {
            root: tree.root,
            stats: tree.stats,
            levels: tree.levels.map(level => level.map(n => n.id)),
          },
          breadcrumbs: tree.breadcrumbs,
          metadata: {
            totalNodes: tree.stats.totalNodes,
            maxDepth: tree.stats.maxDepth,
            totalValue: tree.stats.totalValue,
            riskDistribution: tree.stats.riskDistribution,
          },
        });
      }

      case 'ancestors': {
        const ancestors = await contractHierarchyService.getAncestry(contractId, tenantId, {
          maxLevels: params.maxDepth,
        });

        return createSuccessResponse(ctx, {
          ancestors,
          count: ancestors.length,
          rootId: ancestors.length > 0 ? ancestors[ancestors.length - 1].id : contractId,
        });
      }

      case 'descendants': {
        const descendants = await contractHierarchyService.getDescendants(contractId, tenantId, {
          maxLevels: params.maxDepth,
        });

        return createSuccessResponse(ctx, {
          descendants,
          count: descendants.length,
          byLevel: descendants.reduce((acc, d) => {
            acc[d.level] = (acc[d.level] || 0) + 1;
            return acc;
          }, {} as Record<number, number>),
        });
      }

      case 'siblings': {
        const siblings = await contractHierarchyService.getSiblings(contractId, tenantId);

        return createSuccessResponse(ctx, {
          siblings,
          count: siblings.length,
        });
      }

      case 'amendments': {
        const chain = await contractHierarchyService.buildAmendmentChain(contractId, tenantId);

        return createSuccessResponse(ctx, {
          chain,
          currentVersion: chain.currentVersion,
          isLatest: chain.isLatest,
          hasPending: chain.hasPendingAmendments,
        });
      }

      case 'impact': {
        if (!params.operation) {
          return createErrorResponse(ctx, 'VALIDATION_ERROR', 'operation parameter required', 400);
        }

        const impact = await contractHierarchyService.analyzeImpact(
          contractId,
          params.operation,
          tenantId
        );

        return createSuccessResponse(ctx, {
          impact,
          riskLevel: impact.riskLevel,
          directImpactCount: impact.directImpacts.length,
          hasCriticalImpacts: impact.directImpacts.some(i => i.impact === 'critical'),
        });
      }

      case 'layout': {
        const layout = await contractHierarchyService.generateVisualLayout(
          contractId,
          tenantId,
          {
            orientation: params.orientation,
          }
        );

        return createSuccessResponse(ctx, {
          layout: {
            nodes: layout.nodes,
            edges: layout.edges,
            bounds: layout.bounds,
          },
          config: layout.config,
        });
      }

      case 'ui-data': {
        const uiData = await contractHierarchyService.getUITreeData(
          contractId,
          tenantId,
          {
            view: params.view,
            expandLevel: params.expandLevel,
          }
        );

        return createSuccessResponse(ctx, {
          view: params.view,
          data: uiData,
        });
      }

      case 'breadcrumb': {
        const tree = await contractHierarchyService.buildTree(contractId, tenantId, {
          maxDepth: 1,
        });

        return createSuccessResponse(ctx, {
          breadcrumbs: tree.breadcrumbs,
          currentLevel: tree.breadcrumbs.findIndex(b => b.isActive),
          totalLevels: tree.breadcrumbs.length,
        });
      }

      case 'family': {
        const tree = await contractHierarchyService.buildTree(contractId, tenantId, {
          maxDepth: 5,
          includeSiblings: true,
        });

        // Extract contract family (MSA + all SOWs)
        const root = tree.root;
        const family = {
          root: {
            id: root.id,
            title: root.title,
            type: root.type,
            value: root.value,
          },
          children: root.children.map(c => ({
            id: c.id,
            title: c.title,
            type: c.type,
            value: c.value,
            relationship: c.relationships.find(r => r.targetId === root.id)?.type,
          })),
          siblings: root.siblings.map(s => ({
            id: s.id,
            title: s.title,
            type: s.type,
          })),
          totalValue: root.children.reduce((sum, c) => sum + (c.value || 0), root.value || 0),
          contractCount: 1 + root.children.length + root.siblings.length,
        };

        return createSuccessResponse(ctx, {
          family,
          stats: tree.stats,
        });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${params.action}`, 400);
    }
  } catch (error) {
    logger.error('[Hierarchy] API error', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process request', 500);
  }
});

/**
 * POST /api/contracts/[id]/hierarchy
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const action = body.action;

  // Extract contract ID from URL
  const urlParts = request.url.split('/');
  const contractId = urlParts[urlParts.indexOf('contracts') + 1];

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  try {
    // Cascade operation
    if (action === 'cascade') {
      const validated = cascadeOperationSchema.safeParse(body);
      if (!validated.success) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', validated.error.message, 400);
      }

      const { operationType, targetFilter, params, dryRun } = validated.data;

      const results = await contractHierarchyService.cascade(
        contractId,
        tenantId,
        {
          type: operationType,
          targetFilter,
          params,
          dryRun,
        }
      );

      return createSuccessResponse(ctx, {
        results,
        operation: operationType,
        targetFilter,
        dryRun,
        affectedCount: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
      });
    }

    // Create amendment
    if (action === 'amend') {
      const validated = createAmendmentSchema.safeParse(body);
      if (!validated.success) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', validated.error.message, 400);
      }

      const { title, description, changes, effectiveDate } = validated.data;

      const result = await contractHierarchyService.createAmendment(
        contractId,
        tenantId,
        userId,
        {
          title,
          description,
          changes,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
        }
      );

      return createSuccessResponse(ctx, {
        amendment: {
          id: result.amendmentId,
          version: result.version,
          parentContractId: contractId,
        },
        message: `Amendment v${result.version} created successfully`,
      });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
  } catch (error) {
    logger.error('[Hierarchy] API error', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 
      error instanceof Error ? error.message : 'Failed to process request', 
      500
    );
  }
});

/**
 * DELETE /api/contracts/[id]/hierarchy
 * Remove contract from hierarchy (unlink)
 */
export const DELETE = withContractApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const relationshipId = searchParams.get('relationshipId');

  if (!relationshipId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'relationshipId is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    // Verify relationship belongs to tenant
    const relationship = await prisma.contractRelationship.findFirst({
      where: {
        id: relationshipId,
        tenantId,
      },
    });

    if (!relationship) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Relationship not found', 404);
    }

    await prisma.contractRelationship.delete({
      where: { id: relationshipId },
    });

    return createSuccessResponse(ctx, {
      message: 'Contract unlinked from hierarchy',
      relationshipId,
      sourceContractId: relationship.sourceContractId,
      targetContractId: relationship.targetContractId,
    });
  } catch (error) {
    logger.error('[Hierarchy] API error', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to unlink contract', 500);
  }
});
