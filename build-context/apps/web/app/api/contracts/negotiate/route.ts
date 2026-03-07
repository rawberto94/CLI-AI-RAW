/**
 * Negotiation Copilot API
 * 
 * POST /api/contracts/negotiate — Generate negotiation playbook
 * POST /api/contracts/negotiate/redline — Generate clause redline
 * POST /api/contracts/negotiate/advise — Stream negotiation advice
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { contractId, ourRole, negotiationContext } = body;

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
  }

  try {
    const { generateAndStorePlaybook } = await import('@/lib/ai/negotiation-copilot.service');

    const playbook = await generateAndStorePlaybook({
      contractId,
      tenantId: ctx.tenantId,
      ourRole: ourRole || 'auto',
      negotiationContext,
    });

    return createSuccessResponse(ctx, { playbook });
  } catch (error) {
    return createErrorResponse(
      ctx, 'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Negotiation playbook generation failed',
      500
    );
  }
});
