/**
 * Agent Observability API Routes
 * 
 * Provides endpoints for fetching agent traces, metrics, and
 * real-time observability data.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

// =============================================================================
// TYPES
// =============================================================================

interface AgentTrace {
  id: string;
  agentId: string;
  agentName: string;
  agentType: 'react' | 'debate' | 'extraction' | 'validation' | 'custom';
  sessionId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  goal: string;
  steps: AgentStep[];
  tokensUsed: number;
  estimatedCost: number;
  contractId?: string;
  tenantId: string;
  userId: string;
}

interface AgentStep {
  id: string;
  stepNumber: number;
  type: 'thought' | 'action' | 'observation' | 'tool_call' | 'critique' | 'decision';
  content: string;
  timestamp: string;
  durationMs: number;
  toolId?: string;
  toolInput?: Record<string, any>;
  toolOutput?: any;
  confidence?: number;
  tokens?: number;
}

interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  completedToday: number;
  failedToday: number;
  avgCompletionTimeMs: number;
  avgTokensPerTask: number;
  successRate: number;
  topAgents: Array<{ agentId: string; name: string; taskCount: number }>;
  topTools: Array<{ toolId: string; name: string; usageCount: number }>;
  costToday: number;
  costTrend: number;
}

// =============================================================================
// GET - Fetch traces and metrics
// =============================================================================

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'traces', 'metrics', 'all'
    const status = searchParams.get('status'); // Filter by status
    const agentType = searchParams.get('agentType'); // Filter by agent type
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch traces from Redis cache or database
    let traces: AgentTrace[] = [];
    let metrics: AgentMetrics = {
      totalAgents: 0,
      activeAgents: 0,
      completedToday: 0,
      failedToday: 0,
      avgCompletionTimeMs: 0,
      avgTokensPerTask: 0,
      successRate: 0,
      topAgents: [],
      topTools: [],
      costToday: 0,
      costTrend: 0 };

    try {
      // Try to fetch from Redis first
      const { getCached } = await import('@/lib/cache');
      const cachedTraces = await getCached<AgentTrace[]>(`agent:traces:${tenantId}`);
      const cachedMetrics = await getCached<AgentMetrics>(`agent:metrics:${tenantId}`);
      
      if (cachedTraces) traces = cachedTraces;
      if (cachedMetrics) metrics = cachedMetrics;
    } catch {
      // Redis unavailable — compute metrics from database
    }

    // If no traces from Redis, build from DB agentGoal + steps
    if (traces.length === 0) {
      try {
        const dbGoals = await prisma.agentGoal.findMany({
          where: { tenantId },
          include: { steps: { orderBy: { order: 'asc' } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        traces = dbGoals.map((g: any) => {
          const startTime = g.startedAt ?? g.createdAt;
          const endTime = g.completedAt ?? (g.status === 'FAILED' ? g.updatedAt : undefined);
          const tokenUsage = (g.result as any)?._tokenUsage;

          const statusMap: Record<string, string> = {
            PENDING: 'running',
            PLANNING: 'running',
            AWAITING_APPROVAL: 'running',
            EXECUTING: 'running',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'failed',
          };

          return {
            id: g.id,
            agentId: g.type,
            agentName: g.title,
            agentType: g.type,
            sessionId: g.id,
            startTime: startTime.toISOString(),
            endTime: endTime ? endTime.toISOString() : undefined,
            status: statusMap[g.status] ?? 'running',
            goal: g.description ?? g.title,
            steps: g.steps.map((s: any) => ({
              type: s.type === 'tool_call' ? 'tool_call' : s.type === 'decision' ? 'decision' : 'action',
              content: s.name,
              durationMs: s.duration ?? 0,
              toolInput: s.input ? JSON.stringify(s.input) : undefined,
              toolOutput: s.output ? JSON.stringify(s.output) : undefined,
              confidence: s.progress ? s.progress / 100 : undefined,
              tokens: 0,
            })),
            tokensUsed: tokenUsage?.totalTokens ?? 0,
            estimatedCost: tokenUsage?.estimatedCost ?? 0,
          } as AgentTrace;
        });
      } catch {
        // DB trace fallback failed — traces stays empty
      }
    }

    // If no cached metrics, compute from real DB data
    if (metrics.totalAgents === 0) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const [totalGoals, statusCounts, completedToday, failedToday, yesterdayCompleted, recentGoals] = await Promise.all([
          prisma.agentGoal.count({ where: { tenantId } }),
          prisma.agentGoal.groupBy({
            by: ['status'],
            where: { tenantId },
            _count: true,
          }),
          prisma.agentGoal.count({ where: { tenantId, status: 'COMPLETED', completedAt: { gte: today } } }),
          prisma.agentGoal.count({ where: { tenantId, status: 'FAILED', completedAt: { gte: today } } }),
          prisma.agentGoal.count({ where: { tenantId, status: 'COMPLETED', completedAt: { gte: yesterday, lt: today } } }),
          prisma.agentGoal.findMany({
            where: { tenantId, completedAt: { not: null }, startedAt: { not: null } },
            select: { startedAt: true, completedAt: true, type: true },
            orderBy: { completedAt: 'desc' },
            take: 100,
          }),
        ]);

        const statusMap = statusCounts.reduce((m: Record<string, number>, s: any) => { m[s.status] = s._count; return m; }, {} as Record<string, number>);
        const active = (statusMap['EXECUTING'] ?? 0) + (statusMap['PLANNING'] ?? 0) + (statusMap['AWAITING_APPROVAL'] ?? 0);
        const completed = statusMap['COMPLETED'] ?? 0;
        const failed = statusMap['FAILED'] ?? 0;
        const total = completed + failed;
        const successRate = total > 0 ? completed / total : 0;

        // Average completion time from recent goals
        const durations = recentGoals
          .filter((g: any) => g.startedAt && g.completedAt)
          .map((g: any) => new Date(g.completedAt).getTime() - new Date(g.startedAt).getTime());
        const avgCompletionTimeMs = durations.length > 0
          ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length
          : 0;

        // Top goal types
        const typeCounts = recentGoals.reduce((m: Record<string, number>, g: any) => {
          m[g.type] = (m[g.type] || 0) + 1; return m;
        }, {} as Record<string, number>);
        const topAgents = Object.entries(typeCounts)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([type, count]) => ({ agentId: type, name: type, taskCount: count as number }));

        // Cost trend (today vs yesterday)
        const costTrend = yesterdayCompleted > 0 ? (completedToday - yesterdayCompleted) / yesterdayCompleted : 0;

        // Compute real token usage and cost from goal results
        let avgTokensPerTask = 0;
        let costToday = 0;
        try {
          const todayGoals = await prisma.agentGoal.findMany({
            where: { tenantId, status: 'COMPLETED', completedAt: { gte: today } },
            select: { result: true },
          });
          let totalTokens = 0;
          let totalCost = 0;
          let counted = 0;
          for (const g of todayGoals) {
            const tokenUsage = (g.result as any)?._tokenUsage;
            if (tokenUsage?.totalTokens) {
              totalTokens += tokenUsage.totalTokens;
              totalCost += tokenUsage.estimatedCost ?? 0;
              counted++;
            }
          }
          avgTokensPerTask = counted > 0 ? Math.round(totalTokens / counted) : 0;
          costToday = Math.round(totalCost * 10000) / 10000;
        } catch {
          // Non-critical — token data is best-effort
        }

        metrics = {
          totalAgents: totalGoals,
          activeAgents: active,
          completedToday,
          failedToday,
          avgCompletionTimeMs: Math.round(avgCompletionTimeMs),
          avgTokensPerTask,
          successRate: Math.round(successRate * 100) / 100,
          topAgents,
          topTools: [],
          costToday,
          costTrend: Math.round(costTrend * 100) / 100,
        };
      } catch {
        // DB query failed — return defaults (already set above)
      }
    }

    // Apply filters
    if (status && status !== 'all') {
      traces = traces.filter(t => t.status === status);
    }
    if (agentType && agentType !== 'all') {
      traces = traces.filter(t => t.agentType === agentType);
    }

    // Apply limit
    traces = traces.slice(0, limit);

    // Return based on type
    if (type === 'traces') {
      return createSuccessResponse(ctx, { traces });
    }
    if (type === 'metrics') {
      return createSuccessResponse(ctx, { metrics });
    }

    return createSuccessResponse(ctx, {
      traces,
      metrics,
      timestamp: new Date().toISOString() });
  });

// =============================================================================
// POST - Record new trace or update existing
// =============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action, trace, step, traceId } = body;

    switch (action) {
      case 'create_trace': {
        // Persist trace as an AgentGoal (observability record)
        const goal = await prisma.agentGoal.create({
          data: {
            tenantId,
            userId: trace?.userId || 'system',
            type: trace?.agentType || 'custom',
            title: trace?.goal || 'Agent trace',
            description: `Agent: ${trace?.agentName || 'unknown'} | Session: ${trace?.sessionId || 'none'}`,
            status: 'IN_PROGRESS' as any,
            context: {
              agentId: trace?.agentId,
              agentName: trace?.agentName,
              agentType: trace?.agentType,
              sessionId: trace?.sessionId,
              contractId: trace?.contractId,
              source: 'observability_trace',
            },
            contractId: trace?.contractId,
            startedAt: new Date(),
          },
        });

        return createSuccessResponse(ctx, { 
          traceId: goal.id,
          message: 'Trace created successfully' 
        });
      }

      case 'add_step': {
        if (!traceId || !step) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId and step are required', 400);
        }

        // Count existing steps and persist the new step
        const existingSteps = await prisma.agentGoalStep.count({ where: { goalId: traceId } });
        const goalStep = await prisma.agentGoalStep.create({
          data: {
            goalId: traceId,
            name: step.content?.substring(0, 200) || `Step ${existingSteps + 1}`,
            type: step.type || 'action',
            order: step.stepNumber || existingSteps + 1,
            status: 'COMPLETED',
            input: step.toolInput ? step.toolInput : undefined,
            output: step.toolOutput ? { result: step.toolOutput, confidence: step.confidence } : undefined,
            duration: step.durationMs,
            startedAt: new Date(step.timestamp || Date.now()),
            completedAt: new Date(),
          },
        });

        // Update parent goal's token/cost tracking in context
        if (step.tokens) {
          await prisma.agentGoal.update({
            where: { id: traceId },
            data: {
              currentStep: existingSteps + 1,
              totalSteps: existingSteps + 1,
            },
          }).catch(() => {}); // best-effort
        }

        return createSuccessResponse(ctx, {
          stepId: goalStep.id,
          message: 'Step added successfully' });
      }

      case 'complete_trace': {
        if (!traceId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId is required', 400);
        }

        await prisma.agentGoal.update({
          where: { id: traceId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            progress: 100,
          },
        });

        return createSuccessResponse(ctx, {
          message: 'Trace completed successfully' });
      }

      case 'fail_trace': {
        if (!traceId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId is required', 400);
        }

        const { error: errorMessage } = body;

        await prisma.agentGoal.update({
          where: { id: traceId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: errorMessage || 'Unknown error',
          },
        });

        return createSuccessResponse(ctx, {
          message: 'Trace marked as failed',
          error: errorMessage });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }
  });
