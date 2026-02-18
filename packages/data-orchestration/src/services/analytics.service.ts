/**
 * AI-Powered Portfolio Analytics Service
 * Comprehensive contract intelligence with predictive insights and visual reporting
 */

import { prisma } from '../lib/prisma';


// ============================================
// TYPES & INTERFACES
// ============================================

export interface PortfolioMetrics {
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  annualValue: number;
  avgContractValue: number;
  avgDuration: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
  highRiskCount: number;
  autoRenewalCount: number;
  supplierCount: number;
  categoryCount: number;
  complianceScore: number;
}

export interface SpendAnalysis {
  totalSpend: number;
  annualizedSpend: number;
  bySupplier: Array<{ supplier: string; value: number; count: number; percentage: number }>;
  byCategory: Array<{ category: string; value: number; count: number; percentage: number }>;
  byStatus: Array<{ status: string; value: number; count: number }>;
  byContractType: Array<{ type: string; value: number; count: number }>;
  topSuppliers: Array<{ supplier: string; value: number; contracts: number }>;
  spendTrend: Array<{ period: string; value: number; count: number }>;
}

export interface RiskAnalysis {
  overallRiskScore: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  expiringContracts: Array<{ id: string; title: string; supplier: string; daysUntil: number; value: number }>;
  autoRenewals: Array<{ id: string; title: string; supplier: string; renewalDate: Date; value: number }>;
  highValueAtRisk: number;
  missingData: Array<{ contractId: string; title: string; missingFields: string[] }>;
  complianceIssues: Array<{ contractId: string; title: string; issues: string[] }>;
}

export interface SavingsOpportunities {
  totalPotential: number;
  opportunities: Array<{
    type: string;
    description: string;
    potentialSavings: number;
    contractIds: string[];
    priority: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
  }>;
  consolidationOpportunities: Array<{
    suppliers: string[];
    currentSpend: number;
    potentialSavings: number;
    contractCount: number;
  }>;
  rateOptimization: Array<{
    role: string;
    currentAvgRate: number;
    marketRate: number;
    potentialSavings: number;
    contractCount: number;
  }>;
}

export interface SupplierPerformance {
  supplier: string;
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  avgContractValue: number;
  relationshipDuration: number; // months
  onTimeRenewalRate: number;
  complianceScore: number;
  riskScore: number;
  spendTrend: Array<{ period: string; value: number }>;
  contractTypes: string[];
}

export interface TimeSeriesData {
  period: string;
  timestamp: Date;
  value: number;
  count: number;
  avgValue: number;
}

export interface ReportData {
  id: string;
  type: 'executive' | 'financial' | 'risk' | 'compliance' | 'supplier' | 'custom';
  title: string;
  generatedAt: Date;
  tenantId: string;
  metrics: PortfolioMetrics;
  spend: SpendAnalysis;
  risks: RiskAnalysis;
  savings: SavingsOpportunities;
  insights: string[];
  recommendations: string[];
  charts: ChartData[];
  summary: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter' | 'heatmap';
  title: string;
  data: any[];
  labels?: string[];
  datasets?: Array<{ label: string; data: number[]; color?: string }>;
  options?: any;
}

export interface AnomalyDetection {
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedContracts: string[];
    detectedAt: Date;
    metric: string;
    expectedValue: number;
    actualValue: number;
    deviation: number;
  }>;
}

// ============================================
// ANALYTICS SERVICE
// ============================================

