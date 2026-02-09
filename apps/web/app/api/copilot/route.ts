/**
 * AI Contract Copilot API
 * 
 * Real-time drafting assistance endpoints:
 * - POST /api/copilot - Get suggestions for current text
 * - POST /api/copilot/complete - Get auto-completions
 * - POST /api/copilot/risks - Analyze risks only
 * - POST /api/copilot/apply - Apply a suggestion
 */

import { NextRequest } from 'next/server';
import { 
  getAICopilotService,
  type CopilotContext,
  type RealtimeSuggestion as _RealtimeSuggestion 
} from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

// ============================================================================
// POST - Get real-time suggestions
// ============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body = await request.json();
    const { 
      text, 
      cursorPosition = text?.length || 0,
      contractType,
      counterpartyName,
      contractValue,
      isNegotiating = false,
      userRole = 'drafter',
      playbook } = body;

    if (!text) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Text is required', 400);
    }

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType,
      counterpartyName,
      contractValue,
      isNegotiating,
      userRole,
      activePlaybook: playbook };

    const copilotService = getAICopilotService();
    const response = await copilotService.getSuggestions(text, cursorPosition, context);

    return createSuccessResponse(ctx, response);
  });
