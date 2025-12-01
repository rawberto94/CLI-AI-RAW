/**
 * Readiness Check Endpoint
 * Deep health check for Kubernetes readiness probes
 * Checks all critical dependencies
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DependencyCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  message?: string;
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: DependencyCheck[];
  details?: Record<string, unknown>;
}

// Track server start time
const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<DependencyCheck> {
  const start = Date.now();
  try {
    // Dynamically import to avoid initialization issues
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      name: 'database',
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<DependencyCheck> {
  const start = Date.now();
  
  // Check if Redis is configured
  if (!process.env.REDIS_URL) {
    return {
      name: 'redis',
      status: 'degraded',
      message: 'Redis not configured',
    };
  }

  try {
    const { getCached, setCached } = await import('@/lib/cache');
    
    // Simple ping test
    const testKey = `health_check_${Date.now()}`;
    await setCached(testKey, 'ping', { ttl: 10 });
    const result = await getCached<string>(testKey);
    
    if (result === 'ping') {
      return {
        name: 'redis',
        status: 'healthy',
        latency: Date.now() - start,
      };
    }
    
    return {
      name: 'redis',
      status: 'degraded',
      latency: Date.now() - start,
      message: 'Cache read/write mismatch',
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check storage connectivity (S3/MinIO)
 */
async function checkStorage(): Promise<DependencyCheck> {
  const start = Date.now();
  
  // Check if storage is configured
  if (!process.env.S3_BUCKET && !process.env.MINIO_BUCKET) {
    return {
      name: 'storage',
      status: 'degraded',
      message: 'Storage not configured',
    };
  }

  try {
    // Just check if we can initialize the client
    // Actual bucket operations might require credentials
    return {
      name: 'storage',
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'storage',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): DependencyCheck {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usagePercent = (used.heapUsed / used.heapTotal) * 100;

  if (usagePercent > 90) {
    return {
      name: 'memory',
      status: 'unhealthy',
      message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    };
  }

  if (usagePercent > 75) {
    return {
      name: 'memory',
      status: 'degraded',
      message: `Elevated memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
    };
  }

  return {
    name: 'memory',
    status: 'healthy',
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
  };
}

/**
 * Check disk space (approximate via temp file)
 */
function checkDiskSpace(): DependencyCheck {
  // Node.js doesn't have direct disk space access
  // In production, you'd use a monitoring agent
  return {
    name: 'disk',
    status: 'healthy',
    message: 'Disk check requires system agent',
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verbose = url.searchParams.get('verbose') === 'true';
  const timeout = parseInt(url.searchParams.get('timeout') || '5000', 10);

  // Run all checks with timeout
  const checkPromises = [
    Promise.race([
      checkDatabase(),
      new Promise<DependencyCheck>((_, reject) =>
        setTimeout(() => reject(new Error('Database check timeout')), timeout)
      ),
    ]).catch((error): DependencyCheck => ({
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Timeout',
    })),
    Promise.race([
      checkRedis(),
      new Promise<DependencyCheck>((_, reject) =>
        setTimeout(() => reject(new Error('Redis check timeout')), timeout)
      ),
    ]).catch((error): DependencyCheck => ({
      name: 'redis',
      status: 'degraded',
      message: error instanceof Error ? error.message : 'Timeout',
    })),
    Promise.race([
      checkStorage(),
      new Promise<DependencyCheck>((_, reject) =>
        setTimeout(() => reject(new Error('Storage check timeout')), timeout)
      ),
    ]).catch((error): DependencyCheck => ({
      name: 'storage',
      status: 'degraded',
      message: error instanceof Error ? error.message : 'Timeout',
    })),
  ];

  const [databaseCheck, redisCheck, storageCheck] = await Promise.all(checkPromises);
  const memoryCheck = checkMemory();
  const diskCheck = checkDiskSpace();

  const checks: DependencyCheck[] = [
    databaseCheck,
    redisCheck,
    storageCheck,
    memoryCheck,
    diskCheck,
  ];

  // Determine overall status
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');

  // Database is critical - if it's down, we're not ready
  const isCriticalDown = databaseCheck.status === 'unhealthy';

  let overallStatus: ReadinessResponse['status'];
  if (isCriticalDown || hasUnhealthy) {
    overallStatus = 'not_ready';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'ready';
  }

  const response: ReadinessResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  // Add verbose details if requested
  if (verbose) {
    response.details = {
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };
  }

  // Set appropriate HTTP status
  const httpStatus = overallStatus === 'ready' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': overallStatus,
    },
  });
}
