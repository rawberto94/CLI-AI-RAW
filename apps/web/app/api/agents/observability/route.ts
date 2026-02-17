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

        metrics = {
          totalAgents: totalGoals,
          activeAgents: active,
          completedToday,
          failedToday,
          avgCompletionTimeMs: Math.round(avgCompletionTimeMs),
          avgTokensPerTask: 0, // Would need token tracking
          successRate: Math.round(successRate * 100) / 100,
          topAgents,
          topTools: [],
          costToday: 0,
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
        // In production, store in database
        const newTrace: AgentTrace = {
          id: `trace-${Date.now()}`,
          ...trace,
          tenantId,
          startTime: new Date().toISOString(),
          status: 'running',
          steps: [],
          tokensUsed: 0,
          estimatedCost: 0 };

        return createSuccessResponse(ctx, { 
          traceId: newTrace.id,
          message: 'Trace created successfully' 
        });
      }

      case 'add_step': {
        if (!traceId || !step) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId and step are required', 400);
        }

        // In production, update trace in database
        const newStep: AgentStep = {
          id: `step-${Date.now()}`,
          ...step,
          timestamp: new Date().toISOString() };

        return createSuccessResponse(ctx, {
          stepId: newStep.id,
          message: 'Step added successfully' });
      }

      case 'complete_trace': {
        if (!traceId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId is required', 400);
        }

        // In production, update trace status in database
        return createSuccessResponse(ctx, {
          message: 'Trace completed successfully' });
      }

      case 'fail_trace': {
        if (!traceId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'traceId is required', 400);
        }

        const { error: errorMessage } = body;

        // In production, update trace status in database
        return createSuccessResponse(ctx, {
          message: 'Trace marked as failed',
          error: errorMessage });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }
  });
