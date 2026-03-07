/**
 * AI Extraction Quality Dashboard API
 * Analytics and metrics for AI extraction quality monitoring
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import to avoid build-time resolution issues
async function getQualityDashboardService() {
  const services = await import('data-orchestration/services');
  return (services as any).extractionQualityDashboardService;
}

/**
 * GET /api/ai/quality
 * Retrieve quality dashboard data
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as any) || 'week';
    const format = searchParams.get('format');

    const qualityService = await getQualityDashboardService();

    // Export as CSV
    if (format === 'csv') {
      const csv = qualityService.exportToCsv(tenantId, period);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="quality-report-${period}.csv"` } });
    }

    // Get full dashboard
    const dashboard = qualityService.getDashboard(tenantId, period);

    return createSuccessResponse(ctx, {
      dashboard,
      generatedAt: new Date().toISOString() });
  });

/**
 * POST /api/ai/quality
 * Record extraction results and analyze quality
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action, ...data } = body;

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
        return createErrorResponse(ctx, 'BAD_REQUEST', 'extractionId, contractId, model, and fields are required', 400);
      }

      qualityService.recordExtraction(tenantId, {
        extractionId,
        contractId,
        model,
        fields,
        overallConfidence,
        durationMs,
        success,
        errorType });

      // Get immediate quality assessment
      const dashboard = qualityService.getDashboard(tenantId, 'day');

      return createSuccessResponse(ctx, {
        message: 'Extraction recorded',
        currentQuality: {
          overallScore: dashboard.overallScore,
          grade: dashboard.overallScore.grade,
          activeAlerts: dashboard.alerts.filter((a: any) => !a.resolved).length } });
    }

    // Record correction (human feedback)
    if (action === 'correction') {
      const { extractionId, fieldName, originalValue, correctedValue } = data;

      if (!extractionId || !fieldName) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'extractionId and fieldName are required', 400);
      }

      qualityService.recordCorrection(tenantId, extractionId, fieldName, originalValue, correctedValue);

      return createSuccessResponse(ctx, {
        message: 'Correction recorded' });
    }

    // Get field-specific analytics
    if (action === 'fieldAnalytics') {
      const { fieldName, period = 'week' } = data;

      if (!fieldName) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'fieldName is required', 400);
      }

      const analytics = qualityService.getFieldAnalytics(tenantId, fieldName, period);

      return createSuccessResponse(ctx, {
        fieldName,
        analytics });
    }

    // Get model comparison
    if (action === 'modelComparison') {
      const { period = 'week' } = data;
      const dashboard = qualityService.getDashboard(tenantId, period);

      return createSuccessResponse(ctx, {
        modelPerformance: dashboard.modelPerformance,
        period });
    }

    // Get alerts
    if (action === 'alerts') {
      const { includeResolved = false } = data;
      const dashboard = qualityService.getDashboard(tenantId, 'week');
      
      const alerts = includeResolved 
        ? dashboard.alerts 
        : dashboard.alerts.filter((a: any) => !a.resolved);

      return createSuccessResponse(ctx, {
        alerts,
        totalCount: alerts.length });
    }

    // Resolve an alert
    if (action === 'resolveAlert') {
      const { alertId } = data;

      if (!alertId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'alertId is required', 400);
      }

      qualityService.resolveAlert(alertId);

      return createSuccessResponse(ctx, {
        message: 'Alert resolved' });
    }

    // Get trends
    if (action === 'trends') {
      const { period = 'week' } = data;
      const dashboard = qualityService.getDashboard(tenantId, period);

      return createSuccessResponse(ctx, {
        trends: dashboard.trends,
        period });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: record, correction, fieldAnalytics, modelComparison, alerts, resolveAlert, or trends', 400);
  });
