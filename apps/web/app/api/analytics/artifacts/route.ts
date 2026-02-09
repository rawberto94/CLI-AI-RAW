/**
 * Artifact Analytics API Route
 * 
 * Provides analytics and metrics for contract artifacts
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

/**
 * GET /api/analytics/artifacts
 * Get aggregated artifact metrics and analytics
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;

  // Query all artifacts for the tenant
  const artifacts = await prisma.artifact.findMany({
    where: {
      contract: {
        tenantId: tenantId
      }
    },
    include: {
      contract: {
        select: {
          id: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Calculate overall metrics
  const totalArtifacts = artifacts.length;
  const avgConfidence = totalArtifacts > 0
    ? artifacts.reduce((sum, a) => sum + (Number(a.confidence) || 0), 0) / totalArtifacts
    : 0;
  // Note: completeness field doesn't exist in schema, using confidence as proxy
  const avgCompleteness = avgConfidence;
  // Note: validationResults relation doesn't exist, using validationIssues from artifact
  const validationIssues = artifacts.reduce(
    (sum, a) => sum + ((a.validationIssues as any)?.length || 0),
    0
  );

  // Calculate metrics by artifact type
  const artifactTypes = ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK'];
  const byType: Record<string, any> = {};

  for (const type of artifactTypes) {
    const typeArtifacts = artifacts.filter(a => a.type === type);
    const count = typeArtifacts.length;

    byType[type] = {
      count,
      avgConfidence: count > 0
        ? typeArtifacts.reduce((sum, a) => sum + (Number(a.confidence) || 0), 0) / count
        : 0,
      avgCompleteness: count > 0
        ? typeArtifacts.reduce((sum, a) => sum + (Number(a.confidence) || 0), 0) / count
        : 0,
      issues: typeArtifacts.reduce(
        (sum, a) => sum + ((a.validationIssues as any)?.length || 0),
        0
      )
    };
  }

  // Get total cost savings
  const costSavingsAgg = await prisma.costSavingsOpportunity.aggregate({
    where: {
      tenantId: tenantId,
      status: 'identified'
    },
    _sum: {
      potentialSavingsAmount: true
    }
  });

  const costSavingsTotal = Number(costSavingsAgg._sum.potentialSavingsAmount || 0);

  // Get recent activity (last 10 artifacts)
  const recentActivity = artifacts.slice(0, 10).map(a => ({
    id: a.id,
    contractId: a.contract.id,
    artifactType: a.type,
    confidence: Number(a.confidence) || 0,
    completeness: Number(a.confidence) || 0, // using confidence as proxy
    createdAt: a.createdAt.toISOString()
  }));

  return createSuccessResponse(ctx, {
    totalArtifacts,
    avgConfidence,
    avgCompleteness,
    validationIssues,
    costSavingsTotal,
    byType,
    recentActivity
  });
});
