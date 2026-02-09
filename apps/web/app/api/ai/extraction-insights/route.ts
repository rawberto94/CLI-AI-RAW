/**
 * AI Extraction Insights API
 * 
 * Provides real-time insights about extraction performance,
 * quality metrics, and recommendations for improvement.
 */

import { NextRequest } from 'next/server';
import { getExtractionAnalytics } from '@/lib/ai/extraction-analytics';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * GET /api/ai/extraction-insights
 * 
 * Returns real-time extraction performance insights
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const type = request.nextUrl.searchParams.get('type') || 'all';

    const analytics = getExtractionAnalytics();

    switch (type) {
      case 'realtime': {
        const insights = await analytics.getRealTimeInsights(tenantId);
        return createSuccessResponse(ctx, insights);
      }

      case 'quality': {
        const quality = analytics.getQualityScore(tenantId);
        return createSuccessResponse(ctx, quality);
      }

      case 'tenant': {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        const endDate = new Date();
        const tenantAnalytics = await analytics.getTenantAnalytics(tenantId, startDate, endDate);
        return createSuccessResponse(ctx, tenantAnalytics);
      }

      case 'all':
      default: {
        const [realtime, quality] = await Promise.all([
          analytics.getRealTimeInsights(tenantId),
          analytics.getQualityScore(tenantId),
        ]);

        return createSuccessResponse(ctx, {
            realtime,
            quality,
            timestamp: new Date().toISOString() });
      }
    }
  });

/**
 * POST /api/ai/extraction-insights/record
 * 
 * Record an extraction event for analytics
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();

    const {
      contractId,
      eventType,
      fieldKey,
      fieldType: _fieldType,
      confidence: _confidence,
      originalValue,
      correctedValue,
      processingTimeMs,
      modelUsed,
      success: _success,
      errorMessage: _errorMessage } = body;

    if (!contractId || !eventType) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and eventType are required', 400);
    }

    const analytics = getExtractionAnalytics();

    // Record the event
    switch (eventType) {
      case 'extraction_started':
        await analytics.recordExtractionStart(contractId, tenantId);
        break;
      case 'extraction_completed':
        await analytics.recordExtractionComplete(
          contractId,
          tenantId,
          [], // Fields would be passed from the actual extraction
          processingTimeMs || 0,
          modelUsed
        );
        break;
      case 'field_corrected':
        await analytics.recordFieldCorrected(
          contractId,
          tenantId,
          fieldKey,
          'text', // Default field type when not provided
          originalValue,
          correctedValue
        );
        break;
      default:
        // For other event types, additional methods would be needed
        break;
    }

    return createSuccessResponse(ctx, { message: 'Event recorded' });
  });
