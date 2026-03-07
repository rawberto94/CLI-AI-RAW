/**
 * Contract Details API - Simplified for Frontend
 * GET /api/contracts/[id]/details - Get contract with artifacts in frontend format
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = ctx.tenantId;

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    // Fetch contract with artifacts - scoped to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        artifacts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Transform artifacts to frontend format
    const transformedArtifacts = contract.artifacts.map(artifact => {
      const artifactData = artifact.data as any || {};
      return {
        type: artifact.type,
        data: artifact.data,
        confidence: Number(artifact.confidence || 0),
        completeness: artifactData.completeness || 0,
        method: artifactData.method || 'ai',
        processingTime: artifactData.processingTime || 0,
        validationResults: artifactData.validationResults
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
    } catch {
      // Cost savings fetch failed
    }

    // Return data in frontend format
    const responseData = {
      id: contract.id,
      name: contract.fileName || 'Untitled Contract',
      status: contract.status?.toLowerCase() || 'active',
      uploadedAt: contract.createdAt.toISOString(),
      artifacts: transformedArtifacts,
      costSavings
    };

    return createSuccessResponse(ctx, {
      success: true,
      data: responseData
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
