/**
 * POST /api/agents/decisions/[id]/revert
 *
 * Undo an applied / auto-applied agent field write by restoring previousValue.
 * Marks the decision outcome as `reverted` and writes an audit log entry.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { emitUxEvent } from '@/lib/analytics/ux-events';
import { writeDomainFieldValue } from '@/lib/agents/domain-field-write';
import {
  isAgentWriteAllowlisted,
  isAgentWriteDenylisted,
} from '@repo/utils';

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  const rawParams = (ctx as { params?: Promise<{ id: string }> | { id: string } }).params;
  const resolvedParams = rawParams && typeof (rawParams as Promise<unknown>).then === 'function'
    ? await (rawParams as Promise<{ id: string }>)
    : (rawParams as { id?: string } | undefined);
  const decisionId =
    resolvedParams?.id ||
    req.nextUrl.pathname.split('/').filter(Boolean).slice(-2, -1)[0];

  if (!decisionId) {
    return createErrorResponse(ctx, 'INVALID_REQUEST', 'Decision id is required', 400);
  }

  try {
    const decision = await prisma.aiDecision.findFirst({
      where: {
        id: decisionId,
        tenantId,
        feature: 'agent_write',
      },
    });

    if (!decision) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Decision not found', 404);
    }

    if (decision.outcome === 'reverted' || decision.revertedAt) {
      return createErrorResponse(
        ctx,
        'ALREADY_REVERTED',
        'Decision has already been reverted',
        400,
      );
    }

    if (decision.outcome !== 'accepted' && decision.outcome !== 'auto_applied') {
      return createErrorResponse(
        ctx,
        'NOT_REVERTABLE',
        `Cannot revert decision with outcome=${decision.outcome}`,
        400,
      );
    }

    const previousValue = decision.previousValue;
    if (previousValue === undefined || previousValue === null) {
      // Allow empty string / 0 / false; only block missing snapshot
      // Prisma Json null means missing for our purposes (see 1.2)
      // Re-check output fallback
      const output = (decision.output ?? {}) as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(output, 'previousValue')) {
        return createErrorResponse(
          ctx,
          'NO_PREVIOUS_VALUE',
          'Nothing to revert to — previousValue was not captured for this decision',
          409,
        );
      }
    }

    const output = (decision.output ?? {}) as Record<string, unknown>;
    const entity = String(output.entity ?? 'Contract');
    const entityId = String(output.entityId ?? decision.contractId ?? '');
    const field = String(output.field ?? decision.subFeature?.split('.')[1] ?? '');
    const restoreValue =
      previousValue !== undefined && previousValue !== null
        ? previousValue
        : output.previousValue;

    if (!entityId || !field) {
      return createErrorResponse(
        ctx,
        'INVALID_DECISION',
        'Decision is missing entityId or field',
        400,
      );
    }

    if (isAgentWriteDenylisted(field)) {
      return createErrorResponse(
        ctx,
        'DENYLISTED',
        `Field ${field} is denylisted and cannot be reverted via this path`,
        403,
      );
    }

    if (!isAgentWriteAllowlisted(entity, field)) {
      return createErrorResponse(
        ctx,
        'NOT_ALLOWLISTED',
        `Field ${entity}.${field} is not allowlisted`,
        403,
      );
    }

    // Race guard: only transition accepted/auto_applied → reverted once
    const updated = await prisma.aiDecision.updateMany({
      where: {
        id: decisionId,
        tenantId,
        outcome: { in: ['accepted', 'auto_applied'] },
        revertedAt: null,
      },
      data: {
        outcome: 'reverted',
        revertedAt: new Date(),
        reviewedAt: new Date(),
        userFeedback: {
          ...((decision.userFeedback as object) || {}),
          revert: {
            actorId: userId,
            restoredValue: restoreValue as object | string | number | boolean | null,
            at: new Date().toISOString(),
          },
        } as object,
      },
    });

    if (updated.count === 0) {
      return createErrorResponse(
        ctx,
        'CONFLICT',
        'Decision was already reverted or is no longer eligible',
        409,
      );
    }

    const wrote = await writeDomainFieldValue(entity, entityId, field, restoreValue, tenantId);
    if (!wrote) {
      // Roll back decision state so a retry is possible
      await prisma.aiDecision.update({
        where: { id: decisionId },
        data: {
          outcome: decision.outcome,
          revertedAt: null,
        },
      });
      return createErrorResponse(
        ctx,
        'APPLY_FAILED',
        `Failed to restore ${entity}.${field} — entity not found for tenant`,
        500,
      );
    }

    // Audit log (same table the rest of the product uses)
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'agent_write.reverted',
        resource: entity,
        resourceId: entityId,
        resourceType: entity,
        entityType: entity,
        entityId,
        changes: {
          field,
          restoredValue: restoreValue as object | string | number | boolean | null,
          decisionId,
          previousOutcome: decision.outcome,
        } as object,
        metadata: {
          feature: 'agent_write',
          decisionId,
        } as object,
      },
    });

    await emitUxEvent({
      tenantId,
      userId,
      event: 'agent_undo_used',
      props: {
        decisionId,
        entity,
        entityId,
        field,
        previousOutcome: decision.outcome,
      },
    });

    logger.info('Agent write decision reverted', {
      decisionId,
      entity,
      entityId,
      field,
      userId,
    });

    return createSuccessResponse(ctx, {
      decisionId,
      status: 'reverted',
      entity,
      entityId,
      field,
      restoredValue: restoreValue,
    });
  } catch (error) {
    logger.error('Failed to revert agent decision:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to revert decision', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
