/**
 * Smart Contract Comparison API (AI-powered semantic comparison)
 * POST /api/contracts/smart-compare — Clause-level AI comparison with risk analysis
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { contractId1, contractId2 } = body;

  if (!contractId1 || !contractId2) {
    return createErrorResponse('contractId1 and contractId2 are required', 400);
  }

  if (contractId1 === contractId2) {
    return createErrorResponse('Cannot compare a contract with itself', 400);
  }

  try {
    const { generateSmartComparison } = await import('@/lib/ai/smart-comparison.service');

    const report = await generateSmartComparison({
      contractId1,
      contractId2,
      tenantId: ctx.tenantId,
    });

    return createSuccessResponse({ report });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Smart comparison failed',
      500
    );
  }
});
