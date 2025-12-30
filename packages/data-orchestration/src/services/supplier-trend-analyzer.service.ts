
/**
 * Supplier Trend Analyzer Service
 * 
 * Analyzes supplier rate card trends, detects above-market increases,
 * and provides historical performance insights.
 */

import { PrismaClient } from '@prisma/client';

export interface SupplierTrend {
  period: string;
  averageRate: number;
  rateChange: number;
  rateChangePercent: number;
  volumeCommitted: number;
  entriesCount: number;
  marketAverage?: number;
  deviationFromMarket?: number;
}

export interface TrendAnalysis {
  supplierId: string;
  supplierName: string;
  currentPeriod: SupplierTrend;
  historicalTrends: SupplierTrend[];
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  averageAnnualChange: number;
  projectedNextPeriodRate: number;
  riskLevel: 'low' | 'medium' | 'high';
  insights: string[];
}

export interface RateIncreaseAlert {
  supplierId: string;
  supplierName: string;
  role: string;
  previousRate: number;
  currentRate: number;
  increasePercent: number;
  marketRate: number;
  deviationFromMarket: number;
  alertLevel: 'warning' | 'critical';
  recommendation: string;
}

export interface AboveMarketAnalysis {
  supplierId: string;
  alerts: RateIncreaseAlert[];
  totalImpact: number;
  affectedRoles: number;
  summary: string;
}

