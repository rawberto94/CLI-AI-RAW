/**
 * Agent Ecosystem Status API
 * 
 * GET /api/agents/status - Get overall Contigo Lab status
 * 
 * Dashboard overview with stats, agent health, and recent activity
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const CLUSTER_CONFIG = {
  guardians: {
    name: 'Guardians',
    color: '#3b82f6',
    icon: '🛡️',
    agents: ['sentinel', 'vigil', 'warden', 'proactive-validation-agent', 'compliance-monitoring-agent', 'proactive-risk-detector'],
  },
  oracles: {
    name: 'Oracles',
    color: '#8b5cf6',
    icon: '🔮',
    agents: ['sage', 'prospector', 'scout', 'intelligent-search-agent', 'opportunity-discovery-engine', 'rfx-detection-agent'],
  },
  operators: {
    name: 'Operators',
    color: '#10b981',
    icon: '⚙️',
    agents: ['clockwork', 'conductor', 'architect', 'autonomous-deadline-manager', 'conflict-resolution-agent', 'workflow-authoring-agent'],
  },
  strategists: {
    name: 'Strategists',
    color: '#f59e0b',
    icon: '🎯',
    agents: ['merchant', 'navigator', 'memorykeeper', 'rfx-procurement-agent', 'onboarding-coach-agent', 'contract-transformation-agent'],
  },
  evolution: {
    name: 'Evolution',
    color: '#ec4899',
    icon: '🔄',
    agents: ['orchestrator', 'builder', 'synthesizer', 'workflow-orchestrator-agent', 'template-generation-agent', 'data-synthesizer-agent'],
  },
};

const AGENT_METADATA: Record<string, { codename: string; cluster: string; avatar: string }> = {
  'proactive-validation-agent': { codename: 'Sentinel', cluster: 'guardians', avatar: '🛡️' },
  'compliance-monitoring-agent': { codename: 'Vigil', cluster: 'guardians', avatar: '⚖️' },
  'proactive-risk-detector': { codename: 'Warden', cluster: 'guardians', avatar: '🔥' },
  'intelligent-search-agent': { codename: 'Sage', cluster: 'oracles', avatar: '🔮' },
  'opportunity-discovery-engine': { codename: 'Prospector', cluster: 'oracles', avatar: '💎' },
  'rfx-detection-agent': { codename: 'Scout', cluster: 'oracles', avatar: '🎯' },
  'autonomous-deadline-manager': { codename: 'Clockwork', cluster: 'operators', avatar: '⏰' },
  'conflict-resolution-agent': { codename: 'Conductor', cluster: 'operators', avatar: '🎼' },
  'workflow-authoring-agent': { codename: 'Architect', cluster: 'operators', avatar: '🏛️' },
  'rfx-procurement-agent': { codename: 'Merchant', cluster: 'strategists', avatar: '🤝' },
  'onboarding-coach-agent': { codename: 'Navigator', cluster: 'strategists', avatar: '🧭' },
  'contract-transformation-agent': { codename: 'Memorykeeper', cluster: 'strategists', avatar: '📚' },
  'workflow-orchestrator-agent': { codename: 'Orchestrator', cluster: 'evolution', avatar: '🎼' },
  'template-generation-agent': { codename: 'Builder', cluster: 'evolution', avatar: '🏗️' },
  'data-synthesizer-agent': { codename: 'Synthesizer', cluster: 'evolution', avatar: '🔄' },
};

/**
 * GET /api/agents/status
 * 
 * Returns overall Contigo Lab status dashboard data
 */
