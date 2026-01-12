
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface NegotiationScenario {
  scenarioType: 'best' | 'likely' | 'worst';
  targetRate: number;
  probability: number;
  annualSavings: number;
  assumptions: string[];
  risks: string[];
  recommendations: string[];
}

export interface ScenarioAnalysis {
  currentRate: number;
  marketMedian: number;
  scenarios: NegotiationScenario[];
  probabilityWeightedSavings: number;
  recommendedTarget: number;
  confidenceLevel: number;
}

export class NegotiationScenarioService {
  /**
   * Generate negotiation scenarios for a rate card
   */
  async generateScenarios(
    rateCardId: string,
    tenantId: string,
    volume?: number
  ): Promise<ScenarioAnalysis> {
    // Get rate card details
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId },
      include: { supplier: true },
    });

    if (!rateCard) {
      throw new Error('Rate card not found');
    }

    // Get market benchmark
    const benchmark = await this.getMarketBenchmark(
      tenantId,
      rateCard.roleStandardized,
      rateCard.country,
      rateCard.seniority
    );

    const currentRate = Number(rateCard.dailyRateUSD);
    const marketMedian = benchmark.median;
    const marketP25 = benchmark.p25;
    const marketP75 = benchmark.p75;

    // Calculate annual volume
    const annualVolume = volume || 220; // Default 220 working days

    // Generate scenarios
    const scenarios: NegotiationScenario[] = [];

    // Best Case Scenario (reach P25)
    const bestCaseRate = Math.min(currentRate * 0.85, marketP25);
    scenarios.push({
      scenarioType: 'best',
      targetRate: bestCaseRate,
      probability: 0.2,
      annualSavings: (currentRate - bestCaseRate) * annualVolume,
      assumptions: [
        'Strong negotiation leverage',
        'Multiple competitive alternatives available',
        'Supplier eager to maintain relationship',
        'Market conditions favorable',
      ],
      risks: [
        'May require longer contract commitment',
        'Potential quality concerns at lower rate',
        'Supplier may not accept',
      ],
      recommendations: [
        'Present competitive alternatives',
        'Emphasize volume commitment',
        'Negotiate multi-year contract',
      ],
    });

    // Likely Case Scenario (reach median)
    const likelyCaseRate = Math.min(currentRate * 0.92, marketMedian);
    scenarios.push({
      scenarioType: 'likely',
      targetRate: likelyCaseRate,
      probability: 0.6,
      annualSavings: (currentRate - likelyCaseRate) * annualVolume,
      assumptions: [
        'Moderate negotiation leverage',
        'Market-aligned positioning',
        'Reasonable supplier flexibility',
      ],
      risks: [
        'May require some concessions',
        'Moderate implementation effort',
      ],
      recommendations: [
        'Focus on market data',
        'Highlight long-term partnership',
        'Request volume discounts',
      ],
    });

    // Worst Case Scenario (minimal reduction)
    const worstCaseRate = currentRate * 0.97;
    scenarios.push({
      scenarioType: 'worst',
      targetRate: worstCaseRate,
      probability: 0.2,
      annualSavings: (currentRate - worstCaseRate) * annualVolume,
      assumptions: [
        'Limited negotiation leverage',
        'Supplier has strong position',
        'Few alternatives available',
      ],
      risks: [
        'Minimal savings achieved',
        'Relationship strain',
        'May need to accept rate increase',
      ],
      recommendations: [
        'Focus on non-rate terms',
        'Negotiate payment terms',
        'Explore alternative suppliers',
      ],
    });

    // Calculate probability-weighted savings
    const probabilityWeightedSavings = scenarios.reduce(
      (sum, scenario) => sum + scenario.annualSavings * scenario.probability,
      0
    );

    // Recommended target is the likely case
    const recommendedTarget = likelyCaseRate;

    // Confidence level based on market data quality
    const confidenceLevel = this.calculateConfidenceLevel(
      benchmark.sampleSize,
      currentRate,
      marketMedian
    );

    return {
      currentRate,
      marketMedian,
      scenarios,
      probabilityWeightedSavings,
      recommendedTarget,
      confidenceLevel,
    };
  }

  /**
   * Get market benchmark for comparison
   */
  private async getMarketBenchmark(
    tenantId: string,
    role: string,
    country: string,
    seniority: string
  ): Promise<any> {
    const rates = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: role,
        country,
        seniority: seniority as any,
      },
      select: {
        dailyRateUSD: true,
      },
    });

    if (rates.length === 0) {
      throw new Error('Insufficient market data for benchmark');
    }

    const sortedRates = rates
      .map((r) => Number(r.dailyRateUSD))
      .sort((a, b) => a - b);

    const median = this.calculatePercentile(sortedRates, 50);
    const p25 = this.calculatePercentile(sortedRates, 25);
    const p75 = this.calculatePercentile(sortedRates, 75);

    return {
      median,
      p25,
      p75,
      sampleSize: rates.length,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate confidence level based on data quality
   */
  private calculateConfidenceLevel(
    sampleSize: number,
    currentRate: number,
    marketMedian: number
  ): number {
    let confidence = 0;

    // Sample size factor (0-40 points)
    if (sampleSize >= 50) confidence += 40;
    else if (sampleSize >= 20) confidence += 30;
    else if (sampleSize >= 10) confidence += 20;
    else confidence += 10;

    // Rate variance factor (0-30 points)
    const variance = Math.abs(currentRate - marketMedian) / marketMedian;
    if (variance < 0.1) confidence += 30;
    else if (variance < 0.2) confidence += 20;
    else if (variance < 0.3) confidence += 10;

    // Data recency factor (0-30 points)
    confidence += 30; // Assume recent data for now

    return Math.min(confidence, 100);
  }

  /**
   * Compare scenarios across multiple rate cards
   */
  async compareScenarios(
    rateCardIds: string[],
    tenantId: string
  ): Promise<any> {
    const analyses = await Promise.all(
      rateCardIds.map((id) => this.generateScenarios(id, tenantId))
    );

    const totalWeightedSavings = analyses.reduce(
      (sum, analysis) => sum + analysis.probabilityWeightedSavings,
      0
    );

    const avgConfidence =
      analyses.reduce((sum, analysis) => sum + analysis.confidenceLevel, 0) /
      analyses.length;

    return {
      analyses,
      totalWeightedSavings,
      avgConfidence,
      summary: this.generateComparisonSummary(analyses),
    };
  }

  /**
   * Generate summary for scenario comparison
   */
  private generateComparisonSummary(analyses: ScenarioAnalysis[]): string {
    const totalSavings = analyses.reduce(
      (sum, a) => sum + a.probabilityWeightedSavings,
      0
    );

    const highConfidence = analyses.filter((a) => a.confidenceLevel > 70).length;

    return `Analyzed ${analyses.length} rate cards with total expected savings of $${totalSavings.toLocaleString()}. ${highConfidence} rate cards have high confidence levels (>70%).`;
  }
}

export const negotiationScenarioService = new NegotiationScenarioService();
