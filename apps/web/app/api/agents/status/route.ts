/**
 * API Route: GET /api/agents/status
 * Returns agent events and recommendations for a contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const agentName = searchParams.get('agentName');

    if (!contractId) {
      return NextResponse.json(
        { error: 'contractId is required' },
        { status: 400 }
      );
    }

    // Verify contract belongs to tenant before proceeding
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found or access denied' },
        { status: 404 }
      );
    }

    // Build filter
    const where: { contractId: string; agentName?: string } = { contractId };
    if (agentName) {
      where.agentName = agentName;
    }

    // Fetch agent events
    const events = await prisma.agentEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        agentName: true,
        eventType: true,
        timestamp: true,
        outcome: true,
        metadata: true,
        reasoning: true,
        confidence: true,
      },
    });

    // Fetch active recommendations
    const recommendations = await prisma.agentRecommendation.findMany({
      where: {
        contractId,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 20,
      select: {
        id: true,
        agentName: true,
        action: true,
        description: true,
        priority: true,
        automated: true,
        estimatedImpact: true,
        potentialValue: true,
        confidence: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      events: events.map(event => ({
        ...event,
        metadata: event.metadata as any,
      })),
      recommendations: recommendations.map(rec => ({
        ...rec,
        estimatedImpact: rec.estimatedImpact as any,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
