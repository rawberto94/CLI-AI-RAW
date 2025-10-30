import { NextResponse } from 'next/server';
import { healthCheckService } from '@/../../packages/data-orchestration/src/services/health-check.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE connection-specific health check endpoint
 */
export async function GET() {
  try {
    const sseHealth = await healthCheckService.checkSSE();
    
    const statusCode = sseHealth.status === 'healthy' ? 200 : sseHealth.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(sseHealth, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'SSE health check failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
