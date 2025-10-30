import { NextResponse } from 'next/server';
import { healthCheckService } from '@/../../packages/data-orchestration/src/services/health-check.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cache-specific health check endpoint
 */
export async function GET() {
  try {
    const cacheHealth = await healthCheckService.checkCache();
    
    const statusCode = cacheHealth.status === 'healthy' ? 200 : cacheHealth.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(cacheHealth, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Cache health check failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
