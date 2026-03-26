/**
 * Smart Contract Comparison API (AI-powered semantic comparison)
 * POST /api/contracts/smart-compare — Clause-level AI comparison with risk analysis
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

const smartCompareSchema = z.object({
  contractId1: z.string().min(1, 'contractId1 is required'),
  contractId2: z.string().min(1, 'contractId2 is required'),
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();

  let validated;
  try {
    validated = smartCompareSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
    }
    throw error;
  }

  const { contractId1, contractId2 } = validated;

  if (contractId1 === contractId2) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot compare a contract with itself', 400);
  }

  try {
    const { generateSmartComparison } = await import('@/lib/ai/smart-comparison.service');

    const report = await generateSmartComparison({
      contractId1,
      contractId2,
      tenantId: ctx.tenantId,
    });

    return createSuccessResponse(ctx, { report });
  } catch (error) {
    return createErrorResponse(
      ctx, 'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Smart comparison failed',
      500
    );
  }
});
