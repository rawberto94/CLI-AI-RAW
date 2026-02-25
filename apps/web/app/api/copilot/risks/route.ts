/**
 * AI Copilot Risk Analysis API
 * 
 * Dedicated endpoint for risk-only analysis
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAICopilotService, type CopilotContext } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const riskSchema = z.object({
  text: z.string().min(1, 'Text is required').max(100000, 'Text too long'),
  contractType: z.string().max(100).optional(),
  playbook: z.string().max(200).optional(),
});

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body = await request.json();

    const parsed = riskSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        ctx,
        'BAD_REQUEST',
        parsed.error.issues.map(i => i.message).join('; '),
        400,
      );
    }

    const { text, contractType, playbook } = parsed.data;

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
