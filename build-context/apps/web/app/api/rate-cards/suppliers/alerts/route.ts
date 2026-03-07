/**
 * Supplier Alerts API Endpoint
 * 
 * GET /api/rate-cards/suppliers/alerts
 * 
 * Returns supplier alerts including:
 * - Above-market rate increases
 * - Deteriorating competitiveness
 * - Accelerating rate increases
 * - Market position declines
 * 
 * POST /api/rate-cards/suppliers/alerts
 * 
 * Triggers alert detection for all suppliers
 * 
 * Requirements: 4.2
 */

import { NextRequest } from 'next/server';
import { supplierAlertService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status') || 'active';
    const severity = searchParams.get('severity');
    const alertType = searchParams.get('alertType');

    // Get alerts based on filters
    let alerts;
    
    if (supplierId) {
      // Get alerts for specific supplier
      alerts = await supplierAlertService.getSupplierAlerts(
        supplierId,
        ctx.tenantId
      );
    } else {
      // Get all alerts for tenant
      alerts = await supplierAlertService.getActiveAlerts(
        ctx.tenantId
      );
    }

    // Apply additional filters
    if (status && status !== 'all') {
      alerts = alerts.filter(alert => alert.status === status);
    }

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    if (alertType) {
      alerts = alerts.filter(alert => alert.alertType === alertType);
    }

    // Get alert statistics
    const statistics = await supplierAlertService.getAlertStatistics(
      ctx.tenantId
    );

    return createSuccessResponse(ctx, {
      alerts,
      count: alerts.length,
      statistics,
      generatedAt: new Date().toISOString()
    });
  });

export const POST = withAuthApiHandler(async (request, ctx) => {
    // Trigger alert detection for all suppliers
    const alerts = await supplierAlertService.detectSupplierAlerts(
      ctx.tenantId
    );

    return createSuccessResponse(ctx, {
      message: 'Alert detection completed',
      alertsDetected: alerts.length,
      alerts,
      generatedAt: new Date().toISOString()
    });
  });

/**
 * PATCH /api/rate-cards/suppliers/alerts
 * 
 * Update alert status (acknowledge, resolve, dismiss)
 */
export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { alertId, action, resolution } = body;

    if (!alertId || !action) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required fields: alertId, action', 400);
    }

    let updatedAlert;

    switch (action) {
      case 'acknowledge':
        updatedAlert = await supplierAlertService.acknowledgeAlert(
          alertId,
          ctx.userId
        );
        break;

      case 'resolve':
        if (!resolution) {
          return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Resolution is required for resolve action', 400);
        }
        updatedAlert = await supplierAlertService.resolveAlert({
          alertId,
          resolvedBy: ctx.userId,
          resolvedAt: new Date(),
          resolution: resolution.description,
          actionTaken: resolution.actionTaken,
          notes: resolution.notes
        });
        break;

      case 'dismiss':
        updatedAlert = await supplierAlertService.dismissAlert(
          alertId,
          ctx.userId
        );
        break;

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      message: `Alert ${action}d successfully`,
      alert: updatedAlert
    });
  });
