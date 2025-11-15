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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { supplierAlertService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        session.user.tenantId
      );
    } else {
      // Get all alerts for tenant
      alerts = await supplierAlertService.getActiveAlerts(
        session.user.tenantId
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
      session.user.tenantId
    );

    return NextResponse.json({
      alerts,
      count: alerts.length,
      statistics,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching supplier alerts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch supplier alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trigger alert detection for all suppliers
    const alerts = await supplierAlertService.detectSupplierAlerts(
      session.user.tenantId
    );

    return NextResponse.json({
      message: 'Alert detection completed',
      alertsDetected: alerts.length,
      alerts,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error detecting supplier alerts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to detect supplier alerts' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rate-cards/suppliers/alerts
 * 
 * Update alert status (acknowledge, resolve, dismiss)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { alertId, action, resolution } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, action' },
        { status: 400 }
      );
    }

    let updatedAlert;

    switch (action) {
      case 'acknowledge':
        updatedAlert = await supplierAlertService.acknowledgeAlert(
          alertId,
          session.user.id
        );
        break;

      case 'resolve':
        if (!resolution) {
          return NextResponse.json(
            { error: 'Resolution is required for resolve action' },
            { status: 400 }
          );
        }
        updatedAlert = await supplierAlertService.resolveAlert({
          alertId,
          resolvedBy: session.user.id,
          resolvedAt: new Date(),
          resolution: resolution.description,
          actionTaken: resolution.actionTaken,
          notes: resolution.notes
        });
        break;

      case 'dismiss':
        updatedAlert = await supplierAlertService.dismissAlert(
          alertId,
          session.user.id
        );
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Must be acknowledge, resolve, or dismiss` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Alert ${action}d successfully`,
      alert: updatedAlert
    });
  } catch (error: any) {
    console.error('Error updating supplier alert:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update supplier alert' },
      { status: 500 }
    );
  }
}
