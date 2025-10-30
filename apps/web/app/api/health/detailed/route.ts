import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '@/../../packages/data-orchestration/src/services/health-check.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Detailed health check endpoint
 * Returns comprehensive health information for all system components
 */
export async function GET(request: NextRequest) {
  try {
    const health = await healthCheckService.getOverallHealth();
    
    // Add system metrics
    const memUsage = process.memoryUsage();
    const systemMetrics = {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
        percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
      },
      process: {
        uptime: healthCheckService.getFormattedUptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    };
    
    const response = {
      ...health,
      system: systemMetrics,
    };
    
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
      },
      { status: 503 }
    );
  }
}
