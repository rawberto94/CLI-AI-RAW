/**
 * Extraction Anomaly Detection API
 * Detect and manage suspicious or unusual extraction results
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Dynamic import to avoid build-time resolution issues
async function getAnomalyDetectionService() {
  const services = await import('data-orchestration/services');
  return (services as any).extractionAnomalyDetectionService;
}

/**
 * GET /api/ai/anomalies
 * Retrieve detected anomalies
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeResolved = searchParams.get('includeResolved') === 'true';

    const anomalyService = await getAnomalyDetectionService();

    // Get anomalies with filters
    let anomalies = anomalyService.getAnomalies(tenantId);

    // Filter by resolution status
    if (!includeResolved) {
      anomalies = anomalies.filter((a: any) => !a.resolved);
    }

    // Filter by severity
    if (severity) {
      anomalies = anomalies.filter((a: any) => a.severity === severity);
    }

    // Filter by type
    if (type) {
      anomalies = anomalies.filter((a: any) => a.type === type);
    }

    // Sort by severity and timestamp
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    anomalies.sort((a: any, b: any) => {
      const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - 
                          severityOrder[b.severity as keyof typeof severityOrder];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Apply limit
    anomalies = anomalies.slice(0, limit);

    // Get summary stats
    const allAnomalies = anomalyService.getAnomalies(tenantId);
    const stats = {
      total: allAnomalies.length,
      unresolved: allAnomalies.filter((a: any) => !a.resolved).length,
      bySeverity: {
        critical: allAnomalies.filter((a: any) => a.severity === 'critical').length,
        high: allAnomalies.filter((a: any) => a.severity === 'high').length,
        medium: allAnomalies.filter((a: any) => a.severity === 'medium').length,
        low: allAnomalies.filter((a: any) => a.severity === 'low').length },
      byType: {} as Record<string, number> };

    // Count by type
    allAnomalies.forEach((a: any) => {
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
    });

    return createSuccessResponse(ctx, {
      anomalies,
      stats,
      filters: { severity, type, limit, includeResolved } });
  });

/**
 * POST /api/ai/anomalies
 * Analyze extractions for anomalies or manage rules
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action, ...data } = body;

    const anomalyService = await getAnomalyDetectionService();

    // Analyze an extraction for anomalies
    if (action === 'analyze') {
      const { extractionId, contractId, fields, model, contractType } = data;

      if (!extractionId || !contractId || !fields) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'extractionId, contractId, and fields are required', 400);
      }

      const result = anomalyService.analyzeExtraction(tenantId, {
        extractionId,
        contractId,
        fields,
        model,
        contractType });

      return createSuccessResponse(ctx, {
        extractionId,
        result });
    }

    // Add a custom detection rule
    if (action === 'addRule') {
      const { rule } = data;

      if (!rule || !rule.id || !rule.name || !rule.type) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'rule with id, name, and type is required', 400);
      }

      anomalyService.addRule(tenantId, rule);

      return createSuccessResponse(ctx, {
        message: 'Rule added successfully',
        ruleId: rule.id });
    }

    // Remove a detection rule
    if (action === 'removeRule') {
      const { ruleId } = data;

      if (!ruleId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'ruleId is required', 400);
      }

      const success = anomalyService.removeRule(tenantId, ruleId);

      if (!success) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Rule not found', 404);
      }

      return createSuccessResponse(ctx, {
        message: 'Rule removed' });
    }

    // Get all rules
    if (action === 'getRules') {
      const rules = anomalyService.getRules(tenantId);

      return createSuccessResponse(ctx, {
        rules,
        totalCount: rules.length });
    }

    // Resolve an anomaly
    if (action === 'resolve') {
      const { anomalyId, resolution, notes } = data;

      if (!anomalyId || !resolution) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'anomalyId and resolution are required', 400);
      }

      const success = anomalyService.resolveAnomaly(tenantId, anomalyId, resolution, notes);

      if (!success) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Anomaly not found', 404);
      }

      return createSuccessResponse(ctx, {
        message: 'Anomaly resolved' });
    }

    // Bulk resolve anomalies
    if (action === 'bulkResolve') {
      const { anomalyIds, resolution, notes } = data;

      if (!anomalyIds || !Array.isArray(anomalyIds) || !resolution) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'anomalyIds array and resolution are required', 400);
      }

      let resolved = 0;
      for (const anomalyId of anomalyIds) {
        if (anomalyService.resolveAnomaly(tenantId, anomalyId, resolution, notes)) {
          resolved++;
        }
      }

      return createSuccessResponse(ctx, {
        message: `${resolved} of ${anomalyIds.length} anomalies resolved`,
        resolved,
        total: anomalyIds.length });
    }

    // Get field statistics (for understanding baseline)
    if (action === 'fieldStats') {
      const { fieldName } = data;

      if (!fieldName) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'fieldName is required', 400);
      }

      const stats = anomalyService.getFieldStatistics(tenantId, fieldName);

      return createSuccessResponse(ctx, {
        fieldName,
        statistics: stats });
    }

    // Clear resolved anomalies (cleanup)
    if (action === 'clearResolved') {
      const { olderThan } = data;
      const cutoffDate = olderThan ? new Date(olderThan) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days default

      let cleared = 0;
      const anomalies = anomalyService.getAnomalies(tenantId);
      
      for (const anomaly of anomalies) {
        if (anomaly.resolved && new Date(anomaly.resolvedAt) < cutoffDate) {
          anomalyService.removeAnomaly(tenantId, anomaly.id);
          cleared++;
        }
      }

      return createSuccessResponse(ctx, {
        message: `Cleared ${cleared} resolved anomalies older than ${cutoffDate.toISOString()}`,
        cleared });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use: analyze, addRule, removeRule, getRules, resolve, bulkResolve, fieldStats, or clearResolved', 400);
  });
