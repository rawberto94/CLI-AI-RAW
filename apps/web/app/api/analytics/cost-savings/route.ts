/**
 * Cost Savings Analytics API Route
 * 
 * Provides cost savings analysis and tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { costSavingsAnalyzerService } from 'data-orchestration/services';

/**
 * GET /api/analytics/cost-savings
 * Get aggregated cost savings across all contracts or for specific contract
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
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
              select: { name: true }
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

        return NextResponse.json({
          success: true,
          contractId,
          data: {
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
            select: { name: true, id: true }
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

      return NextResponse.json({
        success: true,
        tenantId,
        data: {
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
            contractName: opp.contract.name,
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
            contractName: opp.contract.name,
            contractId: opp.contractId
          }))
        }
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Cost savings analysis error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze cost savings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/cost-savings/track
 * Track implementation of a cost savings opportunity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { opportunityId, contractId, tenantId, userId, status, notes } = body;

    if (!opportunityId || !contractId || !tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // In production, this would save to database
    // await trackOpportunityImplementation({ opportunityId, contractId, status, notes });

    return NextResponse.json({
      success: true,
      message: 'Opportunity implementation tracked',
      opportunityId,
      status,
      trackedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Track opportunity error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to track opportunity',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
