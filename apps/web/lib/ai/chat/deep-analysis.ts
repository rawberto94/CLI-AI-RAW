import { prisma } from '@/lib/prisma';

// ============================================
// ADVANCED AI AGENT: DEEP ANALYSIS FUNCTION
// ============================================

export interface DeepAnalysisResult {
  summary: {
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
    averageValue: number;
    averageDurationMonths: number;
    shortestDurationMonths: number;
    longestDurationMonths: number;
  };
  contracts: Array<{
    id: string;
    title: string;
    supplierName: string;
    value: number;
    status: string;
    effectiveDate: Date | null;
    expirationDate: Date | null;
    durationMonths: number;
    category: string;
    daysUntilExpiry: number | null;
  }>;
  byCategory: Record<string, { count: number; value: number; contracts: string[] }>;
  byStatus: Record<string, number>;
  byYear: Record<string, { count: number; value: number }>;
  riskAnalysis: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    autoRenewalCount: number;
    highValueAtRisk: number;
  };
  filters: {
    supplierName?: string;
    category?: string;
    year?: string;
  };
}

/**
 * Perform deep analysis on contracts matching the given criteria
 * This is the core AI agent capability for complex queries
 */
export async function performDeepAnalysis(
  tenantId: string,
  options: {
    supplierName?: string;
    category?: string;
    year?: string;
    analysisAspects?: {
      value?: boolean;
      duration?: boolean;
      categories?: boolean;
      supplierDetails?: boolean;
      risk?: boolean;
      terms?: boolean;
    };
  }
): Promise<DeepAnalysisResult> {
  const { supplierName, category, year, analysisAspects } = options;
  
  try {
    // Build dynamic query
    const where: Record<string, unknown> = { tenantId };
    
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }
    
    if (category) {
      where.OR = [
        { categoryL1: { contains: category, mode: 'insensitive' } },
        { categoryL2: { contains: category, mode: 'insensitive' } },
        { procurementCategory: { name: { contains: category, mode: 'insensitive' } } },
      ];
    }
    
    // Filter by year if specified
    if (year) {
      const yearNum = parseInt(year);
      where.AND = [
        {
          OR: [
            { effectiveDate: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } },
            { 
              AND: [
                { effectiveDate: { lte: new Date(`${yearNum}-12-31`) } },
                { expirationDate: { gte: new Date(`${yearNum}-01-01`) } },
              ]
            },
          ]
        }
      ];
    }
    
    
    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { totalValue: 'desc' },
      take: 100, // Limit for performance
    });
    
    
    if (contracts.length === 0) {
      return {
        summary: {
          totalContracts: 0,
          activeContracts: 0,
          totalValue: 0,
          averageValue: 0,
          averageDurationMonths: 0,
          shortestDurationMonths: 0,
          longestDurationMonths: 0 },
        contracts: [],
        byCategory: {},
        byStatus: {},
        byYear: {},
        riskAnalysis: {
          expiringIn30Days: 0,
          expiringIn90Days: 0,
          autoRenewalCount: 0,
          highValueAtRisk: 0 },
        filters: { supplierName, category, year } };
    }
    
    // Calculate durations
    const contractsWithDuration = contracts.map(c => {
      const effectiveDate = c.effectiveDate ? new Date(c.effectiveDate) : null;
      const expirationDate = c.expirationDate ? new Date(c.expirationDate) : null;
      const durationMonths = effectiveDate && expirationDate
        ? Math.round((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      const daysUntilExpiry = expirationDate 
        ? Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        id: c.id,
        title: c.contractTitle || 'Untitled',
        supplierName: c.supplierName || 'Unknown',
        value: Number(c.totalValue) || 0,
        status: c.status,
        effectiveDate,
        expirationDate,
        durationMonths,
        category: c.categoryL1 || 'Uncategorized',
        daysUntilExpiry };
    });
    
    // Calculate summary stats
    const totalValue = contractsWithDuration.reduce((sum, c) => sum + c.value, 0);
    const durations = contractsWithDuration.filter(c => c.durationMonths > 0).map(c => c.durationMonths);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const activeContracts = contractsWithDuration.filter(c => c.status === 'ACTIVE').length;
    
    // Group by category
    const byCategory: Record<string, { count: number; value: number; contracts: string[] }> = {};
    contractsWithDuration.forEach(c => {
      const cat = c.category;
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, value: 0, contracts: [] };
      }
      byCategory[cat].count++;
      byCategory[cat].value += c.value;
      byCategory[cat].contracts.push(c.title);
    });
    
    // Group by status
    const byStatus: Record<string, number> = {};
    contractsWithDuration.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });
    
    // Group by year
    const byYear: Record<string, { count: number; value: number }> = {};
    contractsWithDuration.forEach(c => {
      const contractYear = c.effectiveDate?.getFullYear()?.toString() || 'Unknown';
      if (!byYear[contractYear]) {
        byYear[contractYear] = { count: 0, value: 0 };
      }
      byYear[contractYear].count++;
      byYear[contractYear].value += c.value;
    });
    
    // Risk analysis
    const now = Date.now();
    const in30Days = now + (30 * 24 * 60 * 60 * 1000);
    const in90Days = now + (90 * 24 * 60 * 60 * 1000);
    
    const expiringIn30Days = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30
    ).length;
    
    const expiringIn90Days = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90
    ).length;
    
    const autoRenewalCount = contracts.filter(c => c.autoRenewalEnabled).length;
    
    const highValueAtRisk = contractsWithDuration.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90 && c.value > 100000
    ).length;
    
    return {
      summary: {
        totalContracts: contracts.length,
        activeContracts,
        totalValue,
        averageValue: contracts.length > 0 ? totalValue / contracts.length : 0,
        averageDurationMonths: Math.round(avgDuration),
        shortestDurationMonths: durations.length > 0 ? Math.min(...durations) : 0,
        longestDurationMonths: durations.length > 0 ? Math.max(...durations) : 0 },
      contracts: contractsWithDuration.slice(0, 20), // Top 20 by value
      byCategory,
      byStatus,
      byYear,
      riskAnalysis: {
        expiringIn30Days,
        expiringIn90Days,
        autoRenewalCount,
        highValueAtRisk },
      filters: { supplierName, category, year } };
  } catch {
    return {
      summary: {
        totalContracts: 0,
        activeContracts: 0,
        totalValue: 0,
        averageValue: 0,
        averageDurationMonths: 0,
        shortestDurationMonths: 0,
        longestDurationMonths: 0 },
      contracts: [],
      byCategory: {},
      byStatus: {},
      byYear: {},
      riskAnalysis: {
        expiringIn30Days: 0,
        expiringIn90Days: 0,
        autoRenewalCount: 0,
        highValueAtRisk: 0 },
      filters: { supplierName, category, year } };
  }
}

// Get rate comparison data
export async function getRateComparison(tenantId: string, supplierName?: string) {
  try {
    const where: Record<string, unknown> = { tenantId };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    // Get rate card entries if available
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      include: {
        contract: {
          select: { contractTitle: true, supplierName: true } } },
      take: 20 });

    // Transform to comparison format with market rates
    const comparison = rateCards.map(entry => {
      const rate = Number(entry.dailyRate) || 0;
      const marketRate = entry.marketRateAverage ? Number(entry.marketRateAverage) : Math.round(rate * 1.1);
      const variance = marketRate > 0 ? Math.round(((rate - marketRate) / marketRate) * 100) : 0;
      return {
        roleName: entry.roleStandardized || entry.roleOriginal,
        rate,
        marketRate,
        vsMarket: variance,
        supplier: entry.supplierName || entry.contract?.supplierName || 'Unknown',
        contractTitle: entry.contract?.contractTitle || 'Unknown' };
    });

    return {
      rateCards: comparison,
      totalRates: rateCards.length };
  } catch {
    return { rateCards: [], totalRates: 0 };
  }
}
