import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '@/../../packages/data-orchestration/src/services/health-check.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Basic health check endpoint
 * Returns simple status for load balancers and monitoring tools
 */
export async function GET(request: NextRequest) {
  try {
    const health = await healthCheckService.getOverallHealth();
    
    // Simple response format for basic health checks
    const response = {
      status: health.status,
      timestamp: health.timestamp,
      uptime: healthCheckService.getFormattedUptime(),
      version: health.version,
    };
    
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      },
      { status: 503 }
    );
  }
}
