/**
 * AI Copilot Risk Analysis API
 * 
 * Dedicated endpoint for risk-only analysis
 */

import { NextRequest } from 'next/server';
import { getAICopilotService, type CopilotContext } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body = await request.json();
    const { 
      text,
      contractType,
      playbook } = body;

    if (!text) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Text is required', 400);
    }

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType,
      activePlaybook: playbook };

    const copilotService = getAICopilotService();
    const risks = await copilotService.detectRisks(text, context);

    return createSuccessResponse(ctx, {
      risks,
      totalRisks: risks.length,
      criticalCount: risks.filter(r => r.severity === 'critical').length,
      highCount: risks.filter(r => r.severity === 'high').length,
      mediumCount: risks.filter(r => r.severity === 'medium').length,
      lowCount: risks.filter(r => r.severity === 'low').length });
  });
