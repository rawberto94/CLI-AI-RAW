/**
 * AI Copilot Completions API
 * 
 * Get auto-completions for partial clause text
 */

import { NextRequest } from 'next/server';
import { getAICopilotService, type CopilotContext } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body = await request.json();
    const { 
      text, 
      cursorPosition = text?.length || 0,
      contractType } = body;

    if (!text) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Text is required', 400);
    }

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType };

    const copilotService = getAICopilotService();
    const completions = await copilotService.getAutoCompletions(text, cursorPosition, context);

    return createSuccessResponse(ctx, completions);
  });
