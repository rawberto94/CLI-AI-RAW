/**
 * Taxonomy Metrics API
 * GET /api/admin/metrics/taxonomy - Get taxonomy adoption and classification metrics
 * 
 * Returns:
 * - Migration progress
 * - Classification distribution
 * - Confidence scores
 * - Document role distribution
 * - Tag usage statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface TaxonomyMetrics {
  migration: {
    total: number
    migrated: number
    pending: number
    progressPercentage: number
  }
  classification: {
    byCategory: Record<string, number>
    byRole: Record<string, number>
    averageConfidence: number
    lowConfidenceCount: number
  }
  tags: {
    pricingModels: Record<string, number>
    deliveryModels: Record<string, number>
    dataProfiles: Record<string, number>
    riskFlags: Record<string, number>
  }
  quality: {
    highConfidence: number // >= 0.8
    mediumConfidence: number // 0.5 - 0.8
    lowConfidence: number // < 0.5
    unclassified: number
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')

    // Build where clause for tenant filtering
    const whereClause = tenantId
      ? {
          tenantId,
          isDeleted: false,
        }
      : {
          isDeleted: false,
        }

    // Total contracts
    const totalContracts = await prisma.contract.count({
      where: whereClause,
    })

    // Migrated contracts (have contractCategoryId)
    const migratedContracts = await prisma.contract.count({
      where: {
        ...whereClause,
        contractCategoryId: {
          not: null,
        },
      },
    })

    // Get classification distribution
    const categoryDistribution = await prisma.contract.groupBy({
      by: ['contractCategoryId'],
      where: {
        ...whereClause,
        contractCategoryId: {
          not: null,
        },
      },
      _count: true,
    })

    const roleDistribution = await prisma.contract.groupBy({
      by: ['documentRole'],
      where: {
        ...whereClause,
        documentRole: {
          not: null,
        },
      },
      _count: true,
    })

    // Get confidence statistics
    const confidenceStats = await prisma.contract.groupBy({
      by: ['contractCategoryId'],
      where: {
        ...whereClause,
        classificationConf: {
          not: null,
        },
      },
      _avg: {
        classificationConf: true,
      },
      _count: true,
    })

    // Count by confidence levels
    const highConfidence = await prisma.contract.count({
      where: {
        ...whereClause,
        classificationConf: {
          gte: 0.8,
        },
      },
    })

    const mediumConfidence = await prisma.contract.count({
      where: {
        ...whereClause,
        classificationConf: {
          gte: 0.5,
          lt: 0.8,
        },
      },
    })

    const lowConfidence = await prisma.contract.count({
      where: {
        ...whereClause,
        classificationConf: {
          lt: 0.5,
        },
      },
    })

    // Get tag usage (this requires JSON querying, simplified for now)
    // In production, you'd use Prisma's JSON operators or raw queries
    const contractsWithTags = await prisma.contract.findMany({
      where: {
        ...whereClause,
        OR: [
          { pricingModels: { not: Prisma.DbNull } },
          { deliveryModels: { not: Prisma.DbNull } },
          { dataProfiles: { not: Prisma.DbNull } },
          { riskFlags: { not: Prisma.DbNull } },
        ],
      },
      select: {
        pricingModels: true,
        deliveryModels: true,
        dataProfiles: true,
        riskFlags: true,
      },
    })

    // Aggregate tag usage
    const tagStats = {
      pricingModels: {} as Record<string, number>,
      deliveryModels: {} as Record<string, number>,
      dataProfiles: {} as Record<string, number>,
      riskFlags: {} as Record<string, number>,
    }

    contractsWithTags.forEach((contract) => {
      // Count pricing models
      if (Array.isArray(contract.pricingModels)) {
        contract.pricingModels.forEach((tag: any) => {
          const tagStr = typeof tag === 'string' ? tag : JSON.stringify(tag)
          tagStats.pricingModels[tagStr] = (tagStats.pricingModels[tagStr] || 0) + 1
        })
      }

      // Count delivery models
      if (Array.isArray(contract.deliveryModels)) {
        contract.deliveryModels.forEach((tag: any) => {
          const tagStr = typeof tag === 'string' ? tag : JSON.stringify(tag)
          tagStats.deliveryModels[tagStr] = (tagStats.deliveryModels[tagStr] || 0) + 1
        })
      }

      // Count data profiles
      if (Array.isArray(contract.dataProfiles)) {
        contract.dataProfiles.forEach((tag: any) => {
          const tagStr = typeof tag === 'string' ? tag : JSON.stringify(tag)
          tagStats.dataProfiles[tagStr] = (tagStats.dataProfiles[tagStr] || 0) + 1
        })
      }

      // Count risk flags
      if (Array.isArray(contract.riskFlags)) {
        contract.riskFlags.forEach((tag: any) => {
          const tagStr = typeof tag === 'string' ? tag : JSON.stringify(tag)
          tagStats.riskFlags[tagStr] = (tagStats.riskFlags[tagStr] || 0) + 1
        })
      }
    })

    // Calculate average confidence
    const avgConfidence =
      confidenceStats.reduce((sum, stat) => sum + (stat._avg.classificationConf || 0), 0) /
      (confidenceStats.length || 1)

    const metrics: TaxonomyMetrics = {
      migration: {
        total: totalContracts,
        migrated: migratedContracts,
        pending: totalContracts - migratedContracts,
        progressPercentage: totalContracts > 0 ? Math.round((migratedContracts / totalContracts) * 100) : 0,
      },
      classification: {
        byCategory: categoryDistribution.reduce((acc, item) => {
          if (item.contractCategoryId) {
            acc[item.contractCategoryId] = item._count
          }
          return acc
        }, {} as Record<string, number>),
        byRole: roleDistribution.reduce((acc, item) => {
          if (item.documentRole) {
            acc[item.documentRole] = item._count
          }
          return acc
        }, {} as Record<string, number>),
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        lowConfidenceCount: lowConfidence,
      },
      tags: tagStats,
      quality: {
        highConfidence,
        mediumConfidence,
        lowConfidence,
        unclassified: totalContracts - migratedContracts,
      },
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Taxonomy metrics error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get taxonomy metrics',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
