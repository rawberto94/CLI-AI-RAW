/**
 * Agent Transparency Dashboard API
 * 
 * GET /api/ai/agents/dashboard — Aggregate agent health, activity, learning stats
 * 
 * Surfaces background agent activity, learning improvements, quality thresholds,
 * and recent goals so users can see what AI agents are doing behind the scenes.
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;

  // Rate limit: 60 req/min per user (lightweight)
  const rl = checkRateLimit(tenantId, userId, '/api/ai/agents/dashboard', AI_RATE_LIMITS.lightweight);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('range') || '7d'; // 7d, 30d, 90d

  const daysBack = timeRange === '90d' ? 90 : timeRange === '30d' ? 30 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  try {
    // Parallel queries for dashboard data
    const [
      recentGoals,
      goalStats,
      learningRecords,
      qualityThresholds,
      recentRecommendations,
      opportunityDiscoveries,
    ] = await Promise.all([
      // 1. Recent agent goals with step counts
      prisma.agentGoal.findMany({
        where: { tenantId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          progress: true,
          priority: true,
          currentStep: true,
          totalSteps: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          error: true,
          result: true,
        },
      }),

      // 2. Goal status breakdown
      prisma.agentGoal.groupBy({
        by: ['status'],
        where: { tenantId, createdAt: { gte: since } },
        _count: { id: true },
      }),

      // 3. Learning records — recent corrections
      prisma.learningRecord.findMany({
        where: { tenantId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          artifactType: true,
          contractType: true,
          field: true,
          correctionType: true,
          confidence: true,
          modelUsed: true,
          createdAt: true,
        },
      }),

      // 4. Quality thresholds — adaptive thresholds status
      prisma.qualityThreshold.findMany({
        where: { tenantId },
        select: {
          id: true,
          artifactType: true,
          thresholds: true,
          previousThresholds: true,
          adjustmentReason: true,
          adjustmentMagnitude: true,
          updatedAt: true,
        },
      }),

      // 5. Recent agent recommendations
      prisma.agentRecommendation.findMany({
        where: { tenantId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          impact: true,
          confidence: true,
          createdAt: true,
        },
      }),

      // 6. Opportunity discoveries
      prisma.opportunityDiscovery.findMany({
        where: { tenantId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          opportunityType: true,
          title: true,
          description: true,
          potentialValue: true,
          confidence: true,
          effort: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Compute agent performance metrics
    const completedGoals = recentGoals.filter(g => g.status === 'COMPLETED');
    const failedGoals = recentGoals.filter(g => g.status === 'FAILED');
    const avgCompletionTime = completedGoals.length > 0
      ? completedGoals.reduce((sum, g) => {
          if (g.startedAt && g.completedAt) {
            return sum + (new Date(g.completedAt).getTime() - new Date(g.startedAt).getTime());
          }
          return sum;
        }, 0) / completedGoals.filter(g => g.startedAt && g.completedAt).length
      : 0;

    // Learning improvement metrics
    const correctionsByField = learningRecords.reduce((acc, r) => {
      acc[r.field] = (acc[r.field] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const correctionsByType = learningRecords.reduce((acc, r) => {
      const t = r.correctionType || 'unknown';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status breakdown map
    const statusMap = goalStats.reduce((acc, g) => {
      acc[g.status] = g._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Total opportunity value
    const totalOpportunityValue = opportunityDiscoveries.reduce(
      (sum, o) => sum + Number(o.potentialValue || 0),
      0
    );

    return NextResponse.json({
      timeRange,
      overview: {
        totalGoals: recentGoals.length,
        statusBreakdown: statusMap,
        successRate: recentGoals.length > 0
          ? Math.round((completedGoals.length / recentGoals.length) * 100)
          : 0,
        failureRate: recentGoals.length > 0
          ? Math.round((failedGoals.length / recentGoals.length) * 100)
          : 0,
        avgCompletionTimeMs: Math.round(avgCompletionTime),
        totalLearningRecords: learningRecords.length,
        totalRecommendations: recentRecommendations.length,
        totalOpportunities: opportunityDiscoveries.length,
        totalOpportunityValue,
      },
      goals: recentGoals,
      learning: {
        records: learningRecords.slice(0, 20),
        correctionsByField,
        correctionsByType,
        totalCorrections: learningRecords.length,
      },
      qualityThresholds,
      recommendations: recentRecommendations,
      opportunities: opportunityDiscoveries,
    });
  } catch (error) {
    console.error('[Agent Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent dashboard data' },
      { status: 500 }
    );
  }
});
