/**
 * AI Extraction Quality Dashboard API
 * Analytics and metrics for AI extraction quality monitoring
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to avoid build-time resolution issues
async function getQualityDashboardService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).extractionQualityDashboardService;
}

/**
 * GET /api/ai/quality
 * Retrieve quality dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as any) || 'week';
    const format = searchParams.get('format');
    const tenantId = searchParams.get('tenantId') || 'default';

    const qualityService = await getQualityDashboardService();

    // Export as CSV
    if (format === 'csv') {
      const csv = qualityService.exportToCsv(tenantId, period);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="quality-report-${period}.csv"`,
        },
      });
    }

    // Get full dashboard
    const dashboard = qualityService.getDashboard(tenantId, period);

    return NextResponse.json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve quality dashboard' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/quality
 * Record extraction results and analyze quality
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenantId = 'default', ...data } = body;

    const qualityService = await getQualityDashboardService();

    // Record a new extraction
    if (action === 'record') {
      const { 
        extractionId, 
        contractId, 
        model, 
        fields, 
        overallConfidence, 
        durationMs, 
        success, 
        errorType 
      } = data;

      if (!extractionId || !contractId || !model || !fields) {
        return NextResponse.json(
          { error: 'extractionId, contractId, model, and fields are required' },
          { status: 400 }
        );
      }

      qualityService.recordExtraction(tenantId, {
        extractionId,
        contractId,
        model,
        fields,
        overallConfidence,
        durationMs,
        success,
        errorType,
      });

      // Get immediate quality assessment
      const dashboard = qualityService.getDashboard(tenantId, 'day');

      return NextResponse.json({
        success: true,
        message: 'Extraction recorded',
        currentQuality: {
          overallScore: dashboard.overallScore,
          grade: dashboard.overallScore.grade,
          activeAlerts: dashboard.alerts.filter((a: any) => !a.resolved).length,
        },
      });
    }

    // Record correction (human feedback)
    if (action === 'correction') {
      const { extractionId, fieldName, originalValue, correctedValue } = data;

      if (!extractionId || !fieldName) {
        return NextResponse.json(
          { error: 'extractionId and fieldName are required' },
          { status: 400 }
        );
      }

      qualityService.recordCorrection(tenantId, extractionId, fieldName, originalValue, correctedValue);

      return NextResponse.json({
        success: true,
        message: 'Correction recorded',
      });
    }

    // Get field-specific analytics
    if (action === 'fieldAnalytics') {
      const { fieldName, period = 'week' } = data;

      if (!fieldName) {
        return NextResponse.json(
          { error: 'fieldName is required' },
          { status: 400 }
        );
      }

      const analytics = qualityService.getFieldAnalytics(tenantId, fieldName, period);

      return NextResponse.json({
        success: true,
        fieldName,
        analytics,
      });
    }

    // Get model comparison
    if (action === 'modelComparison') {
      const { period = 'week' } = data;
      const dashboard = qualityService.getDashboard(tenantId, period);

      return NextResponse.json({
        success: true,
        modelPerformance: dashboard.modelPerformance,
        period,
      });
    }

    // Get alerts
    if (action === 'alerts') {
      const { includeResolved = false } = data;
      const dashboard = qualityService.getDashboard(tenantId, 'week');
      
      const alerts = includeResolved 
        ? dashboard.alerts 
        : dashboard.alerts.filter((a: any) => !a.resolved);

      return NextResponse.json({
        success: true,
        alerts,
        totalCount: alerts.length,
      });
    }

    // Resolve an alert
    if (action === 'resolveAlert') {
      const { alertId } = data;

      if (!alertId) {
        return NextResponse.json(
          { error: 'alertId is required' },
          { status: 400 }
        );
      }

      qualityService.resolveAlert(alertId);

      return NextResponse.json({
        success: true,
        message: 'Alert resolved',
      });
    }

    // Get trends
    if (action === 'trends') {
      const { period = 'week' } = data;
      const dashboard = qualityService.getDashboard(tenantId, period);

      return NextResponse.json({
        success: true,
        trends: dashboard.trends,
        period,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: record, correction, fieldAnalytics, modelComparison, alerts, resolveAlert, or trends' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to process quality request' },
      { status: 500 }
    );
  }
}
