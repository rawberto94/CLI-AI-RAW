/**
 * Negotiation Copilot — Clause Redline API
 * POST /api/contracts/negotiate/redline — Generate redline for specific clause
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { clauseText, clauseType, contractType, objective } = body;

  if (!clauseText) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'clauseText is required', 400);
  }

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
