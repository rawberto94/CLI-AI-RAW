import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      details?: any;
      error?: string;
    };
  };
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    nodeVersion: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthCheckResult>> {
  const startTime = Date.now();
  const checks: HealthCheckResult['services'] = {};

  // Database health check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'up',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Application health check (basic check that app is running)
  checks.application = {
    status: 'up',
    responseTime: Date.now() - startTime,
  };

  // Determine overall status
  const allUp = Object.values(checks).every((check) => check.status === 'up');
  const anyDown = Object.values(checks).some((check) => check.status === 'down');
  const overallStatus = allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded';

  // System metrics
  const memUsage = process.memoryUsage();
  const system = {
    uptime: process.uptime(),
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    nodeVersion: process.version,
  };

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: checks,
    system,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(result, { status: statusCode });
}
