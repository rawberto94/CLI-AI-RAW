import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';
import { expirationOrEndDateFilter, portfolioWhere } from '@/lib/contracts/server/portfolio';
import { resolveDisplayCurrency, sumGroupedTotalValue } from '@/lib/display-currency.server';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'TENANT_REQUIRED', 'Tenant ID required', 400);
  }

  const displayCurrency = await resolveDisplayCurrency(ctx.tenantId);
  const cacheKey = `analytics:metrics:${tenantId}:${displayCurrency}:v3`;
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

  const portfolio = portfolioWhere(tenantId);
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    totalContracts,
    valueByCurrency,
    suppliers,
    artifacts,
    upcomingContracts
  ] = await Promise.all([
    prisma.contract.count({ where: portfolio }),
    prisma.contract.groupBy({
      by: ['currency'],
      where: { ...portfolio, totalValue: { not: null } },
      _sum: { totalValue: true },
    }),
    prisma.contract.groupBy({
      by: ['supplierName'],
      where: { ...portfolio, supplierName: { not: null } }
    }),
    prisma.artifact.count({ where: { tenantId } }),
    prisma.contract.count({
      where: {
        ...portfolio,
        ...expirationOrEndDateFilter({ gte: now, lte: ninetyDaysFromNow }),
      }
    })
  ])

  const totalValue = sumGroupedTotalValue(valueByCurrency, displayCurrency);
  const data = {
    totalContracts,
    totalValue,
    displayCurrency,
    potentialSavings: Math.round(totalValue * 0.15), // 15% estimate
    activeSuppliers: suppliers.length,
    upcomingRenewals: upcomingContracts,
    artifactsProcessed: artifacts
  };
  await setCached(cacheKey, data, { ttl: 60 });
  return createSuccessResponse(ctx, data);
});
