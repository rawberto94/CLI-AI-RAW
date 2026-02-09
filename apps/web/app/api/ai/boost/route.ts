import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/ai/boost
 * Boost extraction confidence using multiple strategies
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { 
      extraction, 
      contractText,
      strategy,
      config = {}
    } = body;

    if (!extraction || !contractText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'extraction and contractText are required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const boostingService = (services as any).extractionConfidenceBoostingService;

    if (!boostingService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Confidence boosting service not available', 503);
    }

    // Apply boosting strategy
    let result;
    if (strategy) {
      // Single strategy
      switch (strategy) {
        case 'multi_model':
          result = await boostingService.boostWithMultiModel(
            extraction,
            contractText,
            config
          );
          break;
        case 'evidence_chain':
          result = await boostingService.boostWithEvidence(
            extraction,
            contractText,
            config
          );
          break;
        case 'historical_calibration':
          result = await boostingService.boostWithHistoricalCalibration(
            extraction,
            config
          );
          break;
        default:
          result = await boostingService.boostExtraction(
            extraction,
            contractText,
            { ...config, strategy }
          );
      }
    } else {
      // Use ensemble (all strategies)
      result = await boostingService.boostExtraction(
        extraction,
        contractText,
        { ...config, strategy: 'ensemble' }
      );
    }

    return createSuccessResponse(ctx, {
      strategy: strategy || 'ensemble',
      ...result });
  });

/**
 * POST /api/ai/boost/feedback
 * Submit human feedback to improve future boosting
 */
export const PUT = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { 
      fieldName, 
      originalValue,
      correctedValue,
      originalConfidence,
      wasCorrect
    } = body;

    if (!fieldName) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'fieldName is required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const boostingService = (services as any).extractionConfidenceBoostingService;

    if (!boostingService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Confidence boosting service not available', 503);
    }

    // Record human feedback
    boostingService.recordHumanFeedback({
      fieldName,
      originalValue,
      correctedValue,
      originalConfidence,
      wasCorrect: wasCorrect !== false });

    return createSuccessResponse(ctx, { message: 'Feedback recorded successfully' });
  });

/**
 * GET /api/ai/boost
 * Get available boosting strategies and stats
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
    const services = await import('data-orchestration/services');
    const boostingService = (services as any).extractionConfidenceBoostingService;

    const strategies = [
      { 
        name: 'multi_model', 
        description: 'Use multiple AI models for consensus voting' 
      },
      { 
        name: 'evidence_chain', 
        description: 'Build evidence chains with document quotes' 
      },
      { 
        name: 'historical_calibration', 
        description: 'Adjust confidence based on historical accuracy' 
      },
      { 
        name: 'cross_validation', 
        description: 'Cross-validate with related field values' 
      },
      { 
        name: 'ensemble', 
        description: 'Combine all strategies for maximum accuracy' 
      },
    ];

    let accuracyStats = null;
    if (boostingService) {
      accuracyStats = boostingService.getHistoricalAccuracy?.();
    }

    return createSuccessResponse(ctx, {
      strategies,
      accuracyStats,
      recommendedThresholds: {
        highConfidence: 0.85,
        mediumConfidence: 0.65,
        lowConfidence: 0.45,
        humanReviewRequired: 0.45 } });
  });
