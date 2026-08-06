/**
 * GET /api/agents/autonomy/graduation — graduation nudges (Phase 2.2)
 * POST — accept a nudge (enable mode=auto with observed thresholds)
 *
 * Nudge appears only after ≥10 decisions with ≥90% acceptance for a tenant×agent×action.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { emitUxEvent } from '@/lib/analytics/ux-events';
import { DEFAULT_CONFIDENCE_THRESHOLD } from '@repo/utils';

const MIN_DECISIONS = 10;
const MIN_ACCEPTANCE = 0.9;
const LOOKBACK = 50;

export interface GraduationNudge {
  agentId: string;
  actionType: string;
  sampleSize: number;
  acceptanceRate: number;
  suggestedConfidenceThreshold: number;
  acceptedCount: number;
  rejectedCount: number;
  message: string;
}

export const GET = withAuthApiHandler(async (_req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  try {
    const decisions = await prisma.aiDecision.findMany({
      where: {
        tenantId,
        feature: 'agent_write',
        outcome: { in: ['accepted', 'rejected', 'auto_applied', 'modified'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        model: true,
        subFeature: true,
        outcome: true,
        confidence: true,
        output: true,
      },
    });

    // Group by agentId × actionType (entity.field)
    type Bucket = {
      agentId: string;
      actionType: string;
      outcomes: string[];
      confidences: number[];
    };
    const buckets = new Map<string, Bucket>();

    for (const d of decisions) {
      const output = (d.output ?? {}) as Record<string, unknown>;
      const agentId = String(output.agentId ?? d.model ?? 'agent');
      const field = String(output.field ?? d.subFeature?.split('.')[1] ?? 'field');
      const entity = String(output.entity ?? d.subFeature?.split('.')[0] ?? 'Contract');
      const actionType = `agent_write.${entity}.${field}`;
      const key = `${agentId}::${actionType}`;
      if (!buckets.has(key)) {
        buckets.set(key, { agentId, actionType, outcomes: [], confidences: [] });
      }
      const b = buckets.get(key)!;
      if (b.outcomes.length >= LOOKBACK) continue;
      b.outcomes.push(d.outcome);
      if (typeof d.confidence === 'number') b.confidences.push(d.confidence);
    }

    // Load existing auto configs to skip already-automated pairs
    const existing = await prisma.agentAutonomyConfig.findMany({
      where: { tenantId, mode: 'auto' },
      select: { agentId: true, actionType: true },
    });
    const autoKeys = new Set(existing.map((e) => `${e.agentId}::${e.actionType}`));

    const nudges: GraduationNudge[] = [];
    for (const [key, b] of buckets) {
      if (autoKeys.has(key) || autoKeys.has(`${b.agentId}::agent_write`)) continue;
      if (b.outcomes.length < MIN_DECISIONS) continue;
      const accepted = b.outcomes.filter((o) => o === 'accepted' || o === 'auto_applied').length;
      const rejected = b.outcomes.filter((o) => o === 'rejected').length;
      const rate = accepted / b.outcomes.length;
      if (rate < MIN_ACCEPTANCE) continue;

      // 90th percentile confidence of accepted-ish decisions (or default)
      const sorted = [...b.confidences].sort((a, c) => a - c);
      const p90 =
        sorted.length > 0
          ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]
          : DEFAULT_CONFIDENCE_THRESHOLD;

      nudges.push({
        agentId: b.agentId,
        actionType: b.actionType,
        sampleSize: b.outcomes.length,
        acceptanceRate: rate,
        suggestedConfidenceThreshold: Math.min(0.99, Math.max(0.7, p90)),
        acceptedCount: accepted,
        rejectedCount: rejected,
        message: `You accepted ${b.agentId}'s last ${b.outcomes.length} ${b.actionType} actions (${Math.round(rate * 100)}%) — automate these?`,
      });
    }

    nudges.sort((a, b) => b.acceptanceRate - a.acceptanceRate || b.sampleSize - a.sampleSize);

    return createSuccessResponse(ctx, { nudges, minDecisions: MIN_DECISIONS, minAcceptance: MIN_ACCEPTANCE });
  } catch (error) {
    logger.error('Failed to compute graduation nudges', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to compute graduation nudges', 500);
  }
});

const AcceptSchema = z.object({
  agentId: z.string().min(1),
  actionType: z.string().min(1),
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  try {
    const body = AcceptSchema.parse(await req.json());
    const confidenceThreshold = body.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

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
        mode: 'auto',
        confidenceThreshold,
        riskThreshold: 'medium',
      },
      update: {
        mode: 'auto',
        confidenceThreshold,
      },
    });

    await emitUxEvent({
      tenantId,
      userId,
      event: 'autonomy_changed',
      props: {
        source: 'graduation_nudge',
        agentId: body.agentId,
        actionType: body.actionType,
        mode: 'auto',
        confidenceThreshold,
      },
    });

    return createSuccessResponse(ctx, { config: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid payload', 400, {
        details: error.issues.map((i) => i.message).join('; '),
      });
    }
    logger.error('Failed to accept graduation nudge', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to enable auto mode', 500);
  }
});
