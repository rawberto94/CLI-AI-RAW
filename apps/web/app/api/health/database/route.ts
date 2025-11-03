import { NextResponse } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Database-specific health check endpoint
 */
export async function GET() {
  try {
    const dbHealth = await healthCheckService.checkDatabase();
    
    const statusCode = dbHealth.status === 'healthy' ? 200 : dbHealth.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(dbHealth, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Database health check failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
