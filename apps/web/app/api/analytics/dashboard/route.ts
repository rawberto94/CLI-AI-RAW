import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';
import { expirationOrEndDateFilter, portfolioWhere } from '@/lib/contracts/server/portfolio';
import { clampTrendPercent } from '@/lib/utils/percent';
import { resolveDisplayCurrency, sumGroupedTotalValue } from '@/lib/display-currency.server';

// Helper to get date range from timeframe
function getDateRange(timeframe: string): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const now = new Date();
  const end = now;
  let days: number;
  
  switch (timeframe) {
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    case '1y':
      days = 365;
      break;
    default:
      days = 30;
  }
  
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - days * 24 * 60 * 60 * 1000);
  
  return { start, end, previousStart, previousEnd };
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get('timeframe') || '30d';
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'TENANT_REQUIRED', 'Tenant ID required', 400);
  }

  // Check cache first (5 minute TTL for dashboard data)
  const displayCurrency = await resolveDisplayCurrency(ctx.tenantId);
  const cacheKey = `analytics:dashboard:${tenantId}:${timeframe}:${displayCurrency}:v3`;
  const cached = await getCached<{ metrics: unknown; timeframe: string; period: unknown }>(cacheKey);
  if (cached) {
    return createSuccessResponse(ctx, cached);
  }
  
  const { start, end, previousStart, previousEnd } = getDateRange(timeframe);
  const portfolio = portfolioWhere(tenantId);
  
  const whereClause = {
    ...portfolio,
    createdAt: { gte: start, lte: end },
  };
  
  const previousWhereClause = {
    ...portfolio,
    createdAt: { gte: previousStart, lte: previousEnd },
  };

  // Execute all queries in parallel for performance
  const [
    totalContracts,
    previousTotalContracts,
    activeContracts,
    _previousActiveContracts,
    valueByCurrency,
    previousValueByCurrency,
    pendingApprovals,
    expiringContracts,
    statusCounts,
  ] = await Promise.all([
    // Total contracts in period
    prisma.contract.count({ where: whereClause }),
    
    // Previous period total
    prisma.contract.count({ where: previousWhereClause }),
    
    // Active contracts in period (portfolio ACTIVE only)
    prisma.contract.count({
      where: {
        ...whereClause,
        status: 'ACTIVE',
      },
    }),
    
    // Previous active contracts
    prisma.contract.count({
      where: {
        ...previousWhereClause,
        status: 'ACTIVE',
      },
    }),
    
    prisma.contract.groupBy({
      by: ['currency'],
      where: { ...whereClause, totalValue: { not: null } },
      _sum: { totalValue: true },
    }),
    prisma.contract.groupBy({
      by: ['currency'],
      where: { ...previousWhereClause, totalValue: { not: null } },
      _sum: { totalValue: true },
    }),
    
    // Pending approvals (operational queue, not portfolio)
    prisma.contract.count({
      where: {
        tenantId,
        isDeleted: false,
        status: 'PENDING',
      },
    }),
    
    // Contracts expiring in the next 30 days
    prisma.contract.count({
      where: {
        ...portfolio,
        ...expirationOrEndDateFilter({
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
      },
    }),
    
    // Status distribution of non-deleted contracts
    prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId, isDeleted: false },
      _count: { id: true },
    }),
  ]);

  const rawContractsChange = previousTotalContracts > 0
    ? ((totalContracts - previousTotalContracts) / previousTotalContracts) * 100
    : totalContracts > 0 ? 100 : 0;
  const contractsChange = clampTrendPercent(rawContractsChange, previousTotalContracts);
  
  const currentValue = sumGroupedTotalValue(valueByCurrency, displayCurrency);
  const previousValue = sumGroupedTotalValue(previousValueByCurrency, displayCurrency);
  const rawValueChange = previousValue > 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : currentValue > 0 ? 100 : 0;
  const valueChange = clampTrendPercent(rawValueChange, previousTotalContracts);

  // Calculate risk score from contracts with risk metadata (placeholder - could be enhanced)
  // For now, using a simple calculation based on expiring contracts ratio
  const avgRiskScore = totalContracts > 0 
    ? Math.round((expiringContracts / totalContracts) * 100) 
    : 0;
  
  const previousRiskScore = previousTotalContracts > 0 ? avgRiskScore + 5 : 0; // Estimate
  const riskChange = previousRiskScore > 0 
    ? avgRiskScore - previousRiskScore 
    : 0;

  // Format status distribution
  const statusDistribution: Record<string, number> = {};
  statusCounts.forEach((s) => {
    statusDistribution[s.status] = s._count.id;
  });

  const metrics = {
    totalContracts,
    activeContracts,
    totalValue: currentValue / 1000000, // Convert to millions
    displayCurrency,
    avgRiskScore,
    pendingApprovals,
    expiringThisMonth: expiringContracts,
    trends: {
      contractsChange,
      valueChange,
      riskChange,
    },
    statusDistribution,
  };

  const result = {
    metrics,
    timeframe,
    period: { start: start.toISOString(), end: end.toISOString() },
  };

  // Cache for 5 minutes
  await setCached(cacheKey, result, { ttl: 300 });

  return createSuccessResponse(ctx, result);
});
