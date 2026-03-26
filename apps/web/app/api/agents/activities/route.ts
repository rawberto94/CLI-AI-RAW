/**
 * Agent Activities API
 * 
 * GET /api/agents/activities - List agent activities with filtering
 * POST /api/agents/activities/clear - Clear activities
 * 
 * Real-time activity feed from autonomous and HITL agents
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const ACTIVITY_TYPES = [
  'task_completed',
  'insight_generated',
  'alert_raised',
  'recommendation_made',
  'goal_achieved',
  'approval_requested',
  'approval_granted',
  'contract_analyzed',
  'risk_detected',
  'opportunity_found',
];

const AGENT_CODENAMES: Record<string, string> = {
  'sage': 'Sage',
  'sentinel': 'Sentinel',
  'vigil': 'Vigil',
  'warden': 'Warden',
  'architect': 'Architect',
  'prospector': 'Prospector',
  'merchant': 'Merchant',
  'scout': 'Scout',
  'clockwork': 'Clockwork',
  'conductor': 'Conductor',
  'memorykeeper': 'Memorykeeper',
  'navigator': 'Navigator',
  'orchestrator': 'Orchestrator',
  'builder': 'Builder',
  'synthesizer': 'Synthesizer',
};

/**
 * GET /api/agents/activities
 * 
 * Returns activity feed with filtering and pagination
 */
