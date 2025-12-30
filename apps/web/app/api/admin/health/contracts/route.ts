/**
 * Contract System Health Check
 * GET /api/admin/health/contracts - Check health of contract system
 * 
 * Returns:
 * - Database connectivity
 * - Processing job status
 * - Stuck jobs count
 * - Orphaned records
 * - Recent errors
 * - System health score
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  score: number
  timestamp: string
  checks: {
    database: { status: string; latency?: number }
    processing: { status: string; activeJobs: number; stuckJobs: number }
    orphanedData: { status: string; orphanedEmbeddings: number; orphanedArtifacts: number }
    recentErrors: { status: string; errorCount: number; lastError?: string }
  }
  recommendations: string[]
}

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()

    // Check database connectivity
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStart

    // Check processing jobs
    const activeJobs = await prisma.processingJob.count({
      where: {
        status: {
          in: ['PENDING', 'PROCESSING'] as const,
        },
      },
    });

    const stuckJobs = await prisma.processingJob.count({
      where: {
        status: 'PROCESSING' as const,
        startedAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // > 24 hours
        },
      },
    })

    // Check for orphaned data (embeddings/artifacts without contracts)
    const orphanedEmbeddings = await prisma.embedding.count({
      where: {
        contract: null,
      },
    })

    const orphanedArtifacts = await prisma.artifact.count({
      where: {
        contract: null,
      },
    })

    // Check recent errors (last hour)
    const recentErrors = await prisma.processingJob.count({
      where: {
        status: 'FAILED',
        updatedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    })

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
    })

    // Calculate health score (0-100)
    let score = 100
    const recommendations: string[] = []

    // Database latency check
    if (dbLatency > 1000) {
      score -= 20
      recommendations.push('Database latency is high (>1s). Consider connection pooling or database optimization.')
    } else if (dbLatency > 500) {
      score -= 10
      recommendations.push('Database latency is elevated (>500ms). Monitor database performance.')
    }

    // Stuck jobs check
    if (stuckJobs > 10) {
      score -= 30
      recommendations.push(`${stuckJobs} jobs stuck for >24 hours. Review job processing system.`)
    } else if (stuckJobs > 0) {
      score -= 15
      recommendations.push(`${stuckJobs} jobs stuck for >24 hours. Monitor job completion.`)
    }

    // Orphaned data check
    if (orphanedEmbeddings > 100 || orphanedArtifacts > 100) {
      score -= 20
      recommendations.push('Significant orphaned data detected. Run cleanup task.')
    } else if (orphanedEmbeddings > 0 || orphanedArtifacts > 0) {
      score -= 10
      recommendations.push('Minor orphaned data detected. Schedule cleanup.')
    }

    // Recent errors check
    if (recentErrors > 50) {
      score -= 20
      recommendations.push('High error rate in last hour. Investigate processing issues.')
    } else if (recentErrors > 10) {
      score -= 10
      recommendations.push('Elevated error rate in last hour. Monitor processing.')
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
    }

    return NextResponse.json(health)
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        score: 0,
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
