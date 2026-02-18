/**
 * Contract System Health Check
 * GET /api/admin/health/contracts - Check health of contract system
 */

import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { healthCheckService } from 'data-orchestration/services';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  timestamp: string;
  checks: {
    database: { status: string; latency?: number };
    processing: { status: string; activeJobs: number; stuckJobs: number };
    orphanedData: { status: string; orphanedEmbeddings: number; orphanedArtifacts: number };
    recentErrors: { status: string; errorCount: number; lastError?: string };
  };
  recommendations: string[];
}

export const GET = withAuthApiHandler(async (_request, ctx) => {
  // Check database connectivity
  const dbStart = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbLatency = Date.now() - dbStart;

  // Check processing jobs
  const activeJobs = await prisma.processingJob.count({
    where: {
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
  });

  const stuckJobs = await prisma.processingJob.count({
    where: {
      status: 'RUNNING',
      startedAt: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  // Check for orphaned data
  const orphanedEmbeddings = await prisma.embedding.count({
    where: {
      contractId: undefined,
    },
  });

  const orphanedArtifacts = await prisma.artifact.count({
    where: {
      contractId: undefined,
    },
  });

  // Check recent errors (last hour)
  const recentErrors = await prisma.processingJob.count({
    where: {
      status: 'FAILED',
      updatedAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
  });

  const lastError = await prisma.processingJob.findFirst({
    where: {
      status: 'FAILED',
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      error: true,
      errorCategory: true,
      updatedAt: true,
    },
  });

  // Calculate health score (0-100)
  let score = 100;
  const recommendations: string[] = [];

  if (dbLatency > 1000) {
    score -= 20;
    recommendations.push('Database latency is high (>1s). Consider connection pooling or database optimization.');
  } else if (dbLatency > 500) {
    score -= 10;
    recommendations.push('Database latency is elevated (>500ms). Monitor database performance.');
  }

  if (stuckJobs > 10) {
    score -= 30;
    recommendations.push(`${stuckJobs} jobs stuck for >24 hours. Review job processing system.`);
  } else if (stuckJobs > 0) {
    score -= 15;
    recommendations.push(`${stuckJobs} jobs stuck for >24 hours. Monitor job completion.`);
  }

  if (orphanedEmbeddings > 100 || orphanedArtifacts > 100) {
    score -= 20;
    recommendations.push('Significant orphaned data detected. Run cleanup task.');
  } else if (orphanedEmbeddings > 0 || orphanedArtifacts > 0) {
    score -= 10;
    recommendations.push('Minor orphaned data detected. Schedule cleanup.');
  }

  if (recentErrors > 50) {
    score -= 20;
    recommendations.push('High error rate in last hour. Investigate processing issues.');
  } else if (recentErrors > 10) {
    score -= 10;
    recommendations.push('Elevated error rate in last hour. Monitor processing.');
  }

  const health: HealthCheck = {
    status: score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'unhealthy',
    score: Math.max(0, score),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbLatency < 500 ? 'healthy' : dbLatency < 1000 ? 'degraded' : 'unhealthy',
        latency: dbLatency,
      },
      processing: {
        status: stuckJobs === 0 ? 'healthy' : stuckJobs < 10 ? 'degraded' : 'unhealthy',
        activeJobs,
        stuckJobs,
      },
      orphanedData: {
        status: orphanedEmbeddings + orphanedArtifacts === 0 ? 'healthy' : orphanedEmbeddings + orphanedArtifacts < 100 ? 'degraded' : 'unhealthy',
        orphanedEmbeddings,
        orphanedArtifacts,
      },
      recentErrors: {
        status: recentErrors === 0 ? 'healthy' : recentErrors < 10 ? 'degraded' : 'unhealthy',
        errorCount: recentErrors,
        lastError: lastError
          ? `${lastError.errorCategory || 'Unknown'}: ${lastError.error?.substring(0, 100) || 'No details'} (${lastError.updatedAt.toISOString()})`
          : undefined,
      },
    },
    recommendations: recommendations.length > 0 ? recommendations : ['All systems operating normally'],
  };

  return createSuccessResponse(ctx, health);
});
