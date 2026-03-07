/**
 * Legal Review API
 * 
 * Comprehensive legal review and redlining endpoints
 */

import { NextRequest } from 'next/server';
import { getLegalReviewService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// POST - Perform legal review against playbook
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { 
    contractText,
    playbookId = 'default_playbook',
    contractType,
    counterpartyName: _counterpartyName,
    includePatternAnalysis: _includePatternAnalysis = false,
    includePrecedents: _includePrecedents = false,
  } = body;

  if (!contractText) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract text is required', 400);
  }

  const tenantId = ctx.tenantId;

  const legalReviewService = getLegalReviewService();
  const result = await legalReviewService.reviewContract(contractText, {
    tenantId,
    playbookId,
    contractType,
  });

  return createSuccessResponse(ctx, {
    success: true,
    ...result,
  });
});