export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;

  try {
    // Try cache first (30 second TTL for status)
    const cacheKey = `status:${tenantId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return createSuccessResponse(ctx, JSON.parse(cached), { cached: true });
    }

    // Gather all status data in parallel
    const [
      agentHealth,
      pendingApprovals,
      recentActivity,
      opportunityStats,
      performanceMetrics,
      agentGoals,
      workflowStats,
      alertStats,
    ] = await Promise.all([
      getAgentHealth(tenantId),
      getPendingApprovalsCount(tenantId),
      getRecentActivity(tenantId),
      getOpportunityStats(tenantId),
      getPerformanceMetrics(tenantId),
      getAgentGoalsStats(tenantId),
      getWorkflowStats(tenantId),
      getAlertStats(tenantId),
    ]);

    const status = {
      overview: {
        totalAgents: Object.keys(AGENT_METADATA).length,
        activeAgents: agentHealth.filter(a => a.status === 'healthy').length,
        pendingApprovals,
        lastScan: new Date().toISOString(),
      },
      clusters: Object.entries(CLUSTER_CONFIG).map(([id, config]) => ({
        id,
        name: config.name,
        icon: config.icon,
        color: config.color,
        agents: agentHealth.filter(a => config.agents.includes(a.id)),
        stats: {
          healthy: agentHealth.filter(a => config.agents.includes(a.id) && a.status === 'healthy').length,
          warning: agentHealth.filter(a => config.agents.includes(a.id) && a.status === 'warning').length,
          error: agentHealth.filter(a => config.agents.includes(a.id) && a.status === 'error').length,
        },
      })),
      metrics: {
        ...performanceMetrics,
        ...opportunityStats,
        ...agentGoals,
        ...workflowStats,
        ...alertStats,
      },
      recentActivity,
      quickActions: [
        {
          id: 'scan-opportunities',
          label: 'Scan for RFx Opportunities',
          agent: 'scout',
          icon: '🔍',
          href: '/api/agents/rfx-opportunities/detect',
        },
        {
          id: 'review-approvals',
          label: 'Review Pending Approvals',
          icon: '✅',
          href: '/contigo-lab?tab=approvals',
          badge: pendingApprovals > 0 ? pendingApprovals.toString() : null,
        },
        {
          id: 'check-alerts',
          label: 'Check Compliance Alerts',
          agent: 'vigil',
          icon: '⚠️',
          href: '/contigo-lab?tab=alerts',
          badge: alertStats.unacknowledgedAlerts > 0 ? alertStats.unacknowledgedAlerts.toString() : null,
        },
        {
          id: 'create-rfx',
          label: 'Create New RFx',
          agent: 'merchant',
          icon: '📋',
          href: '/contigo-lab?action=create_rfx',
        },
      ],
    };

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(status));

    return createSuccessResponse(ctx, status);
  } catch (error) {
    logger.error('Failed to get agent status:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to get agent status', 500);
  }
});

// ============================================================================
// DATA GATHERING FUNCTIONS
// ============================================================================

async function getAgentHealth(tenantId: string) {
  // Get recent execution status for each agent
  const recentExecutions = await prisma.agentPerformanceLog.groupBy({
    by: ['agentType'],
    where: {
      tenantId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    _count: { id: true },
    _max: { createdAt: true },
  });

  // AgentPerformanceLog has no 'status' field, so we use qualityScore as a proxy:
  // low quality scores (< 0.3) indicate failures
  const failedExecutions = await prisma.agentPerformanceLog.groupBy({
    by: ['agentType'],
    where: {
      tenantId,
      qualityScore: { lt: 0.3 },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    _count: { id: true },
  });

  const failedMap = new Map(failedExecutions.map(f => [f.agentType, f._count.id]));

  return Object.entries(AGENT_METADATA).map(([id, meta]) => {
    const exec = recentExecutions.find(e => e.agentType === id);
    const failed = (failedMap.get(id) as number) || 0;
    const total = exec?._count.id || 0;
    const lastActive = exec?._max.createdAt;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (failed > 0 && total > 0 && failed / total > 0.5) status = 'error';
    else if (failed > 0) status = 'warning';
    else if (!lastActive || new Date().getTime() - new Date(lastActive).getTime() > 7 * 24 * 60 * 60 * 1000) {
      status = 'warning';
    }

    return {
      id,
      ...meta,
      status,
      lastActive: lastActive?.toISOString() || null,
      executions24h: total,
      failures24h: failed,
    };
  });
}

async function getPendingApprovalsCount(tenantId: string): Promise<number> {
  const [
    agentGoals,
    rfxEvents,
    complianceAlerts,
    renewalAlerts,
  ] = await Promise.all([
    prisma.agentGoal.count({
      where: { tenantId, status: 'AWAITING_APPROVAL' },
    }),
    prisma.rFxEvent.count({
      where: { tenantId, status: { in: ['open', 'published'] } },
    }),
    prisma.riskDetectionLog.count({
      where: {
        tenantId,
        acknowledged: false,
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    }),
    prisma.contract.count({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        expirationDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
        renewalInitiatedAt: null,
      },
    }),
  ]);

  return agentGoals + rfxEvents + complianceAlerts + renewalAlerts;
}

async function getRecentActivity(tenantId: string) {
  const activities = await prisma.agentEvent.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });

  return activities.map(a => ({
    id: a.id,
    type: a.eventType,
    agentCodename: AGENT_METADATA[a.agentName]?.codename || a.agentName || 'Agent',
    agentAvatar: AGENT_METADATA[a.agentName]?.avatar || '🤖',
    title: a.eventType,
    description: a.reasoning || a.outcome,
    timestamp: a.timestamp.toISOString(),
    importance: 'normal',
  }));
}

async function getOpportunityStats(tenantId: string) {
  const [
    totalOpportunities,
    byAlgorithm,
    totalSavings,
  ] = await Promise.all([
    prisma.rFxOpportunity.count({
      where: { tenantId },
    }),
    prisma.rFxOpportunity.groupBy({
      by: ['algorithm'],
      where: { tenantId, status: { in: ['IDENTIFIED', 'UNDER_REVIEW'] } },
      _count: { id: true },
    }),
    prisma.rFxOpportunity.aggregate({
      where: { tenantId },
      _sum: { savingsPotential: true },
    }),
  ]);

  return {
    totalOpportunities,
    opportunitiesByAlgorithm: byAlgorithm.reduce((acc, curr) => {
      acc[curr.algorithm] = curr._count.id;
      return acc;
    }, {} as Record<string, number>),
    totalSavingsPotential: totalSavings._sum.savingsPotential || 0,
  };
}

async function getPerformanceMetrics(tenantId: string) {
  const [
    executions24h,
    avgExecutionTime,
  ] = await Promise.all([
    prisma.agentPerformanceLog.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.agentPerformanceLog.aggregate({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      _avg: {
        executionTime: true,
      },
    }),
  ]);

  return {
    executions24h,
    avgExecutionTimeMs: avgExecutionTime._avg.executionTime || 0,
    successRate: executions24h > 0 ? 100 : 100,
  };
}

async function getAgentGoalsStats(tenantId: string) {
  const [
    activeGoals,
    completedGoals,
    failedGoals,
    goalsByType,
  ] = await Promise.all([
    prisma.agentGoal.count({
      where: { tenantId, status: { in: ['EXECUTING', 'PLANNING'] } },
    }),
    prisma.agentGoal.count({
      where: { tenantId, status: 'COMPLETED' },
    }),
    prisma.agentGoal.count({
      where: { tenantId, status: 'FAILED' },
    }),
    prisma.agentGoal.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: { id: true },
    }),
  ]);

  return {
    activeGoals,
    completedGoals,
    failedGoals,
    goalsByType: goalsByType.reduce((acc, curr) => {
      acc[curr.type || 'UNKNOWN'] = curr._count.id;
      return acc;
    }, {} as Record<string, number>),
  };
}

async function getWorkflowStats(tenantId: string) {
  const [
    activeWorkflows,
    completedWorkflows,
    failedWorkflows,
  ] = await Promise.all([
    prisma.agentGoal.count({
      where: { tenantId, status: { in: ['EXECUTING', 'PENDING'] } },
    }),
    prisma.agentGoal.count({
      where: { tenantId, status: 'COMPLETED' },
    }),
    prisma.agentGoal.count({
      where: { tenantId, status: 'FAILED' },
    }),
  ]);

  return {
    activeWorkflows,
    completedWorkflows,
    failedWorkflows,
  };
}

async function getAlertStats(tenantId: string) {
  const [
    unacknowledgedAlerts,
    criticalAlerts,
    highAlerts,
  ] = await Promise.all([
    prisma.riskDetectionLog.count({
      where: { tenantId, acknowledged: false },
    }),
    prisma.riskDetectionLog.count({
      where: { tenantId, acknowledged: false, severity: 'CRITICAL' },
    }),
    prisma.riskDetectionLog.count({
      where: { tenantId, acknowledged: false, severity: 'HIGH' },
    }),
  ]);

  return {
    unacknowledgedAlerts,
    criticalAlerts,
    highAlerts,
  };
}
