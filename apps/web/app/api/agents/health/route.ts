/**
 * API Route: GET /api/agents/health
 * Returns contract health assessment
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractHealthMonitor } from '@repo/workers/agents';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const tenantId = searchParams.get('tenantId');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!contractId || !tenantId) {
      return NextResponse.json(
        { error: 'contractId and tenantId are required' },
        { status: 400 }
      );
    }

    // Check for cached health report (< 1 hour old)
    if (!forceRefresh) {
      const cachedReport = await prisma.agentEvent.findFirst({
        where: {
          contractId,
          agentName: 'contract-health-monitor',
          eventType: 'health_assessment',
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour
          },
        },
        orderBy: { timestamp: 'desc' },
        select: {
          metadata: true,
          timestamp: true,
        },
      });

      if (cachedReport) {
        return NextResponse.json({
          health: cachedReport.metadata,
          cached: true,
          timestamp: cachedReport.timestamp,
        });
      }
    }

    // Fetch fresh health assessment
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Execute health monitor
    const result = await contractHealthMonitor.executeWithTracking({
      contractId,
      tenantId,
      context: { contract },
      metadata: {
        triggeredBy: 'system',
        priority: 'medium',
        timestamp: new Date(),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.reasoning || 'Health assessment failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      health: result.data,
      cached: false,
      timestamp: new Date(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
