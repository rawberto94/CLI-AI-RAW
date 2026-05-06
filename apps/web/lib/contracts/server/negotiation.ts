import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

type NegotiationPlaybook = Record<string, unknown>;

const roundChangeSchema = z.object({
  clause: z.string().min(1),
  original: z.string(),
  proposed: z.string(),
});

const createRoundSchema = z.object({
  message: z.string().min(1, 'A message is required for the negotiation round'),
  changes: z.array(roundChangeSchema).min(1, 'At least one clause change is required'),
});

const negotiateCopilotSchema = z.object({
  contractId: z.string().min(1, 'contractId is required'),
  ourRole: z.string().optional(),
  negotiationContext: z.string().optional(),
});

const redlineCopilotSchema = z.object({
  clauseText: z.string().min(1, 'clauseText is required'),
  clauseType: z.string().optional(),
  contractType: z.string().optional(),
  objective: z.string().optional(),
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

function parseNegotiationRounds(negotiationNotes: unknown): NegotiationRound[] {
  if (typeof negotiationNotes !== 'string' || negotiationNotes.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(negotiationNotes);
    return Array.isArray(parsed) ? (parsed as NegotiationRound[]) : [];
  } catch {
    return [];
  }
}

export async function getNegotiationPlaybook(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const artifact = await prisma.artifact.findFirst({
    where: {
      contractId,
      tenantId: context.tenantId,
      type: 'NEGOTIATION_POINTS' as any,
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!artifact) {
    return createSuccessResponse(context, {
      playbook: null,
      negotiationStatus: (contract as any).negotiationStatus || 'DRAFT',
    });
  }

  return createSuccessResponse(context, {
    playbook: artifact.data as unknown as NegotiationPlaybook,
    artifactId: artifact.id,
    generatedAt: artifact.createdAt,
    modelUsed: artifact.modelUsed,
    negotiationStatus: (contract as any).negotiationStatus || 'DRAFT',
    negotiationRound: (contract as any).negotiationRound || 0,
  });
}

export async function postNegotiationCopilotPlaybook(
  request: NextRequest,
  context: ContractApiContext,
) {
  const { contractId, ourRole, negotiationContext } = negotiateCopilotSchema.parse(await request.json());

  try {
    const { generateAndStorePlaybook } = await import('@/lib/ai/negotiation-copilot.service');
    const playbook = await generateAndStorePlaybook({
      contractId,
      tenantId: context.tenantId,
      ourRole: (ourRole || 'auto') as 'auto' | 'licensor' | 'licensee' | 'buyer' | 'seller',
      negotiationContext,
    });

    return createSuccessResponse(context, { playbook });
  } catch (error) {
    return createErrorResponse(
      context,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Negotiation playbook generation failed',
      500,
    );
  }
}

export async function postNegotiationCopilotRedline(
  request: NextRequest,
  context: ContractApiContext,
) {
  const { clauseText, clauseType, contractType, objective } = redlineCopilotSchema.parse(await request.json());

  try {
    const { generateRedlineSuggestion } = await import('@/lib/ai/negotiation-copilot.service');
    const redline = await generateRedlineSuggestion({
      clauseText,
      clauseType,
      contractType,
      tenantId: context.tenantId,
      objective,
    });

    return createSuccessResponse(context, { redline });
  } catch {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Redline generation failed', 500);
  }
}

export async function postNegotiationPlaybook(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const { generateAndStorePlaybook } = await import('@/lib/ai/negotiation-copilot.service');
  const body = await request.json().catch(() => ({}));

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (!contract.rawText) {
    return createErrorResponse(
      context,
      'VALIDATION_ERROR',
      'Contract has no extracted text. Upload and process the contract first.',
      422,
    );
  }

  logger.info('Generating negotiation playbook', { contractId, tenantId: context.tenantId });

  const playbook = await generateAndStorePlaybook({
    contractId,
    tenantId: context.tenantId,
    ourRole: body.ourRole || 'auto',
    negotiationContext: body.negotiationContext,
  });

  const currentNegotiationStatus = (contract as any).negotiationStatus;
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      ...(currentNegotiationStatus === null
        ? { negotiationStatus: 'IN_NEGOTIATION', negotiationStartedAt: new Date() }
        : {}),
    } as any,
  });

  await prisma.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'NEGOTIATION_PLAYBOOK_GENERATED',
      resourceType: 'Contract',
      entityType: 'Contract',
      entityId: contractId,
      resource: contractId,
      details: { description: 'Generated AI negotiation playbook' },
      metadata: {
        overallPosition: playbook.overallPosition,
        difficulty: playbook.estimatedNegotiationDifficulty,
        clauseCount: playbook.clauses?.length || 0,
      },
    },
  });

  return createSuccessResponse(context, { playbook }, { status: 201 });
}

