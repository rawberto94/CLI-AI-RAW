import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAiConfigured, areRequiredKeysConfigured } from '@/lib/api-key-utils';

/**
 * Health Check API Endpoint
 * Returns the health status of the API and all services
 * 
 * OPTIMIZATION: Caches response for 10 seconds to reduce database load
 */

// Cache healthz response for 10 seconds
export const revalidate = 10;

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  error?: string;
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'operational', latency: Date.now() - start };
  } catch (error) {
    return { 
      status: 'down', 
      latency: Date.now() - start,
      error: (error as Error).message 
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  if (!process.env.REDIS_HOST) {
    return { status: 'degraded', error: 'Not configured' };
  }
  // Redis check would go here if we had a client
  return { status: 'operational' };
}

function checkAiServices(): ServiceStatus {
  if (!isAiConfigured()) {
    return { status: 'degraded', error: 'API key not configured' };
  }
  return { status: 'operational' };
}

function checkStorage(): ServiceStatus {
  const hasMinIO = process.env.MINIO_ENDPOINT;
  const hasS3 = process.env.S3_ENDPOINT;
  
  if (!hasMinIO && !hasS3) {
    return { status: 'degraded', error: 'No storage configured' };
  }
  return { status: 'operational' };
}

function checkSecurity(): ServiceStatus {
  if (!areRequiredKeysConfigured()) {
    return { status: 'degraded', error: 'Missing security secrets' };
  }
  return { status: 'operational' };
}

export async function GET() {
  const startTime = Date.now();
  
  // Run health checks in parallel
  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);
  
  const aiStatus = checkAiServices();
  const storageStatus = checkStorage();
  const securityStatus = checkSecurity();
  
  // Determine overall health
  const allServices = [dbStatus, redisStatus, aiStatus, storageStatus, securityStatus];
  const hasDown = allServices.some(s => s.status === 'down');
  const hasDegraded = allServices.some(s => s.status === 'degraded');
  
  const overallStatus = hasDown ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
  const statusCode = hasDown ? 503 : 200;
  
  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    services: {
      database: dbStatus,
      redis: redisStatus,
      ai: aiStatus,
      storage: storageStatus,
      security: securityStatus,
    },
  }, {
    status: statusCode,
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
    },
  });
}
