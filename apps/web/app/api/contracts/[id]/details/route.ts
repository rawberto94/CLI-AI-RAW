/**
 * Contract Details API - Simplified for Frontend
 * GET /api/contracts/[id]/details - Get contract with artifacts in frontend format
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Fetch contract with artifacts
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Transform artifacts to frontend format
    const transformedArtifacts = contract.artifacts.map(artifact => {
      const metadata = artifact.metadata as any || {};
      return {
        type: artifact.type,
        data: artifact.data,
        confidence: Number(artifact.confidence || 0),
        completeness: metadata.completeness || 0,
        method: metadata.method || 'ai',
        processingTime: metadata.processingTime || 0,
        validationResults: metadata.validationResults
      };
    });

    // Fetch cost savings opportunities
    let costSavings = null;
    try {
      const opportunities = await prisma.costSavingsOpportunity.findMany({
        where: {
          contractId: contractId,
          status: 'identified'
        },
        orderBy: {
          potentialSavingsAmount: 'desc'
        }
      });

      if (opportunities.length > 0) {
        const totalSavings = opportunities.reduce(
          (sum, opp) => sum + Number(opp.potentialSavingsAmount),
          0
        );

        const transformedOpportunities = opportunities.map(opp => ({
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
          actionItems: opp.actionItems as string[],
          implementationTimeline: opp.implementationTimeline,
          risks: opp.risks as string[]
        }));

        const quickWins = transformedOpportunities.filter(
          opp => opp.confidence === 'high' && opp.effort === 'low'
        );

        const strategicInitiatives = transformedOpportunities.filter(
          opp => opp.potentialSavings.amount > 50000
        );

        costSavings = {
          totalPotentialSavings: {
            amount: totalSavings,
            currency: 'USD',
            percentage: 0
          },
          opportunities: transformedOpportunities,
          quickWins,
          strategicInitiatives,
          summary: {
            opportunityCount: opportunities.length,
            averageSavingsPerOpportunity: opportunities.length > 0 ? totalSavings / opportunities.length : 0,
            highConfidenceOpportunities: opportunities.filter(o => o.confidence === 'high').length
          }
        };
      }
    } catch (costSavingsError) {
      console.error('Error fetching cost savings:', costSavingsError);
    }

    // Return data in frontend format
    const responseData = {
      id: contract.id,
      name: contract.name || contract.fileName || 'Untitled Contract',
      status: contract.status?.toLowerCase() || 'active',
      uploadedAt: contract.createdAt.toISOString(),
      artifacts: transformedArtifacts,
      costSavings
    };

    return NextResponse.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching contract details:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch contract details',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
