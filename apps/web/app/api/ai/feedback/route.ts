/**
 * AI Feedback & Learning API
 * 
 * Record user corrections to improve AI extractions over time:
 * - Stores correction patterns
 * - Enables prompt enhancement based on learnings
 * - Supports per-tenant customization
 * 
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

interface CorrectionRequest {
  contractId: string;
  artifactType: string;
  originalData: Record<string, unknown>;
  correctedData: Record<string, unknown>;
  tenantId: string;
  userId: string;
  feedbackType?: 'correction' | 'validation' | 'rejection';
}

/**
 * POST - Record a user correction for AI learning
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const services = await import('data-orchestration/services');
    const aiLearningService = services.aiLearningService;

    const body = await request.json() as CorrectionRequest;

    // Validate required fields
    if (!body.contractId || !body.artifactType) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and artifactType are required', 400);
    }

    if (!body.originalData || !body.correctedData) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'originalData and correctedData are required', 400);
    }

    // Calculate which fields were corrected
    const correctionFields = Object.keys(body.correctedData).filter(
      key => JSON.stringify(body.originalData[key]) !== JSON.stringify(body.correctedData[key])
    );

    // Record the correction
    await aiLearningService.recordCorrection({
      contractId: body.contractId,
      tenantId,
      artifactType: body.artifactType,
      originalData: body.originalData as Record<string, unknown>,
      correctedData: body.correctedData as Record<string, unknown>,
      correctionFields,
      userId,
      feedbackType: body.feedbackType || 'correction' });

    return createSuccessResponse(ctx, {
      message: 'Correction recorded for AI learning',
      data: {
        contractId: body.contractId,
        artifactType: body.artifactType,
        correctionFields,
        recordedAt: new Date().toISOString() } });

  });

/**
 * GET - Retrieve learned patterns or stats
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const services = await import('data-orchestration/services');
    const aiLearningService = services.aiLearningService;

    const { searchParams } = new URL(request.url);
    const artifactType = searchParams.get('artifactType') || undefined;

    // Get learned patterns
    const patterns = await aiLearningService.getLearningPatterns(
      tenantId,
      artifactType
    );

    return createSuccessResponse(ctx, {
      tenantId,
      artifactType: artifactType || 'all',
      patterns,
      patternCount: patterns.length });

  });
