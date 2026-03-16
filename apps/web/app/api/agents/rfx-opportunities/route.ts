/**
 * RFx Opportunities API (Scout Agent)
 * 
 * GET /api/agents/rfx-opportunities - List detected RFx opportunities
 * POST /api/agents/rfx-opportunities/detect - Trigger detection scan
 * POST /api/agents/rfx-opportunities/:id/accept - Accept and create RFx
 * POST /api/agents/rfx-opportunities/:id/reject - Reject opportunity
 * 
 * Scout agent proactively identifies contracts that need RFx sourcing.
 * Detection algorithms are in @/lib/rfx-detection (canonical implementation).
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { detectRFxOpportunities, type RFxOpportunity, type DetectionFilter } from '@/lib/rfx-detection';
import { logger } from '@/lib/logger';

const DetectionFilterSchema = z.object({
  algorithm: z.enum(['expiration', 'savings', 'performance', 'consolidation', 'all']).default('all'),
  urgency: z.enum(['critical', 'high', 'medium', 'low', 'all']).default('all'),
  category: z.string().optional(),
  minSavings: z.number().optional(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

const OpportunityActionSchema = z.object({
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
  action: z.enum(['accept', 'reject', 'snooze', 'create_rfx']),
  notes: z.string().optional(),
  snoozeDays: z.number().min(1).max(90).default(7),
  rfxConfig: z.object({
    type: z.enum(['RFP', 'RFQ', 'RFI']),
    title: z.string(),
    description: z.string(),
  }).optional(),
});

/**
 * GET /api/agents/rfx-opportunities
 * 
 * Returns RFx opportunities detected by Scout agent
 */
