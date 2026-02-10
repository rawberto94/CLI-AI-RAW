import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

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
  
  const { start, end, previousStart, previousEnd } = getDateRange(timeframe);
  
  // Build where clause
  const whereClause: Record<string, unknown> = {
    createdAt: { gte: start, lte: end },
    tenantId,
  };
  
  const previousWhereClause: Record<string, unknown> = {
    createdAt: { gte: previousStart, lte: previousEnd },
    tenantId,
  };

  // Execute all queries in parallel for performance
  const [
    totalContracts,
    previousTotalContracts,
    activeContracts,
    _previousActiveContracts,
    valueAgg,
    previousValueAgg,
    pendingApprovals,
    expiringContracts,
    statusCounts,
  ] = await Promise.all([
    // Total contracts in period
    prisma.contract.count({ where: whereClause }),
    
    // Previous period total
    prisma.contract.count({ where: previousWhereClause }),
    
    // Active contracts
    prisma.contract.count({
      where: {
        ...whereClause,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
    }),
    
    // Previous active contracts
    prisma.contract.count({
      where: {
        ...previousWhereClause,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
    }),
    
    // Total value aggregation
    prisma.contract.aggregate({
      where: whereClause,
      _sum: { totalValue: true },
      _avg: { totalValue: true },
    }),
    
    // Previous period value
    prisma.contract.aggregate({
      where: previousWhereClause,
      _sum: { totalValue: true },
    }),
    
    // Pending approvals (PENDING status)
    prisma.contract.count({
      where: {
        status: 'PENDING',
        ...(tenantId ? { tenantId } : {}),
      },
    }),
    
    // Contracts expiring in the next 30 days
    prisma.contract.count({
      where: {
        expirationDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        status: { in: ['ACTIVE', 'COMPLETED'] },
        ...(tenantId ? { tenantId } : {}),
      },
    }),
    
    // Status distribution
    prisma.contract.groupBy({
      by: ['status'],
      where: tenantId ? { tenantId } : {},
      _count: { id: true },
    }),
  ]);

  // Calculate percentage changes
  const contractsChange = previousTotalContracts > 0 
    ? Math.round(((totalContracts - previousTotalContracts) / previousTotalContracts) * 100) 
    : totalContracts > 0 ? 100 : 0;
  
  const currentValue = Number(valueAgg._sum.totalValue || 0);
  const previousValue = Number(previousValueAgg._sum.totalValue || 0);
  const valueChange = previousValue > 0 
    ? Math.round(((currentValue - previousValue) / previousValue) * 100) 
    : currentValue > 0 ? 100 : 0;

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

  return createSuccessResponse(ctx, {
    metrics,
    timeframe,
    period: { start: start.toISOString(), end: end.toISOString() },
  });
});
