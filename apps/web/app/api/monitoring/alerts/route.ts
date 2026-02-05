import { NextRequest, NextResponse } from 'next/server';
import { alertingService } from 'data-orchestration/services';

/**
 * GET /api/monitoring/alerts
 * Returns active alerts and alert history
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const activeAlerts = alertingService.getActiveAlerts();
    const history = includeHistory ? alertingService.getAlertHistory(limit) : [];

    return NextResponse.json({
      active: activeAlerts,
      history,
      count: {
        active: activeAlerts.length,
        history: history.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/alerts/check
 * Manually trigger threshold checks
 */
export async function POST(_request: NextRequest) {
  try {
    const newAlerts = await alertingService.checkThresholds();

    return NextResponse.json({
      newAlerts,
      count: newAlerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to check thresholds' },
      { status: 500 }
    );
  }
}