class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // ============================================
  // PORTFOLIO METRICS
  // ============================================

  async getPortfolioMetrics(tenantId: string): Promise<PortfolioMetrics> {
    const [
      totalContracts,
      activeContracts,
      valueAgg,
      annualAgg,
      expiringIn30,
      expiringIn90,
      highRisk,
      autoRenewal,
      suppliers,
      categories,
    ] = await Promise.all([
      prisma.contract.count({ where: { tenantId } }),
      prisma.contract.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.contract.aggregate({
        where: { tenantId, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
        _sum: { totalValue: true },
        _avg: { totalValue: true },
      }),
      prisma.contract.aggregate({
        where: { tenantId, status: 'ACTIVE' },
        _sum: { annualValue: true },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          expirationDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          expirationDate: {
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          OR: [
            { expirationRisk: { in: ['HIGH', 'CRITICAL'] } },
            {
              expirationDate: {
                lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                gte: new Date(),
              },
            },
          ],
        },
      }),
      prisma.contract.count({
        where: { tenantId, status: 'ACTIVE', autoRenewalEnabled: true },
      }),
      prisma.contract.groupBy({
        by: ['supplierName'],
        where: { tenantId, supplierName: { not: null } },
      }),
      prisma.contract.groupBy({
        by: ['categoryL1'],
        where: { tenantId, categoryL1: { not: null } },
      }),
    ]);

    // Calculate average duration
    const contractsWithDates = await prisma.contract.findMany({
      where: {
        tenantId,
        effectiveDate: { not: null },
        expirationDate: { not: null },
      },
      select: { effectiveDate: true, expirationDate: true },
    });

    const avgDuration =
      contractsWithDates.length > 0
        ? contractsWithDates.reduce((sum, c) => {
            const duration =
              (new Date(c.expirationDate!).getTime() - new Date(c.effectiveDate!).getTime()) /
              (1000 * 60 * 60 * 24);
            return sum + duration;
          }, 0) / contractsWithDates.length
        : 0;

    // Calculate compliance score (simplified)
    const complianceScore = this.calculateComplianceScore({
      totalContracts,
      missingExpirationDate: totalContracts - contractsWithDates.length,
      expiringIn30Days: expiringIn30,
      highRiskCount: highRisk,
    });

    return {
      totalContracts,
      activeContracts,
      totalValue: Number(valueAgg._sum.totalValue || 0),
      annualValue: Number(annualAgg._sum.annualValue || valueAgg._sum.totalValue || 0),
      avgContractValue: Number(valueAgg._avg.totalValue || 0),
      avgDuration: Math.round(avgDuration),
      expiringIn30Days: expiringIn30,
      expiringIn90Days: expiringIn90,
      highRiskCount: highRisk,
      autoRenewalCount: autoRenewal,
      supplierCount: suppliers.length,
      categoryCount: categories.length,
      complianceScore,
    };
  }

  private calculateComplianceScore(data: {
    totalContracts: number;
    missingExpirationDate: number;
    expiringIn30Days: number;
    highRiskCount: number;
  }): number {
    if (data.totalContracts === 0) return 100;

    let score = 100;
    score -= (data.missingExpirationDate / data.totalContracts) * 20;
    score -= (data.expiringIn30Days / data.totalContracts) * 15;
    score -= (data.highRiskCount / data.totalContracts) * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ============================================
  // SPEND ANALYSIS
  // ============================================

  async getSpendAnalysis(tenantId: string, startDate?: Date, endDate?: Date): Promise<SpendAnalysis> {
    const where: any = {
      tenantId,
      status: { notIn: ['CANCELLED'] },
    };

    if (startDate && endDate) {
      where.effectiveDate = { gte: startDate, lte: endDate };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        supplierName: true,
        categoryL1: true,
        status: true,
        contractType: true,
        totalValue: true,
        annualValue: true,
        effectiveDate: true,
      },
    });

    const totalSpend = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
    const annualizedSpend = contracts
      .filter((c) => c.status === 'ACTIVE')
      .reduce((sum, c) => sum + Number(c.annualValue || c.totalValue || 0), 0);

    // By Supplier
    const supplierMap = new Map<string, { value: number; count: number }>();
    contracts.forEach((c) => {
      const supplier = c.supplierName || 'Unknown';
      const current = supplierMap.get(supplier) || { value: 0, count: 0 };
      supplierMap.set(supplier, {
        value: current.value + Number(c.totalValue || 0),
        count: current.count + 1,
      });
    });

    const bySupplier = Array.from(supplierMap.entries())
      .map(([supplier, data]) => ({
        supplier,
        value: data.value,
        count: data.count,
        percentage: totalSpend > 0 ? (data.value / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // By Category
    const categoryMap = new Map<string, { value: number; count: number }>();
    contracts.forEach((c) => {
      const category = c.categoryL1 || 'Uncategorized';
      const current = categoryMap.get(category) || { value: 0, count: 0 };
      categoryMap.set(category, {
        value: current.value + Number(c.totalValue || 0),
        count: current.count + 1,
      });
    });

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        value: data.value,
        count: data.count,
        percentage: totalSpend > 0 ? (data.value / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // By Status
    const statusMap = new Map<string, { value: number; count: number }>();
    contracts.forEach((c) => {
      const status = c.status;
      const current = statusMap.get(status) || { value: 0, count: 0 };
      statusMap.set(status, {
        value: current.value + Number(c.totalValue || 0),
        count: current.count + 1,
      });
    });

    const byStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      value: data.value,
      count: data.count,
    }));

    // By Contract Type
    const typeMap = new Map<string, { value: number; count: number }>();
    contracts.forEach((c) => {
      const type = c.contractType || 'Unknown';
      const current = typeMap.get(type) || { value: 0, count: 0 };
      typeMap.set(type, {
        value: current.value + Number(c.totalValue || 0),
        count: current.count + 1,
      });
    });

    const byContractType = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        value: data.value,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value);

    // Top Suppliers
    const topSuppliers = bySupplier.slice(0, 10).map((s) => ({
      supplier: s.supplier,
      value: s.value,
      contracts: s.count,
    }));

    // Spend Trend (last 12 months)
    const spendTrend = await this.calculateSpendTrend(tenantId, 12);

    return {
      totalSpend,
      annualizedSpend,
      bySupplier,
      byCategory,
      byStatus,
      byContractType,
      topSuppliers,
      spendTrend,
    };
  }

  private async calculateSpendTrend(tenantId: string, months: number): Promise<TimeSeriesData[]> {
    const trend: TimeSeriesData[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const contracts = await prisma.contract.findMany({
        where: {
          tenantId,
          effectiveDate: { lte: periodEnd },
          OR: [{ expirationDate: { gte: periodStart } }, { expirationDate: null }],
          status: { notIn: ['CANCELLED'] },
        },
        select: { totalValue: true, annualValue: true },
      });

      const value = contracts.reduce((sum, c) => sum + Number(c.annualValue || c.totalValue || 0), 0);

      trend.push({
        period: periodStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        timestamp: periodStart,
        value,
        count: contracts.length,
        avgValue: contracts.length > 0 ? value / contracts.length : 0,
      });
    }

    return trend;
  }

  // ============================================
  // RISK ANALYSIS
  // ============================================

  async getRiskAnalysis(tenantId: string): Promise<RiskAnalysis> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Get expiring contracts
    const expiringContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        expirationDate: { lte: in90Days, gte: now },
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        supplierName: true,
        expirationDate: true,
        totalValue: true,
      },
      orderBy: { expirationDate: 'asc' },
      take: 20,
    });

    const expiringWithDays = expiringContracts.map((c) => ({
      id: c.id,
      title: c.contractTitle || c.fileName || 'Untitled',
      supplier: c.supplierName || 'Unknown',
      daysUntil: Math.ceil((new Date(c.expirationDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      value: Number(c.totalValue || 0),
    }));

    // Get auto-renewal contracts
    const autoRenewals = await prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        autoRenewalEnabled: true,
        expirationDate: { lte: in90Days, gte: now },
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        supplierName: true,
        expirationDate: true,
        totalValue: true,
      },
      take: 10,
    });

    const autoRenewalsData = autoRenewals.map((c) => ({
      id: c.id,
      title: c.contractTitle || c.fileName || 'Untitled',
      supplier: c.supplierName || 'Unknown',
      renewalDate: c.expirationDate!,
      value: Number(c.totalValue || 0),
    }));

    // Risk distribution
    const [critical, high, medium, low] = await Promise.all([
      prisma.contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          OR: [
            { expirationRisk: 'CRITICAL' },
            { expirationDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), gte: now } },
          ],
        },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          expirationRisk: 'HIGH',
          expirationDate: { gt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.contract.count({
        where: { tenantId, status: 'ACTIVE', expirationRisk: 'MEDIUM' },
      }),
      prisma.contract.count({
        where: { tenantId, status: 'ACTIVE', OR: [{ expirationRisk: 'LOW' }, { expirationRisk: null }] },
      }),
    ]);

    // High value at risk
    const highValueAtRisk = expiringWithDays
      .filter((c) => c.daysUntil <= 30)
      .reduce((sum, c) => sum + c.value, 0);

    // Missing data
    const contractsWithMissingData = await prisma.contract.findMany({
      where: {
        tenantId,
        status: { notIn: ['CANCELLED', 'ARCHIVED'] },
        OR: [{ expirationDate: null }, { supplierName: null }, { totalValue: null }],
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        expirationDate: true,
        supplierName: true,
        totalValue: true,
        effectiveDate: true,
      },
      take: 20,
    });

    const missingData = contractsWithMissingData.map((c) => {
      const missing: string[] = [];
      if (!c.expirationDate) missing.push('Expiration Date');
      if (!c.supplierName) missing.push('Supplier Name');
      if (!c.totalValue) missing.push('Contract Value');
      if (!c.effectiveDate) missing.push('Effective Date');

      return {
        contractId: c.id,
        title: c.contractTitle || c.fileName || 'Untitled',
        missingFields: missing,
      };
    });

    // Compliance issues (simplified - can be expanded)
    const complianceIssues = expiringWithDays
      .filter((c) => c.daysUntil <= 30)
      .map((c) => ({
        contractId: c.id,
        title: c.title,
        issues: [`Expires in ${c.daysUntil} days - requires immediate attention`],
      }));

    // Calculate overall risk score
    const totalActive = await prisma.contract.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const overallRiskScore = this.calculateRiskScore({
      totalActive,
      critical,
      high,
      medium,
      expiringIn30: expiringWithDays.filter((c) => c.daysUntil <= 30).length,
      autoRenewalCount: autoRenewals.length,
      missingDataCount: missingData.length,
    });

    return {
      overallRiskScore,
      riskDistribution: { low, medium, high, critical },
      expiringContracts: expiringWithDays,
      autoRenewals: autoRenewalsData,
      highValueAtRisk,
      missingData,
      complianceIssues,
    };
  }

  private calculateRiskScore(data: {
    totalActive: number;
    critical: number;
    high: number;
    medium: number;
    expiringIn30: number;
    autoRenewalCount: number;
    missingDataCount: number;
  }): number {
    if (data.totalActive === 0) return 0;

    let risk = 0;
    risk += (data.critical / data.totalActive) * 40;
    risk += (data.high / data.totalActive) * 25;
    risk += (data.medium / data.totalActive) * 15;
    risk += (data.expiringIn30 / data.totalActive) * 10;
    risk += (data.missingDataCount / data.totalActive) * 10;

    return Math.min(100, Math.round(risk));
  }

  // ============================================
  // SAVINGS OPPORTUNITIES
  // ============================================

  async getSavingsOpportunities(tenantId: string): Promise<SavingsOpportunities> {
    const opportunities: SavingsOpportunities['opportunities'] = [];
    let totalPotential = 0;

    // 1. Duplicate suppliers (consolidation)
    const consolidationOpportunities = await this.findConsolidationOpportunities(tenantId);
    consolidationOpportunities.forEach((opp) => {
      totalPotential += opp.potentialSavings;
      opportunities.push({
        type: 'consolidation',
        description: `Consolidate ${opp.suppliers.join(', ')} contracts for volume discounts`,
        potentialSavings: opp.potentialSavings,
        contractIds: [],
        priority: opp.potentialSavings > 50000 ? 'high' : opp.potentialSavings > 20000 ? 'medium' : 'low',
        effort: 'medium',
      });
    });

    // 2. Rate optimization
    const rateOptimization = await this.findRateOptimizationOpportunities(tenantId);
    rateOptimization.forEach((opp) => {
      totalPotential += opp.potentialSavings;
      opportunities.push({
        type: 'rate_optimization',
        description: `Negotiate ${opp.role} rates (currently $${opp.currentAvgRate}/hr vs market $${opp.marketRate}/hr)`,
        potentialSavings: opp.potentialSavings,
        contractIds: [],
        priority: opp.potentialSavings > 100000 ? 'high' : opp.potentialSavings > 50000 ? 'medium' : 'low',
        effort: 'low',
      });
    });

    // 3. Auto-renewal prevention
    const autoRenewals = await prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        autoRenewalEnabled: true,
        expirationDate: {
          lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      select: { id: true, totalValue: true, annualValue: true },
    });

    if (autoRenewals.length > 0) {
      const autoRenewalSavings = autoRenewals.reduce(
        (sum, c) => sum + Number(c.annualValue || c.totalValue || 0) * 0.1,
        0
      );
      totalPotential += autoRenewalSavings;
      opportunities.push({
        type: 'auto_renewal',
        description: `Review ${autoRenewals.length} auto-renewing contracts for renegotiation`,
        potentialSavings: autoRenewalSavings,
        contractIds: autoRenewals.map((c) => c.id),
        priority: 'high',
        effort: 'low',
      });
    }

    return {
      totalPotential,
      opportunities: opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings),
      consolidationOpportunities,
      rateOptimization,
    };
  }

  private async findConsolidationOpportunities(
    tenantId: string
  ): Promise<SavingsOpportunities['consolidationOpportunities']> {
    // Find suppliers with multiple small contracts
    const suppliers = await prisma.contract.groupBy({
      by: ['supplierName'],
      where: {
        tenantId,
        status: 'ACTIVE',
        supplierName: { not: null },
      },
      _count: { id: true },
      _sum: { totalValue: true },
      having: { id: { _count: { gt: 2 } } },
    });

    return suppliers
      .map((s) => ({
        suppliers: [s.supplierName!],
        currentSpend: Number(s._sum.totalValue || 0),
        potentialSavings: Number(s._sum.totalValue || 0) * 0.08, // 8% savings estimate
        contractCount: s._count.id,
      }))
      .filter((o) => o.potentialSavings > 5000)
      .sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  private async findRateOptimizationOpportunities(
    tenantId: string
  ): Promise<SavingsOpportunities['rateOptimization']> {
    // This would typically compare against market rates from a database
    // For now, return empty array - can be enhanced with actual rate data
    return [];
  }

  // ============================================
  // SUPPLIER PERFORMANCE
  // ============================================

  async getSupplierPerformance(tenantId: string, supplierName: string): Promise<SupplierPerformance | null> {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
      },
      orderBy: { effectiveDate: 'asc' },
    });

    if (contracts.length === 0) return null;

    const activeContracts = contracts.filter((c) => c.status === 'ACTIVE').length;
    const totalValue = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
    const avgContractValue = totalValue / contracts.length;

    // Relationship duration
    const firstContract = contracts[0];
    const relationshipDuration = firstContract.effectiveDate
      ? Math.floor((Date.now() - new Date(firstContract.effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    // On-time renewal rate (simplified)
    const onTimeRenewalRate = 85; // Placeholder - would need renewal history data

    // Compliance score (simplified)
    const complianceScore = 90; // Placeholder - would need compliance data

    // Risk score
    const expiringCount = contracts.filter(
      (c) =>
        c.expirationDate &&
        new Date(c.expirationDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
        c.status === 'ACTIVE'
    ).length;
    const riskScore = activeContracts > 0 ? (expiringCount / activeContracts) * 100 : 0;

    // Spend trend
    const spendTrend: Array<{ period: string; value: number }> = [];
    // Simplified - would calculate actual trend

    // Contract types
    const contractTypes = [...new Set(contracts.map((c) => c.contractType).filter((t): t is string => Boolean(t)))];

    return {
      supplier: supplierName,
      totalContracts: contracts.length,
      activeContracts,
      totalValue,
      avgContractValue,
      relationshipDuration,
      onTimeRenewalRate,
      complianceScore,
      riskScore,
      spendTrend,
      contractTypes,
    };
  }

  // ============================================
  // ANOMALY DETECTION
  // ============================================

  async detectAnomalies(tenantId: string): Promise<AnomalyDetection> {
    const anomalies: AnomalyDetection['anomalies'] = [];

    // 1. Unusual contract values
    const valueStats = await prisma.contract.aggregate({
      where: { tenantId, status: 'ACTIVE', totalValue: { not: null } },
      _avg: { totalValue: true },
      _count: { id: true },
    });

    if (valueStats._avg.totalValue) {
      const avgValue = Number(valueStats._avg.totalValue);
      const threshold = avgValue * 3; // 3x average

      const unusualValues = await prisma.contract.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          totalValue: { gte: threshold },
        },
        select: { id: true, contractTitle: true, totalValue: true },
        take: 5,
      });

      if (unusualValues.length > 0) {
        anomalies.push({
          type: 'unusual_value',
          severity: 'medium',
          description: `${unusualValues.length} contracts have unusually high values (>3x average)`,
          affectedContracts: unusualValues.map((c) => c.id),
          detectedAt: new Date(),
          metric: 'contract_value',
          expectedValue: avgValue,
          actualValue: Number(unusualValues[0].totalValue || 0),
          deviation: ((Number(unusualValues[0].totalValue || 0) - avgValue) / avgValue) * 100,
        });
      }
    }

    // 2. Clustering of expirations
    const expirations = await prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        expirationDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, expirationDate: true },
    });

    // Group by month
    const expirationsByMonth = new Map<string, number>();
    expirations.forEach((c) => {
      const month = new Date(c.expirationDate!).toISOString().slice(0, 7);
      expirationsByMonth.set(month, (expirationsByMonth.get(month) || 0) + 1);
    });

    const avgPerMonth = expirations.length / 3; // 3 months
    const clusteredMonths = Array.from(expirationsByMonth.entries()).filter(([_, count]) => count > avgPerMonth * 2);

    if (clusteredMonths.length > 0) {
      anomalies.push({
        type: 'expiration_cluster',
        severity: 'high',
        description: `Unusual clustering of ${clusteredMonths[0][1]} expirations in ${clusteredMonths[0][0]}`,
        affectedContracts: [],
        detectedAt: new Date(),
        metric: 'expirations_per_month',
        expectedValue: avgPerMonth,
        actualValue: clusteredMonths[0][1],
        deviation: ((clusteredMonths[0][1] - avgPerMonth) / avgPerMonth) * 100,
      });
    }

    return { anomalies };
  }

  // ============================================
  // EVENT TRACKING (original methods)
  // ============================================

  async trackEvent(_event: string, _properties?: any): Promise<void> {
    // Track analytics event - can be expanded to store in database
  }

  async getMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Legacy method - kept for backward compatibility
    return {
      events: [],
      totalCount: 0,
    };
  }
}

export const analyticsService = AnalyticsService.getInstance();
