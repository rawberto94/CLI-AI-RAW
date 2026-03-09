import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Basic health check endpoint
 * Returns simple status for load balancers and monitoring tools
 * 
 * NOTE: This endpoint does NOT use withApiHandler because health checks
 * should not require authentication or tenant headers. Load balancers,
 * Kubernetes probes, and monitoring tools need unauthenticated access.
 */
export async function GET(_request: NextRequest) {
  try {
    const health = await healthCheckService.getOverallHealth();
    
    // Simple response format for basic health checks
    const response = {
      status: health.status,
      timestamp: health.timestamp,
      uptime: healthCheckService.getFormattedUptime(),
      version: health.version,
    };
    
    // Return 200 for healthy/degraded. Only return 503 if unhealthy AND
    // uptime > 30s (allow cold-start grace period for services to initialize).
    const uptimeMs = healthCheckService.getUptime();
    const statusCode = health.status === 'unhealthy' && uptimeMs > 30000 ? 503 : 200;
    
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: (error as Error).message },
      { status: 503 }
    );
  }
}
