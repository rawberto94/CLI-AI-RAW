/**
 * GET/PUT /api/agents/autonomy
 * Per-agent autonomy settings (Agentic UX 2.1).
 * Default mode is always `review` when no row exists.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  normalizeAutonomyMode,
  normalizeRiskLevel,
  DEFAULT_AUTONOMY_MODE,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_RISK_THRESHOLD,
} from '@repo/utils';
import { emitUxEvent } from '@/lib/analytics/ux-events';

const UpsertSchema = z.object({
  agentId: z.string().min(1),
  actionType: z.string().min(1).default('agent_write'),
  mode: z.enum(['suggest', 'review', 'auto']),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  costThreshold: z.number().nonnegative().nullable().optional(),
  riskThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const agentId = req.nextUrl.searchParams.get('agentId');
  try {
    const rows = await prisma.agentAutonomyConfig.findMany({
      where: {
        tenantId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: [{ agentId: 'asc' }, { actionType: 'asc' }],
    });
    return createSuccessResponse(ctx, {
      configs: rows,
      defaults: {
        mode: DEFAULT_AUTONOMY_MODE,
        confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
        riskThreshold: DEFAULT_RISK_THRESHOLD,
      },
    });
  } catch (error) {
    logger.error('Failed to load autonomy configs', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to load autonomy configs', 500);
  }
});

export const PUT = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  try {
    const body = UpsertSchema.parse(await req.json());
    const mode = normalizeAutonomyMode(body.mode);
    const riskThreshold = normalizeRiskLevel(body.riskThreshold ?? DEFAULT_RISK_THRESHOLD);
    const confidenceThreshold =
      typeof body.confidenceThreshold === 'number'
        ? body.confidenceThreshold
        : DEFAULT_CONFIDENCE_THRESHOLD;

    const existing = await prisma.agentAutonomyConfig.findUnique({
      where: {
        tenantId_agentId_actionType: {
          tenantId,
          agentId: body.agentId,
          actionType: body.actionType,
        },
      },
    });

    const row = await prisma.agentAutonomyConfig.upsert({
      where: {
        tenantId_agentId_actionType: {
          tenantId,
          agentId: body.agentId,
          actionType: body.actionType,
        },
      },
      create: {
        tenantId,
        agentId: body.agentId,
        actionType: body.actionType,
        mode,
        confidenceThreshold,
        costThreshold: body.costThreshold ?? null,
        riskThreshold,
        notifyEmail: body.notifyEmail ?? true,
        notifyInApp: body.notifyInApp ?? true,
      },
      update: {
        mode,
        confidenceThreshold,
        costThreshold: body.costThreshold === undefined ? undefined : body.costThreshold,
        riskThreshold,
        notifyEmail: body.notifyEmail,
        notifyInApp: body.notifyInApp,
      },
    });

    await emitUxEvent({
      tenantId,
      userId,
      event: 'autonomy_changed',
      props: {
        agentId: body.agentId,
        actionType: body.actionType,
        previousMode: existing?.mode ?? null,
        mode: row.mode,
        confidenceThreshold: row.confidenceThreshold,
        riskThreshold: row.riskThreshold,
        costThreshold: row.costThreshold,
      },
    });

    return createSuccessResponse(ctx, { config: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid autonomy payload', 400, {
        details: error.issues.map((i) => i.message).join('; '),
      });
    }
    logger.error('Failed to upsert autonomy config', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to save autonomy config', 500);
  }
});
