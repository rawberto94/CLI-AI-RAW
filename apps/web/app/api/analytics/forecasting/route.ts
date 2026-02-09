import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

// Helper to get month string
function getMonthString(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Generate forecast data from contracts
async function generateForecastData(tenantId: string, months: number) {
  const now = new Date();
  const forecastData = [];
  let cumulative = 0;

  // Get all active contracts
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      status: { notIn: ['DRAFT', 'CANCELLED', 'EXPIRED', 'DELETED'] },
    },
    select: {
      id: true,
      totalValue: true,
      supplierName: true,
      startDate: true,
      endDate: true,
      expirationDate: true,
      status: true,
      contractType: true,
    },
  });

  // Calculate current portfolio value
  const currentValue = contracts.reduce((sum, c) => sum + (c.totalValue ? Number(c.totalValue) : 0), 0);
  cumulative = currentValue;

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    
    // Find contracts expiring this month
    const expiringContracts = contracts.filter(c => {
      const expDate = c.expirationDate || c.endDate;
      if (!expDate) return false;
      const exp = new Date(expDate);
      return exp >= monthDate && exp <= monthEnd;
    });

    const renewalValue = expiringContracts.reduce((sum, c) => {
      // Assume 80% renewal rate
      return sum + (c.totalValue ? Number(c.totalValue) * 0.8 : 0);
    }, 0);

    const terminationValue = expiringContracts.reduce((sum, c) => {
      // Assume 20% termination rate
      return sum + (c.totalValue ? Number(c.totalValue) * 0.2 : 0);
    }, 0);

    // Estimate new contract value based on historical growth (5% monthly)
    const newContractValue = i > 0 ? Math.round(currentValue * 0.02) : 0;

    const netChange = renewalValue + newContractValue - terminationValue;
    cumulative += netChange;

    forecastData.push({
      month: getMonthString(monthDate),
      renewalValue: Math.round(renewalValue),
      newContractValue: Math.round(newContractValue),
      terminationValue: Math.round(terminationValue),
      netChange: Math.round(netChange),
      cumulative: Math.round(cumulative),
    });
  }

  return forecastData;
}

// Generate scenarios based on portfolio
async function generateScenarios(tenantId: string, currentValue: number) {
  const contracts = await prisma.contract.findMany({
    where: { tenantId, isDeleted: false },
    select: { totalValue: true, supplierName: true, status: true },
    orderBy: { totalValue: 'desc' },
    take: 10,
  });

  const topContractsValue = contracts.slice(0, 5).reduce((sum, c) => sum + (c.totalValue ? Number(c.totalValue) : 0), 0);
  const projectedCostBaseline = currentValue * 1.05; // 5% growth

  return [
    {
      id: 's1',
      name: 'Baseline',
      description: 'Current trajectory with standard escalators',
      assumptions: ['All contracts renew at projected rates', 'No new negotiations', 'Standard 3-5% escalators apply'],
      projectedSavings: 0,
      projectedCost: Math.round(projectedCostBaseline),
      riskLevel: 'medium',
      probability: 60,
    },
    {
      id: 's2',
      name: 'Aggressive Renegotiation',
      description: `Proactive renegotiation of top ${Math.min(5, contracts.length)} contracts`,
      assumptions: ['15% average discount on renewals', 'Terminate underperformers', 'Consolidate similar contracts'],
      projectedSavings: Math.round(topContractsValue * 0.15),
      projectedCost: Math.round(projectedCostBaseline * 0.92),
      riskLevel: 'high',
      probability: 35,
    },
    {
      id: 's3',
      name: 'Conservative Optimization',
      description: 'Targeted improvements on at-risk contracts',
      assumptions: ['5% discount on high-value renewals', 'Focus on quick wins', 'Maintain key relationships'],
      projectedSavings: Math.round(topContractsValue * 0.05),
      projectedCost: Math.round(projectedCostBaseline * 0.965),
      riskLevel: 'low',
      probability: 75,
    },
  ];
}

