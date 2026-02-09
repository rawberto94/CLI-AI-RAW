import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const dataMode = request.headers.get('x-data-mode') || 'real'

  if (dataMode !== 'real') {
    // Return mock data for non-real modes
    return createSuccessResponse(ctx, {
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
    prisma.contract.count({ where: { isDeleted: false } }),
    prisma.contract.aggregate({
      where: { isDeleted: false },
      _sum: { totalValue: true }
    }),
    prisma.contract.groupBy({
      by: ['supplierName'],
      where: { supplierName: { not: null }, isDeleted: false }
    }),
    prisma.artifact.count(),
    prisma.contract.count({
      where: {
        isDeleted: false,
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }
      }
    })
  ])

  return createSuccessResponse(ctx, {
    totalContracts,
    totalValue: Number(valueAggregate._sum.totalValue || 0),
    potentialSavings: Math.round(Number(valueAggregate._sum.totalValue || 0) * 0.15), // 15% estimate
    activeSuppliers: suppliers.length,
    upcomingRenewals: upcomingContracts,
    artifactsProcessed: artifacts
  })
});
