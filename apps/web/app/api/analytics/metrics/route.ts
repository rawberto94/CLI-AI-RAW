import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  const cacheKey = `analytics:metrics:${tenantId}`;
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

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

  const data = {
    totalContracts,
    totalValue: Number(valueAggregate._sum.totalValue || 0),
    potentialSavings: Math.round(Number(valueAggregate._sum.totalValue || 0) * 0.15), // 15% estimate
    activeSuppliers: suppliers.length,
    upcomingRenewals: upcomingContracts,
    artifactsProcessed: artifacts
  };
  await setCached(cacheKey, data, 60);
  return createSuccessResponse(ctx, data);
});
