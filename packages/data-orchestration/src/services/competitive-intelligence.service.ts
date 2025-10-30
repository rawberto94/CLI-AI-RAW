import { PrismaClient } from '@prisma/client';

interface CompetitivenessMetrics {
  overallScore: number; // 0-100
  marketPosition: {
    percentile: number;
    ranking: string; // 'Excellent', 'Good', 'Average', 'Below Average', 'Poor'
  };
  priceCompetitiveness: {
    score: number;
    avgRateVsMarket: number; // percentage difference
    competitiveRatesCount: number;
    totalRatesCount: number;
  };
  coverageAnalysis: {
    rolesCount: number;
    geographiesCount: number;
    suppliersCount: number;
    gapAreas: string[];
  };
  topOpportunities: CompetitiveOpportunity[];
  atRiskRates: AtRiskRate[];
  trends: {
    monthOverMonth: number;
    quarterOverQuarter: number;
    direction: 'improving' | 'declining' | 'stable';
  };
}

interface CompetitiveOpportunity {
  id: string;
  type: 'rate_reduction' | 'supplier_switch' | 'consolidation' | 'geographic_arbitrage';
  title: string;
  description: string;
  potentialSavings: number;
  savingsPercentage: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: number;
  affectedRates: number;
}

interface AtRiskRate {
  id: string;
  role: string;
  supplier: string;
  currentRate: number;
  marketMedian: number;
  percentileRank: number;
  riskLevel: 'high' | 'critical';
  reason: string;
  recommendedAction: string;
}