export async function getNegotiationRounds(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  return createSuccessResponse(context, {
    rounds: parseNegotiationRounds((contract as any).negotiationNotes),
    negotiationStatus: (contract as any).negotiationStatus || 'DRAFT',
    currentRound: (contract as any).negotiationRound || 0,
  });
}

export async function postNegotiationRound(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const body = await request.json();

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const rounds = parseNegotiationRounds((contract as any).negotiationNotes);
  const { pushAgentNotification } = await import('@/lib/ai/agent-notifications');

  if (body.roundId && body.status) {
    const validated = updateRoundSchema.safeParse(body);
    if (!validated.success) {
      return createErrorResponse(context, 'VALIDATION_ERROR', validated.error.errors[0].message, 422);
    }

    const roundIndex = rounds.findIndex((round) => round.id === validated.data.roundId);
    if (roundIndex === -1) {
      return createErrorResponse(context, 'NOT_FOUND', 'Negotiation round not found', 404);
    }

    rounds[roundIndex] = {
      ...rounds[roundIndex],
      status: validated.data.status,
      responseMessage: validated.data.responseMessage,
      respondedAt: new Date().toISOString(),
      respondedBy: context.userId,
    };

    await prisma.contract.update({
      where: { id: contractId },
      data: { negotiationNotes: JSON.stringify(rounds) } as any,
    });

    logger.info('Negotiation round updated', {
      contractId,
      roundId: validated.data.roundId,
      status: validated.data.status,
    });

    pushAgentNotification({
      tenantId: context.tenantId,
      userId: context.userId,
      type: 'agent_complete',
      severity: validated.data.status === 'accepted' ? 'info' : 'medium',
      title: `Negotiation round ${validated.data.status}`,
      message: `Round ${rounds[roundIndex].round} for "${contract.contractTitle || 'contract'}" was ${validated.data.status}`,
      source: 'negotiation-agent',
      metadata: {
        contractId,
        roundId: validated.data.roundId,
        status: validated.data.status,
      },
      actionUrl: `/contracts/${contractId}/negotiate`,
    });

    return createSuccessResponse(context, { round: rounds[roundIndex], rounds });
  }

  const validated = createRoundSchema.safeParse(body);
  if (!validated.success) {
    return createErrorResponse(context, 'VALIDATION_ERROR', validated.error.errors[0].message, 422);
  }

  const newRound: NegotiationRound = {
    id: `nr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    round: rounds.length + 1,
    initiatedBy: context.userId,
    status: 'pending',
    changes: validated.data.changes,
    message: validated.data.message,
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

  await prisma.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'NEGOTIATION_ROUND_CREATED',
      resourceType: 'Contract',
      entityType: 'Contract',
      entityId: contractId,
      resource: contractId,
      details: { description: `Created negotiation round ${newRound.round}` },
      metadata: {
        roundId: newRound.id,
        roundNumber: newRound.round,
        changesCount: validated.data.changes.length,
      },
    },
  });

  pushAgentNotification({
    tenantId: context.tenantId,
    type: 'opportunity',
    severity: 'medium',
    title: 'New negotiation round',
    message: `Round ${newRound.round} submitted for "${contract.contractTitle || 'contract'}" with ${validated.data.changes.length} clause change(s)`,
    source: 'negotiation-agent',
    metadata: {
      contractId,
      roundId: newRound.id,
      changesCount: validated.data.changes.length,
    },
    actionUrl: `/contracts/${contractId}/negotiate`,
  });

  logger.info('Negotiation round created', {
    contractId,
    roundId: newRound.id,
    round: newRound.round,
  });

  return createSuccessResponse(context, { round: newRound, rounds }, { status: 201 });
}