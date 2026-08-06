/**
 * GET /api/agents/auto-applied — auto-approval digest (Phase 2.3)
 * Lists recent auto_applied AiDecisions with deep links to revert.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') || '7', 10) || 7, 1), 90);
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10) || 50, 200);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.aiDecision.findMany({
      where: {
        tenantId,
        feature: 'agent_write',
        outcome: 'auto_applied',
        createdAt: { gte: since },
        revertedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const items = rows.map((d) => {
      const output = (d.output ?? {}) as Record<string, unknown>;
      const field = String(output.field ?? d.subFeature?.split('.')[1] ?? 'field');
      const agentId = String(output.agentId ?? d.model ?? 'agent');
      return {
        id: d.id,
        decisionId: d.id,
        agentId,
        field,
        entity: String(output.entity ?? 'Contract'),
        entityId: String(output.entityId ?? d.contractId ?? ''),
        contractId: d.contractId,
        value: output.value ?? output.proposedValue,
        previousValue: d.previousValue ?? output.previousValue,
        confidence: d.confidence,
        createdAt: d.createdAt.toISOString(),
        canRevert: d.previousValue !== null && d.previousValue !== undefined,
        revertUrl: `/api/agents/decisions/${d.id}/revert`,
        deepLink: d.contractId ? `/contracts/${d.contractId}` : null,
      };
    });

    return createSuccessResponse(ctx, {
      items,
      count: items.length,
      periodDays: days,
      since: since.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to load auto-applied digest', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to load auto-applied digest', 500);
  }
});