export class CompetitiveIntelligenceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate overall competitiveness score
   */
  async calculateCompetitivenessScore(tenantId: string): Promise<CompetitivenessMetrics> {
    // Fetch all rate cards for tenant
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      include: {
        supplier: true,
      },
    });

    if (rateCards.length === 0) {
      return this.getEmptyMetrics();
    }

    // Calculate price competitiveness
    const priceCompetitiveness = this.calculatePriceCompetitiveness(rateCards);

    // Calculate coverage analysis
    const coverageAnalysis = this.calculateCoverageAnalysis(rateCards);

    // Identify top opportunities
    const topOpportunities = await this.identifyTopOpportunities(tenantId, rateCards);

    // Identify at-risk rates
    const atRiskRates = this.identifyAtRiskRates(rateCards);

    // Calculate trends
    const trends = await this.calculateTrends(tenantId);

    // Calculate overall score (weighted average)
    const overallScore = this.calculateOverallScore(
      priceCompetitiveness.score,
      coverageAnalysis,
      atRiskRates.length,
      rateCards.length
    );

    // Determine market position
    const marketPosition = this.determineMarketPosition(overallScore);

    return {
      overallScore,
      marketPosition,
      priceCompetitiveness,
      coverageAnalysis,
      topOpportunities: topOpportunities.slice(0, 10),
      atRiskRates: atRiskRates.slice(0, 10),
      trends,
    };
  }

  /**
   * Calculate price competitiveness
   */
  private calculatePriceCompetitiveness(rateCards: any[]) {
    let competitiveCount = 0;
    let totalDifference = 0;
    let validComparisons = 0;

    rateCards.forEach((rc) => {
      if (rc.marketRateMedian && rc.percentileRank) {
        const difference = ((rc.dailyRateUSD - rc.marketRateMedian) / rc.marketRateMedian) * 100;
        totalDifference += difference;
        validComparisons++;

        // Consider competitive if below 50th percentile
        if (rc.percentileRank <= 50) {
          competitiveCount++;
        }
      }
    });

    const avgRateVsMarket = validComparisons > 0 ? totalDifference / validComparisons : 0;
    const competitivePercentage = (competitiveCount / rateCards.length) * 100;

    // Score: 100 if all rates are competitive, decreasing as fewer are competitive
    const score = Math.max(0, Math.min(100, competitivePercentage));

    return {
      score,
      avgRateVsMarket,
      competitiveRatesCount: competitiveCount,
      totalRatesCount: rateCards.length,
    };
  }

  /**
   * Calculate coverage analysis
   */
  private calculateCoverageAnalysis(rateCards: any[]) {
    const roles = new Set(rateCards.map((rc) => rc.roleStandardized));
    const geographies = new Set(rateCards.map((rc) => rc.country));
    const suppliers = new Set(rateCards.map((rc) => rc.supplierId));

    // Identify gap areas (simplified - would need more sophisticated analysis)
    const gapAreas: string[] = [];
    if (roles.size < 10) gapAreas.push('Limited role coverage');
    if (geographies.size < 5) gapAreas.push('Limited geographic coverage');
    if (suppliers.size < 3) gapAreas.push('Limited supplier diversity');

    return {
      rolesCount: roles.size,
      geographiesCount: geographies.size,
      suppliersCount: suppliers.size,
      gapAreas,
    };
  }

  /**
   * Identify top opportunities
   */
  private async identifyTopOpportunities(
    tenantId: string,
    rateCards: any[]
  ): Promise<CompetitiveOpportunity[]> {
    const opportunities: CompetitiveOpportunity[] = [];

    // Find rates above 75th percentile (expensive)
    rateCards.forEach((rc) => {
      if (rc.percentileRank && rc.percentileRank >= 75 && rc.marketRateMedian) {
        const potentialSavings = rc.dailyRateUSD - rc.marketRateMedian;
        const savingsPercentage = (potentialSavings / rc.dailyRateUSD) * 100;

        if (potentialSavings > 0) {
          opportunities.push({
            id: rc.id,
            type: 'rate_reduction',
            title: `Reduce ${rc.roleStandardized} rate`,
            description: `Current rate is at ${rc.percentileRank}th percentile. Target median rate.`,
            potentialSavings: potentialSavings * (rc.volumeCommitted || 220), // Annualized
            savingsPercentage,
            effort: savingsPercentage > 20 ? 'high' : savingsPercentage > 10 ? 'medium' : 'low',
            impact: potentialSavings > 500 ? 'high' : potentialSavings > 200 ? 'medium' : 'low',
            priority: this.calculatePriority(potentialSavings, savingsPercentage),
            affectedRates: 1,
          });
        }
      }
    });

    // Sort by priority (savings * impact)
    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Identify at-risk rates
   */
  private identifyAtRiskRates(rateCards: any[]): AtRiskRate[] {
    const atRisk: AtRiskRate[] = [];

    rateCards.forEach((rc) => {
      if (rc.percentileRank && rc.percentileRank >= 90) {
        const riskLevel = rc.percentileRank >= 95 ? 'critical' : 'high';
        const reason =
          rc.percentileRank >= 95
            ? 'Rate is in top 5% most expensive'
            : 'Rate is in top 10% most expensive';

        atRisk.push({
          id: rc.id,
          role: rc.roleStandardized,
          supplier: rc.supplierName,
          currentRate: rc.dailyRateUSD,
          marketMedian: rc.marketRateMedian || 0,
          percentileRank: rc.percentileRank,
          riskLevel,
          reason,
          recommendedAction: 'Renegotiate or consider alternative suppliers',
        });
      }
    });

    return atRisk.sort((a, b) => b.percentileRank - a.percentileRank);
  }

  /**
   * Calculate trends
   */
  private async calculateTrends(tenantId: string) {
    // Get historical competitiveness scores (simplified - would need historical tracking)
    // For now, return placeholder data
    return {
      monthOverMonth: 0,
      quarterOverQuarter: 0,
      direction: 'stable' as const,
    };
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(
    priceScore: number,
    coverage: any,
    atRiskCount: number,
    totalCount: number
  ): number {
    // Weighted scoring
    const priceWeight = 0.5;
    const coverageWeight = 0.2;
    const riskWeight = 0.3;

    // Coverage score (normalized)
    const coverageScore = Math.min(
      100,
      (coverage.rolesCount / 20) * 30 +
        (coverage.geographiesCount / 10) * 30 +
        (coverage.suppliersCount / 5) * 40
    );

    // Risk score (inverse - fewer at-risk is better)
    const riskPercentage = (atRiskCount / totalCount) * 100;
    const riskScore = Math.max(0, 100 - riskPercentage * 2);

    const overall =
      priceScore * priceWeight + coverageScore * coverageWeight + riskScore * riskWeight;

    return Math.round(overall);
  }

  /**
   * Determine market position
   */
  private determineMarketPosition(score: number) {
    let ranking: string;
    let percentile: number;

    if (score >= 90) {
      ranking = 'Excellent';
      percentile = 95;
    } else if (score >= 75) {
      ranking = 'Good';
      percentile = 75;
    } else if (score >= 60) {
      ranking = 'Average';
      percentile = 50;
    } else if (score >= 40) {
      ranking = 'Below Average';
      percentile = 25;
    } else {
      ranking = 'Poor';
      percentile = 10;
    }

    return { percentile, ranking };
  }

  /**
   * Calculate priority
   */
  private calculatePriority(savings: number, percentage: number): number {
    // Priority = savings amount * percentage impact
    return Math.round(savings * percentage);
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): CompetitivenessMetrics {
    return {
      overallScore: 0,
      marketPosition: {
        percentile: 0,
        ranking: 'No Data',
      },
      priceCompetitiveness: {
        score: 0,
        avgRateVsMarket: 0,
        competitiveRatesCount: 0,
        totalRatesCount: 0,
      },
      coverageAnalysis: {
        rolesCount: 0,
        geographiesCount: 0,
        suppliersCount: 0,
        gapAreas: ['No rate cards available'],
      },
      topOpportunities: [],
      atRiskRates: [],
      trends: {
        monthOverMonth: 0,
        quarterOverQuarter: 0,
        direction: 'stable',
      },
    };
  }
}
