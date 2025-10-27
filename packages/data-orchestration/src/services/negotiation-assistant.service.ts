import { PrismaClient } from '@prisma/client';

export interface NegotiationBrief {
  currentSituation: {
    currentRate: number;
    supplierName: string;
    contractExpiry?: Date;
    volumeCommitted?: number;
    roleStandardized: string;
    seniority: string;
    country: string;
  };
  marketPosition: {
    percentileRank: number;
    position: string;
    marketMedian: number;
    marketP25: number;
    marketP75: number;
    cohortSize: number;
  };
  targetRates: RateTargets;
  leverage: LeveragePoint[];
  alternatives: SupplierAlternative[];
  talkingPoints: TalkingPoint[];
  risks: NegotiationRisk[];
  recommendedStrategy: string;
}

export interface RateTargets {
  aggressive: number;
  realistic: number;
  fallback: number;
  justification: string;
}

export interface LeveragePoint {
  point: string;
  category: 'market' | 'volume' | 'competition' | 'relationship';
  strength: 'high' | 'medium' | 'low';
}

export interface SupplierAlternative {
  supplierName: string;
  dailyRate: number;
  savingsAmount: number;
  savingsPercent: number;
  country: string;
  effectiveDate: Date;
  pros: string[];
  cons: string[];
}

export interface TalkingPoint {
  point: string;
  supportingData: string;
  impact: string;
  priority: number;
}

export interface NegotiationRisk {
  risk: string;
  severity: 'high' | 'medium' | 'low';
  mitigation: string;
}

export class NegotiationAssistantService {
  constructor(private prisma: any) {}

