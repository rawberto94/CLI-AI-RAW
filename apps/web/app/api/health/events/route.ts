import { NextResponse } from 'next/server';
import { healthCheckService } from '@/../../packages/data-orchestration/src/services/health-check.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Event bus-specific health check endpoint
 */
export async function GET() {
  try {
    const eventBusHealth = await healthCheckService.checkEventBus();
    
    const statusCode = eventBusHealth.status === 'healthy' ? 200 : eventBusHealth.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(eventBusHealth, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Event bus health check failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