export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const searchParams = req.nextUrl.searchParams;
  
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 200);
  const cursor = searchParams.get('cursor');
  const agentId = searchParams.get('agent');
  const type = searchParams.get('type');
  const since = searchParams.get('since');
  const status = searchParams.get('status');
  const realtime = searchParams.get('realtime') === 'true';

  try {
    // If realtime is requested, try to get recent activities from Redis cache
    if (realtime) {
      const cachedActivities = await getRecentActivitiesFromCache(tenantId, limit);
      if (cachedActivities.length > 0) {
        return createSuccessResponse(ctx, {
          activities: cachedActivities,
          cursor: null,
          hasMore: false,
          source: 'cache',
        }, { cached: true });
      }
    }

    // Fetch from multiple activity sources in parallel
    const [
      agentActivities,
      executionLogs,
      goalActivities,
      workflowActivities,
      recentTasks,
    ] = await Promise.all([
      // 1. Agent activity log
      prisma.agentEvent.findMany({
        where: {
          tenantId,
          ...(agentId && { agentName: agentId }),
          ...(type && ACTIVITY_TYPES.includes(type) && { eventType: type }),
          ...(since && { timestamp: { gte: new Date(since) } }),
          ...(status && { outcome: status }),
          ...(cursor && { id: { lt: cursor } }),
        },
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),

      // 2. Agent execution logs
      prisma.agentPerformanceLog.findMany({
        where: {
          tenantId,
          ...(agentId && { agentType: agentId }),
          ...(cursor && { createdAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Agent goal completions
      prisma.agentGoal.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          ...(agentId && { type: agentId.toUpperCase() }),
          ...(cursor && { completedAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { completedAt: 'desc' },
        include: {
          steps: {
            where: { status: 'COMPLETED' },
            select: { type: true, output: true },
          },
        },
      }),

      // 4. Workflow-style goal executions
      prisma.agentGoal.findMany({
        where: {
          tenantId,
          completedAt: { not: null },
          ...(cursor && { completedAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { completedAt: 'desc' },
        include: {
          steps: {
            select: { name: true, status: true, output: true, duration: true },
          },
        },
      }),

      // 5. Task completions (goal steps)
      prisma.agentGoalStep.findMany({
        where: {
          status: 'COMPLETED',
          ...(cursor && { completedAt: { lt: new Date(cursor) } }),
        },
        take: limit,
        orderBy: { completedAt: 'desc' },
        include: {
          goal: {
            select: { tenantId: true, type: true, contractId: true, priority: true },
          },
        },
      }),
    ]);

    // Transform to unified activity format
    const activities = [
      // Agent activities
      ...agentActivities.map(a => ({
        id: a.id,
        type: a.eventType,
        agentId: a.agentName,
        agentCodename: getCodenameFromId(a.agentName),
        agentAvatar: getAvatarFromCodename(getCodenameFromId(a.agentName)),
        title: a.eventType,
        description: a.reasoning,
        context: a.metadata,
        contractId: a.contractId,
        timestamp: a.timestamp.toISOString(),
        importance: 'normal',
        category: getActivityCategory(a.eventType),
        status: a.outcome,
        metrics: (a.metadata as Record<string, any>)?.metrics,
      })),

      // Execution logs
      ...executionLogs.map(e => ({
        id: `exec-${e.id}`,
        type: 'task_completed',
        agentId: e.agentType,
        agentCodename: getCodenameFromId(e.agentType),
        agentAvatar: getAvatarFromCodename(getCodenameFromId(e.agentType)),
        title: `${getCodenameFromId(e.agentType)} completed task`,
        description: `${e.artifactType} processed`,
        context: {
          duration: e.executionTime ? Math.round(e.executionTime / 1000) : null,
          cost: e.cost,
        },
        contractId: e.contractId,
        timestamp: e.timestamp.toISOString(),
        importance: 'normal',
        category: 'execution',
        status: 'success',
      })),

      // Goal achievements
      ...goalActivities.map(g => ({
        id: `goal-${g.id}`,
        type: 'goal_achieved',
        agentId: g.type?.toLowerCase().replace(/_/g, '-'),
        agentCodename: getCodenameFromType(g.type),
        agentAvatar: getAvatarFromCodename(getCodenameFromType(g.type)),
        title: `Goal achieved: ${g.title}`,
        description: g.description,
        context: {
          progress: g.progress,
          steps: g.steps,
        },
        contractId: g.contractId,
        timestamp: g.completedAt?.toISOString() || g.updatedAt.toISOString(),
        importance: 'normal',
        category: 'milestone',
        status: 'success',
      })),

      // Workflow completions
      ...workflowActivities.map(w => ({
        id: `workflow-${w.id}`,
        type: w.status === 'COMPLETED' ? 'task_completed' : 'alert_raised',
        agentId: 'orchestrator',
        agentCodename: 'Orchestrator',
        agentAvatar: '🎼',
        title: w.title || 'Workflow completed',
        description: w.description || `Workflow ${w.status.toLowerCase()}`,
        context: {
          steps: w.steps.map(s => ({ name: s.name, status: s.status, duration: s.duration })),
          totalSteps: w.totalSteps,
        },
        timestamp: w.completedAt?.toISOString() || w.updatedAt.toISOString(),
        importance: w.status === 'FAILED' ? 'high' : 'normal',
        category: 'workflow',
        status: w.status.toLowerCase(),
      })),

      // Task completions (goal steps)
      ...recentTasks.filter(t => t.goal.tenantId === tenantId).map(t => ({
        id: `task-${t.id}`,
        type: 'task_completed',
        agentId: t.type,
        agentCodename: getCodenameFromId(t.type),
        agentAvatar: getAvatarFromCodename(getCodenameFromId(t.type)),
        title: `Task completed: ${t.name}`,
        description: `Step ${t.order} completed`,
        context: {
          output: t.output,
          duration: t.duration,
        },
        contractId: t.goal.contractId,
        timestamp: t.completedAt?.toISOString() || t.updatedAt.toISOString(),
        importance: t.goal.priority <= 2 ? 'critical' : t.goal.priority <= 4 ? 'high' : 'normal',
        category: 'task',
        status: 'success',
      })),
    ];

    // Sort by timestamp (newest first)
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Deduplicate by ID and limit results
    const seen = new Set<string>();
    const uniqueActivities = activities.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    }).slice(0, limit);

    // Update cache for realtime requests
    if (realtime) {
      await cacheActivities(tenantId, uniqueActivities);
    }

    // Get pagination cursor
    const nextCursor = uniqueActivities.length > 0 
      ? uniqueActivities[uniqueActivities.length - 1].id 
      : null;

    return createSuccessResponse(ctx, {
      activities: uniqueActivities,
      cursor: nextCursor,
      hasMore: uniqueActivities.length === limit,
      source: 'database',
    });
  } catch (error) {
    logger.error('Failed to fetch activities:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch activities', 500);
  }
});

/**
 * POST /api/agents/activities/clear
 * 
 * Mark activities as read/cleared
 */
export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;

  try {
    const body = await req.json();
    const { activityIds, clearAll, filter } = body;

    if (clearAll) {
      // Mark all as read
      await prisma.agentEvent.updateMany({
        where: { tenantId },
        data: { outcome: 'read' },
      });

      // Clear cache
      await redis.del(`activities:${tenantId}`);

      return createSuccessResponse(ctx, {
        cleared: 'all',
      });
    }

    if (activityIds && activityIds.length > 0) {
      await prisma.agentEvent.updateMany({
        where: {
          id: { in: activityIds },
          tenantId,
        },
        data: { outcome: 'read' },
      });

      return createSuccessResponse(ctx, {
        cleared: activityIds.length,
      });
    }

    return createErrorResponse(ctx, 'INVALID_REQUEST', 'Invalid request: provide activityIds or clearAll', 400);
  } catch (error) {
    logger.error('Failed to clear activities:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to clear activities', 500);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getRecentActivitiesFromCache(tenantId: string, limit: number): Promise<any[]> {
  try {
    const cached = await redis.get(`activities:${tenantId}`);
    if (cached) {
      const activities = JSON.parse(cached);
      return activities.slice(0, limit);
    }
  } catch (error) {
    logger.warn('Failed to get activities from cache:', error);
  }
  return [];
}

async function cacheActivities(tenantId: string, activities: any[]): Promise<void> {
  try {
    await redis.setex(`activities:${tenantId}`, 300, JSON.stringify(activities));
  } catch (error) {
    logger.warn('Failed to cache activities:', error);
  }
}

function getCodenameFromId(agentId: string): string {
  const parts = agentId.split('-');
  return AGENT_CODENAMES[agentId] || 
    parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function getCodenameFromType(agentType: string | null | undefined): string {
  const typeMap: Record<string, string> = {
    'RENEWAL_MANAGEMENT': 'Clockwork',
    'COMPLIANCE_CHECK': 'Vigil',
    'RISK_ASSESSMENT': 'Warden',
    'OPPORTUNITY_DISCOVERY': 'Prospector',
    'VENDOR_CONSOLIDATION': 'Merchant',
    'CONTRACT_CREATION': 'Builder',
    'TERM_ANALYSIS': 'Sage',
  };
  return typeMap[agentType || ''] || 'Agent';
}

function getAvatarFromCodename(codename: string | undefined): string {
  const avatarMap: Record<string, string> = {
    'Sage': '🔮',
    'Sentinel': '🛡️',
    'Vigil': '⚖️',
    'Warden': '🔥',
    'Architect': '🏛️',
    'Prospector': '💎',
    'Merchant': '🤝',
    'Scout': '🎯',
    'Clockwork': '⏰',
    'Conductor': '🎼',
    'Memorykeeper': '📚',
    'Navigator': '🧭',
    'Orchestrator': '🎼',
    'Builder': '🏗️',
    'Synthesizer': '🔄',
    'Guardian': '🛡️',
    'Oracle': '🔮',
    'Operator': '⚙️',
    'Strategist': '🎯',
    'Evolution': '🔄',
  };
  return avatarMap[codename || ''] || '🤖';
}

function getActivityCategory(type: string): string {
  const categoryMap: Record<string, string> = {
    'task_completed': 'task',
    'insight_generated': 'insight',
    'alert_raised': 'alert',
    'recommendation_made': 'recommendation',
    'goal_achieved': 'milestone',
    'approval_requested': 'approval',
    'approval_granted': 'approval',
    'contract_analyzed': 'analysis',
    'risk_detected': 'alert',
    'opportunity_found': 'insight',
  };
  return categoryMap[type] || 'general';
}
