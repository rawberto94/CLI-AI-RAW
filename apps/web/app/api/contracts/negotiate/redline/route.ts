/**
 * Negotiation Copilot — Clause Redline API
 * POST /api/contracts/negotiate/redline — Generate redline for specific clause
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

const redlineSchema = z.object({
  clauseText: z.string().min(1, 'clauseText is required'),
  clauseType: z.string().optional(),
  contractType: z.string().optional(),
  objective: z.string().optional(),
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { clauseText, clauseType, contractType, objective } = redlineSchema.parse(await request.json());

  try {
    const { generateRedlineSuggestion } = await import('@/lib/ai/negotiation-copilot.service');

    const redline = await generateRedlineSuggestion({
      clauseText,
      clauseType,
      contractType,
      tenantId: ctx.tenantId,
      objective,
    });

    return createSuccessResponse(ctx, { redline });
  } catch (error) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Redline generation failed', 500);
  }
});
