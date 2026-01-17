/**
 * Extraction Anomaly Detection API
 * Detect and manage suspicious or unusual extraction results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

// Dynamic import to avoid build-time resolution issues
async function getAnomalyDetectionService() {
  const services = await import('@repo/data-orchestration/services');
  return (services as any).extractionAnomalyDetectionService;
}

/**
 * GET /api/ai/anomalies
 * Retrieve detected anomalies
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

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
        low: allAnomalies.filter((a: any) => a.severity === 'low').length,
      },
      byType: {} as Record<string, number>,
    };

    // Count by type
    allAnomalies.forEach((a: any) => {
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      anomalies,
      stats,
      filters: { severity, type, limit, includeResolved },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve anomalies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/anomalies
 * Analyze extractions for anomalies or manage rules
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const body = await request.json();
    const { action, ...data } = body;

    const anomalyService = await getAnomalyDetectionService();

    // Analyze an extraction for anomalies
    if (action === 'analyze') {
      const { extractionId, contractId, fields, model, contractType } = data;

      if (!extractionId || !contractId || !fields) {
        return NextResponse.json(
          { error: 'extractionId, contractId, and fields are required' },
          { status: 400 }
        );
      }

      const result = anomalyService.analyzeExtraction(tenantId, {
        extractionId,
        contractId,
        fields,
        model,
        contractType,
      });

      return NextResponse.json({
        success: true,
        extractionId,
        result,
      });
    }

    // Add a custom detection rule
    if (action === 'addRule') {
      const { rule } = data;

      if (!rule || !rule.id || !rule.name || !rule.type) {
        return NextResponse.json(
          { error: 'rule with id, name, and type is required' },
          { status: 400 }
        );
      }

      anomalyService.addRule(tenantId, rule);

      return NextResponse.json({
        success: true,
        message: 'Rule added successfully',
        ruleId: rule.id,
      });
    }

    // Remove a detection rule
    if (action === 'removeRule') {
      const { ruleId } = data;

      if (!ruleId) {
        return NextResponse.json(
          { error: 'ruleId is required' },
          { status: 400 }
        );
      }

      const success = anomalyService.removeRule(tenantId, ruleId);

      if (!success) {
        return NextResponse.json(
          { error: 'Rule not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Rule removed',
      });
    }

    // Get all rules
    if (action === 'getRules') {
      const rules = anomalyService.getRules(tenantId);

      return NextResponse.json({
        success: true,
        rules,
        totalCount: rules.length,
      });
    }

    // Resolve an anomaly
    if (action === 'resolve') {
      const { anomalyId, resolution, notes } = data;

      if (!anomalyId || !resolution) {
        return NextResponse.json(
          { error: 'anomalyId and resolution are required' },
          { status: 400 }
        );
      }

      const success = anomalyService.resolveAnomaly(tenantId, anomalyId, resolution, notes);

      if (!success) {
        return NextResponse.json(
          { error: 'Anomaly not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Anomaly resolved',
      });
    }

    // Bulk resolve anomalies
    if (action === 'bulkResolve') {
      const { anomalyIds, resolution, notes } = data;

      if (!anomalyIds || !Array.isArray(anomalyIds) || !resolution) {
        return NextResponse.json(
          { error: 'anomalyIds array and resolution are required' },
          { status: 400 }
        );
      }

      let resolved = 0;
      for (const anomalyId of anomalyIds) {
        if (anomalyService.resolveAnomaly(tenantId, anomalyId, resolution, notes)) {
          resolved++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `${resolved} of ${anomalyIds.length} anomalies resolved`,
        resolved,
        total: anomalyIds.length,
      });
    }

    // Get field statistics (for understanding baseline)
    if (action === 'fieldStats') {
      const { fieldName } = data;

      if (!fieldName) {
        return NextResponse.json(
          { error: 'fieldName is required' },
          { status: 400 }
        );
      }

      const stats = anomalyService.getFieldStatistics(tenantId, fieldName);

      return NextResponse.json({
        success: true,
        fieldName,
        statistics: stats,
      });
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

      return NextResponse.json({
        success: true,
        message: `Cleared ${cleared} resolved anomalies older than ${cutoffDate.toISOString()}`,
        cleared,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: analyze, addRule, removeRule, getRules, resolve, bulkResolve, fieldStats, or clearResolved' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to process anomaly request' },
      { status: 500 }
    );
  }
}
