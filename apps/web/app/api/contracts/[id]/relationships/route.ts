/**
 * Contract Relationships API
 * 
 * GET /api/contracts/[id]/relationships - Get all relationships for a contract
 * POST /api/contracts/[id]/relationships - Create or detect relationships
 * PATCH /api/contracts/[id]/relationships - Update relationship status
 * DELETE /api/contracts/[id]/relationships - Delete a relationship
 * 
 * Features:
 * - Fetch related contracts with navigation suggestions
 * - AI-powered relationship detection
 * - Relationship graph for visualization
 * - Contract family aggregation
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { relationshipDetectionService, RelationshipType } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const createRelationshipSchema = z.object({
  targetContractId: z.string(),
  relationshipType: z.enum([
    'SOW_UNDER_MSA',
    'ANNEX_TO_MAIN',
    'EXHIBIT_TO_MAIN',
    'AMENDMENT_TO_ORIGINAL',
    'ADDENDUM_TO_ORIGINAL',
    'RENEWAL_OF',
    'MASTER_TO_SUB',
    'RELATED_AGREEMENT',
    'SUPERSEDES',
  ]),
  direction: z.enum(['parent', 'child', 'sibling', 'bidirectional']).optional(),
  confidence: z.number().min(0).max(1).optional().default(1),
});

const detectRelationshipsSchema = z.object({
  candidateContractIds: z.array(z.string()).optional(),
  useAI: z.boolean().optional().default(true),
  usePatterns: z.boolean().optional().default(true),
  useEntityMatching: z.boolean().optional().default(true),
});

const updateRelationshipSchema = z.object({
  relationshipId: z.string(),
  status: z.enum(['confirmed', 'rejected']),
});

/**
 * GET /api/contracts/[id]/relationships
 * 
 * Query parameters:
 * - include: 'suggestions' | 'graph' | 'family' | 'all'
 * - maxDepth: number (for graph, default: 2)
 * - minConfidence: number (default: 0.7)
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const include = searchParams.get('include') || 'all';
  const maxDepth = parseInt(searchParams.get('maxDepth') || '2', 10);
  const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.7');

  // Extract contract ID from URL
  const urlParts = request.url.split('/');
  const contractId = urlParts[urlParts.indexOf('contracts') + 1];

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    const result: any = {};

    // Always include direct relationships
    if (include === 'all' || include === 'relationships') {
      const relationships = await prisma.contractRelationship.findMany({
        where: {
          OR: [
            { sourceContractId: contractId },
            { targetContractId: contractId },
          ],
          tenantId,
          confidence: { gte: minConfidence },
          status: { in: ['confirmed', 'auto_confirmed', 'pending'] },
        },
        include: {
          sourceContract: {
            select: {
              id: true,
              contractTitle: true,
              contractType: true,
              supplierName: true,
              status: true,
            },
          },
          targetContract: {
            select: {
              id: true,
              contractTitle: true,
              contractType: true,
              supplierName: true,
              status: true,
            },
          },
        },
        orderBy: { confidence: 'desc' },
      });

      // Format relationships with navigation info
      result.relationships = relationships.map(rel => {
        const isSource = rel.sourceContractId === contractId;
        const relatedContract = isSource ? rel.targetContract : rel.sourceContract;
        
        return {
          id: rel.id,
          relationshipType: rel.relationshipType,
          direction: rel.direction,
          confidence: rel.confidence,
          status: rel.status,
          detectedBy: rel.detectedBy,
          detectedAt: rel.detectedAt,
          confirmedAt: rel.confirmedAt,
          relatedContract: {
            id: relatedContract.id,
            title: relatedContract.contractTitle,
            type: relatedContract.contractType,
            supplier: relatedContract.supplierName,
            status: relatedContract.status,
          },
          navigationHint: getNavigationHint(rel.relationshipType as RelationshipType, isSource),
        };
      });
    }

    // Include navigation suggestions
    if (include === 'all' || include === 'suggestions') {
      result.suggestions = await relationshipDetectionService.getNavigationSuggestions(
        contractId,
        tenantId
      );
    }

    // Include relationship graph
    if (include === 'all' || include === 'graph') {
      result.graph = await relationshipDetectionService.buildRelationshipGraph(
        contractId,
        tenantId,
        { maxDepth, minConfidence }
      );
    }

    // Include contract family
    if (include === 'all' || include === 'family') {
      try {
        result.family = await relationshipDetectionService.findContractFamily(
          contractId,
          tenantId
        );
      } catch (error) {
        // Family not found, contract might be standalone
        result.family = null;
      }
    }

    return createSuccessResponse(ctx, result);
  } catch (error) {
    console.error('[Relationships API] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch relationships', 500);
  }
});

/**
 * POST /api/contracts/[id]/relationships
 * 
 * Actions:
 * - detect: Run AI detection to find relationships
 * - create: Manually create a relationship
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { action = 'detect' } = body;

  // Extract contract ID from URL
  const urlParts = request.url.split('/');
  const contractId = urlParts[urlParts.indexOf('contracts') + 1];

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    if (action === 'detect') {
      const validated = detectRelationshipsSchema.parse(body);

      // Verify contract belongs to tenant
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
      });

      if (!contract) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
      }

      // Run relationship detection
      const relationships = await relationshipDetectionService.detectRelationships(
        contractId,
        tenantId,
        {
          useAI: validated.useAI,
          usePatterns: validated.usePatterns,
          useEntityMatching: validated.useEntityMatching,
          candidateContracts: validated.candidateContractIds,
        }
      );

      // Store detected relationships
      await relationshipDetectionService.storeRelationships(relationships, tenantId);

      return createSuccessResponse(ctx, {
        detected: relationships.length,
        relationships: relationships.map(r => ({
          targetContractId: r.targetContractId,
          relationshipType: r.relationshipType,
          confidence: r.confidence,
          status: r.status,
          detectedBy: r.detectedBy,
        })),
        autoConfirmed: relationships.filter(r => r.status === 'auto_confirmed').length,
        pendingReview: relationships.filter(r => r.status === 'pending').length,
      });
    }

    if (action === 'create') {
      const validated = createRelationshipSchema.parse(body);

      // Verify both contracts belong to tenant
      const [sourceContract, targetContract] = await Promise.all([
        prisma.contract.findFirst({ where: { id: contractId, tenantId } }),
        prisma.contract.findFirst({ where: { id: validated.targetContractId, tenantId } }),
      ]);

      if (!sourceContract || !targetContract) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'One or both contracts not found', 404);
      }

      // Prevent self-relationship
      if (contractId === validated.targetContractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot create relationship with self', 400);
      }

      // Create the relationship
      const relationship = await prisma.contractRelationship.create({
        data: {
          tenantId,
          sourceContractId: contractId,
          targetContractId: validated.targetContractId,
          relationshipType: validated.relationshipType,
          direction: validated.direction || 'bidirectional',
          confidence: validated.confidence,
          status: 'confirmed', // Manual creation is auto-confirmed
          detectedBy: 'manual',
          evidence: [{
            type: 'manual',
            description: 'Created manually by user',
            confidence: 1,
          }],
        },
      });

      return createSuccessResponse(ctx, {
        relationship: {
          id: relationship.id,
          sourceContractId: relationship.sourceContractId,
          targetContractId: relationship.targetContractId,
          relationshipType: relationship.relationshipType,
          confidence: relationship.confidence,
          status: relationship.status,
        },
      });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.message, 400);
    }
    console.error('[Relationships API] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process relationship', 500);
  }
});

/**
 * PATCH /api/contracts/[id]/relationships
 * Update relationship status (confirm or reject)
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  
  const validated = updateRelationshipSchema.safeParse(body);
  if (!validated.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validated.error.message, 400);
  }

  const { relationshipId, status } = validated.data;
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

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

    await relationshipDetectionService.updateRelationshipStatus(
      relationshipId,
      status,
      userId
    );

    return createSuccessResponse(ctx, {
      relationshipId,
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Relationships API] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update relationship', 500);
  }
});

/**
 * DELETE /api/contracts/[id]/relationships
 * Delete a relationship
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
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
      message: 'Relationship deleted successfully',
      relationshipId,
    });
  } catch (error) {
    console.error('[Relationships API] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete relationship', 500);
  }
});

// Helper function
function getNavigationHint(type: RelationshipType, isSource: boolean): string {
  const hints: Record<RelationshipType, { source: string; target: string }> = {
    SOW_UNDER_MSA: {
      source: 'This SOW is governed by the Master Agreement →',
      target: '← View the Master Agreement',
    },
    ANNEX_TO_MAIN: {
      source: 'This Annex is part of →',
      target: '← View the main Agreement',
    },
    EXHIBIT_TO_MAIN: {
      source: 'This Exhibit is attached to →',
      target: '← View the main Agreement',
    },
    AMENDMENT_TO_ORIGINAL: {
      source: 'This amends →',
      target: '← Amended by this',
    },
    ADDENDUM_TO_ORIGINAL: {
      source: 'This Addendum modifies →',
      target: '← Modified by Addendum',
    },
    RENEWAL_OF: {
      source: 'Renewal of →',
      target: '← Renewed as',
    },
    MASTER_TO_SUB: {
      source: 'Master Agreement with SOWs →',
      target: '← SOW under Master',
    },
    RELATED_AGREEMENT: {
      source: 'Related Agreement →',
      target: '← Related Agreement',
    },
    SUPERSEDES: {
      source: 'Supersedes →',
      target: '← Superseded by',
    },
    CONFLICTS_WITH: {
      source: 'Conflicts with →',
      target: '← Conflicts with',
    },
    SAME_PARTY_BUNDLE: {
      source: 'Same party bundle →',
      target: '← Same party bundle',
    },
    TEMPORAL_SEQUENCE: {
      source: 'Sequential to →',
      target: '← Followed by',
    },
  };

  return hints[type]?.[isSource ? 'source' : 'target'] || 'Related →';
}