// Discover optimization opportunities
async function discoverOpportunities(tenantId: string) {
  const opportunities = [];

  // Find expiring contracts
  const expiringContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      expirationDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Next 90 days
      },
    },
    select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true },
    orderBy: { totalValue: 'desc' },
    take: 5,
  });

  expiringContracts.forEach((c, idx) => {
    opportunities.push({
      id: `o-renew-${idx}`,
      type: 'renegotiation',
      title: `Renegotiate ${c.contractTitle || c.supplierName || 'Contract'}`,
      description: `Proactively renegotiate before expiration on ${c.expirationDate?.toLocaleDateString()}`,
      contracts: [c.contractTitle || c.supplierName || `Contract ${c.id}`],
      potentialSavings: Math.round((c.totalValue ? Number(c.totalValue) : 0) * 0.1),
      effort: 'medium',
      timeframe: '30-60 days',
      confidence: 70,
    });
  });

  // Find consolidation opportunities (same supplier, multiple contracts)
  const supplierContracts = await prisma.contract.groupBy({
    by: ['supplierName'],
    where: { tenantId, isDeleted: false, supplierName: { not: null } },
    _count: { id: true },
    _sum: { totalValue: true },
    having: { id: { _count: { gt: 1 } } },
  });

  supplierContracts.slice(0, 3).forEach((s, idx) => {
    if (s.supplierName && s._count.id > 1) {
      opportunities.push({
        id: `o-consol-${idx}`,
        type: 'consolidation',
        title: `Consolidate ${s.supplierName} Contracts`,
        description: `Merge ${s._count.id} agreements into a single master agreement for volume discount`,
        contracts: [`${s._count.id} contracts with ${s.supplierName}`],
        potentialSavings: Math.round((s._sum.totalValue ? Number(s._sum.totalValue) : 0) * 0.08),
        effort: 'medium',
        timeframe: '30-60 days',
        confidence: 65,
      });
    }
  });

  return opportunities.length > 0 ? opportunities : [{
    id: 'o-default',
    type: 'optimization',
    title: 'Review Contract Portfolio',
    description: 'Upload more contracts to discover optimization opportunities',
    contracts: [],
    potentialSavings: 0,
    effort: 'low',
    timeframe: '7-14 days',
    confidence: 100,
  }];
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || '12m';
  const months = timeRange === '6m' ? 6 : timeRange === '24m' ? 24 : 12;

  // Get current portfolio value
  const contracts = await prisma.contract.findMany({
    where: { tenantId, isDeleted: false },
    select: {
      id: true,
      totalValue: true,
      supplierName: true,
      status: true,
    },
  });

  const currentValue = contracts.reduce((sum, c) => sum + (c.totalValue ? Number(c.totalValue) : 0), 0);

  // Generate all data in parallel
  const [forecastData, scenarios, opportunities] = await Promise.all([
    generateForecastData(tenantId, months),
    generateScenarios(tenantId, currentValue),
    discoverOpportunities(tenantId),
  ]);

  // Calculate supplier spend from real contracts
  const supplierSpendMap = new Map<string, { currentSpend: number; contractCount: number }>();
  
  contracts.forEach(c => {
    if (c.supplierName && c.totalValue) {
      const existing = supplierSpendMap.get(c.supplierName) || { currentSpend: 0, contractCount: 0 };
      supplierSpendMap.set(c.supplierName, {
        currentSpend: existing.currentSpend + Number(c.totalValue),
        contractCount: existing.contractCount + 1,
      });
    }
  });

  const supplierSpend = Array.from(supplierSpendMap.entries())
    .map(([supplier, data]) => ({
      supplier,
      currentSpend: Math.round(data.currentSpend),
      projectedSpend: Math.round(data.currentSpend * 1.05),
      changePercent: 5.0,
      contractCount: data.contractCount,
      riskLevel: data.currentSpend > 500000 ? 'high' : data.currentSpend > 100000 ? 'medium' : 'low',
    }))
    .sort((a, b) => b.currentSpend - a.currentSpend)
    .slice(0, 10);

  return createSuccessResponse(ctx, {
    forecastData,
    scenarios,
    opportunities,
    supplierSpend,
    metadata: {
      contractCount: contracts.length,
      portfolioValue: currentValue,
      timeRange,
      generatedAt: new Date().toISOString(),
      source: 'database',
    },
  });
});
