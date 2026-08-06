/**
 * GET /api/agents/runs/[runId]
 * Run inspector data source (Phase 2.4). Maps AgentGoal + steps into
 * AgentStep-shaped timeline for the run detail UI.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type RunInspectorStep = {
  id: string;
  stepNumber: number;
  type: 'thought' | 'action' | 'observation' | 'tool_call' | 'critique' | 'decision';
  content: string;
  timestamp: string;
  durationMs: number;
  status?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  confidence?: number;
  tokens?: number;
  error?: string | null;
};

function mapStepType(type: string): RunInspectorStep['type'] {
  const t = (type || '').toLowerCase();
  if (t.includes('tool')) return 'tool_call';
  if (t.includes('think') || t.includes('plan')) return 'thought';
  if (t.includes('observ') || t.includes('result')) return 'observation';
  if (t.includes('crit')) return 'critique';
  if (t.includes('decid') || t.includes('approv')) return 'decision';
  return 'action';
}

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const rawParams = (ctx as { params?: Promise<{ runId: string }> | { runId: string } }).params;
  const resolved =
    rawParams && typeof (rawParams as Promise<unknown>).then === 'function'
      ? await (rawParams as Promise<{ runId: string }>)
      : (rawParams as { runId?: string } | undefined);
  const runId =
    resolved?.runId ||
    req.nextUrl.pathname.split('/').filter(Boolean).slice(-1)[0];

  if (!runId) {
    return createErrorResponse(ctx, 'INVALID_REQUEST', 'runId required', 400);
  }

  try {
    // runId is typically an AgentGoal id (or prefixed goal-*)
    const goalId = runId.replace(/^goal-/, '').replace(/^run-/, '');
    const goal = await prisma.agentGoal.findFirst({
      where: { id: goalId, tenantId },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    if (!goal) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Run not found', 404);
    }

    const steps: RunInspectorStep[] = (goal.steps || []).map((s, idx) => {
      const input = (s.input ?? {}) as Record<string, unknown>;
      const output = (s.output ?? {}) as Record<string, unknown>;
      const durationMs =
        typeof s.duration === 'number'
          ? s.duration
          : s.startedAt && s.completedAt
            ? Math.max(0, s.completedAt.getTime() - s.startedAt.getTime())
            : 0;
      return {
        id: s.id,
        stepNumber: s.order ?? idx + 1,
        type: mapStepType(s.type),
        content: s.name || s.type || `Step ${idx + 1}`,
        timestamp: (s.startedAt || s.createdAt).toISOString(),
        durationMs,
        status: s.status,
        toolId: typeof input.toolId === 'string' ? input.toolId : s.type,
        toolInput: input,
        toolOutput: output,
        confidence: typeof output.confidence === 'number' ? (output.confidence as number) : undefined,
        tokens: typeof output.tokens === 'number' ? (output.tokens as number) : undefined,
        error: s.error,
      };
    });

    // If no step rows, synthesize from plan JSON
    if (steps.length === 0 && goal.plan) {
      const plan = goal.plan as { steps?: Array<Record<string, unknown>> };
      const planSteps = Array.isArray(plan.steps) ? plan.steps : [];
      planSteps.forEach((ps, idx) => {
        steps.push({
          id: `plan-${idx}`,
          stepNumber: idx + 1,
          type: mapStepType(String(ps.type || ps.action || 'action')),
          content: String(ps.name || ps.action || ps.description || `Plan step ${idx + 1}`),
          timestamp: goal.createdAt.toISOString(),
          durationMs: 0,
          status: String(ps.status || 'PENDING'),
          toolInput: (ps.input as Record<string, unknown>) || ps,
        });
      });
    }

    const totalDurationMs = steps.reduce((a, s) => a + (s.durationMs || 0), 0);
    const totalTokens = steps.reduce((a, s) => a + (s.tokens || 0), 0);
    // Rough cost estimate: $0.01 / 1k tokens if no stored cost
    const estimatedCost = totalTokens > 0 ? (totalTokens / 1000) * 0.01 : 0;

    const result = (goal.result ?? {}) as Record<string, unknown>;

    return createSuccessResponse(ctx, {
      run: {
        id: goal.id,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        type: goal.type,
        goal: goal.title,
        contractId: goal.contractId,
        progress: goal.progress,
        error: goal.error,
        createdAt: goal.createdAt.toISOString(),
        startedAt: goal.startedAt?.toISOString() ?? null,
        completedAt: goal.completedAt?.toISOString() ?? null,
        summary:
          typeof result.summary === 'string'
            ? result.summary
            : goal.error ||
              (goal.status === 'COMPLETED' ? 'Goal completed' : null),
        tokensUsed: totalTokens,
        estimatedCost,
        totalDurationMs,
        steps,
        plan: goal.plan,
        context: goal.context,
        result: goal.result,
      },
    });
  } catch (error) {
    logger.error('Failed to load run', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to load run', 500);
  }
});
