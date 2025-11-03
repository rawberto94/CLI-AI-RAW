import { NextRequest, NextResponse } from 'next/server';
import { alertingService } from 'data-orchestration/services';

/**
 * POST /api/monitoring/alerts/[id]/acknowledge
 * Acknowledge an alert
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const alertId = params.id;
    const success = alertingService.acknowledgeAlert(alertId);

    if (!success) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      alertId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Alerts API] Error acknowledging alert:', error);
    
    return NextResponse.json(
      { error: 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
