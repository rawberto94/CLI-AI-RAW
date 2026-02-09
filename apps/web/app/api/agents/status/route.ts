/**
 * API Route: GET /api/agents/status
 * Returns agent events and recommendations for a contract
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const agentName = searchParams.get('agentName');

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
    }

    // Verify contract belongs to tenant before proceeding
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true } });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found or access denied', 404);
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
        confidence: true } });

    // Fetch active recommendations
    const recommendations = await prisma.agentRecommendation.findMany({
      where: {
        contractId,
        status: { in: ['pending', 'in_progress'] } },
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
        createdAt: true } });

    return createSuccessResponse(ctx, {
      events: events.map(event => ({
        ...event,
        metadata: event.metadata as any })),
      recommendations: recommendations.map(rec => ({
        ...rec,
        estimatedImpact: rec.estimatedImpact as any })) });
  });
