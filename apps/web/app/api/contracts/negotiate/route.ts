/**
 * Negotiation Copilot API
 * 
 * POST /api/contracts/negotiate — Generate negotiation playbook
 * POST /api/contracts/negotiate/redline — Generate clause redline
 * POST /api/contracts/negotiate/advise — Stream negotiation advice
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

const negotiateSchema = z.object({
  contractId: z.string().min(1, 'contractId is required'),
  ourRole: z.string().optional(),
  negotiationContext: z.string().optional(),
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { contractId, ourRole, negotiationContext } = negotiateSchema.parse(await request.json());

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
