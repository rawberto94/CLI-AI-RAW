/**
 * GET /api/contracts/[id]/agent-writes
 * Lists agent field-write decisions for a contract (applied / pending / reverted).
 * Used by the contract-level Undo banner (Phase 1.3).
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const rawParams = (ctx as { params?: Promise<{ id: string }> | { id: string } }).params;
  const resolved =
    rawParams && typeof (rawParams as Promise<unknown>).then === 'function'
      ? await (rawParams as Promise<{ id: string }>)
      : (rawParams as { id?: string } | undefined);
  const contractId =
    resolved?.id || req.nextUrl.pathname.split('/').filter(Boolean).slice(-2, -1)[0];

  if (!contractId) {
    return createErrorResponse(ctx, 'INVALID_REQUEST', 'Contract id required', 400);
  }

  const status = req.nextUrl.searchParams.get('status') || 'applied';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '10', 10) || 10, 50);

  const outcomes =
    status === 'applied'
      ? ['accepted', 'auto_applied']
      : status === 'pending'
        ? ['pending']
        : status === 'reverted'
          ? ['reverted']
          : ['accepted', 'auto_applied', 'pending', 'reverted'];

  try {
    // Tenant-scope contract first
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const decisions = await prisma.aiDecision.findMany({
      where: {
        tenantId,
        contractId,
        feature: 'agent_write',
        outcome: { in: outcomes },
        ...(status === 'applied' ? { revertedAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const items = decisions
      .filter((d) => {
        if (status !== 'applied') return true;
        return d.previousValue !== null && d.previousValue !== undefined && !d.revertedAt;
      })
      .map((d) => {
        const output = (d.output ?? {}) as Record<string, unknown>;
        return {
          id: d.id,
          field: String(output.field ?? d.subFeature?.split('.')[1] ?? 'field'),
          outcome: d.outcome,
          previousValue: d.previousValue ?? output.previousValue,
          appliedValue: output.proposedValue ?? output.value,
          createdAt: d.createdAt.toISOString(),
          agentId: String(output.agentId ?? d.model ?? 'agent'),
        };
      });

    return createSuccessResponse(ctx, { items, decisions: items });
  } catch (error) {
    logger.error('Failed to list agent writes for contract:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to list agent writes', 500);
  }
});
