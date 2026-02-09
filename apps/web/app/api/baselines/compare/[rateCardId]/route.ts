/**
 * GET /api/baselines/compare/[rateCardId]
 * 
 * Compare rate card entry against baselines
 */

import { NextRequest } from 'next/server';
import { baselineManagementService } from 'data-orchestration/services';
import { prisma } from "@/lib/prisma";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export async function GET(req: NextRequest, props: { params: Promise<{ rateCardId: string }> }) {
  const params = await props.params;
  const ctx = getApiContext(req);
  try {

    const { rateCardId } = params;

    const service = new baselineManagementService(prisma);
    const comparisons = await service.compareAgainstBaselines(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      rateCardId,
      comparisons,
      summary: {
        totalBaselines: comparisons.length,
        maxSavingsOpportunity: Math.max(...comparisons.map(c => (c as any).savingsOpportunity || 0), 0),
        aboveBaseline: comparisons.filter(c => c.status === 'ABOVE_BASELINE').length,
        atBaseline: comparisons.filter(c => c.status === 'AT_BASELINE').length,
        belowBaseline: comparisons.filter(c => c.status === 'BELOW_BASELINE').length,
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