export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const searchParams = req.nextUrl.searchParams;
  
  const filter = DetectionFilterSchema.parse({
    algorithm: searchParams.get('algorithm') || 'all',
    urgency: searchParams.get('urgency') || 'all',
    category: searchParams.get('category') || undefined,
    minSavings: searchParams.get('minSavings') ? parseFloat(searchParams.get('minSavings')!) : undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
  });

  try {
    // Run Scout detection algorithms via shared lib (canonical implementation)
    const allOpportunities = await detectRFxOpportunities(prisma as any, tenantId, filter);

    // Get stats before pagination (for accurate totals)
    const stats = {
      total: allOpportunities.length,
      byUrgency: allOpportunities.reduce((acc, o) => {
        acc[o.urgency] = (acc[o.urgency] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byAlgorithm: allOpportunities.reduce((acc, o) => {
        acc[o.algorithm] = (acc[o.algorithm] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalSavingsPotential: allOpportunities
        .filter(o => o.savingsPotential !== null)
        .reduce((sum, o) => sum + (o.savingsPotential || 0), 0),
      avgConfidence: allOpportunities.length > 0
        ? Math.round(allOpportunities.reduce((sum, o) => sum + o.confidence, 0) / allOpportunities.length * 100) / 100
        : 0,
    };

    // Apply pagination
    const paginated = allOpportunities.slice(filter.offset, filter.offset + filter.limit);

    return createSuccessResponse(ctx, {
      opportunities: paginated,
      stats,
      pagination: {
        total: allOpportunities.length,
        limit: filter.limit,
        offset: filter.offset,
        hasMore: filter.offset + filter.limit < allOpportunities.length,
      },
      scout: {
        lastScan: new Date().toISOString(),
        algorithmsRun: filter.algorithm === 'all' 
          ? ['expiration', 'savings', 'performance', 'consolidation']
          : [filter.algorithm],
        scanDuration: undefined as number | undefined,
      },
    });
  } catch (error) {
    logger.error('Failed to detect RFx opportunities:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to detect opportunities', 500);
  }
});

/**
 * POST /api/agents/rfx-opportunities/detect
 * 
 * Trigger a new detection scan
 */
export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const filter = DetectionFilterSchema.parse(body);

    // Trigger detection scan via shared lib
    const opportunities = await detectRFxOpportunities(prisma as any, tenantId, filter);

    // Log the scan
    await prisma.agentEvent.create({
      data: {
        tenantId,
        contractId: '',
        agentName: 'rfx-detection-agent',
        eventType: 'opportunity_found',
        outcome: 'success',
        reasoning: `Scout detected ${opportunities.length} opportunities`,
        metadata: {
          algorithm: filter.algorithm,
          urgency: filter.urgency,
          count: opportunities.length,
        },
      },
    });

    return createSuccessResponse(ctx, {
      opportunities,
      message: `Scout detected ${opportunities.length} RFx opportunities`,
    });
  } catch (error) {
    logger.error('Failed to run RFx detection:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to run detection', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/agents/rfx-opportunities
 * 
 * Handle opportunity action (accept/reject/snooze)
 */
export const PATCH = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;

  try {
    const body = await req.json();
    const { opportunityId, action, notes, rfxConfig, snoozeDays } = OpportunityActionSchema.parse(body);

    switch (action) {
      case 'create_rfx':
      case 'accept': {
        // Create RFx from opportunity
        const result = await createRfxFromOpportunity(
          tenantId, 
          opportunityId, 
          notes, 
          rfxConfig
        );
        
        return createSuccessResponse(ctx, {
          action: 'rfx_created',
          rfxId: result.id,
          message: 'RFx event created from opportunity',
        });
      }

      case 'reject': {
        // Mark opportunity as rejected
        await prisma.rFxOpportunity.updateMany({
          where: {
            id: opportunityId,
            tenantId,
          },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason: notes || 'User rejected',
          },
        });

        return createSuccessResponse(ctx, {
          action: 'rejected',
          message: 'Opportunity rejected',
        });
      }

      case 'snooze': {
        // Snooze opportunity for configurable duration
        const snoozeDuration = snoozeDays * 24 * 60 * 60 * 1000;
        const snoozeUntilDate = new Date(Date.now() + snoozeDuration);

        await prisma.rFxOpportunity.updateMany({
          where: {
            id: opportunityId,
            tenantId,
          },
          data: {
            status: 'REJECTED',
            snoozedUntil: snoozeUntilDate,
          },
        });

        return createSuccessResponse(ctx, {
          action: 'snoozed',
          message: `Opportunity snoozed for ${snoozeDays} days`,
          snoozeUntil: snoozeUntilDate.toISOString(),
        });
      }

      default:
        return createErrorResponse(ctx, 'INVALID_ACTION', 'Invalid action', 400);
    }
  } catch (error) {
    logger.error('Failed to process opportunity:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process opportunity', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createRfxFromOpportunity(
  tenantId: string,
  opportunityId: string,
  notes?: string,
  rfxConfig?: { type: 'RFP' | 'RFQ' | 'RFI'; title: string; description: string }
) {
  // Extract contract ID from opportunity ID (format: "alg-{contractId}")
  // Handle both UUID and non-UUID formats safely
  const dashIndex = opportunityId.indexOf('-');
  if (dashIndex === -1) {
    throw new Error('Invalid opportunity ID format');
  }
  const algorithm = opportunityId.substring(0, dashIndex);
  const contractId = opportunityId.substring(dashIndex + 1);

  if (!contractId) {
    throw new Error('Could not extract contract ID from opportunity');
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: {
      clauses: true,
    },
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create RFx event
    const rfx = await tx.rFxEvent.create({
      data: {
        tenantId,
        type: rfxConfig?.type || 'RFP',
        title: rfxConfig?.title || `Sourcing: ${contract.contractTitle}`,
        description: rfxConfig?.description || `Competitive sourcing for ${contract.contractTitle}`,
        sourceContractId: contract.id,
        status: 'draft',
        category: contract.contractType,
        estimatedValue: contract.totalValue ? Number(contract.totalValue) : undefined,
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: tenantId,
      },
    });

    // Mark opportunity as acted upon
    await tx.rFxOpportunity.create({
      data: {
        tenantId,
        contractId: contract.id,
        algorithm: algorithm as any,
        status: 'APPROVED',
        rfxId: rfx.id,
        title: rfxConfig?.title || `Sourcing: ${contract.contractTitle}`,
        description: rfxConfig?.description || `Competitive sourcing for ${contract.contractTitle}`,
        reasoning: `Converted from ${algorithm} opportunity`,
        recommendedAction: `Create ${rfxConfig?.type || 'RFP'} event`,
        metadata: {
          sourceOpportunityId: opportunityId,
          convertedAt: new Date().toISOString(),
        },
      },
    });

    // Log the conversion event
    await tx.agentEvent.create({
      data: {
        tenantId,
        contractId: contract.id,
        agentName: 'rfx-detection-agent',
        eventType: 'opportunity_converted',
        outcome: 'success',
        reasoning: `Converted ${algorithm} opportunity for "${contract.contractTitle}" into RFx event`,
        metadata: {
          rfxId: rfx.id,
          contractId: contract.id,
          algorithm,
          opportunityId,
        },
      },
    });

    return rfx;
  });

  return result;
}
