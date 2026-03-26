/**
 * Enhanced Renewal Radar API
 * 
 * GET /api/analytics/renewal-radar - Get renewal radar data
 * GET /api/analytics/renewal-radar?action=calendar - Get renewal calendar
 * GET /api/analytics/renewal-radar?action=portfolio - Get portfolio analytics
 * GET /api/analytics/renewal-radar?action=opportunities - Get negotiation opportunities
 * GET /api/analytics/renewal-radar?action=predict&contractId=xxx - Predict renewal outcome
 * 
 * POST /api/analytics/renewal-radar - Schedule alerts or trigger actions
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { renewalIntelligenceService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation schemas
const getRadarSchema = z.object({
  action: z.enum(['radar', 'calendar', 'portfolio', 'opportunities', 'predict', 'alerts']).default('radar'),
  daysAhead: z.coerce.number().min(1).max(730).optional().default(180),
  riskLevel: z.string().optional(), // comma-separated: critical,high,medium,low
  category: z.string().optional(),
  supplierId: z.string().optional(),
  contractId: z.string().optional(), // for predict action
  year: z.coerce.number().optional(), // for calendar action
  includeAutoRenewal: z.enum(['true', 'false']).optional().default('true'),
});

const postActionSchema = z.object({
  action: z.enum(['schedule-alerts', 'trigger-rfx', 'batch-detect', 'export']),
  contractId: z.string().optional(),
  contractIds: z.array(z.string()).optional(),
  alertConfig: z.object({
    channels: z.array(z.enum(['email', 'in_app', 'slack', 'sms'])).optional(),
    recipients: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * GET /api/analytics/renewal-radar
 * 
 * Multi-action endpoint for renewal intelligence
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  
  const validated = getRadarSchema.safeParse({
    action: searchParams.get('action') || 'radar',
    daysAhead: searchParams.get('daysAhead') || undefined,
    riskLevel: searchParams.get('riskLevel') || undefined,
    category: searchParams.get('category') || undefined,
    supplierId: searchParams.get('supplierId') || undefined,
    contractId: searchParams.get('contractId') || undefined,
    year: searchParams.get('year') || undefined,
    includeAutoRenewal: searchParams.get('includeAutoRenewal') || 'true',
  });

  if (!validated.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validated.error.message, 400);
  }

  const {
    action,
    daysAhead,
    riskLevel,
    category,
    supplierId,
    contractId,
    year,
    includeAutoRenewal,
  } = validated.data;

  const tenantId = ctx.tenantId;

  try {
    // Action: Get Renewal Radar
    if (action === 'radar') {
      const riskLevels = riskLevel ? riskLevel.split(',') as any : undefined;
      
      const radar = await renewalIntelligenceService.getRenewalRadar(tenantId, {
        daysAhead,
        riskLevel: riskLevels,
        category,
        supplierId,
        includeAutoRenewal: includeAutoRenewal === 'true',
      });

      // Calculate summary statistics
      const summary = {
        total: radar.length,
        totalValue: radar.reduce((sum, r) => sum + r.currentValue, 0),
        byRiskLevel: {
          critical: radar.filter(r => r.riskLevel === 'critical').length,
          high: radar.filter(r => r.riskLevel === 'high').length,
          medium: radar.filter(r => r.riskLevel === 'medium').length,
          low: radar.filter(r => r.riskLevel === 'low').length,
        },
        autoRenewals: radar.filter(r => r.autoRenewal).length,
        expiringWithin30Days: radar.filter(r => r.daysUntilRenewal <= 30).length,
        expiringWithin60Days: radar.filter(r => r.daysUntilRenewal <= 60).length,
        expiringWithin90Days: radar.filter(r => r.daysUntilRenewal <= 90).length,
      };

      return createSuccessResponse(ctx, {
        radar,
        summary,
        filters: {
          daysAhead,
          riskLevel: riskLevels,
          category,
          supplierId,
          includeAutoRenewal: includeAutoRenewal === 'true',
        },
      });
    }

    // Action: Get Renewal Calendar
    if (action === 'calendar') {
      const calendarYear = year || new Date().getFullYear();
      const calendar = await renewalIntelligenceService.getRenewalCalendar(tenantId, calendarYear);

      const summary = {
        year: calendarYear,
        totalRenewals: calendar.reduce((sum, m) => sum + m.renewals.length, 0),
        totalValue: calendar.reduce((sum, m) => sum + m.totalValue, 0),
        peakMonths: calendar
          .map((m, i) => ({ month: i, count: m.renewals.length, value: m.totalValue }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(m => ({
            month: calendar[m.month].monthName,
            renewals: m.count,
            value: m.value,
          })),
      };

      return createSuccessResponse(ctx, {
        calendar,
        summary,
      });
    }

    // Action: Get Portfolio Analytics
    if (action === 'portfolio') {
      const analytics = await renewalIntelligenceService.getPortfolioAnalytics(tenantId, {
        lookbackMonths: 12,
      });

      return createSuccessResponse(ctx, {
        analytics,
        generatedAt: new Date().toISOString(),
      });
    }

    // Action: Get Negotiation Opportunities
    if (action === 'opportunities') {
      const opportunities = await renewalIntelligenceService.identifyNegotiationOpportunities(
        tenantId,
        {
          minSavingsPercentage: 5,
          minValue: 10000,
          daysUntilRenewal: daysAhead,
        }
      );

      const summary = {
        totalOpportunities: opportunities.length,
        totalPotentialSavings: opportunities.reduce((sum, o) => sum + o.potentialSavings, 0),
        avgSavingsPercentage: opportunities.length > 0
          ? opportunities.reduce((sum, o) => sum + o.savingsPercentage, 0) / opportunities.length
          : 0,
        byPriority: {
          critical: opportunities.filter(o => o.priority === 'critical').length,
          high: opportunities.filter(o => o.priority === 'high').length,
          medium: opportunities.filter(o => o.priority === 'medium').length,
          low: opportunities.filter(o => o.priority === 'low').length,
        },
      };

      return createSuccessResponse(ctx, {
        opportunities,
        summary,
      });
    }

    // Action: Predict Renewal Outcome
    if (action === 'predict') {
      if (!contractId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId is required for prediction', 400);
      }

      const prediction = await renewalIntelligenceService.predictRenewal(contractId, tenantId);

      return createSuccessResponse(ctx, {
        prediction,
      });
    }

    // Action: Get Alert Schedule
    if (action === 'alerts') {
      if (!contractId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId is required for alerts', 400);
      }

      const schedule = await renewalIntelligenceService.generateAlertSchedule(contractId, tenantId);

      return createSuccessResponse(ctx, {
        schedule,
      });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
  } catch (error) {
    logger.error('[RenewalRadar] API error', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process request', 500);
  }
});

/**
 * POST /api/analytics/renewal-radar
 * 
 * Actions:
 * - schedule-alerts: Schedule renewal alerts for contract(s)
 * - trigger-rfx: Trigger RFX generation for a contract
 * - batch-detect: Run batch relationship detection
 * - export: Export renewal data
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  
  const validated = postActionSchema.safeParse(body);
  if (!validated.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validated.error.message, 400);
  }

  const { action, contractId, contractIds, alertConfig } = validated.data;
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  try {
    // Action: Schedule Alerts
    if (action === 'schedule-alerts') {
      const targetIds = contractId ? [contractId] : contractIds;
      
      if (!targetIds || targetIds.length === 0) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId or contractIds required', 400);
      }

      const results: { contractId: string; alertsScheduled: number }[] = [];
      for (const id of targetIds) {
        const schedule = await renewalIntelligenceService.generateAlertSchedule(id, tenantId);
        
        // Store alert schedule in database (may fail if migration not run yet)
        try {
          for (const alert of schedule.alerts) {
            await prisma.contractAlert.create({
              data: {
                tenantId,
                contractId: id,
                type: alert.type,
                scheduledDate: alert.scheduledDate,
                priority: alert.priority,
                channels: alert.channels,
                recipients: alertConfig?.recipients || [userId],
                status: 'scheduled',
              },
            });
          }
        } catch (dbError) {
          logger.warn('[RenewalRadar] Failed to store alerts (migration may be needed)', { error: dbError });
          // Continue without storing - alerts are still returned in response
        }

        results.push({
          contractId: id,
          alertsScheduled: schedule.alerts.length,
        });
      }

      return createSuccessResponse(ctx, {
        scheduled: results,
        totalAlerts: results.reduce((sum, r) => sum + r.alertsScheduled, 0),
      });
    }

    // Action: Trigger RFX
    if (action === 'trigger-rfx') {
      if (!contractId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId is required', 400);
      }

      // Create RFX event/record
      const rfxEvent = await prisma.rFxEvent.create({
        data: {
          tenantId,
          sourceContractId: contractId,
          status: 'DRAFT',
          createdBy: userId,
          title: `RFX for ${contractId}`,
          type: 'RFX_INITIATED',
          responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return createSuccessResponse(ctx, {
        rfxEvent: {
          id: rfxEvent.id,
          status: rfxEvent.status,
          contractId,
        },
        message: 'RFX generation initiated. Complete setup in the RFX module.',
      });
    }

    // Action: Batch Detect
    if (action === 'batch-detect') {
      const { relationshipDetectionService } = await import('data-orchestration/services');
      
      const result = await relationshipDetectionService.runBatchDetection(tenantId, {
        contractIds,
        maxContracts: 100,
      });

      return createSuccessResponse(ctx, {
        batchResult: result,
      });
    }

    // Action: Export
    if (action === 'export') {
      const radar = await renewalIntelligenceService.getRenewalRadar(tenantId, {
        daysAhead: 365,
      });

      // Format for export
      const exportData = radar.map(r => ({
        'Contract ID': r.contractId,
        'Title': r.contractTitle,
        'Supplier': r.supplierName,
        'Category': r.category,
        'Current Value': r.currentValue,
        'Currency': r.currency,
        'Renewal Date': r.renewalDate.toISOString().split('T')[0],
        'Days Until Renewal': r.daysUntilRenewal,
        'Risk Level': r.riskLevel,
        'Risk Score': r.riskScore,
        'Auto-Renewal': r.autoRenewal,
        'Opt-Out Deadline': r.optOutDeadline?.toISOString().split('T')[0] || 'N/A',
        'Recommended Action': r.recommendedAction,
        'Issues': r.issues.join('; '),
      }));

      return createSuccessResponse(ctx, {
        exportData,
        count: exportData.length,
        exportedAt: new Date().toISOString(),
      });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
  } catch (error) {
    logger.error('[RenewalRadar] API error', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process action', 500);
  }
});
