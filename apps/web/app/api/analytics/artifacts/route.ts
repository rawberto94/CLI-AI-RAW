/**
 * Artifact Analytics API Route
 * 
 * Provides analytics and metrics for contract artifacts.
 * Uses completenessScore (not confidence) for completeness metrics.
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
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
  // Use actual completenessScore field from schema (not confidence proxy)
  const avgCompleteness = totalArtifacts > 0
    ? artifacts.reduce((sum, a) => sum + (Number(a.completenessScore) || 0), 0) / totalArtifacts
    : 0;
  const avgQualityScore = totalArtifacts > 0
    ? artifacts.reduce((sum, a) => sum + (Number(a.qualityScore) || 0), 0) / totalArtifacts
    : 0;
  const validationIssues = artifacts.reduce(
    (sum, a) => sum + ((a.validationIssues as any)?.length || 0),
    0
  );

  // Feedback metrics
  const withFeedback = artifacts.filter(a => a.userRating !== null);
  const avgUserRating = withFeedback.length > 0
    ? withFeedback.reduce((sum, a) => sum + (a.userRating || 0), 0) / withFeedback.length
    : null;
  const verifiedCount = artifacts.filter(a => a.isUserVerified).length;

  // Calculate metrics by artifact type (include all known types)
  const artifactTypes = ['OVERVIEW', 'CLAUSES', 'FINANCIAL', 'RISK', 'COMPLIANCE', 'OBLIGATIONS', 
    'RENEWAL', 'NEGOTIATION_POINTS', 'AMENDMENTS', 'CONTACTS', 'PARTIES', 'TIMELINE', 
    'DELIVERABLES', 'EXECUTIVE_SUMMARY', 'RATES'];
  const byType: Record<string, any> = {};

  for (const type of artifactTypes) {
    const typeArtifacts = artifacts.filter(a => a.type === type);
    const count = typeArtifacts.length;
    if (count === 0) continue; // Skip types with no artifacts

    byType[type] = {
      count,
      avgConfidence: count > 0
        ? typeArtifacts.reduce((sum, a) => sum + (Number(a.confidence) || 0), 0) / count
        : 0,
      avgCompleteness: count > 0
        ? typeArtifacts.reduce((sum, a) => sum + (Number(a.completenessScore) || 0), 0) / count
        : 0,
      avgQualityScore: count > 0
        ? typeArtifacts.reduce((sum, a) => sum + (Number(a.qualityScore) || 0), 0) / count
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
    completeness: Number(a.completenessScore) || 0,
    qualityScore: Number(a.qualityScore) || 0,
    createdAt: a.createdAt.toISOString()
  }));

  return createSuccessResponse(ctx, {
    totalArtifacts,
    avgConfidence,
    avgCompleteness,
    avgQualityScore,
    avgUserRating,
    verifiedCount,
    feedbackCount: withFeedback.length,
    validationIssues,
    costSavingsTotal,
    byType,
    recentActivity
  });
});