export class SupplierTrendAnalyzerService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Analyze historical trends for a specific supplier
   */
  async analyzeSupplierTrends(
    supplierId: string,
    tenantId: string,
    monthsBack: number = 12
  ): Promise<TrendAnalysis> {
    // Get supplier info
    const supplier = await this.prisma.party.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    // Get rate card entries grouped by month
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const entries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        rateCard: {
          supplierId,
        },
        createdAt: { gte: startDate },
      },
      include: {
        rateCard: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group entries by month
    const monthlyData = this.groupByMonth(entries);
    const historicalTrends = this.calculateMonthlyTrends(monthlyData);

    // Get market averages for comparison
    const marketAverages = await this.getMarketAverages(tenantId, monthsBack);
    
    // Enrich trends with market comparison
    historicalTrends.forEach(trend => {
      const marketAvg = marketAverages[trend.period];
      if (marketAvg) {
        trend.marketAverage = marketAvg;
        trend.deviationFromMarket = ((trend.averageRate - marketAvg) / marketAvg) * 100;
      }
    });

    // Calculate overall trend
    const overallTrend = this.determineOverallTrend(historicalTrends);
    const averageAnnualChange = this.calculateAverageAnnualChange(historicalTrends);
    const projectedNextPeriodRate = this.projectNextPeriodRate(historicalTrends);
    const riskLevel = this.assessRiskLevel(historicalTrends, overallTrend);
    const insights = this.generateInsights(historicalTrends, overallTrend, riskLevel);

    const currentPeriod = historicalTrends[historicalTrends.length - 1] || {
      period: new Date().toISOString().substring(0, 7),
      averageRate: 0,
      rateChange: 0,
      rateChangePercent: 0,
      volumeCommitted: 0,
      entriesCount: 0,
    };

    return {
      supplierId,
      supplierName: supplier.name,
      currentPeriod,
      historicalTrends,
      overallTrend,
      averageAnnualChange,
      projectedNextPeriodRate,
      riskLevel,
      insights,
    };
  }

  /**
   * Detect above-market rate increases
   */
  async detectAboveMarketIncreases(
    supplierId: string,
    tenantId: string,
    thresholdPercent: number = 10
  ): Promise<AboveMarketAnalysis> {
    const supplier = await this.prisma.party.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    // Get current and previous rate card entries
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const currentEntries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        rateCard: { supplierId },
        createdAt: { gte: sixMonthsAgo },
      },
      include: { rateCard: true },
    });

    const previousEntries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        rateCard: { supplierId },
        createdAt: { lt: sixMonthsAgo },
      },
      include: { rateCard: true },
      orderBy: { createdAt: 'desc' },
    });

    // Get market rates for comparison
    const marketRates = await this.getMarketRatesByRole(tenantId);

    const alerts: RateIncreaseAlert[] = [];
    let totalImpact = 0;

    // Compare rates by role
    const currentByRole = this.groupByRole(currentEntries);
    const previousByRole = this.groupByRole(previousEntries);

    for (const [role, currentAvg] of Object.entries(currentByRole)) {
      const previousAvg = previousByRole[role];
      const marketRate = marketRates[role] || currentAvg;

      if (previousAvg) {
        const increasePercent = ((currentAvg - previousAvg) / previousAvg) * 100;
        const deviationFromMarket = ((currentAvg - marketRate) / marketRate) * 100;

        if (increasePercent > thresholdPercent || deviationFromMarket > thresholdPercent) {
          const alertLevel = increasePercent > 20 || deviationFromMarket > 25 ? 'critical' : 'warning';
          const impact = (currentAvg - Math.min(previousAvg, marketRate)) * (currentByRole[role] || 1);
          totalImpact += impact;

          alerts.push({
            supplierId,
            supplierName: supplier.name,
            role,
            previousRate: previousAvg,
            currentRate: currentAvg,
            increasePercent: Math.round(increasePercent * 10) / 10,
            marketRate,
            deviationFromMarket: Math.round(deviationFromMarket * 10) / 10,
            alertLevel,
            recommendation: this.generateRecommendation(increasePercent, deviationFromMarket),
          });
        }
      }
    }

    // Sort alerts by severity
    alerts.sort((a, b) => {
      if (a.alertLevel === 'critical' && b.alertLevel !== 'critical') return -1;
      if (b.alertLevel === 'critical' && a.alertLevel !== 'critical') return 1;
      return b.increasePercent - a.increasePercent;
    });

    return {
      supplierId,
      alerts,
      totalImpact: Math.round(totalImpact),
      affectedRoles: alerts.length,
      summary: this.generateAboveMarketSummary(alerts, totalImpact),
    };
  }

  // Private helper methods

  private groupByMonth(entries: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    entries.forEach(entry => {
      const month = entry.createdAt.toISOString().substring(0, 7);
      if (!grouped.has(month)) {
        grouped.set(month, []);
      }
      grouped.get(month)!.push(entry);
    });

    return grouped;
  }

  private calculateMonthlyTrends(monthlyData: Map<string, any[]>): SupplierTrend[] {
    const trends: SupplierTrend[] = [];
    let previousAvgRate = 0;

    const sortedMonths = Array.from(monthlyData.keys()).sort();

    for (const month of sortedMonths) {
      const entries = monthlyData.get(month)!;
      const rates = entries.map(e => Number(e.dailyRate || 0)).filter(r => r > 0);
      const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
      const totalVolume = entries.reduce((sum, e) => sum + (e.volumeCommitted || 0), 0);

      const rateChange = previousAvgRate > 0 ? avgRate - previousAvgRate : 0;
      const rateChangePercent = previousAvgRate > 0 
        ? ((avgRate - previousAvgRate) / previousAvgRate) * 100 
        : 0;

      trends.push({
        period: month,
        averageRate: Math.round(avgRate * 100) / 100,
        rateChange: Math.round(rateChange * 100) / 100,
        rateChangePercent: Math.round(rateChangePercent * 10) / 10,
        volumeCommitted: totalVolume,
        entriesCount: entries.length,
      });

      previousAvgRate = avgRate;
    }

    return trends;
  }

  private async getMarketAverages(tenantId: string, monthsBack: number): Promise<Record<string, number>> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const entries = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        dailyRate: true,
        createdAt: true,
      },
    });

    const byMonth: Record<string, number[]> = {};
    
    entries.forEach(entry => {
      const month = entry.createdAt.toISOString().substring(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      if (entry.dailyRate) {
        byMonth[month].push(Number(entry.dailyRate));
      }
    });

    const averages: Record<string, number> = {};
    for (const [month, rates] of Object.entries(byMonth)) {
      if (rates.length > 0) {
        averages[month] = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }

    return averages;
  }

  private async getMarketRatesByRole(tenantId: string): Promise<Record<string, number>> {
    const entries = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: {
        standardizedRole: true,
        role: true,
        dailyRate: true,
      },
    });

    const byRole: Record<string, number[]> = {};
    
    entries.forEach(entry => {
      const role = entry.standardizedRole || entry.role || 'Unknown';
      if (!byRole[role]) byRole[role] = [];
      if (entry.dailyRate) {
        byRole[role].push(Number(entry.dailyRate));
      }
    });

    const averages: Record<string, number> = {};
    for (const [role, rates] of Object.entries(byRole)) {
      if (rates.length > 0) {
        averages[role] = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }

    return averages;
  }

  private groupByRole(entries: any[]): Record<string, number> {
    const byRole: Record<string, number[]> = {};
    
    entries.forEach(entry => {
      const role = entry.standardizedRole || entry.role || 'Unknown';
      if (!byRole[role]) byRole[role] = [];
      if (entry.dailyRate) {
        byRole[role].push(Number(entry.dailyRate));
      }
    });

    const averages: Record<string, number> = {};
    for (const [role, rates] of Object.entries(byRole)) {
      if (rates.length > 0) {
        averages[role] = rates.reduce((a, b) => a + b, 0) / rates.length;
      }
    }

    return averages;
  }

  private determineOverallTrend(trends: SupplierTrend[]): 'increasing' | 'decreasing' | 'stable' {
    if (trends.length < 2) return 'stable';

    const changes = trends.slice(1).map(t => t.rateChangePercent);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    if (avgChange > 3) return 'increasing';
    if (avgChange < -3) return 'decreasing';
    return 'stable';
  }

  private calculateAverageAnnualChange(trends: SupplierTrend[]): number {
    if (trends.length < 2) return 0;

    const monthlyChanges = trends.slice(1).map(t => t.rateChangePercent);
    const avgMonthlyChange = monthlyChanges.reduce((a, b) => a + b, 0) / monthlyChanges.length;
    
    return Math.round(avgMonthlyChange * 12 * 10) / 10;
  }

  private projectNextPeriodRate(trends: SupplierTrend[]): number {
    if (trends.length < 2) {
      return trends[0]?.averageRate || 0;
    }

    const lastTrend = trends[trends.length - 1];
    const avgMonthlyChange = trends.slice(-6).reduce((sum, t) => sum + t.rateChange, 0) / 
                             Math.min(6, trends.length);

    return Math.round((lastTrend.averageRate + avgMonthlyChange) * 100) / 100;
  }

  private assessRiskLevel(trends: SupplierTrend[], overallTrend: string): 'low' | 'medium' | 'high' {
    if (trends.length === 0) return 'medium';

    const recentTrends = trends.slice(-3);
    const avgDeviation = recentTrends
      .filter(t => t.deviationFromMarket !== undefined)
      .reduce((sum, t) => sum + Math.abs(t.deviationFromMarket!), 0) / recentTrends.length;

    if (avgDeviation > 20 || (overallTrend === 'increasing' && avgDeviation > 10)) {
      return 'high';
    }
    if (avgDeviation > 10 || overallTrend === 'increasing') {
      return 'medium';
    }
    return 'low';
  }

  private generateInsights(
    trends: SupplierTrend[], 
    overallTrend: string, 
    riskLevel: string
  ): string[] {
    const insights: string[] = [];

    if (trends.length === 0) {
      insights.push('Insufficient data for trend analysis');
      return insights;
    }

    const latestTrend = trends[trends.length - 1];

    if (overallTrend === 'increasing') {
      insights.push(`Rates have been trending upward with an average monthly increase`);
    } else if (overallTrend === 'decreasing') {
      insights.push(`Rates have been trending downward, presenting potential cost savings`);
    } else {
      insights.push(`Rates have remained relatively stable over the analysis period`);
    }

    if (latestTrend.deviationFromMarket !== undefined) {
      if (latestTrend.deviationFromMarket > 15) {
        insights.push(`Current rates are ${Math.round(latestTrend.deviationFromMarket)}% above market average - consider renegotiation`);
      } else if (latestTrend.deviationFromMarket < -10) {
        insights.push(`Current rates are ${Math.abs(Math.round(latestTrend.deviationFromMarket))}% below market - competitive pricing`);
      }
    }

    if (riskLevel === 'high') {
      insights.push('High risk of above-market pricing detected - immediate review recommended');
    }

    return insights;
  }

  private generateRecommendation(increasePercent: number, deviationFromMarket: number): string {
    if (deviationFromMarket > 25) {
      return 'Immediate renegotiation required. Consider alternative suppliers.';
    }
    if (increasePercent > 20) {
      return 'Significant rate increase. Request justification and explore alternatives.';
    }
    if (deviationFromMarket > 15) {
      return 'Above market pricing. Schedule rate review with supplier.';
    }
    return 'Monitor closely. Consider including in next contract renewal.';
  }

  private generateAboveMarketSummary(alerts: RateIncreaseAlert[], totalImpact: number): string {
    const criticalCount = alerts.filter(a => a.alertLevel === 'critical').length;
    const warningCount = alerts.filter(a => a.alertLevel === 'warning').length;

    if (alerts.length === 0) {
      return 'No above-market rate increases detected. Pricing is within acceptable thresholds.';
    }

    let summary = `Detected ${alerts.length} above-market rate concern${alerts.length > 1 ? 's' : ''}`;
    
    if (criticalCount > 0) {
      summary += ` (${criticalCount} critical)`;
    }
    
    if (totalImpact > 0) {
      summary += `. Estimated annual impact: $${totalImpact.toLocaleString()}`;
    }

    return summary;
  }
}

// Singleton instance
let instance: SupplierTrendAnalyzerService | null = null;

export function getSupplierTrendAnalyzerService(prisma: PrismaClient): SupplierTrendAnalyzerService {
  if (!instance) {
    instance = new SupplierTrendAnalyzerService(prisma);
  }
  return instance;
}

// For runtime initialization
export const supplierTrendAnalyzerService = {
  getInstance: getSupplierTrendAnalyzerService,
};
