/**
 * OCR Quality Metrics API
 * 
 * Dashboard metrics for OCR quality monitoring
 * Note: Uses metadata fields until dedicated schema fields are added
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';

const querySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  contractType: z.string().optional(),
});

/**
 * GET /api/ocr/quality/metrics
 * Get OCR quality metrics for dashboard
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { searchParams } = new URL(request.url);
  const params = querySchema.parse(Object.fromEntries(searchParams));

  const tenantId = session.user.tenantId;

  // Calculate date range
  const now = new Date();
  const periodDays = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  }[params.period];
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Build where clause
  const where: Record<string, unknown> = {
    tenantId,
    createdAt: { gte: startDate },
  };
  if (params.contractType) {
    where.contractType = params.contractType;
  }

  // Get basic contract metrics (OCR confidence stored in aiMetadata)
  const [contracts, byContractType] = await Promise.all([
    prisma.contract.count({ where }),
    prisma.contract.groupBy({
      by: ['contractType'],
      where,
      _count: true,
    }),
  ]);

  // Get contracts with AI metadata to calculate OCR confidence
  const contractsWithMetadata = await prisma.contract.findMany({
    where,
    select: {
      aiMetadata: true,
      createdAt: true,
      contractType: true,
    },
    take: 1000, // Limit for performance
  });

  // Calculate confidence from aiMetadata (where ocrConfidence might be stored)
  let totalConfidence = 0;
  let confidenceCount = 0;
  const confidenceDistribution: Record<string, number> = {
    excellent: 0,
    good: 0,
    acceptable: 0,
    needs_review: 0,
  };

  contractsWithMetadata.forEach((contract) => {
    const metadata = contract.aiMetadata as Record<string, unknown> | null;
    const confidence = metadata?.ocrConfidence as number | undefined;

    if (typeof confidence === 'number') {
      totalConfidence += confidence;
      confidenceCount++;

      if (confidence >= 0.9) confidenceDistribution.excellent++;
      else if (confidence >= 0.8) confidenceDistribution.good++;
      else if (confidence >= 0.7) confidenceDistribution.acceptable++;
      else confidenceDistribution.needs_review++;
    }
  });

  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // Generate trend data
  const trend = generateTrendData(contractsWithMetadata, startDate, periodDays);

  return createSuccessResponse(ctx, {
    summary: {
      totalProcessed: contracts,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      period: params.period,
      contractsWithConfidence: confidenceCount,
    },
    confidenceDistribution,
    byContractType: byContractType.map((item) => ({
      type: item.contractType || 'Unknown',
      count: item._count,
    })),
    trend,
    fieldAccuracy: [], // Would need OCR review data
  });
});

/**
 * Generate trend data from contracts
 */
function generateTrendData(
  contracts: Array<{ createdAt: Date; aiMetadata: unknown }>,
  _startDate: Date,
  _periodDays: number
): Array<{ date: string; avgConfidence: number; count: number }> {
  // Group by day
  const byDay: Record<string, { total: number; count: number; contracts: number }> = {};
  
  contracts.forEach((contract) => {
    const dateKey = contract.createdAt.toISOString().split('T')[0];
    if (!byDay[dateKey]) {
      byDay[dateKey] = { total: 0, count: 0, contracts: 0 };
    }
    byDay[dateKey].contracts++;
    
    const metadata = contract.aiMetadata as Record<string, unknown> | null;
    const confidence = metadata?.ocrConfidence as number | undefined;
    if (typeof confidence === 'number') {
      byDay[dateKey].total += confidence;
      byDay[dateKey].count++;
    }
  });

  return Object.entries(byDay)
    .map(([date, data]) => ({
      date,
      avgConfidence: data.count > 0 ? Math.round((data.total / data.count) * 1000) / 1000 : 0,
      count: data.contracts,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
