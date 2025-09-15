/**
 * API Routes for Accuracy Monitoring and Metrics System
 * Provides endpoints for tracking, monitoring, and reporting on AI extraction accuracy
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { accuracyMonitoringSystem } from '../monitoring/accuracy-monitoring-system';
import type { ValidationResult, AccuracyAlert } from '../monitoring/accuracy-monitoring-system';

const WorkerMetricsParamsSchema = z.object({
  workerId: z.string(),
});

const AccuracyReportQuerySchema = z.object({
  tenantId: z.string(),
  reportType: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const ValidationUpdateSchema = z.object({
  workerId: z.string(),
  contractId: z.string(),
  validationResults: z.array(z.object({
    fieldName: z.string(),
    extractedValue: z.any(),
    validatedValue: z.any(),
    isAccurate: z.boolean(),
    confidenceScore: z.number().min(0).max(1),
    errorType: z.enum(['false_positive', 'false_negative', 'incorrect_value', 'formatting_error']).optional(),
    correctionTime: z.number(),
    validatorId: z.string(),
    validationMethod: z.enum(['human', 'automated', 'cross_validation']),
  })),
});

const ExtractionMetricsSchema = z.object({
  workerId: z.string(),
  contractId: z.string(),
  tenantId: z.string(),
  extractedFields: z.record(z.any()),
  confidenceScores: z.record(z.number()),
  extractionTime: z.number(),
  modelVersion: z.string(),
});

export async function accuracyMonitoringRoutes(app: FastifyInstance) {
  // Record extraction metrics
  app.post<{
    Body: z.infer<typeof ExtractionMetricsSchema>;
  }>('/monitoring/extraction-metrics', {
    schema: {
      body: ExtractionMetricsSchema,
    },
  }, async (request, reply) => {
    const {
      workerId,
      contractId,
      tenantId,
      extractedFields,
      confidenceScores,
      extractionTime,
      modelVersion
    } = request.body;

    try {
      await accuracyMonitoringSystem.recordExtractionMetrics(
        workerId,
        contractId,
        tenantId,
        {
          extractedFields,
          confidenceScores,
          extractionTime,
          modelVersion
        }
      );

      return {
        success: true,
        message: 'Extraction metrics recorded successfully',
        metadata: {
          workerId,
          contractId,
          extractionTime,
          overallConfidence: Object.values(confidenceScores).reduce((sum, conf) => sum + conf, 0) / Object.values(confidenceScores).length
        }
      };
    } catch (error) {
      app.log.error({ err: error, workerId, contractId }, 'Failed to record extraction metrics');
      return reply.status(500).send({
        error: 'Metrics recording failed',
        message: 'Unable to record extraction metrics'
      });
    }
  });

  // Update validation results
  app.post<{
    Body: z.infer<typeof ValidationUpdateSchema>;
  }>('/monitoring/validation-results', {
    schema: {
      body: ValidationUpdateSchema,
    },
  }, async (request, reply) => {
    const { workerId, contractId, validationResults } = request.body;

    try {
      await accuracyMonitoringSystem.updateValidationResults(
        workerId,
        contractId,
        validationResults as any[]
      );

      const accuracy = validationResults.filter(r => r.isAccurate).length / validationResults.length;

      return {
        success: true,
        message: 'Validation results updated successfully',
        metrics: {
          workerId,
          contractId,
          accuracy: Math.round(accuracy * 100) / 100,
          validationCount: validationResults.length,
          errorsCount: validationResults.filter(r => !r.isAccurate).length
        }
      };
    } catch (error) {
      app.log.error({ err: error, workerId, contractId }, 'Failed to update validation results');
      return reply.status(500).send({
        error: 'Validation update failed',
        message: 'Unable to update validation results'
      });
    }
  });

  // Get worker accuracy metrics
  app.get<{
    Params: { workerId: string };
    Querystring: { timeWindow?: string };
  }>('/monitoring/workers/:workerId/accuracy', {
    schema: {
      params: WorkerMetricsParamsSchema,
      querystring: z.object({
        timeWindow: z.string().optional().default('24h')
      })
    },
  }, async (request, reply) => {
    const { workerId } = request.params;
    const { timeWindow } = request.query;

    try {
      // Convert timeWindow to milliseconds
      const timeWindowMs = timeWindow === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                          timeWindow === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                          24 * 60 * 60 * 1000; // Default to 24h

      const metrics = await accuracyMonitoringSystem.getWorkerAccuracyMetrics(
        workerId,
        timeWindowMs
      );

      return {
        success: true,
        data: metrics,
        metadata: {
          workerId,
          timeWindow,
          retrievedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      app.log.error({ err: error, workerId }, 'Failed to get worker accuracy metrics');
      return reply.status(500).send({
        error: 'Metrics retrieval failed',
        message: 'Unable to retrieve worker accuracy metrics'
      });
    }
  });

  // Generate accuracy report
  app.post<{
    Body: z.infer<typeof AccuracyReportQuerySchema>;
  }>('/monitoring/reports/accuracy', {
    schema: {
      body: AccuracyReportQuerySchema,
    },
  }, async (request, reply) => {
    const { tenantId, reportType, startDate, endDate } = request.body;

    try {
      let customPeriod: { start: Date; end: Date } | undefined;
      
      if (startDate && endDate) {
        customPeriod = {
          start: new Date(startDate),
          end: new Date(endDate)
        };
      }

      const report = await accuracyMonitoringSystem.generateAccuracyReport(
        tenantId,
        reportType,
        customPeriod
      );

      return {
        success: true,
        data: report,
        metadata: {
          reportId: report.reportId,
          generatedAt: report.generatedAt,
          period: report.period,
          tenantId
        }
      };
    } catch (error) {
      app.log.error({ err: error, tenantId, reportType }, 'Failed to generate accuracy report');
      return reply.status(500).send({
        error: 'Report generation failed',
        message: 'Unable to generate accuracy report'
      });
    }
  });

  // Get real-time accuracy dashboard data
  app.get<{
    Querystring: { tenantId: string; timeWindow?: string };
  }>('/monitoring/dashboard', {
    schema: {
      querystring: z.object({
        tenantId: z.string(),
        timeWindow: z.string().optional().default('24h')
      })
    },
  }, async (request, reply) => {
    const { tenantId, timeWindow } = request.query;

    try {
      const timeWindowMs = timeWindow === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                          timeWindow === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                          24 * 60 * 60 * 1000;

      // Get metrics for all workers
      const workers = ['overview', 'financial', 'clauses', 'compliance', 'risk', 'rates', 'template'];
      const workerMetrics = await Promise.all(
        workers.map(workerId => 
          accuracyMonitoringSystem.getWorkerAccuracyMetrics(workerId, timeWindowMs)
        )
      );

      // Calculate overall metrics
      const overallAccuracy = workerMetrics.reduce((sum, m) => sum + m.accuracy, 0) / workerMetrics.length;
      const overallConfidence = workerMetrics.reduce((sum, m) => sum + m.confidence, 0) / workerMetrics.length;
      const totalExtractions = workerMetrics.reduce((sum, m) => sum + m.extractionCount, 0);
      const totalAlerts = workerMetrics.reduce((sum, m) => sum + m.alertsCount, 0);

      // Identify top and worst performers
      const sortedByAccuracy = [...workerMetrics].sort((a, b) => b.accuracy - a.accuracy);
      const topPerformer = sortedByAccuracy[0];
      const worstPerformer = sortedByAccuracy[sortedByAccuracy.length - 1];

      // Get trending workers
      const improving = workerMetrics.filter(m => m.recentTrend === 'improving');
      const declining = workerMetrics.filter(m => m.recentTrend === 'declining');

      return {
        success: true,
        data: {
          overview: {
            overallAccuracy: Math.round(overallAccuracy * 100) / 100,
            overallConfidence: Math.round(overallConfidence * 100) / 100,
            totalExtractions,
            totalAlerts,
            timeWindow
          },
          workers: workerMetrics,
          insights: {
            topPerformer: topPerformer ? {
              workerId: topPerformer.workerId,
              accuracy: topPerformer.accuracy
            } : null,
            worstPerformer: worstPerformer ? {
              workerId: worstPerformer.workerId,
              accuracy: worstPerformer.accuracy
            } : null,
            improvingWorkers: improving.map(w => w.workerId),
            decliningWorkers: declining.map(w => w.workerId),
          },
          alerts: {
            total: totalAlerts,
            critical: workerMetrics.filter(m => m.accuracy < 0.7).length,
            warning: workerMetrics.filter(m => m.accuracy < 0.85 && m.accuracy >= 0.7).length
          }
        },
        metadata: {
          tenantId,
          timeWindow,
          generatedAt: new Date().toISOString(),
          workersAnalyzed: workers.length
        }
      };
    } catch (error) {
      app.log.error({ err: error, tenantId }, 'Failed to get accuracy dashboard data');
      return reply.status(500).send({
        error: 'Dashboard data retrieval failed',
        message: 'Unable to retrieve accuracy dashboard data'
      });
    }
  });

  // Get accuracy trends for a specific worker
  app.get<{
    Params: { workerId: string };
    Querystring: { tenantId: string; days?: string };
  }>('/monitoring/workers/:workerId/trends', {
    schema: {
      params: WorkerMetricsParamsSchema,
      querystring: z.object({
        tenantId: z.string(),
        days: z.string().optional().default('7')
      })
    },
  }, async (request, reply) => {
    const { workerId } = request.params;
    const { tenantId, days } = request.query;

    try {
      const daysNum = parseInt(days || '7');
      const timeWindowMs = daysNum * 24 * 60 * 60 * 1000;

      // Get recent metrics for trend analysis
      const metrics = await accuracyMonitoringSystem.getWorkerAccuracyMetrics(workerId, timeWindowMs);

      // In a full implementation, this would get historical data points
      // For now, return current metrics with trend indication
      const trendData = {
        workerId,
        period: `${days} days`,
        currentAccuracy: metrics.accuracy,
        currentConfidence: metrics.confidence,
        trend: metrics.recentTrend,
        extractionCount: metrics.extractionCount,
        averageProcessingTime: metrics.averageProcessingTime,
        dataPoints: [
          // In full implementation, this would be historical data
          {
            date: new Date().toISOString().split('T')[0],
            accuracy: metrics.accuracy,
            confidence: metrics.confidence,
            extractionCount: metrics.extractionCount
          }
        ]
      };

      return {
        success: true,
        data: trendData,
        metadata: {
          workerId,
          tenantId,
          daysAnalyzed: daysNum,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      app.log.error({ err: error, workerId, tenantId }, 'Failed to get worker trends');
      return reply.status(500).send({
        error: 'Trends retrieval failed',
        message: 'Unable to retrieve worker trends'
      });
    }
  });

  // Get accuracy alerts
  app.get<{
    Querystring: { tenantId: string; status?: string; severity?: string };
  }>('/monitoring/alerts', {
    schema: {
      querystring: z.object({
        tenantId: z.string(),
        status: z.enum(['active', 'acknowledged', 'resolved', 'all']).optional().default('active'),
        severity: z.enum(['warning', 'critical', 'all']).optional().default('all')
      })
    },
  }, async (request, reply) => {
    const { tenantId, status, severity } = request.query;

    try {
      // In a full implementation, this would query stored alerts
      // For now, return current active alerts from the monitoring system
      const allAlerts = Array.from((accuracyMonitoringSystem as any).alerts.values()) as Array<{
        acknowledged: boolean;
        resolvedAt?: Date;
        severity: string;
        workerId: string;
      }>;
      
      let filteredAlerts = allAlerts;
      
      if (status !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => {
          switch (status) {
            case 'active': return !alert.acknowledged && !alert.resolvedAt;
            case 'acknowledged': return alert.acknowledged && !alert.resolvedAt;
            case 'resolved': return !!alert.resolvedAt;
            default: return true;
          }
        });
      }
      
      if (severity !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
      }

      const alertsSummary = {
        total: filteredAlerts.length,
        critical: filteredAlerts.filter(a => a.severity === 'critical').length,
        warning: filteredAlerts.filter(a => a.severity === 'warning').length,
        byWorker: filteredAlerts.reduce((acc: Record<string, number>, alert) => {
          acc[alert.workerId] = (acc[alert.workerId] || 0) + 1;
          return acc;
        }, {})
      };

      return {
        success: true,
        data: {
          alerts: filteredAlerts,
          summary: alertsSummary
        },
        metadata: {
          tenantId,
          status,
          severity,
          retrievedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      app.log.error({ err: error, tenantId }, 'Failed to get accuracy alerts');
      return reply.status(500).send({
        error: 'Alerts retrieval failed',
        message: 'Unable to retrieve accuracy alerts'
      });
    }
  });

  // Acknowledge alert
  app.post<{
    Params: { alertId: string };
    Body: { acknowledgedBy: string; notes?: string };
  }>('/monitoring/alerts/:alertId/acknowledge', {
    schema: {
      params: z.object({ alertId: z.string() }),
      body: z.object({
        acknowledgedBy: z.string(),
        notes: z.string().optional()
      })
    },
  }, async (request, reply) => {
    const { alertId } = request.params;
    const { acknowledgedBy, notes } = request.body;

    try {
      // In a full implementation, this would update the alert in storage
      const alerts = (accuracyMonitoringSystem as any).alerts;
      const alert = alerts.get(alertId);
      
      if (!alert) {
        return reply.status(404).send({
          error: 'Alert not found',
          message: `Alert ${alertId} does not exist`
        });
      }

      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      alert.notes = notes;

      return {
        success: true,
        message: 'Alert acknowledged successfully',
        data: {
          alertId,
          acknowledgedBy,
          acknowledgedAt: alert.acknowledgedAt,
          notes
        }
      };
    } catch (error) {
      app.log.error({ err: error, alertId }, 'Failed to acknowledge alert');
      return reply.status(500).send({
        error: 'Alert acknowledgment failed',
        message: 'Unable to acknowledge alert'
      });
    }
  });
}