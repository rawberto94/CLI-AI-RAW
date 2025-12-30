/**
 * API Route: GET /api/agents/dashboard-stats
 * Returns aggregated statistics for the AI Insights dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'current-tenant'; // Get from auth

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      totalEvents,
      activeRecommendations,
      opportunities,
      contracts,
      learningRecords,
    ] = await Promise.all([
      // Total agent events in last 30 days
      prisma.agentEvent.count({
        where: {
          tenantId,
          timestamp: { gte: thirtyDaysAgo },
        },
      }),

      // Active recommendations
      prisma.agentRecommendation.count({
        where: {
          tenantId,
          status: { in: ['pending', 'in_progress'] },
        },
      }),

      // Opportunities summary
      prisma.opportunityDiscovery.aggregate({
        where: {
          tenantId,
          status: { in: ['new', 'reviewing', 'in_progress'] },
        },
        _sum: { potentialValue: true },
        _count: true,
      }),

      // Contract health data (requires contractMetadata or health events)
      prisma.contract.findMany({
        where: { tenantId },
        select: { id: true },
        take: 1000, // Limit for performance
      }),

      // Learning records in last 30 days
      prisma.learningRecord.count({
        where: {
          tenantId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    // Get health assessments from recent events
    const healthEvents = await prisma.agentEvent.findMany({
      where: {
        tenantId,
        agentName: 'contract-health-monitor',
        eventType: 'health_assessment',
        timestamp: { gte: thirtyDaysAgo },
      },
      select: {
        contractId: true,
        metadata: true,
      },
      orderBy: { timestamp: 'desc' },
      distinct: ['contractId'],
    });

    // Calculate health stats
    let totalHealthScore = 0;
    let healthyContracts = 0;
    let atRiskContracts = 0;

    healthEvents.forEach((event) => {
      const metadata = event.metadata as any;
      const score = metadata?.score || 0;
      totalHealthScore += score;

      if (score >= 75) {
        healthyContracts++;
      } else if (score < 50) {
        atRiskContracts++;
      }
    });

    const avgHealthScore = healthEvents.length > 0 
      ? Math.round(totalHealthScore / healthEvents.length) 
      : 0;

    return NextResponse.json({
      totalEvents,
      activeRecommendations,
      totalOpportunityValue: Number(opportunities._sum.potentialValue || 0),
      opportunitiesCount: opportunities._count,
      healthyContracts,
      atRiskContracts,
      avgHealthScore,
      learningRecords,
      totalContracts: contracts.length,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
