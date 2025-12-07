import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const dataMode = request.headers.get('x-data-mode') || 'real'

    if (dataMode !== 'real') {
      // Return mock data for non-real modes
      return NextResponse.json({
        totalContracts: 247,
        totalValue: 45600000,
        potentialSavings: 6840000,
        activeSuppliers: 89,
        upcomingRenewals: 23,
        artifactsProcessed: 1847
      })
    }

    // Real data from database (excluding DELETED contracts)
    const [
      totalContracts,
      valueAggregate,
      suppliers,
      artifacts,
      upcomingContracts
    ] = await Promise.all([
      prisma.contract.count({ where: { status: { not: 'DELETED' } } }),
      prisma.contract.aggregate({
        where: { status: { not: 'DELETED' } },
        _sum: { totalValue: true }
      }),
      prisma.contract.groupBy({
        by: ['supplierName'],
        where: { supplierName: { not: null }, status: { not: 'DELETED' } }
      }),
      prisma.artifact.count(),
      prisma.contract.count({
        where: {
          status: { not: 'DELETED' },
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
          }
        }
      })
    ])

    return NextResponse.json({
      totalContracts,
      totalValue: Number(valueAggregate._sum.totalValue || 0),
      potentialSavings: Math.round(Number(valueAggregate._sum.totalValue || 0) * 0.15), // 15% estimate
      activeSuppliers: suppliers.length,
      upcomingRenewals: upcomingContracts,
      artifactsProcessed: artifacts
    })
  } catch (error) {
    console.error('Analytics metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