  /**
   * Generate comprehensive negotiation brief for a rate card entry
   */
  async generateNegotiationBrief(rateCardEntryId: string): Promise<NegotiationBrief> {
    // Get the rate card entry with related data
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
      include: {
        contract: {
          select: {
            expiryDate: true,
          },
        },
      },
    });

    if (!rateCard) {
      throw new Error('Rate card entry not found');
    }

    // Get benchmark data
    const benchmark = await this.prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (!benchmark) {
      throw new Error('Benchmark data not available for this rate card');
    }

    // Get market position
    const marketPosition = {
      percentileRank: benchmark.percentileRank,
      position: this.getMarketPosition(benchmark.percentileRank),
      marketMedian: benchmark.medianRate,
      marketP25: benchmark.p25Rate,
      marketP75: benchmark.p75Rate,
      cohortSize: benchmark.cohortSize,
    };

    // Calculate target rates
    const targetRates = this.calculateTargetRates(
      rateCard.dailyRateUSD,
      marketPosition
    );

    // Find alternative suppliers
    const alternatives = await this.findAlternativeSuppliers(rateCard);

    // Generate leverage points
    const leverage = this.generateLeveragePoints(
      rateCard,
      marketPosition,
      alternatives
    );

    // Generate talking points
    const talkingPoints = await this.generateTalkingPoints(
      rateCard,
      marketPosition,
      targetRates,
      alternatives
    );

    // Identify risks
    const risks = this.identifyNegotiationRisks(rateCard, marketPosition);

    // Generate recommended strategy using AI
    const recommendedStrategy = await this.generateStrategy(
      rateCard,
      marketPosition,
      targetRates,
      leverage,
      alternatives
    );

    return {
      currentSituation: {
        currentRate: rateCard.dailyRateUSD,
        supplierName: rateCard.supplierName,
        contractExpiry: rateCard.contract?.expiryDate,
        volumeCommitted: rateCard.volumeCommitted,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
      },
      marketPosition,
      targetRates,
      leverage,
      alternatives,
      talkingPoints,
      risks,
      recommendedStrategy,
    };
  }

  /**
   * Get talking points for negotiation
   */
  async getTalkingPoints(rateCardEntryId: string): Promise<TalkingPoint[]> {
    const brief = await this.generateNegotiationBrief(rateCardEntryId);
    return brief.talkingPoints;
  }

  /**
   * Suggest target rates based on market data
   */
  async suggestTargetRates(rateCardEntryId: string): Promise<RateTargets> {
    const brief = await this.generateNegotiationBrief(rateCardEntryId);
    return brief.targetRates;
  }

  /**
   * Find alternative suppliers offering similar services
   */
  async findAlternatives(rateCardEntryId: string): Promise<SupplierAlternative[]> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error('Rate card entry not found');
    }

    return this.findAlternativeSuppliers(rateCard);
  }

  // Private helper methods

  private getMarketPosition(percentileRank: number): string {
    if (percentileRank >= 75) return 'Above Market (Top Quartile)';
    if (percentileRank >= 50) return 'Above Median';
    if (percentileRank >= 25) return 'Below Median';
    return 'Competitive (Bottom Quartile)';
  }

  private calculateTargetRates(
    currentRate: number,
    marketPosition: any
  ): RateTargets {
    const { marketMedian, marketP25, percentileRank } = marketPosition;

    // Aggressive: aim for P25 or 15% reduction, whichever is lower
    const aggressive = Math.min(marketP25, currentRate * 0.85);

    // Realistic: aim for median or 10% reduction
    const realistic = percentileRank > 50 ? marketMedian : currentRate * 0.90;

    // Fallback: 5% reduction minimum
    const fallback = currentRate * 0.95;

    const justification = this.generateTargetJustification(
      currentRate,
      marketPosition,
      { aggressive, realistic, fallback }
    );

    return {
      aggressive: Math.round(aggressive),
      realistic: Math.round(realistic),
      fallback: Math.round(fallback),
      justification,
    };
  }

  private generateTargetJustification(
    currentRate: number,
    marketPosition: any,
    targets: any
  ): string {
    const { percentileRank, marketMedian } = marketPosition;
    
    if (percentileRank >= 75) {
      return `Current rate is in the top quartile (${percentileRank}th percentile). Market data strongly supports a reduction to at least the median rate of $${marketMedian}.`;
    } else if (percentileRank >= 50) {
      return `Current rate is above market median. Competitive pressure and market benchmarks justify a reduction toward the median of $${marketMedian}.`;
    } else {
      return `Current rate is already competitive. Focus on maintaining current rates or modest reductions based on volume commitments.`;
    }
  }

  private async findAlternativeSuppliers(rateCard: any): Promise<SupplierAlternative[]> {
    // Find similar roles from different suppliers with lower rates
    const alternatives = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId: rateCard.tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
        supplierName: { not: rateCard.supplierName },
        dailyRateUSD: { lt: rateCard.dailyRateUSD },
        isActive: true,
      },
      orderBy: { dailyRateUSD: 'asc' },
      take: 5,
    });

    return alternatives.map((alt) => {
      const savingsAmount = rateCard.dailyRateUSD - alt.dailyRateUSD;
      const savingsPercent = (savingsAmount / rateCard.dailyRateUSD) * 100;

      return {
        supplierName: alt.supplierName,
        dailyRate: alt.dailyRateUSD,
        savingsAmount,
        savingsPercent,
        country: alt.country,
        effectiveDate: alt.effectiveDate,
        pros: [
          `${savingsPercent.toFixed(1)}% cost savings`,
          `Proven rate in market`,
        ],
        cons: [
          'Requires supplier transition',
          'May need qualification process',
        ],
      };
    });
  }

  private generateLeveragePoints(
    rateCard: any,
    marketPosition: any,
    alternatives: SupplierAlternative[]
  ): LeveragePoint[] {
    const points: LeveragePoint[] = [];

    // Market position leverage
    if (marketPosition.percentileRank >= 75) {
      points.push({
        point: `Current rate is in the top ${100 - marketPosition.percentileRank}% of market rates`,
        category: 'market',
        strength: 'high',
      });
    }

    // Volume leverage
    if (rateCard.volumeCommitted && rateCard.volumeCommitted > 100) {
      points.push({
        point: `Committed volume of ${rateCard.volumeCommitted} days provides significant leverage`,
        category: 'volume',
        strength: 'high',
      });
    }

    // Competition leverage
    if (alternatives.length > 0) {
      const bestAlt = alternatives[0];
      points.push({
        point: `${alternatives.length} alternative suppliers available with rates ${bestAlt.savingsPercent.toFixed(1)}% lower`,
        category: 'competition',
        strength: alternatives.length >= 3 ? 'high' : 'medium',
      });
    }

    // Cohort size leverage
    if (marketPosition.cohortSize >= 10) {
      points.push({
        point: `Strong market data with ${marketPosition.cohortSize} comparable rates`,
        category: 'market',
        strength: 'medium',
      });
    }

    return points;
  }

  private async generateTalkingPoints(
    rateCard: any,
    marketPosition: any,
    targetRates: RateTargets,
    alternatives: SupplierAlternative[]
  ): Promise<TalkingPoint[]> {
    const points: TalkingPoint[] = [];

    // Market position point
    points.push({
      point: `Market Analysis Shows Opportunity for Rate Optimization`,
      supportingData: `Current rate of $${rateCard.dailyRateUSD} is at the ${marketPosition.percentileRank}th percentile. Market median is $${marketPosition.marketMedian}.`,
      impact: `Aligning to market median would save $${rateCard.dailyRateUSD - marketPosition.marketMedian} per day.`,
      priority: 1,
    });

    // Volume commitment point
    if (rateCard.volumeCommitted) {
      const annualSavings = (rateCard.dailyRateUSD - targetRates.realistic) * rateCard.volumeCommitted;
      points.push({
        point: `Volume Commitment Justifies Preferential Pricing`,
        supportingData: `Committed volume of ${rateCard.volumeCommitted} days annually represents significant business.`,
        impact: `Rate reduction to $${targetRates.realistic} would still provide ${rateCard.volumeCommitted} days of guaranteed work, worth $${targetRates.realistic * rateCard.volumeCommitted} annually.`,
        priority: 2,
      });
    }

    // Competition point
    if (alternatives.length > 0) {
      const bestAlt = alternatives[0];
      points.push({
        point: `Competitive Alternatives Available in Market`,
        supportingData: `${alternatives.length} qualified suppliers offer similar services at lower rates. Best alternative: ${bestAlt.supplierName} at $${bestAlt.dailyRate}.`,
        impact: `Switching suppliers could save $${bestAlt.savingsAmount} per day (${bestAlt.savingsPercent.toFixed(1)}%).`,
        priority: 3,
      });
    }

    // Long-term relationship point
    points.push({
      point: `Seeking Sustainable Long-Term Partnership`,
      supportingData: `Looking to establish competitive rates that support ongoing collaboration.`,
      impact: `Fair market rates enable continued partnership and potential volume growth.`,
      priority: 4,
    });

    return points;
  }

  private identifyNegotiationRisks(
    rateCard: any,
    marketPosition: any
  ): NegotiationRisk[] {
    const risks: NegotiationRisk[] = [];

    // Supplier relationship risk
    if (marketPosition.percentileRank < 50) {
      risks.push({
        risk: 'Current rate is already competitive; aggressive negotiation may damage relationship',
        severity: 'medium',
        mitigation: 'Focus on maintaining current rates rather than reductions. Emphasize partnership value.',
      });
    }

    // Market data risk
    if (marketPosition.cohortSize < 5) {
      risks.push({
        risk: 'Limited market data may weaken negotiation position',
        severity: 'medium',
        mitigation: 'Supplement with industry reports and broader market research.',
      });
    }

    // Supplier switching risk
    risks.push({
      risk: 'Supplier may decline negotiation, requiring transition to alternative',
      severity: 'low',
      mitigation: 'Have qualified alternatives identified and ready. Ensure smooth transition plan.',
    });

    // Quality risk
    if (marketPosition.percentileRank >= 75) {
      risks.push({
        risk: 'Rate reduction may impact service quality or resource availability',
        severity: 'medium',
        mitigation: 'Clearly define quality expectations and SLAs. Monitor performance post-negotiation.',
      });
    }

    return risks;
  }

  private async generateStrategy(
    rateCard: any,
    marketPosition: any,
    targetRates: RateTargets,
    leverage: LeveragePoint[],
    alternatives: SupplierAlternative[]
  ): Promise<string> {
    // Generate strategy based on market position and leverage
    return this.getDefaultStrategy(marketPosition, targetRates, leverage, alternatives);
  }

  private getDefaultStrategy(
    marketPosition: any,
    targetRates: RateTargets,
    leverage: LeveragePoint[],
    alternatives: SupplierAlternative[]
  ): string {
    const hasStrongLeverage = leverage.some(l => l.strength === 'high');
    const hasAlternatives = alternatives.length > 0;

    if (marketPosition.percentileRank >= 75) {
      let strategy = `Lead with market data showing current rate in top quartile (${marketPosition.percentileRank}th percentile). Present realistic target of $${targetRates.realistic} as fair and data-driven based on market median of $${marketPosition.marketMedian}.`;
      
      if (hasAlternatives) {
        strategy += ` Leverage ${alternatives.length} alternative supplier${alternatives.length > 1 ? 's' : ''} offering rates ${alternatives[0].savingsPercent.toFixed(1)}% lower as competitive pressure.`;
      }
      
      if (hasStrongLeverage) {
        strategy += ` Emphasize strong leverage points including volume commitments and market position.`;
      }
      
      strategy += ` Be prepared to walk away if supplier is unwilling to negotiate toward market rates.`;
      return strategy;
    } else if (marketPosition.percentileRank >= 50) {
      let strategy = `Open with market analysis showing rate above median (${marketPosition.percentileRank}th percentile). Propose gradual reduction toward median of $${marketPosition.marketMedian} over contract term.`;
      
      if (hasStrongLeverage) {
        strategy += ` Emphasize volume commitment and long-term partnership value.`;
      }
      
      strategy += ` Position as mutual benefit rather than aggressive cost-cutting. Target realistic rate of $${targetRates.realistic} represents fair market alignment.`;
      return strategy;
    } else {
      let strategy = `Current rate is competitive (${marketPosition.percentileRank}th percentile). Focus on rate stability and volume commitments rather than reductions.`;
      
      if (hasStrongLeverage) {
        strategy += ` Emphasize value of partnership and potential for increased volume.`;
      }
      
      strategy += ` Use market data to justify maintaining current rates against inflation pressures. Target of $${targetRates.fallback} ensures continued competitiveness.`;
      return strategy;
    }
  }
}
