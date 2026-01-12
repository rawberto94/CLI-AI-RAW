/**
 * Analytics Actions Handler
 * Handles analytics and reporting operations
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';

export async function handleAnalyticsActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  const { tenantId } = context;

  try {
    switch (action) {
      case 'count':
        return await countContracts(tenantId, entities.supplierName);

      case 'spend_analysis':
        return await getSpendAnalysis(tenantId, entities.supplierName);

      case 'cost_savings':
        return await getCostSavings(tenantId);

      case 'top_suppliers':
        return await getTopSuppliers(tenantId, entities.topN || 10);

      case 'category_spend':
        return await getCategorySpend(tenantId);

      case 'contract_risks':
      case 'risk_assessment':
        return await getRiskAssessment(tenantId);

      case 'compliance_status':
      case 'compliance_check':
        return await getComplianceStatus(tenantId);

      case 'deep_analysis':
        return await getDeepAnalysis(tenantId, entities);

      default:
        return {
          success: false,
          message: `Unknown analytics action: ${action}`,
        };
    }
  } catch (error) {
    console.error('[Analytics Actions] Error:', error);
    return {
      success: false,
      message: 'Failed to process analytics request',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

async function countContracts(tenantId: string, supplierName?: string): Promise<ActionResponse> {
  const where: Record<string, unknown> = { tenantId };
  
  if (supplierName) {
    where.supplierName = { contains: supplierName, mode: 'insensitive' };
  }

  const [total, active, expiring] = await Promise.all([
    prisma.contract.count({ where }),
    prisma.contract.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.contract.count({
      where: {
        ...where,
        status: 'ACTIVE',
        expirationDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    }),
  ]);

  return {
    success: true,
    message: supplierName
      ? `Found ${total} contract(s) with ${supplierName} (${active} active, ${expiring} expiring in 30 days)`
      : `You have ${total} contract(s) total (${active} active, ${expiring} expiring in 30 days)`,
    data: { total, active, expiring, supplierName },
  };
}

async function getSpendAnalysis(tenantId: string, supplierName?: string): Promise<ActionResponse> {
  const where: Record<string, unknown> = { tenantId };
  if (supplierName) {
    where.supplierName = { contains: supplierName, mode: 'insensitive' };
  }

  const contracts = await prisma.contract.findMany({
    where,
    select: {
      id: true,
      contractTitle: true,
      supplierName: true,
      category: true,
      totalValue: true,
      effectiveDate: true,
      expirationDate: true,
    },
  });

  const totalSpend = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
  
  // Group by supplier
  const bySupplier = contracts.reduce((acc, c) => {
    const name = c.supplierName || 'Unknown';
    if (!acc[name]) acc[name] = { value: 0, count: 0 };
    acc[name].value += Number(c.totalValue) || 0;
    acc[name].count += 1;
    return acc;
  }, {} as Record<string, { value: number; count: number }>);

  // Group by category
  const byCategory = contracts.reduce((acc, c) => {
    const cat = c.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = { value: 0, count: 0 };
    acc[cat].value += Number(c.totalValue) || 0;
    acc[cat].count += 1;
    return acc;
  }, {} as Record<string, { value: number; count: number }>);

  const topSuppliers = Object.entries(bySupplier)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 5);

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 5);

  return {
    success: true,
    message: `Spend analysis complete: $${totalSpend.toLocaleString()} total across ${contracts.length} contracts`,
    data: {
      totalContracts: contracts.length,
      totalSpend,
      bySupplier: topSuppliers,
      byCategory: topCategories,
      supplierFilter: supplierName,
    },
  };
}

async function getCostSavings(tenantId: string): Promise<ActionResponse> {
  // Look for savings opportunities in the database
  const opportunities = await prisma.savingsOpportunity.findMany({
    where: { 
      tenantId,
      status: { in: ['IDENTIFIED', 'IN_PROGRESS'] },
    },
    orderBy: { potentialSavingsAmount: 'desc' },
    take: 10,
    include: {
      contract: {
        select: { id: true, contractTitle: true, supplierName: true },
      },
    },
  });

  const totalPotential = opportunities.reduce(
    (sum, o) => sum + (Number(o.potentialSavingsAmount) || 0),
    0
  );

  return {
    success: true,
    message: opportunities.length > 0
      ? `Found ${opportunities.length} savings opportunities totaling $${totalPotential.toLocaleString()}`
      : 'No active savings opportunities identified',
    data: {
      count: opportunities.length,
      totalPotentialSavings: totalPotential,
      opportunities,
    },
  };
}

async function getTopSuppliers(tenantId: string, limit: number): Promise<ActionResponse> {
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: {
      supplierName: true,
      totalValue: true,
      status: true,
      expirationDate: true,
    },
  });

  const supplierMap = contracts.reduce((acc, c) => {
    const name = c.supplierName || 'Unknown';
    if (!acc[name]) {
      acc[name] = { totalValue: 0, count: 0, activeCount: 0, expiringCount: 0 };
    }
    acc[name].totalValue += Number(c.totalValue) || 0;
    acc[name].count += 1;
    if (c.status === 'ACTIVE') acc[name].activeCount += 1;
    if (c.expirationDate && c.expirationDate <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
      acc[name].expiringCount += 1;
    }
    return acc;
  }, {} as Record<string, { totalValue: number; count: number; activeCount: number; expiringCount: number }>);

  const suppliers = Object.entries(supplierMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);

  return {
    success: true,
    message: `Top ${suppliers.length} suppliers by spend`,
    data: {
      totalSuppliers: Object.keys(supplierMap).length,
      suppliers,
    },
  };
}

async function getCategorySpend(tenantId: string): Promise<ActionResponse> {
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: {
      category: true,
      totalValue: true,
    },
  });

  const categoryMap = contracts.reduce((acc, c) => {
    const cat = c.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = { value: 0, count: 0 };
    acc[cat].value += Number(c.totalValue) || 0;
    acc[cat].count += 1;
    return acc;
  }, {} as Record<string, { value: number; count: number }>);

  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.value - a.value);

  const totalSpend = categories.reduce((sum, c) => sum + c.value, 0);

  return {
    success: true,
    message: `Spend breakdown across ${categories.length} categories`,
    data: { categories, totalSpend },
  };
}

async function getRiskAssessment(tenantId: string): Promise<ActionResponse> {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [expiringNoRenewal, highValue, autoRenew] = await Promise.all([
    // Expiring without renewal started
    prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        expirationDate: { lte: thirtyDays, gte: now },
        renewalStatus: { not: 'STARTED' },
      },
      select: { id: true, contractTitle: true, supplierName: true, totalValue: true, expirationDate: true },
      take: 10,
    }),
    // High value contracts
    prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: { gte: 100000 },
        status: 'ACTIVE',
      },
      select: { id: true, contractTitle: true, supplierName: true, totalValue: true },
      orderBy: { totalValue: 'desc' },
      take: 10,
    }),
    // Auto-renewal contracts
    prisma.contract.findMany({
      where: {
        tenantId,
        autoRenewal: true,
        status: 'ACTIVE',
        expirationDate: { lte: thirtyDays, gte: now },
      },
      select: { id: true, contractTitle: true, supplierName: true, expirationDate: true },
      take: 10,
    }),
  ]);

  const riskContracts = expiringNoRenewal.map(c => ({
    ...c,
    riskType: 'EXPIRING_NO_RENEWAL',
    riskLevel: 'HIGH',
  }));

  return {
    success: true,
    message: riskContracts.length > 0
      ? `Found ${riskContracts.length} high-risk contracts requiring attention`
      : 'No high-risk contracts identified. Portfolio looks healthy!',
    data: {
      contracts: riskContracts,
      summary: {
        expiringNoRenewal: expiringNoRenewal.length,
        highValue: highValue.length,
        autoRenew: autoRenew.length,
      },
    },
  };
}

async function getComplianceStatus(tenantId: string): Promise<ActionResponse> {
  const [total, withCompliance, violations] = await Promise.all([
    prisma.contract.count({ where: { tenantId } }),
    prisma.contract.count({
      where: {
        tenantId,
        OR: [
          { complianceStatus: { not: null } },
          { riskScore: { not: null } },
        ],
      },
    }),
    prisma.complianceAlert.count({
      where: {
        tenantId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
    }),
  ]);

  const complianceRate = total > 0 ? ((withCompliance / total) * 100).toFixed(1) : '0';

  return {
    success: true,
    message: `Compliance overview: ${complianceRate}% of contracts have compliance data`,
    data: {
      totalContracts: total,
      withComplianceData: withCompliance,
      openViolations: violations,
      complianceRate: parseFloat(complianceRate),
    },
  };
}

async function getDeepAnalysis(
  tenantId: string,
  entities: DetectedIntent['entities']
): Promise<ActionResponse> {
  const where: Record<string, unknown> = { tenantId };
  
  if (entities.supplierName) {
    where.supplierName = { contains: entities.supplierName, mode: 'insensitive' };
  }
  if (entities.category) {
    where.category = { contains: entities.category, mode: 'insensitive' };
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: { summary: true },
      },
    },
    take: 50,
  });

  const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
  const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;

  // Calculate duration stats
  const durations = contracts
    .filter(c => c.effectiveDate && c.expirationDate)
    .map(c => {
      const start = new Date(c.effectiveDate!);
      const end = new Date(c.expirationDate!);
      return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30); // months
    });
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  return {
    success: true,
    message: `Deep analysis complete for ${contracts.length} contracts`,
    data: {
      count: contracts.length,
      totalValue,
      avgValue,
      avgDurationMonths: Math.round(avgDuration),
      filters: {
        supplier: entities.supplierName,
        category: entities.category,
        period: entities.timePeriod,
      },
    },
  };
}

