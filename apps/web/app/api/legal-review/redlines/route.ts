/**
 * Redline Generation API
 * 
 * Generate redlines comparing two contract versions
 */

import { NextRequest } from 'next/server';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getLegalReviewService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const { 
    originalText,
    proposedText,
    playbookId: _playbookId,
    includeRiskAssessment = true,
  } = body;

  if (!originalText || !proposedText) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Both original and proposed text are required', 400);
  }

  const tenantId = getSessionTenantId(session);

  const legalReviewService = getLegalReviewService();
  const changes = await legalReviewService.generateRedlines(originalText, proposedText, {
    tenantId,
    includeRiskAssessment,
  } as any);

  // Calculate summary statistics
  const summary = {
    totalChanges: changes.length,
    additions: changes.filter(c => c.type === 'addition').length,
    deletions: changes.filter(c => c.type === 'deletion').length,
    modifications: changes.filter(c => c.type === 'modification').length,
    criticalRisks: changes.filter(c => (c as unknown as { riskAssessment?: { severity: string } }).riskAssessment?.severity === 'critical').length,
    highRisks: changes.filter(c => (c as unknown as { riskAssessment?: { severity: string } }).riskAssessment?.severity === 'high').length,
  };

  return createSuccessResponse(ctx, {
    success: true,
    changes,
    summary,
  });
});
