/**
 * Strategic Recommendations Service
 * 
 * Analyzes patterns across multiple rate cards to generate high-level strategic advice.
 * Provides actionable recommendations prioritized by impact and effort.
 * 
 * @module StrategicRecommendationsService
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StrategicRecommendation {
  id: string;
  category: 'COST_REDUCTION' | 'SUPPLIER_OPTIMIZATION' | 'MARKET_POSITIONING' | 'RISK_MITIGATION' | 'PROCESS_IMPROVEMENT';
  title: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
  estimatedSavings?: number;
  affectedRateCards: number;
  actionItems: string[];
  metrics: RecommendationMetrics;
  createdAt: Date;
}

export interface RecommendationMetrics {
  currentState: Record<string, number>;
  targetState: Record<string, number>;
  improvement: Record<string, number>;
}

export interface PortfolioAnalysis {
  tenantId: string;
  totalRateCards: number;
  totalAnnualSpend: number;
  averagePercentileRank: number;
  supplierConcentration: SupplierConcentration;
  costDistribution: CostDistribution;
  marketPositioning: MarketPositioning;
  riskFactors: RiskFactor[];
  opportunities: OpportunitySummary;
}

export interface SupplierConcentration {
  totalSuppliers: number;
  top3Concentration: number; // % of spend
  top5Concentration: number;
  herfindahlIndex: number; // Market concentration index
  diversificationScore: number; // 0-100
}

export interface CostDistribution {
  byPercentile: Record<string, number>;
  bySupplierTier: Record<string, number>;
  byGeography: Record<string, number>;
  byRole: Record<string, number>;
}

export interface MarketPositioning {
  competitiveRates: number; // % below 50th percentile
  averageRates: number; // % 50-75th percentile
  premiumRates: number; // % above 75th percentile
  averageDeviation: number; // % from median
}

export interface RiskFactor {
  type: 'SUPPLIER_DEPENDENCY' | 'COST_VOLATILITY' | 'MARKET_EXPOSURE' | 'DATA_QUALITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  affectedRateCards: number;
  mitigation: string;
}

export interface OpportunitySummary {
  totalOpportunities: number;
  totalPotentialSavings: number;
  quickWins: number; // Low effort, high impact
  strategicInitiatives: number; // High effort, high impact
  averageOpportunitySize: number;
}

// ============================================================================
// Strategic Recommendations Service
// ============================================================================

export class StrategicRecommendationsService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Portfolio Analysis
  // ==========================================================================

  /**
   * Analyze entire rate card portfolio for a tenant
   */
  async analyzePortfolio(tenantId: string): Promise<PortfolioAnalysis> {
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      include: {
        benchmarkSnapshots: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        },
      },
    });

    const totalRateCards = rateCards.length;
    const totalAnnualSpend = this.calculateTotalSpend(rateCards);
    const averagePercentileRank = this.calculateAveragePercentile(rateCards);
    const supplierConcentration = this.analyzeSupplierConcentration(rateCards);
    const costDistribution = this.analyzeCostDistribution(rateCards);
    const marketPositioning = this.analyzeMarketPositioning(rateCards);
    const riskFactors = this.identifyRiskFactors(rateCards, supplierConcentration);
    const opportunities = await this.summarizeOpportunities(tenantId, rateCards);

    return {
      tenantId,
      totalRateCards,
      totalAnnualSpend,
      averagePercentileRank,
      supplierConcentration,
      costDistribution,
      marketPositioning,
      riskFactors,
      opportunities,
    };
  }

  // ==========================================================================
  // Strategic Recommendations Generation
  // ==========================================================================

  /**
   * Generate strategic recommendations based on portfolio analysis
   */
  async generateRecommendations(tenantId: string): Promise<StrategicRecommendation[]> {
    const portfolio = await this.analyzePortfolio(tenantId);
    const recommendations: StrategicRecommendation[] = [];

    // Cost reduction recommendations
    recommendations.push(...this.generateCostRecommendations(portfolio));

    // Supplier optimization recommendations
    recommendations.push(...this.generateSupplierRecommendations(portfolio));

    // Market positioning recommendations
    recommendations.push(...this.generatePositioningRecommendations(portfolio));

    // Risk mitigation recommendations
    recommendations.push(...this.generateRiskRecommendations(portfolio));

    // Process improvement recommendations
    recommendations.push(...this.generateProcessRecommendations(portfolio));

    // Sort by priority (impact/effort ratio)
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate cost reduction recommendations
   */
  private generateCostRecommendations(portfolio: PortfolioAnalysis): StrategicRecommendation[] {
    const recommendations: StrategicRecommendation[] = [];

    // High-cost rate cards optimization
    if (portfolio.marketPositioning.premiumRates > 25) {
      const premiumCount = Math.round((portfolio.marketPositioning.premiumRates / 100) * portfolio.totalRateCards);
      const estimatedSavings = portfolio.totalAnnualSpend * 0.15; // Conservative 15% savings

      recommendations.push({
        id: 'cost-reduction-premium',
        category: 'COST_REDUCTION',
        title: 'Optimize Premium-Priced Rate Cards',
        description: `${portfolio.marketPositioning.premiumRates.toFixed(0)}% of your rate cards (${premiumCount} rates) are priced above the 75th percentile. Negotiating these to market median could yield significant savings.`,
        impact: estimatedSavings > 500000 ? 'HIGH' : estimatedSavings > 100000 ? 'MEDIUM' : 'LOW',
        effort: 'MEDIUM',
        priority: 1,
        estimatedSavings,
        affectedRateCards: premiumCount,
        actionItems: [
          'Identify top 10 highest-cost rate cards by annual spend',
          'Prepare market benchmark data for each',
          'Initiate renegotiation with suppliers',
          'Set target rates at market median (50th percentile)',
        ],
        metrics: {
          currentState: { premiumRates: portfolio.marketPositioning.premiumRates },
          targetState: { premiumRates: 15 },
          improvement: { savingsPercent: 15 },
        },
        createdAt: new Date(),
      });
    }

    // Above-average rates optimization
    if (portfolio.averagePercentileRank > 60) {
      const targetSavings = portfolio.totalAnnualSpend * 0.08;

      recommendations.push({
        id: 'cost-reduction-average',
        category: 'COST_REDUCTION',
        title: 'Reduce Overall Cost Position',
        description: `Your average rate card is at the ${portfolio.averagePercentileRank.toFixed(0)}th percentile. Moving toward the 50th percentile (market median) would improve cost competitiveness.`,
        impact: 'MEDIUM',
        effort: 'HIGH',
        priority: 3,
        estimatedSavings: targetSavings,
        affectedRateCards: portfolio.totalRateCards,
        actionItems: [
          'Set portfolio-wide target at 50th percentile',
          'Develop phased negotiation strategy',
          'Leverage volume across suppliers',
          'Consider alternative suppliers for high-cost categories',
        ],
        metrics: {
          currentState: { avgPercentile: portfolio.averagePercentileRank },
          targetState: { avgPercentile: 50 },
          improvement: { percentileReduction: portfolio.averagePercentileRank - 50 },
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  /**
   * Generate supplier optimization recommendations
   */
  private generateSupplierRecommendations(portfolio: PortfolioAnalysis): StrategicRecommendation[] {
    const recommendations: StrategicRecommendation[] = [];

    // Supplier concentration risk
    if (portfolio.supplierConcentration.top3Concentration > 60) {
      recommendations.push({
        id: 'supplier-diversification',
        category: 'SUPPLIER_OPTIMIZATION',
        title: 'Reduce Supplier Concentration Risk',
        description: `Top 3 suppliers represent ${portfolio.supplierConcentration.top3Concentration.toFixed(0)}% of your spend. This concentration creates dependency risk and reduces negotiating leverage.`,
        impact: 'HIGH',
        effort: 'HIGH',
        priority: 2,
        affectedRateCards: Math.round(portfolio.totalRateCards * (portfolio.supplierConcentration.top3Concentration / 100)),
        actionItems: [
          'Identify alternative suppliers for key roles',
          'Pilot projects with 2-3 new suppliers',
          'Develop multi-supplier strategy for critical roles',
          'Set target: No single supplier >30% of spend',
        ],
        metrics: {
          currentState: { top3Concentration: portfolio.supplierConcentration.top3Concentration },
          targetState: { top3Concentration: 50 },
          improvement: { diversificationIncrease: 20 },
        },
        createdAt: new Date(),
      });
    }

    // Low diversification
    if (portfolio.supplierConcentration.diversificationScore < 50) {
      recommendations.push({
        id: 'supplier-expansion',
        category: 'SUPPLIER_OPTIMIZATION',
        title: 'Expand Supplier Base',
        description: `With only ${portfolio.supplierConcentration.totalSuppliers} suppliers and a diversification score of ${portfolio.supplierConcentration.diversificationScore.toFixed(0)}/100, expanding your supplier base would improve competition and pricing.`,
        impact: 'MEDIUM',
        effort: 'MEDIUM',
        priority: 4,
        affectedRateCards: 0,
        actionItems: [
          'Research and qualify 3-5 new suppliers',
          'Focus on underserved geographies or roles',
          'Establish preferred supplier program',
          'Create competitive bidding process',
        ],
        metrics: {
          currentState: { supplierCount: portfolio.supplierConcentration.totalSuppliers },
          targetState: { supplierCount: portfolio.supplierConcentration.totalSuppliers + 5 },
          improvement: { diversificationScore: 20 },
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  /**
   * Generate market positioning recommendations
   */
  private generatePositioningRecommendations(portfolio: PortfolioAnalysis): StrategicRecommendation[] {
    const recommendations: StrategicRecommendation[] = [];

    // Poor competitive position
    if (portfolio.marketPositioning.competitiveRates < 30) {
      recommendations.push({
        id: 'market-positioning',
        category: 'MARKET_POSITIONING',
        title: 'Improve Competitive Market Position',
        description: `Only ${portfolio.marketPositioning.competitiveRates.toFixed(0)}% of your rates are competitively priced (below 50th percentile). This puts you at a disadvantage in cost-sensitive markets.`,
        impact: 'HIGH',
        effort: 'HIGH',
        priority: 2,
        estimatedSavings: portfolio.totalAnnualSpend * 0.12,
        affectedRateCards: Math.round(portfolio.totalRateCards * 0.7),
        actionItems: [
          'Benchmark all rates against market',
          'Prioritize renegotiations by spend impact',
          'Leverage competitive alternatives',
          'Target: 50% of rates below market median',
        ],
        metrics: {
          currentState: { competitiveRates: portfolio.marketPositioning.competitiveRates },
          targetState: { competitiveRates: 50 },
          improvement: { competitiveIncrease: 50 - portfolio.marketPositioning.competitiveRates },
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  /**
   * Generate risk mitigation recommendations
   */
  private generateRiskRecommendations(portfolio: PortfolioAnalysis): StrategicRecommendation[] {
    const recommendations: StrategicRecommendation[] = [];

    portfolio.riskFactors.forEach((risk, index) => {
      if (risk.severity === 'HIGH') {
        recommendations.push({
          id: `risk-mitigation-${index}`,
          category: 'RISK_MITIGATION',
          title: `Mitigate ${risk.type.replace(/_/g, ' ')} Risk`,
          description: risk.description,
          impact: 'MEDIUM',
          effort: 'MEDIUM',
          priority: 5,
          affectedRateCards: risk.affectedRateCards,
          actionItems: [
            risk.mitigation,
            'Develop contingency plans',
            'Monitor risk indicators monthly',
          ],
          metrics: {
            currentState: { riskLevel: 3 },
            targetState: { riskLevel: 1 },
            improvement: { riskReduction: 67 },
          },
          createdAt: new Date(),
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate process improvement recommendations
   */
  private generateProcessRecommendations(portfolio: PortfolioAnalysis): StrategicRecommendation[] {
    const recommendations: StrategicRecommendation[] = [];

    // Data quality issues
    const dataQualityRisk = portfolio.riskFactors.find(r => r.type === 'DATA_QUALITY');
    if (dataQualityRisk && dataQualityRisk.severity !== 'LOW') {
      recommendations.push({
        id: 'process-data-quality',
        category: 'PROCESS_IMPROVEMENT',
        title: 'Improve Rate Card Data Quality',
        description: 'Data quality issues are affecting benchmark accuracy and decision-making. Implementing data governance would improve insights.',
        impact: 'MEDIUM',
        effort: 'LOW',
        priority: 6,
        affectedRateCards: dataQualityRisk.affectedRateCards,
        actionItems: [
          'Establish data quality standards',
          'Implement validation rules',
          'Regular data audits and cleanup',
          'Training for data entry personnel',
        ],
        metrics: {
          currentState: { dataQuality: 70 },
          targetState: { dataQuality: 95 },
          improvement: { qualityIncrease: 25 },
        },
        createdAt: new Date(),
      });
    }

    return recommendations;
  }

  // ==========================================================================
  // Analysis Helper Methods
  // ==========================================================================

  private calculateTotalSpend(rateCards: any[]): number {
    return rateCards.reduce((sum, rc) => {
      const rate = Number(rc.dailyRateUSD);
      const volume = rc.volumeCommitted || 250;
      return sum + (rate * volume);
    }, 0);
  }

  private calculateAveragePercentile(rateCards: any[]): number {
    const validRates = rateCards.filter(rc => rc.percentileRank);
    if (validRates.length === 0) return 50;
    return validRates.reduce((sum, rc) => sum + rc.percentileRank, 0) / validRates.length;
  }

  private analyzeSupplierConcentration(rateCards: any[]): SupplierConcentration {
    const supplierSpend = new Map<string, number>();
    let totalSpend = 0;

    rateCards.forEach(rc => {
      const spend = Number(rc.dailyRateUSD) * (rc.volumeCommitted || 250);
      supplierSpend.set(rc.supplierId, (supplierSpend.get(rc.supplierId) || 0) + spend);
      totalSpend += spend;
    });

    const sortedSuppliers = Array.from(supplierSpend.entries())
      .sort((a, b) => b[1] - a[1]);

    const top3Spend = sortedSuppliers.slice(0, 3).reduce((sum, [, spend]) => sum + spend, 0);
    const top5Spend = sortedSuppliers.slice(0, 5).reduce((sum, [, spend]) => sum + spend, 0);

    // Calculate Herfindahl-Hirschman Index
    const hhi = sortedSuppliers.reduce((sum, [, spend]) => {
      const marketShare = (spend / totalSpend) * 100;
      return sum + (marketShare * marketShare);
    }, 0);

    // Diversification score (inverse of concentration)
    const diversificationScore = Math.max(0, 100 - (hhi / 100));

    return {
      totalSuppliers: supplierSpend.size,
      top3Concentration: (top3Spend / totalSpend) * 100,
      top5Concentration: (top5Spend / totalSpend) * 100,
      herfindahlIndex: hhi,
      diversificationScore,
    };
  }

  private analyzeCostDistribution(rateCards: any[]): CostDistribution {
    const byPercentile: Record<string, number> = { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 };
    const bySupplierTier: Record<string, number> = {};
    const byGeography: Record<string, number> = {};
    const byRole: Record<string, number> = {};

    rateCards.forEach(rc => {
      const spend = Number(rc.dailyRateUSD) * (rc.volumeCommitted || 250);

      // By percentile
      if (rc.percentileRank <= 25) byPercentile['0-25'] += spend;
      else if (rc.percentileRank <= 50) byPercentile['25-50'] += spend;
      else if (rc.percentileRank <= 75) byPercentile['50-75'] += spend;
      else byPercentile['75-100'] += spend;

      // By supplier tier
      bySupplierTier[rc.supplierTier] = (bySupplierTier[rc.supplierTier] || 0) + spend;

      // By geography
      byGeography[rc.country] = (byGeography[rc.country] || 0) + spend;

      // By role
      byRole[rc.roleStandardized] = (byRole[rc.roleStandardized] || 0) + spend;
    });

    return { byPercentile, bySupplierTier, byGeography, byRole };
  }

  private analyzeMarketPositioning(rateCards: any[]): MarketPositioning {
    const validRates = rateCards.filter(rc => rc.percentileRank);
    if (validRates.length === 0) {
      return { competitiveRates: 0, averageRates: 0, premiumRates: 0, averageDeviation: 0 };
    }

    const competitive = validRates.filter(rc => rc.percentileRank < 50).length;
    const average = validRates.filter(rc => rc.percentileRank >= 50 && rc.percentileRank < 75).length;
    const premium = validRates.filter(rc => rc.percentileRank >= 75).length;

    const avgDeviation = validRates.reduce((sum, rc) => {
      const deviation = rc.marketRateMedian ? 
        ((Number(rc.dailyRateUSD) - Number(rc.marketRateMedian)) / Number(rc.marketRateMedian)) * 100 : 0;
      return sum + Math.abs(deviation);
    }, 0) / validRates.length;

    return {
      competitiveRates: (competitive / validRates.length) * 100,
      averageRates: (average / validRates.length) * 100,
      premiumRates: (premium / validRates.length) * 100,
      averageDeviation: avgDeviation,
    };
  }

  private identifyRiskFactors(rateCards: any[], concentration: SupplierConcentration): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Supplier dependency risk
    if (concentration.top3Concentration > 70) {
      risks.push({
        type: 'SUPPLIER_DEPENDENCY',
        severity: 'HIGH',
        description: `Critical dependency on top 3 suppliers (${concentration.top3Concentration.toFixed(0)}% of spend)`,
        affectedRateCards: Math.round(rateCards.length * (concentration.top3Concentration / 100)),
        mitigation: 'Diversify supplier base and develop alternative sources',
      });
    }

    // Data quality risk
    const missingData = rateCards.filter(rc => !rc.percentileRank || !rc.marketRateMedian).length;
    if (missingData > rateCards.length * 0.2) {
      risks.push({
        type: 'DATA_QUALITY',
        severity: 'MEDIUM',
        description: `${((missingData / rateCards.length) * 100).toFixed(0)}% of rate cards lack benchmark data`,
        affectedRateCards: missingData,
        mitigation: 'Run benchmarking for all rate cards and improve data completeness',
      });
    }

    return risks;
  }

  private async summarizeOpportunities(tenantId: string, rateCards: any[]): Promise<OpportunitySummary> {
    const highCostRates = rateCards.filter(rc => rc.percentileRank && rc.percentileRank > 75);
    const totalPotentialSavings = highCostRates.reduce((sum, rc) => {
      const savings = rc.savingsAmount ? Number(rc.savingsAmount) : 0;
      const volume = rc.volumeCommitted || 250;
      return sum + (savings * volume);
    }, 0);

    const quickWins = highCostRates.filter(rc => rc.percentileRank > 85).length;
    const strategicInitiatives = highCostRates.filter(rc => rc.percentileRank > 75 && rc.percentileRank <= 85).length;

    return {
      totalOpportunities: highCostRates.length,
      totalPotentialSavings,
      quickWins,
      strategicInitiatives,
      averageOpportunitySize: highCostRates.length > 0 ? totalPotentialSavings / highCostRates.length : 0,
    };
  }
}

export const strategicRecommendationsService = StrategicRecommendationsService;
