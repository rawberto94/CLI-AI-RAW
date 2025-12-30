import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import type { Contract, ContractStatus, Prisma } from '@prisma/client';
import { getErrorMessage } from '@/lib/types/common';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Extended contract with artifacts for analysis
interface ContractWithArtifacts extends Contract {
  artifacts: Array<{ type: string; data: unknown }>;
}

// Enriched contract for analysis
interface EnrichedContract {
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
  autoRenewal: boolean;
  riskLevel: string;
  artifacts: Array<{ type: string; data: unknown }>;
}

interface ReportFilters {
  suppliers?: string[];
  categories?: string[];
  years?: string[];
  statuses?: string[];
}

interface TrendData {
  period: string;
  value: number;
  count: number;
}

interface SupplierAnalysis {
  name: string;
  totalValue: number;
  contractCount: number;
  avgValue: number;
  activeCount: number;
  expiringCount: number;
  riskScore: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface ClauseAnalysis {
  type: string;
  frequency: number;
  avgValue: number;
  riskLevel: 'low' | 'medium' | 'high';
  contracts: string[];
}

interface BenchmarkData {
  metric: string;
  yourValue: number;
  industryAvg: number;
  percentile: number;
  status: 'above' | 'below' | 'at' | 'excellent';
}

interface DeepAnalysisResult {
  summary: {
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
    averageValue: number;
    averageDurationMonths: number;
    shortestDurationMonths: number;
    longestDurationMonths: number;
    healthScore: number;
    complianceScore: number;
    riskScore: number;
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
    autoRenewal: boolean;
    riskLevel: string;
  }>;
  byCategory: Record<string, { count: number; value: number; contracts: string[]; avgDuration: number }>;
  byStatus: Record<string, number>;
  byYear: Record<string, { count: number; value: number }>;
  bySupplier: SupplierAnalysis[];
  riskAnalysis: {
    expiringIn30Days: number;
    expiringIn90Days: number;
    autoRenewalCount: number;
    highValueAtRisk: number;
    overdueContracts: number;
    missingCriticalData: number;
    concentrationRisk: number;
  };
  trends: {
    valueByQuarter: TrendData[];
    contractsByQuarter: TrendData[];
    renewalRate: number;
    avgDurationTrend: TrendData[];
  };
  benchmarks: BenchmarkData[];
  clauseAnalysis: ClauseAnalysis[];
  recommendations: Array<{
    type: 'cost' | 'risk' | 'compliance' | 'efficiency' | 'strategic';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    potentialImpact: string;
    affectedContracts: string[];
  }>;
  filters: ReportFilters;
}

/**
 * Perform deep analysis on contracts matching the given filters
 * Enhanced with supplier analysis, trends, benchmarks, and AI recommendations
 */
async function performDeepAnalysis(
  tenantId: string,
  filters: ReportFilters
): Promise<DeepAnalysisResult> {
  try {
    const queryMode: Prisma.QueryMode = 'insensitive';

    // Build dynamic query (always exclude DELETED)
    const where: Prisma.ContractWhereInput = { 
      tenantId,
      status: { not: 'DELETED' },
    };
    
    // Supplier filter
    if (filters.suppliers && filters.suppliers.length > 0) {
      where.OR = filters.suppliers.map(s => ({
        supplierName: { contains: s, mode: queryMode }
      }));
    }
    
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map(c => ({
        OR: [
          { categoryL1: { contains: c, mode: queryMode } },
          { categoryL2: { contains: c, mode: queryMode } },
        ]
      }));
      const andConditions: Prisma.ContractWhereInput[] = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      andConditions.push({ OR: categoryConditions.flatMap(cc => cc.OR) });
      where.AND = andConditions;
    }
    
    // Status filter (exclude DELETED even if not in filter)
    if (filters.statuses && filters.statuses.length > 0) {
      const validStatuses = filters.statuses
        .filter((s): s is ContractStatus => s !== 'DELETED');
      if (validStatuses.length > 0) {
        where.status = { in: validStatuses };
      }
    }
    
    // Year filter
    if (filters.years && filters.years.length > 0) {
      const yearConditions = filters.years.map(year => {
        const yearNum = parseInt(year);
        return {
          OR: [
            { 
              effectiveDate: { 
                gte: new Date(`${yearNum}-01-01`), 
                lte: new Date(`${yearNum}-12-31`) 
              } 
            },
            { 
              AND: [
                { effectiveDate: { lte: new Date(`${yearNum}-12-31`) } },
                { expirationDate: { gte: new Date(`${yearNum}-01-01`) } },
              ]
            },
          ]
        };
      });
      const andConditions: Prisma.ContractWhereInput[] = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      andConditions.push({ OR: yearConditions.flatMap(yc => yc.OR) });
      where.AND = andConditions;
    }
    
    console.log('[AI Report Builder] Query filters:', filters);
    
    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { totalValue: 'desc' },
      take: 200, // Increased limit for better analysis
      include: {
        artifacts: {
          where: { status: 'active' },
          select: {
            type: true,
            data: true,
          },
        },
      },
    }) as ContractWithArtifacts[];
    
    console.log(`[AI Report Builder] Found ${contracts.length} contracts`);
    
    if (contracts.length === 0) {
      return getEmptyResult(filters);
    }
    
    // Calculate durations and enrich contract data
    const now = new Date();
    const contractsWithDuration: EnrichedContract[] = contracts.map((c: ContractWithArtifacts) => {
      const effectiveDate = c.effectiveDate ? new Date(c.effectiveDate) : null;
      const expirationDate = c.expirationDate ? new Date(c.expirationDate) : null;
      const durationMonths = effectiveDate && expirationDate
        ? Math.round((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      const daysUntilExpiry = expirationDate 
        ? Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      // Calculate risk level based on multiple factors
      let riskLevel = 'low';
      if (daysUntilExpiry !== null && daysUntilExpiry <= 30) riskLevel = 'critical';
      else if (daysUntilExpiry !== null && daysUntilExpiry <= 90) riskLevel = 'high';
      else if (c.autoRenewalEnabled && daysUntilExpiry !== null && daysUntilExpiry <= 60) riskLevel = 'high';
      else if (Number(c.totalValue || 0) > 500000 && daysUntilExpiry !== null && daysUntilExpiry <= 180) riskLevel = 'medium';
      
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
        daysUntilExpiry,
        autoRenewal: c.autoRenewalEnabled || false,
        riskLevel,
        artifacts: c.artifacts,
      };
    });
    
    // Calculate summary stats
    const totalValue = contractsWithDuration.reduce((sum, c) => sum + c.value, 0);
    const durations = contractsWithDuration.filter(c => c.durationMonths > 0).map(c => c.durationMonths);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const activeContracts = contractsWithDuration.filter(c => c.status === 'ACTIVE').length;
    
    // Health score calculation (0-100)
    const healthScore = calculateHealthScore(contractsWithDuration);
    const complianceScore = calculateComplianceScore(contractsWithDuration);
    const riskScore = calculateRiskScore(contractsWithDuration);
    
    // Group by category with enhanced data
    const byCategory: Record<string, { count: number; value: number; contracts: string[]; avgDuration: number }> = {};
    contractsWithDuration.forEach(c => {
      const cat = c.category;
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, value: 0, contracts: [], avgDuration: 0 };
      }
      byCategory[cat].count++;
      byCategory[cat].value += c.value;
      byCategory[cat].contracts.push(c.title);
    });
    // Calculate average duration per category
    Object.keys(byCategory).forEach(cat => {
      const catContracts = contractsWithDuration.filter(c => c.category === cat && c.durationMonths > 0);
      const catEntry = byCategory[cat];
      if (catEntry) {
        catEntry.avgDuration = catContracts.length > 0
          ? Math.round(catContracts.reduce((sum, c) => sum + c.durationMonths, 0) / catContracts.length)
          : 0;
      }
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
    
    // Supplier analysis
    const bySupplier = calculateSupplierAnalysis(contractsWithDuration);
    
    // Risk analysis - enhanced
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
    
    const overdueContracts = contractsWithDuration.filter(c =>
      c.daysUntilExpiry !== null && c.daysUntilExpiry < 0
    ).length;
    
    const missingCriticalData = contractsWithDuration.filter(c =>
      !c.effectiveDate || !c.expirationDate || c.value === 0 || c.supplierName === 'Unknown'
    ).length;
    
    // Concentration risk: top supplier % of total value
    const topSupplier = bySupplier[0];
    const topSupplierValue = topSupplier?.totalValue ?? 0;
    const concentrationRisk = totalValue > 0 ? Math.round((topSupplierValue / totalValue) * 100) : 0;
    
    // Trends calculation
    const trends = calculateTrends(contractsWithDuration);
    
    // Benchmarks
    const benchmarks = calculateBenchmarks(contractsWithDuration, totalValue);
    
    // Clause analysis from artifacts
    const clauseAnalysis = analyzeClausesFromArtifacts(contractsWithDuration);
    
    // Generate AI recommendations
    const recommendations = await generateRecommendations(
      contractsWithDuration, 
      bySupplier, 
      { expiringIn30Days, expiringIn90Days, highValueAtRisk, concentrationRisk }
    );
    
    return {
      summary: {
        totalContracts: contracts.length,
        activeContracts,
        totalValue,
        averageValue: contracts.length > 0 ? totalValue / contracts.length : 0,
        averageDurationMonths: Math.round(avgDuration),
        shortestDurationMonths: durations.length > 0 ? Math.min(...durations) : 0,
        longestDurationMonths: durations.length > 0 ? Math.max(...durations) : 0,
        healthScore,
        complianceScore,
        riskScore,
      },
      contracts: contractsWithDuration.slice(0, 50).map(c => ({
        id: c.id,
        title: c.title,
        supplierName: c.supplierName,
        value: c.value,
        status: c.status,
        effectiveDate: c.effectiveDate,
        expirationDate: c.expirationDate,
        durationMonths: c.durationMonths,
        category: c.category,
        daysUntilExpiry: c.daysUntilExpiry,
        autoRenewal: c.autoRenewal,
        riskLevel: c.riskLevel,
      })),
      byCategory,
      byStatus,
      byYear,
      bySupplier,
      riskAnalysis: {
        expiringIn30Days,
        expiringIn90Days,
        autoRenewalCount,
        highValueAtRisk,
        overdueContracts,
        missingCriticalData,
        concentrationRisk,
      },
      trends,
      benchmarks,
      clauseAnalysis,
      recommendations,
      filters,
    };
  } catch (e) {
    console.error('[AI Report Builder] Error:', e);
    return getEmptyResult(filters);
  }
}

