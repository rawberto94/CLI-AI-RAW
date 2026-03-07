/**
 * Artifact A/B Analytics API Route
 * 
 * Compares artifact quality metrics across different prompt versions and models.
 * Enables data-driven decisions about which prompt/model combination produces
 * the best results for each artifact type.
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

interface VariantStats {
  variant: string;
  count: number;
  avgQualityScore: number;
  avgCompleteness: number;
  avgConfidence: number;
  avgUserRating: number | null;
  ratingCount: number;
  verifiedCount: number;
  avgProcessingTime: number | null;
  failureRate: number;
}

function computeVariantStats(artifacts: any[], variantKey: string): VariantStats[] {
  const grouped = new Map<string, any[]>();
  
  for (const a of artifacts) {
    const variant = a[variantKey] || 'unknown';
    if (!grouped.has(variant)) grouped.set(variant, []);
    grouped.get(variant)!.push(a);
  }

  const stats: VariantStats[] = [];
  for (const [variant, items] of grouped) {
    const count = items.length;
    const withRating = items.filter((a: any) => a.userRating !== null);
    const withProcessingTime = items.filter((a: any) => a.processingTime !== null);
    const failed = items.filter((a: any) => a.validationStatus === 'FAILED');

    stats.push({
      variant,
      count,
      avgQualityScore: count > 0
        ? items.reduce((s: number, a: any) => s + (Number(a.qualityScore) || 0), 0) / count
        : 0,
      avgCompleteness: count > 0
        ? items.reduce((s: number, a: any) => s + (Number(a.completenessScore) || 0), 0) / count
        : 0,
      avgConfidence: count > 0
        ? items.reduce((s: number, a: any) => s + (Number(a.confidence) || 0), 0) / count
        : 0,
      avgUserRating: withRating.length > 0
        ? withRating.reduce((s: number, a: any) => s + (a.userRating || 0), 0) / withRating.length
        : null,
      ratingCount: withRating.length,
      verifiedCount: items.filter((a: any) => a.isUserVerified).length,
      avgProcessingTime: withProcessingTime.length > 0
        ? withProcessingTime.reduce((s: number, a: any) => s + (a.processingTime || 0), 0) / withProcessingTime.length
        : null,
      failureRate: count > 0 ? failed.length / count : 0,
    });
  }

  return stats.sort((a, b) => (b.avgQualityScore || 0) - (a.avgQualityScore || 0));
}

/**
 * GET /api/analytics/artifacts/ab
 * 
 * Query params:
 * - groupBy: 'promptVersion' | 'modelUsed' (default: promptVersion)
 * - artifactType: filter to specific type (optional)
 * - since: ISO date string, filter artifacts created after this date (optional)
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const groupBy = searchParams.get('groupBy') || 'promptVersion';
  const artifactType = searchParams.get('artifactType');
  const since = searchParams.get('since');

  if (!['promptVersion', 'modelUsed'].includes(groupBy)) {
    return createSuccessResponse(ctx, { error: 'groupBy must be promptVersion or modelUsed' });
  }

  const where: Record<string, unknown> = {
    contract: { tenantId },
  };

  if (artifactType) {
    where.type = artifactType;
  }

  if (since) {
    where.createdAt = { gte: new Date(since) };
  }

  const artifacts = await prisma.artifact.findMany({
    where: where as any,
    select: {
      id: true,
      type: true,
      promptVersion: true,
      modelUsed: true,
      qualityScore: true,
      completenessScore: true,
      confidence: true,
      userRating: true,
      isUserVerified: true,
      processingTime: true,
      validationStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5000, // reasonable limit for analytics
  });

  // Overall stats grouped by the selected dimension
  const overallStats = computeVariantStats(artifacts, groupBy);

  // Per-type breakdown
  const types = [...new Set(artifacts.map(a => a.type))];
  const byType: Record<string, VariantStats[]> = {};
  for (const type of types) {
    const typeArtifacts = artifacts.filter(a => a.type === type);
    byType[type] = computeVariantStats(typeArtifacts, groupBy);
  }

  // Statistical significance hint: need at least 30 samples per variant
  const significanceWarnings: string[] = [];
  for (const stat of overallStats) {
    if (stat.count < 30) {
      significanceWarnings.push(
        `Variant "${stat.variant}" has only ${stat.count} samples (need 30+ for reliable comparison)`
      );
    }
  }

  // Best performing variant
  const bestByQuality = overallStats[0]; // already sorted desc by quality
  const ratedVariants = overallStats.filter(s => s.ratingCount >= 5);
  const bestByUserRating = ratedVariants.length > 0
    ? ratedVariants.sort((a, b) => (b.avgUserRating || 0) - (a.avgUserRating || 0))[0]
    : null;

  return createSuccessResponse(ctx, {
    groupBy,
    totalArtifacts: artifacts.length,
    variants: overallStats,
    byType,
    recommendations: {
      bestByQuality: bestByQuality ? { variant: bestByQuality.variant, score: bestByQuality.avgQualityScore } : null,
      bestByUserRating: bestByUserRating ? { variant: bestByUserRating.variant, rating: bestByUserRating.avgUserRating } : null,
    },
    significanceWarnings,
    filters: { artifactType, since, groupBy },
  });
});
