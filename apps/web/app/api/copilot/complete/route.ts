/**
 * AI Copilot Completions API
 * 
 * Get auto-completions for partial clause text
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAICopilotService, type CopilotContext } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const completionSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text too long'),
  cursorPosition: z.number().int().nonnegative().optional(),
  contractType: z.string().max(100).optional(),
});

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body = await request.json();

    const parsed = completionSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        ctx,
        'BAD_REQUEST',
        parsed.error.issues.map(i => i.message).join('; '),
        400,
      );
    }

    const { text, cursorPosition = text.length, contractType } = parsed.data;

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType };

    const copilotService = getAICopilotService();
    const completions = await copilotService.getAutoCompletions(text, cursorPosition, context);

    return createSuccessResponse(ctx, completions);
  });
