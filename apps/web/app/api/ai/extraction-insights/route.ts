/**
 * AI Extraction Insights API
 * 
 * Provides real-time insights about extraction performance,
 * quality metrics, and recommendations for improvement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtractionAnalytics } from '@/lib/ai/extraction-analytics';
import { getApiTenantId } from '@/lib/tenant-server';

/**
 * GET /api/ai/extraction-insights
 * 
 * Returns real-time extraction performance insights
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const type = request.nextUrl.searchParams.get('type') || 'all';

    const analytics = getExtractionAnalytics();

    switch (type) {
      case 'realtime': {
        const insights = await analytics.getRealTimeInsights(tenantId);
        return NextResponse.json({
          success: true,
          data: insights,
        });
      }

      case 'quality': {
        const quality = analytics.getQualityScore(tenantId);
        return NextResponse.json({
          success: true,
          data: quality,
        });
      }

      case 'tenant': {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        const endDate = new Date();
        const tenantAnalytics = await analytics.getTenantAnalytics(tenantId, startDate, endDate);
        return NextResponse.json({
          success: true,
          data: tenantAnalytics,
        });
      }

      case 'all':
      default: {
        const [realtime, quality] = await Promise.all([
          analytics.getRealTimeInsights(tenantId),
          analytics.getQualityScore(tenantId),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            realtime,
            quality,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  } catch (error) {
    console.error('Extraction insights error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get insights',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/extraction-insights/record
 * 
 * Record an extraction event for analytics
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const body = await request.json();

    const {
      contractId,
      eventType,
      fieldKey,
      fieldType,
      confidence,
      originalValue,
      correctedValue,
      processingTimeMs,
      modelUsed,
      success,
      errorMessage,
    } = body;

    if (!contractId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'contractId and eventType are required' },
        { status: 400 }
      );
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
        // For other event types, we'd need to add specific methods
        console.log(`📊 Received event: ${eventType}`, { contractId, fieldKey });
    }

    return NextResponse.json({
      success: true,
      message: 'Event recorded',
    });
  } catch (error) {
    console.error('Record extraction event error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record event',
      },
      { status: 500 }
    );
  }
}
