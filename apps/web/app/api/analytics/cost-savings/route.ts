/**
 * Cost Savings Analytics API Route
 * 
 * Provides cost savings analysis and tracking
 */

import { NextRequest } from 'next/server';
import { costSavingsAnalyzerService as _costSavingsAnalyzerService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

/**
 * GET /api/analytics/cost-savings
 * Get aggregated cost savings across all contracts or for specific contract
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'TENANT_REQUIRED', 'Tenant ID required', 400);
  }

  if (contractId) {
    // Get cost savings for specific contract
    const opportunities = await prisma.costSavingsOpportunity.findMany({
      where: {
        contractId,
        tenantId,
        status: 'identified'
      },
      include: {
        contract: {
          select: { id: true, fileName: true }
        }
      },
      orderBy: {
        potentialSavingsAmount: 'desc'
      }
    });

    const totalSavings = opportunities.reduce(
      (sum, opp) => sum + Number(opp.potentialSavingsAmount),
      0
    );

    const quickWins = opportunities.filter(
      opp => opp.confidence === 'high' && opp.effort === 'low'
    );

    const strategicInitiatives = opportunities.filter(
      opp => Number(opp.potentialSavingsAmount) > 50000
    );

    return createSuccessResponse(ctx, {
      contractId,
      totalPotentialSavings: {
        amount: totalSavings,
        currency: 'USD',
        percentage: 0 // Calculate based on contract value if available
      },
      opportunities: opportunities.map(opp => ({
        id: opp.id,
        category: opp.category,
        title: opp.title,
        description: opp.description,
        potentialSavings: {
          amount: Number(opp.potentialSavingsAmount),
          currency: opp.potentialSavingsCurrency,
          percentage: Number(opp.potentialSavingsPercentage || 0),
          timeframe: opp.timeframe
        },
        confidence: opp.confidence,
        effort: opp.effort,
        priority: opp.priority,
        actionItems: opp.actionItems,
        implementationTimeline: opp.implementationTimeline,
        risks: opp.risks,
        status: opp.status
      })),
      quickWins: quickWins.map(opp => ({
        id: opp.id,
        title: opp.title,
        amount: Number(opp.potentialSavingsAmount),
        confidence: opp.confidence
      })),
      strategicInitiatives: strategicInitiatives.map(opp => ({
        id: opp.id,
        title: opp.title,
        amount: Number(opp.potentialSavingsAmount),
        effort: opp.effort
      })),
      summary: {
        opportunityCount: opportunities.length,
        averageSavingsPerOpportunity: opportunities.length > 0 ? totalSavings / opportunities.length : 0,
        highConfidenceOpportunities: opportunities.filter(o => o.confidence === 'high').length
      }
    });
  }

  // Get aggregated cost savings across all contracts
  const opportunities = await prisma.costSavingsOpportunity.findMany({
    where: {
      tenantId,
      status: 'identified'
    },
    include: {
      contract: {
        select: { id: true, fileName: true }
      }
    },
    orderBy: {
      potentialSavingsAmount: 'desc'
    }
  });

  const totalSavings = opportunities.reduce(
    (sum, opp) => sum + Number(opp.potentialSavingsAmount),
    0
  );

  const quickWins = opportunities.filter(
    opp => opp.confidence === 'high' && opp.effort === 'low'
  );

  const strategicInitiatives = opportunities.filter(
    opp => Number(opp.potentialSavingsAmount) > 50000
  );

  // Group by category
  const byCategory: Record<string, number> = {};
  opportunities.forEach(opp => {
    byCategory[opp.category] = (byCategory[opp.category] || 0) + Number(opp.potentialSavingsAmount);
  });

  // Get unique contracts
  const uniqueContracts = new Set(opportunities.map(o => o.contractId));

  return createSuccessResponse(ctx, {
    tenantId,
    totalContracts: uniqueContracts.size,
    totalPotentialSavings: totalSavings,
    currency: 'USD',
    totalOpportunities: opportunities.length,
    quickWinsCount: quickWins.length,
    strategicInitiativesCount: strategicInitiatives.length,
    byCategory,
    topOpportunities: opportunities.slice(0, 5).map(opp => ({
      id: opp.id,
      title: opp.title,
      amount: Number(opp.potentialSavingsAmount),
      confidence: opp.confidence,
      contractName: opp.contract?.fileName || 'Unknown',
      contractId: opp.contractId
    })),
    opportunities: opportunities.map(opp => ({
      id: opp.id,
      category: opp.category,
      title: opp.title,
      description: opp.description,
      potentialSavings: {
        amount: Number(opp.potentialSavingsAmount),
        currency: opp.potentialSavingsCurrency,
        percentage: Number(opp.potentialSavingsPercentage || 0),
        timeframe: opp.timeframe
      },
      confidence: opp.confidence,
      effort: opp.effort,
      priority: opp.priority,
      contractName: opp.contract?.fileName || 'Unknown',
      contractId: opp.contractId
    }))
  });
});

/**
 * POST /api/analytics/cost-savings/track
 * Track implementation of a cost savings opportunity
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { opportunityId, contractId, status, notes: _notes } = body;
  const tenantId = ctx.tenantId;

  if (!opportunityId || !contractId || !tenantId || !ctx.userId) {
    return createErrorResponse(ctx, 'MISSING_FIELDS', 'Missing required fields', 400);
  }

  const opportunity = await prisma.costSavingsOpportunity.findFirst({
    where: {
      id: opportunityId,
      contractId,
      tenantId,
    },
    select: { id: true },
  });

  if (!opportunity) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Opportunity not found', 404);
  }

  // In production, this would save to database
  // await trackOpportunityImplementation({ opportunityId, contractId, status, notes });

  return createSuccessResponse(ctx, {
    message: 'Opportunity implementation tracked',
    opportunityId,
    status,
    trackedAt: new Date().toISOString()
  });
});
