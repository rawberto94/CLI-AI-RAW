import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { pushAgentNotification } from '@/lib/ai/agent-notifications';

const roundChangeSchema = z.object({
  clause: z.string().min(1),
  original: z.string(),
  proposed: z.string(),
});

const createRoundSchema = z.object({
  message: z.string().min(1, 'A message is required for the negotiation round'),
  changes: z.array(roundChangeSchema).min(1, 'At least one clause change is required'),
  initiatedBy: z.string().default('Internal'),
});

const updateRoundSchema = z.object({
  roundId: z.string(),
  status: z.enum(['accepted', 'rejected', 'countered']),
  responseMessage: z.string().optional(),
});

interface NegotiationRound {
  id: string;
  round: number;
  initiatedBy: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  changes: { clause: string; original: string; proposed: string }[];
  message: string;
  responseMessage?: string;
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;
}

/**
 * GET /api/contracts/[id]/negotiate/rounds
 * Fetch all negotiation rounds for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Rounds stored as JSON in negotiationNotes
    let rounds: NegotiationRound[] = [];
    const negotiationNotes = (contract as any).negotiationNotes;
    if (negotiationNotes) {
      try {
        const parsed = JSON.parse(negotiationNotes);
        rounds = Array.isArray(parsed) ? parsed : [];
      } catch {
        rounds = [];
      }
    }

    return createSuccessResponse(ctx, {
      rounds,
      negotiationStatus: (contract as any).negotiationStatus || 'DRAFT',
      currentRound: (contract as any).negotiationRound || 0,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * POST /api/contracts/[id]/negotiate/rounds
 * Create a new negotiation round or update an existing one
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const { id: contractId } = await params;
    const body = await request.json();

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: ctx.tenantId },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Parse existing rounds
    let rounds: NegotiationRound[] = [];
    const negotiationNotes = (contract as any).negotiationNotes;
    if (negotiationNotes) {
      try {
        const parsed = JSON.parse(negotiationNotes);
        rounds = Array.isArray(parsed) ? parsed : [];
      } catch {
        rounds = [];
      }
    }

    // Determine if creating new round or updating existing
    if (body.roundId && body.status) {
      // Update existing round
      const validated = updateRoundSchema.parse(body);
      const roundIndex = rounds.findIndex(r => r.id === validated.roundId);
      if (roundIndex === -1) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Negotiation round not found', 404);
      }

      rounds[roundIndex] = {
        ...rounds[roundIndex],
        status: validated.status,
        responseMessage: validated.responseMessage,
        respondedAt: new Date().toISOString(),
        respondedBy: ctx.userId,
      };

      await prisma.contract.update({
        where: { id: contractId },
        data: { negotiationNotes: JSON.stringify(rounds) } as any,
      });

      logger.info('Negotiation round updated', { contractId, roundId: validated.roundId, status: validated.status });

      // Push notification
      pushAgentNotification({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        type: 'agent_complete',
        severity: validated.status === 'accepted' ? 'info' : 'medium',
        title: `Negotiation round ${validated.status}`,
        message: `Round ${rounds[roundIndex].round} for "${contract.contractTitle || 'contract'}" was ${validated.status}`,
        source: 'negotiation-agent',
        metadata: { contractId, roundId: validated.roundId, status: validated.status },
        actionUrl: `/contracts/${contractId}/negotiate`,
      });

      return createSuccessResponse(ctx, { round: rounds[roundIndex], rounds });
    }

    // Create new round
    const validated = createRoundSchema.parse(body);
    const newRound: NegotiationRound = {
      id: `nr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      round: rounds.length + 1,
      initiatedBy: validated.initiatedBy,
      status: 'pending',
      changes: validated.changes,
      message: validated.message,
      createdAt: new Date().toISOString(),
    };

    rounds.push(newRound);

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        negotiationNotes: JSON.stringify(rounds),
        negotiationRound: rounds.length,
        negotiationStatus: 'IN_NEGOTIATION',
        ...((contract as any).negotiationStatus === null ? { negotiationStartedAt: new Date() } : {}),
      } as any,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'NEGOTIATION_ROUND_CREATED',
        resourceType: 'Contract',
        entityType: 'Contract',
        entityId: contractId,
        resource: contractId,
        details: { description: `Created negotiation round ${newRound.round}` },
        metadata: {
          roundId: newRound.id,
          roundNumber: newRound.round,
          changesCount: validated.changes.length,
        },
      },
    });

    // Push notification
    pushAgentNotification({
      tenantId: ctx.tenantId,
      type: 'opportunity',
      severity: 'medium',
      title: 'New negotiation round',
      message: `Round ${newRound.round} submitted for "${contract.contractTitle || 'contract'}" with ${validated.changes.length} clause change(s)`,
      source: 'negotiation-agent',
      metadata: { contractId, roundId: newRound.id, changesCount: validated.changes.length },
      actionUrl: `/contracts/${contractId}/negotiate`,
    });

    logger.info('Negotiation round created', { contractId, roundId: newRound.id, round: newRound.round });

    return createSuccessResponse(ctx, { round: newRound, rounds }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors[0].message, 422);
    }
    return handleApiError(ctx, error);
  }
}
