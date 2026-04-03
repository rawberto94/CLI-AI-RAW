import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe — returns 200 if the process is alive and DB is reachable.
 * Use /api/health/detailed as a readiness probe for full subsystem checks.
 *
 * NOTE: This endpoint does NOT use withApiHandler because health checks
 * should not require authentication or tenant headers. Load balancers,
 * Kubernetes probes, and monitoring tools need unauthenticated access.
 */
export async function GET(request: NextRequest) {
  const isReadiness = request.nextUrl.searchParams.get('ready') === '1';

  try {
    if (isReadiness) {
      // Full readiness check — all subsystems
      const health = await healthCheckService.getOverallHealth();
      const uptimeMs = healthCheckService.getUptime();
      const statusCode = health.status === 'unhealthy' && uptimeMs > 30000 ? 503 : 200;

      return NextResponse.json(
        {
          status: health.status,
          timestamp: health.timestamp,
          uptime: healthCheckService.getFormattedUptime(),
          version: health.version,
        },
        { status: statusCode, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    // Liveness probe — lightweight DB ping via direct query
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: healthCheckService.getFormattedUptime(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: (error as Error).message },
      { status: 503 }
    );
  }
}