function getEmptyResult(filters: ReportFilters): DeepAnalysisResult {
  return {
    summary: {
      totalContracts: 0,
      activeContracts: 0,
      totalValue: 0,
      averageValue: 0,
      averageDurationMonths: 0,
      shortestDurationMonths: 0,
      longestDurationMonths: 0,
      healthScore: 0,
      complianceScore: 0,
      riskScore: 0,
    },
    contracts: [],
    byCategory: {},
    byStatus: {},
    byYear: {},
    bySupplier: [],
    riskAnalysis: {
      expiringIn30Days: 0,
      expiringIn90Days: 0,
      autoRenewalCount: 0,
      highValueAtRisk: 0,
      overdueContracts: 0,
      missingCriticalData: 0,
      concentrationRisk: 0,
    },
    trends: {
      valueByQuarter: [],
      contractsByQuarter: [],
      renewalRate: 0,
      avgDurationTrend: [],
    },
    benchmarks: [],
    clauseAnalysis: [],
    recommendations: [],
    filters,
  };
}

function calculateHealthScore(contracts: EnrichedContract[]): number {
  if (contracts.length === 0) return 0;
  
  let score = 100;
  
  // Deduct for expired contracts
  const expiredPct = contracts.filter(c => c.daysUntilExpiry !== null && c.daysUntilExpiry < 0).length / contracts.length;
  score -= expiredPct * 30;
  
  // Deduct for contracts expiring soon
  const expiringSoonPct = contracts.filter(c => c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90).length / contracts.length;
  score -= expiringSoonPct * 15;
  
  // Deduct for missing data
  const missingDataPct = contracts.filter(c => !c.effectiveDate || !c.expirationDate || c.value === 0).length / contracts.length;
  score -= missingDataPct * 20;
  
  // Boost for active contracts
  const activePct = contracts.filter(c => c.status === 'ACTIVE').length / contracts.length;
  score += activePct * 10;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateComplianceScore(contracts: EnrichedContract[]): number {
  if (contracts.length === 0) return 0;
  
  let score = 100;
  
  // Check for required fields
  const missingSupplier = contracts.filter(c => !c.supplierName || c.supplierName === 'Unknown').length;
  const missingDates = contracts.filter(c => !c.effectiveDate || !c.expirationDate).length;
  const missingValue = contracts.filter(c => c.value === 0).length;
  const missingCategory = contracts.filter(c => c.category === 'Uncategorized').length;
  
  score -= (missingSupplier / contracts.length) * 25;
  score -= (missingDates / contracts.length) * 25;
  score -= (missingValue / contracts.length) * 25;
  score -= (missingCategory / contracts.length) * 15;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateRiskScore(contracts: EnrichedContract[]): number {
  if (contracts.length === 0) return 0;
  
  const criticalCount = contracts.filter(c => c.riskLevel === 'critical').length;
  const highCount = contracts.filter(c => c.riskLevel === 'high').length;
  const mediumCount = contracts.filter(c => c.riskLevel === 'medium').length;
  
  // Weighted risk score (higher = more risk)
  const riskScore = (criticalCount * 10 + highCount * 5 + mediumCount * 2) / contracts.length;
  
  return Math.min(100, Math.round(riskScore * 10));
}

function calculateSupplierAnalysis(contracts: EnrichedContract[]): SupplierAnalysis[] {
  const supplierMap = new Map<string, { contracts: EnrichedContract[] }>();
  
  contracts.forEach(c => {
    if (!supplierMap.has(c.supplierName)) {
      supplierMap.set(c.supplierName, { contracts: [] });
    }
    supplierMap.get(c.supplierName)!.contracts.push(c);
  });
  
  const analysis: SupplierAnalysis[] = [];
  
  supplierMap.forEach((data, name) => {
    const totalValue = data.contracts.reduce((sum, c) => sum + c.value, 0);
    const activeCount = data.contracts.filter(c => c.status === 'ACTIVE').length;
    const expiringCount = data.contracts.filter(c => 
      c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90
    ).length;
    
    // Calculate risk score per supplier
    const criticalCount = data.contracts.filter(c => c.riskLevel === 'critical').length;
    const highCount = data.contracts.filter(c => c.riskLevel === 'high').length;
    const riskScore = Math.min(100, Math.round(((criticalCount * 10 + highCount * 5) / data.contracts.length) * 10));
    
    // Determine trend (simplified - would need historical data for real trend)
    const avgAge = data.contracts.reduce((sum, c) => {
      if (c.effectiveDate) {
        return sum + (Date.now() - c.effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      }
      return sum;
    }, 0) / data.contracts.length;
    
    const trend = avgAge < 1 ? 'increasing' : avgAge > 3 ? 'decreasing' : 'stable';
    
    analysis.push({
      name,
      totalValue,
      contractCount: data.contracts.length,
      avgValue: Math.round(totalValue / data.contracts.length),
      activeCount,
      expiringCount,
      riskScore,
      trend,
    });
  });
  
  return analysis.sort((a, b) => b.totalValue - a.totalValue).slice(0, 15);
}

function calculateTrends(contracts: EnrichedContract[]): DeepAnalysisResult['trends'] {
  const now = new Date();
  const quarters: TrendData[] = [];
  
  // Last 8 quarters
  for (let i = 7; i >= 0; i--) {
    const quarterDate = new Date(now);
    quarterDate.setMonth(quarterDate.getMonth() - (i * 3));
    const year = quarterDate.getFullYear();
    const quarter = Math.floor(quarterDate.getMonth() / 3) + 1;
    const quarterStart = new Date(year, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(year, quarter * 3, 0);
    
    const quarterContracts = contracts.filter(c => {
      if (!c.effectiveDate) return false;
      return c.effectiveDate >= quarterStart && c.effectiveDate <= quarterEnd;
    });
    
    quarters.push({
      period: `Q${quarter} ${year}`,
      value: quarterContracts.reduce((sum, c) => sum + c.value, 0),
      count: quarterContracts.length,
    });
  }
  
  // Calculate renewal rate
  const expiredContracts = contracts.filter(c => c.status === 'EXPIRED' || (c.daysUntilExpiry !== null && c.daysUntilExpiry < 0));
  const renewedContracts = contracts.filter(c => c.status === 'ACTIVE' && c.effectiveDate && 
    (Date.now() - c.effectiveDate.getTime()) / (1000 * 60 * 60 * 24) < 365
  );
  const renewalRate = expiredContracts.length > 0 
    ? Math.round((renewedContracts.length / (expiredContracts.length + renewedContracts.length)) * 100)
    : 100;
  
  return {
    valueByQuarter: quarters,
    contractsByQuarter: quarters.map(q => ({ ...q })),
    renewalRate,
    avgDurationTrend: quarters.map((q, i) => ({
      ...q,
      value: 12 + Math.sin(i) * 3, // Placeholder - would calculate from actual data
    })),
  };
}

function calculateBenchmarks(contracts: EnrichedContract[], totalValue: number): BenchmarkData[] {
  const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;
  const avgDuration = contracts.filter(c => c.durationMonths > 0).reduce((sum, c) => sum + c.durationMonths, 0) / 
    Math.max(1, contracts.filter(c => c.durationMonths > 0).length);
  const autoRenewalPct = contracts.length > 0 
    ? (contracts.filter(c => c.autoRenewal).length / contracts.length) * 100 
    : 0;
  
  return [
    {
      metric: 'Average Contract Value',
      yourValue: Math.round(avgValue),
      industryAvg: 150000, // Placeholder industry benchmark
      percentile: Math.min(99, Math.round((avgValue / 300000) * 100)),
      status: avgValue > 180000 ? 'excellent' : avgValue > 150000 ? 'above' : avgValue > 100000 ? 'at' : 'below',
    },
    {
      metric: 'Average Contract Duration',
      yourValue: Math.round(avgDuration),
      industryAvg: 24, // 24 months industry avg
      percentile: Math.min(99, Math.round((avgDuration / 48) * 100)),
      status: avgDuration > 30 ? 'excellent' : avgDuration > 24 ? 'above' : avgDuration > 18 ? 'at' : 'below',
    },
    {
      metric: 'Auto-Renewal Rate',
      yourValue: Math.round(autoRenewalPct),
      industryAvg: 45, // 45% industry avg
      percentile: Math.min(99, Math.round((autoRenewalPct / 80) * 100)),
      status: autoRenewalPct > 60 ? 'excellent' : autoRenewalPct > 45 ? 'above' : autoRenewalPct > 30 ? 'at' : 'below',
    },
    {
      metric: 'Portfolio Diversity Score',
      yourValue: Math.min(100, contracts.length * 5),
      industryAvg: 65,
      percentile: Math.min(99, Math.round((contracts.length / 50) * 100)),
      status: contracts.length > 30 ? 'excellent' : contracts.length > 20 ? 'above' : contracts.length > 10 ? 'at' : 'below',
    },
  ];
}

function analyzeClausesFromArtifacts(contracts: EnrichedContract[]): ClauseAnalysis[] {
  const clauseTypes = ['TERMINATION_CLAUSE', 'LIABILITY_CLAUSE', 'SLA_TERMS', 'FINANCIAL', 'CLAUSES'];
  const analysis: ClauseAnalysis[] = [];
  
  clauseTypes.forEach(clauseType => {
    const contractsWithClause = contracts.filter(c => 
      c.artifacts?.some((a: { type: string; data: unknown }) => a.type === clauseType)
    );
    
    if (contractsWithClause.length > 0) {
      const totalValue = contractsWithClause.reduce((sum, c) => sum + c.value, 0);
      analysis.push({
        type: clauseType.toLowerCase().replace('_', ' '),
        frequency: contractsWithClause.length,
        avgValue: Math.round(totalValue / contractsWithClause.length),
        riskLevel: clauseType === 'LIABILITY' || clauseType === 'TERMINATION' ? 'high' : 'medium',
        contracts: contractsWithClause.slice(0, 5).map(c => c.title),
      });
    }
  });
  
  return analysis;
}

async function generateRecommendations(
  contracts: EnrichedContract[], 
  suppliers: SupplierAnalysis[], 
  riskMetrics: { expiringIn30Days: number; expiringIn90Days: number; highValueAtRisk: number; concentrationRisk: number }
): Promise<DeepAnalysisResult['recommendations']> {
  const recommendations: DeepAnalysisResult['recommendations'] = [];
  
  // Risk-based recommendations
  if (riskMetrics.expiringIn30Days > 0) {
    recommendations.push({
      type: 'risk',
      priority: 'critical',
      title: 'Urgent: Contracts Expiring Within 30 Days',
      description: `${riskMetrics.expiringIn30Days} contract(s) will expire within the next 30 days. Immediate action required to renew or terminate.`,
      potentialImpact: 'Prevent service disruption and maintain business continuity',
      affectedContracts: contracts.filter(c => c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30).slice(0, 5).map(c => c.title),
    });
  }
  
  if (riskMetrics.highValueAtRisk > 0) {
    recommendations.push({
      type: 'risk',
      priority: 'high',
      title: 'High-Value Contracts at Risk',
      description: `${riskMetrics.highValueAtRisk} high-value contract(s) (>$100K) are expiring within 90 days. Prioritize renewal negotiations.`,
      potentialImpact: `Protect significant contract value and supplier relationships`,
      affectedContracts: contracts.filter(c => c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 90 && c.value > 100000).slice(0, 5).map(c => c.title),
    });
  }
  
  // Concentration risk
  const topSupplier = suppliers[0];
  if (riskMetrics.concentrationRisk > 40 && topSupplier) {
    recommendations.push({
      type: 'strategic',
      priority: 'medium',
      title: 'Supplier Concentration Risk',
      description: `${riskMetrics.concentrationRisk}% of total contract value is concentrated with ${topSupplier.name}. Consider diversifying supplier base.`,
      potentialImpact: 'Reduce dependency risk and improve negotiating leverage',
      affectedContracts: contracts.filter(c => c.supplierName === topSupplier.name).slice(0, 5).map(c => c.title),
    });
  }
  
  // Cost optimization
  const highValueContracts = contracts.filter(c => c.value > 200000);
  if (highValueContracts.length > 2) {
    recommendations.push({
      type: 'cost',
      priority: 'medium',
      title: 'Volume Discount Opportunity',
      description: `${highValueContracts.length} contracts exceed $200K. Consider consolidating for volume discounts.`,
      potentialImpact: 'Potential 5-15% savings through consolidated negotiations',
      affectedContracts: highValueContracts.slice(0, 5).map(c => c.title),
    });
  }
  
  // Compliance
  const missingDataContracts = contracts.filter(c => !c.effectiveDate || !c.expirationDate || c.value === 0);
  if (missingDataContracts.length > 0) {
    recommendations.push({
      type: 'compliance',
      priority: 'medium',
      title: 'Complete Missing Contract Data',
      description: `${missingDataContracts.length} contract(s) are missing critical metadata (dates, value). Update for accurate reporting.`,
      potentialImpact: 'Improve portfolio visibility and compliance tracking',
      affectedContracts: missingDataContracts.slice(0, 5).map(c => c.title),
    });
  }
  
  // Efficiency
  const autoRenewalCandidates = contracts.filter(c => !c.autoRenewal && c.status === 'ACTIVE' && c.durationMonths > 12);
  if (autoRenewalCandidates.length > 3) {
    recommendations.push({
      type: 'efficiency',
      priority: 'low',
      title: 'Enable Auto-Renewal',
      description: `${autoRenewalCandidates.length} long-term contracts could benefit from auto-renewal to reduce administrative overhead.`,
      potentialImpact: 'Reduce manual renewal processing by 40%',
      affectedContracts: autoRenewalCandidates.slice(0, 5).map(c => c.title),
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Generate AI summary of the analysis with enhanced insights
 */
async function generateAISummary(analysis: DeepAnalysisResult): Promise<string> {
  if (analysis.summary.totalContracts === 0) {
    return 'No contracts found matching the specified filters. Try adjusting your filter criteria.';
  }
  
  const topSuppliers = analysis.bySupplier.slice(0, 5)
    .map(s => `${s.name}: $${s.totalValue.toLocaleString()} (${s.contractCount} contracts, Risk: ${s.riskScore}%)`)
    .join('\n');
  
  const criticalRecs = analysis.recommendations
    .filter(r => r.priority === 'critical' || r.priority === 'high')
    .map(r => `- [${r.priority.toUpperCase()}] ${r.title}: ${r.description}`)
    .join('\n');
  
  const prompt = `You are ConTigo AI, an expert contract portfolio analyst. Based on the following comprehensive data, provide an executive summary with strategic insights.

**PORTFOLIO OVERVIEW:**
- Total Contracts: ${analysis.summary.totalContracts}
- Active Contracts: ${analysis.summary.activeContracts}
- Total Value: $${analysis.summary.totalValue.toLocaleString()}
- Average Contract Value: $${Math.round(analysis.summary.averageValue).toLocaleString()}
- Portfolio Health Score: ${analysis.summary.healthScore}/100
- Compliance Score: ${analysis.summary.complianceScore}/100
- Risk Score: ${analysis.summary.riskScore}/100 (higher = more risk)

**DURATION ANALYSIS:**
- Average Duration: ${analysis.summary.averageDurationMonths} months
- Range: ${analysis.summary.shortestDurationMonths} to ${analysis.summary.longestDurationMonths} months

**BY CATEGORY:**
${Object.entries(analysis.byCategory).slice(0, 8).map(([cat, data]) => 
  `- ${cat}: ${data.count} contracts, $${data.value.toLocaleString()}, Avg ${data.avgDuration}mo`
).join('\n')}

**BY STATUS:**
${Object.entries(analysis.byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

**TOP SUPPLIERS:**
${topSuppliers}

**RISK ANALYSIS:**
- Expiring in 30 days: ${analysis.riskAnalysis.expiringIn30Days} 🔴
- Expiring in 90 days: ${analysis.riskAnalysis.expiringIn90Days} 🟠
- Auto-renewal enabled: ${analysis.riskAnalysis.autoRenewalCount}
- High-value at risk (>$100K): ${analysis.riskAnalysis.highValueAtRisk}
- Overdue contracts: ${analysis.riskAnalysis.overdueContracts}
- Missing critical data: ${analysis.riskAnalysis.missingCriticalData}
- Supplier concentration risk: ${analysis.riskAnalysis.concentrationRisk}%

**BENCHMARKS:**
${analysis.benchmarks.map(b => 
  `- ${b.metric}: Your ${b.yourValue.toLocaleString()} vs Industry ${b.industryAvg.toLocaleString()} (${b.status})`
).join('\n')}

**CRITICAL RECOMMENDATIONS:**
${criticalRecs || 'No critical items identified'}

**TOP CONTRACTS:**
${analysis.contracts.slice(0, 8).map((c, i) => 
  `${i + 1}. [${c.title}](/contracts/${c.id}) - ${c.supplierName} - $${c.value.toLocaleString()} - ${c.riskLevel} risk`
).join('\n')}

Please provide a structured executive summary with:
1. **Portfolio Health** (2-3 sentences on overall portfolio status)
2. **Key Metrics** (highlight the most important numbers)
3. **Risk Highlights** (what needs immediate attention)
4. **Strategic Insights** (patterns, opportunities, concerns)
5. **Priority Actions** (top 3 recommended next steps)

Format with markdown (bold headers, bullets). Include contract links using the format [Contract Name](/contracts/id). Be concise, data-driven, and actionable. Focus on business impact.`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are ConTigo AI, a contract intelligence assistant. Provide concise, actionable executive summaries. Always include clickable contract links in format [Name](/contracts/id). Use markdown formatting. Focus on business impact and actionable insights.' 
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    });
    
    return completion.choices[0]?.message?.content || 'Analysis complete.';
  } catch (e) {
    console.error('[AI Report Builder] OpenAI error:', e);
    return `## Portfolio Summary

**Health Score: ${analysis.summary.healthScore}/100** | **Risk Score: ${analysis.summary.riskScore}/100**

Your portfolio contains **${analysis.summary.totalContracts} contracts** worth **$${analysis.summary.totalValue.toLocaleString()}**.

### ⚠️ Immediate Attention Required
- ${analysis.riskAnalysis.expiringIn30Days} contracts expiring in 30 days
- ${analysis.riskAnalysis.highValueAtRisk} high-value contracts at risk
- ${analysis.riskAnalysis.missingCriticalData} contracts missing critical data

### 📊 Key Insights
- Average contract value: $${Math.round(analysis.summary.averageValue).toLocaleString()}
- Top supplier concentration: ${analysis.riskAnalysis.concentrationRisk}%
- Renewal rate: ${analysis.trends.renewalRate}%

*Unable to generate AI summary at this time. Please review the data above for insights.*`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters } = body;
    
    // Get tenant ID (in production, from session)
    const tenantId = 'demo-tenant';
    
    // Perform enhanced analysis
    const analysis = await performDeepAnalysis(tenantId, filters || {});
    
    // Generate AI summary with enhanced context
    const aiSummary = await generateAISummary(analysis);
    
    return NextResponse.json({
      success: true,
      analysis,
      aiSummary,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        filtersApplied: Object.values(filters || {}).flat().length,
      },
    });
  } catch (error) {
    console.error('[AI Report Builder] Error:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
