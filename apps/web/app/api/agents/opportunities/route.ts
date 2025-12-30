/**
 * API Route: GET /api/agents/opportunities
 * Returns discovered opportunities for a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { opportunityDiscoveryEngine } from '@repo/workers/agents';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const contractId = searchParams.get('contractId');
    const minValue = parseInt(searchParams.get('minValue') || '0');
    const opportunityType = searchParams.get('type');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // If contractId provided, get opportunities for specific contract
    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          artifacts: {
            include: { data: true },
          },
        },
      });

      if (!contract) {
        return NextResponse.json(
          { error: 'Contract not found' },
          { status: 404 }
        );
      }

      const result = await opportunityDiscoveryEngine.executeWithTracking({
        contractId,
        tenantId,
        context: { contract },
        triggeredBy: 'api',
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Opportunity discovery failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        opportunities: result.output?.opportunities || [],
        totalValue: result.output?.opportunities?.reduce(
          (sum: number, opp: any) => sum + (opp.potentialValue || 0),
          0
        ) || 0,
      });
    }

    // Otherwise, get all opportunities for tenant
    const events = await prisma.agentEvent.findMany({
      where: {
        tenantId,
        agentName: 'opportunity-discovery-engine',
        eventType: 'opportunity_discovered',
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { timestamp: 'desc' },
      select: {
        contractId: true,
        metadata: true,
        timestamp: true,
      },
    });

    // Extract opportunities from metadata
    let opportunities = events
      .flatMap((event: any) => {
        const metadata = event.metadata as any;
        return (metadata?.opportunities || []).map((opp: any) => ({
          ...opp,
          contractId: event.contractId,
          discoveredAt: event.timestamp,
        }));
      })
      .filter((opp: any) => {
        // Apply filters
        if (minValue && opp.potentialValue < minValue) return false;
        if (opportunityType && opp.type !== opportunityType) return false;
        return true;
      });

    // Calculate total value
    const totalValue = opportunities.reduce(
      (sum: number, opp: any) => sum + (opp.potentialValue || 0),
      0
    );

    // Sort by value descending
    opportunities.sort((a: any, b: any) => b.potentialValue - a.potentialValue);

    return NextResponse.json({
      opportunities: opportunities.slice(0, 50), // Limit to 50
      totalValue,
      count: opportunities.length,
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
