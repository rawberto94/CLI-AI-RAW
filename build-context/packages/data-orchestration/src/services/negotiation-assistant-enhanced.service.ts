import { prisma } from '../lib/prisma';


export interface EnhancedTalkingPoint {
  point: string;
  supportingData: string;
  impact: string;
  priority: number;
  category: 'market' | 'supplier' | 'volume' | 'competition' | 'geography' | 'relationship' | 'trend';
  confidence: number;
}

export class NegotiationAssistantEnhancedService {
  /**
   * Generate enhanced talking points with supplier intelligence
   */
  async generateEnhancedTalkingPoints(
    rateCardId: string,
    tenantId: string
  ): Promise<EnhancedTalkingPoint[]> {
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId },
      include: { supplier: true },
    });

    if (!rateCard) {
      throw new Error('Rate card not found');
    }

    // Get market position
    const benchmark = await prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId: rateCardId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!benchmark) {
      throw new Error('Benchmark data not available');
    }

    // Get supplier intelligence
    const supplierScore = await prisma.supplierScore.findFirst({
      where: { supplierId: rateCard.supplierId },
      orderBy: { calculationDate: 'desc' },
    });

    // Get alternatives
    const alternatives = await this.findAlternatives(rateCard);

    // Get geographic opportunities
    const geoOpportunities = await prisma.geographicArbitrageOpportunity.findMany({
      where: {
        tenantId,
        sourceCountry: rateCard.country,
        status: 'IDENTIFIED',
      },
      orderBy: { annualSavingsPotential: 'desc' },
      take: 1,
    });

    // Get market trends
    const marketTrend = await prisma.marketRateIntelligence.findFirst({
      where: {
        tenantId,
        roleStandardized: rateCard.roleStandardized,
        country: rateCard.country,
      },
      orderBy: { periodStart: 'desc' },
    });

    const points: EnhancedTalkingPoint[] = [];

    // Market position point
    if (benchmark.percentileRank > 50) {
      const dailySavings = Number(rateCard.dailyRateUSD) - Number(benchmark.median);
      const annualSavings = dailySavings * 220;
      
      points.push({
        point: 'Market Analysis Shows Significant Rate Optimization Opportunity',
        supportingData: `Current rate of $${rateCard.dailyRateUSD} is at the ${benchmark.percentileRank}th percentile. Market median is $${benchmark.median} based on ${benchmark.cohortSize} comparable rates.`,
        impact: `Aligning to market median would save $${dailySavings.toFixed(2)}/day or $${annualSavings.toLocaleString()}/year.`,
        priority: dailySavings > 100 ? 1 : 2,
        category: 'market',
        confidence: benchmark.cohortSize >= 10 ? 90 : 70,
      });
    }

    // Supplier performance point
    if (supplierScore) {
      if (supplierScore.trend === 'declining') {
        points.push({
          point: 'Supplier Performance Trends Warrant Rate Review',
          supportingData: `Supplier competitiveness score has declined to ${supplierScore.overallScore}/100 (ranked ${supplierScore.ranking} of ${supplierScore.totalSuppliers}). Price competitiveness: ${supplierScore.priceCompetitiveness}/100.`,
          impact: 'Declining performance justifies rate renegotiation to maintain value alignment.',
          priority: 1,
          category: 'supplier',
          confidence: 85,
        });
      } else if (Number(supplierScore.priceCompetitiveness) < 60) {
        points.push({
          point: 'Supplier Pricing Not Competitive with Market',
          supportingData: `Supplier's price competitiveness score is ${supplierScore.priceCompetitiveness}/100, below market average.`,
          impact: 'Market-aligned pricing would improve value proposition and enable continued partnership.',
          priority: 2,
          category: 'supplier',
          confidence: 80,
        });
      }
    }

    // Volume commitment point
    if (rateCard.volumeCommitted && rateCard.volumeCommitted > 100) {
      const targetRate = Number(benchmark.median);
      const annualValue = targetRate * rateCard.volumeCommitted;
      
      points.push({
        point: 'Significant Volume Commitment Justifies Preferential Pricing',
        supportingData: `Committed volume of ${rateCard.volumeCommitted} days annually represents $${annualValue.toLocaleString()} in guaranteed revenue.`,
        impact: `Volume-based pricing at $${targetRate}/day maintains substantial annual contract value while aligning to market rates.`,
        priority: rateCard.volumeCommitted > 200 ? 1 : 2,
        category: 'volume',
        confidence: 95,
      });
    }

    // Competition point
    if (alternatives.length > 0) {
      const bestAlt = alternatives[0];
      const topAlts = alternatives.slice(0, 3);
      
      points.push({
        point: 'Multiple Competitive Alternatives Available',
        supportingData: `${alternatives.length} qualified suppliers offer similar services at lower rates. Top alternatives: ${topAlts.map(a => `${a.supplierName} ($${a.dailyRate})`).join(', ')}.`,
        impact: `Best alternative offers ${bestAlt.savingsPercent.toFixed(1)}% savings ($${bestAlt.savingsAmount}/day). Switching would save $${(bestAlt.savingsAmount * 220).toLocaleString()}/year.`,
        priority: bestAlt.savingsAmount > 100 ? 1 : 3,
        category: 'competition',
        confidence: 85,
      });

      if (alternatives.length >= 3) {
        points.push({
          point: 'Strong Competitive Market Provides Negotiation Leverage',
          supportingData: `${alternatives.length} alternative suppliers demonstrate active, competitive market with rates ranging from $${alternatives[alternatives.length - 1].dailyRate} to $${alternatives[0].dailyRate}.`,
          impact: 'Competitive market conditions support rate reduction requests and provide fallback options.',
          priority: 3,
          category: 'competition',
          confidence: 90,
        });
      }
    }

    // Geographic arbitrage point
    if (geoOpportunities.length > 0) {
      const geoOpp = geoOpportunities[0];
      points.push({
        point: 'Geographic Rate Arbitrage Opportunity Identified',
        supportingData: `Similar roles in ${geoOpp.targetCountry} average $${geoOpp.targetAverageRate}/day vs $${geoOpp.currentAverageRate}/day in ${geoOpp.sourceCountry}.`,
        impact: `Geographic flexibility could save ${geoOpp.savingsPercentage}% or $${Number(geoOpp.annualSavingsPotential).toLocaleString()}/year.`,
        priority: 4,
        category: 'geography',
        confidence: 75,
      });
    }

    // Market trend point
    if (marketTrend && marketTrend.trendDirection === 'decreasing') {
      points.push({
        point: 'Market Rates Trending Downward',
        supportingData: `Market analysis shows ${Math.abs(Number(marketTrend.monthOverMonth) || 0).toFixed(1)}% month-over-month decrease in rates for ${rateCard.roleStandardized} roles.`,
        impact: 'Downward market trend supports rate reduction request and suggests further decreases may occur.',
        priority: 3,
        category: 'trend',
        confidence: 80,
      });
    }

    // Long-term partnership point
    points.push({
      point: 'Seeking Sustainable Long-Term Partnership at Market Rates',
      supportingData: 'Objective is to establish competitive, market-aligned rates that support ongoing collaboration and potential volume growth.',
      impact: 'Fair market rates enable continued partnership, reduce procurement friction, and create foundation for expanded engagement.',
      priority: 5,
      category: 'relationship',
      confidence: 100,
    });

    // Sort by priority
    return points.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Find alternative suppliers
   */
  private async findAlternatives(rateCard: any): Promise<any[]> {
    const alternatives = await prisma.rateCardEntry.findMany({
      where: {
        tenantId: rateCard.tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
        supplierName: { not: rateCard.supplierName },
        dailyRateUSD: { lt: rateCard.dailyRateUSD },
      },
      orderBy: { dailyRateUSD: 'asc' },
      take: 5,
    });

    return alternatives.map((alt) => {
      const savingsAmount = Number(rateCard.dailyRateUSD) - Number(alt.dailyRateUSD);
      const savingsPercent = (savingsAmount / Number(rateCard.dailyRateUSD)) * 100;

      return {
        supplierName: alt.supplierName,
        dailyRate: Number(alt.dailyRateUSD),
        savingsAmount,
        savingsPercent,
      };
    });
  }

  /**
   * Generate historical negotiation insights
   */
  async getHistoricalNegotiationInsights(
    tenantId: string,
    supplierId?: string
  ): Promise<any> {
    // Get historical rate changes
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        supplierId: supplierId || undefined,
      },
      orderBy: { effectiveDate: 'desc' },
      take: 100,
    });

    // Analyze rate changes over time
    const rateChanges = [];
    for (let i = 1; i < rateCards.length; i++) {
      const current = rateCards[i - 1];
      const previous = rateCards[i];

      if (
        current.roleStandardized === previous.roleStandardized &&
        current.supplierId === previous.supplierId
      ) {
        const change = Number(current.dailyRateUSD) - Number(previous.dailyRateUSD);
        const changePercent = (change / Number(previous.dailyRateUSD)) * 100;

        rateChanges.push({
          role: current.roleStandardized,
          supplier: current.supplierName,
          previousRate: Number(previous.dailyRateUSD),
          currentRate: Number(current.dailyRateUSD),
          change,
          changePercent,
          timespan: Math.floor(
            (current.effectiveDate.getTime() - previous.effectiveDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        });
      }
    }

    // Calculate success metrics
    const successfulNegotiations = rateChanges.filter((rc) => rc.change < 0);
    const avgReduction =
      successfulNegotiations.reduce((sum, rc) => sum + Math.abs(rc.changePercent), 0) /
      (successfulNegotiations.length || 1);

    return {
      totalNegotiations: rateChanges.length,
      successfulNegotiations: successfulNegotiations.length,
      successRate: (successfulNegotiations.length / (rateChanges.length || 1)) * 100,
      avgReduction,
      insights: this.generateHistoricalInsights(rateChanges, successfulNegotiations),
    };
  }

  /**
   * Generate insights from historical data
   */
  private generateHistoricalInsights(
    allChanges: any[],
    successful: any[]
  ): string[] {
    const insights: string[] = [];

    if (successful.length > 0) {
      const avgReduction =
        successful.reduce((sum, rc) => sum + Math.abs(rc.changePercent), 0) /
        successful.length;
      insights.push(
        `Historical data shows ${successful.length} successful negotiations with average ${avgReduction.toFixed(1)}% rate reduction.`
      );
    }

    if (allChanges.length > 0) {
      const avgTimespan =
        allChanges.reduce((sum, rc) => sum + rc.timespan, 0) / allChanges.length;
      insights.push(
        `Typical negotiation cycle is ${Math.round(avgTimespan)} days between rate changes.`
      );
    }

    return insights;
  }
}

export const negotiationAssistantEnhancedService =
  new NegotiationAssistantEnhancedService();
