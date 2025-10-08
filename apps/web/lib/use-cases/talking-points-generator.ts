import {
  TalkingPoint,
  MarketIntelligence,
  TrendAnalysis,
  TargetRates,
} from "./rate-history-types";

export interface TalkingPointsConfig {
  role: string;
  level: string;
  location: string;
  supplier: string;
  currentRate: number;
  targetRate: number;
  marketIntelligence: MarketIntelligence;
  trendAnalysis: TrendAnalysis;
  targetRates: TargetRates;
  annualVolume?: number;
  relationshipYears?: number;
}

export class TalkingPointsGenerator {
  // Generate comprehensive talking points for negotiation
  static generateTalkingPoints(config: TalkingPointsConfig): TalkingPoint[] {
    const points: TalkingPoint[] = [];

    // Market-based talking points
    points.push(...this.generateMarketPoints(config));

    // Volume-based talking points
    points.push(...this.generateVolumePoints(config));

    // Competitive talking points
    points.push(...this.generateCompetitivePoints(config));

    // Trend-based talking points
    points.push(...this.generateTrendPoints(config));

    // Relationship talking points
    points.push(...this.generateRelationshipPoints(config));

    // Sort by persuasiveness score
    return points.sort((a, b) => b.persuasivenessScore - a.persuasivenessScore);
  }

  // Generate market-based arguments
  private static generateMarketPoints(
    config: TalkingPointsConfig
  ): TalkingPoint[] {
    const points: TalkingPoint[] = [];
    const { marketIntelligence, currentRate, targetRate } = config;

    // Market position argument
    if (marketIntelligence.competitivePosition.percentile > 60) {
      const percentile = marketIntelligence.competitivePosition.percentile;
      points.push({
        id: `market-position-${Date.now()}`,
        category: "market",
        title: "Current Rate Above Market Average",
        text: `Our current rate of CHF ${currentRate.toLocaleString()} places us in the ${percentile}th percentile of the market. This means we're paying more than ${percentile}% of similar engagements. Market data shows the median rate is CHF ${marketIntelligence.medianRate.toLocaleString()}, representing a ${Math.round(
          ((currentRate - marketIntelligence.medianRate) / currentRate) * 100
        )}% premium.`,
        supportingData: `Market median: CHF ${marketIntelligence.medianRate.toLocaleString()}`,
        persuasivenessScore: 9,
        dataSource: "Market Intelligence Database",
      });
    }

    // Competitive benchmark argument
    const competitorsBelow =
      marketIntelligence.competitivePosition.competitorsBelow;
    if (competitorsBelow > 0) {
      points.push({
        id: `competitive-benchmark-${Date.now()}`,
        category: "competitive",
        title: "Multiple Suppliers Offer Lower Rates",
        text: `Market analysis reveals ${competitorsBelow} suppliers offering comparable ${
          config.role
        } resources at lower rates. The target rate of CHF ${targetRate.toLocaleString()} aligns with the 25th percentile, which is a reasonable market position while maintaining quality standards.`,
        supportingData: `${competitorsBelow} suppliers with lower rates identified`,
        persuasivenessScore: 8,
        dataSource: "Competitive Rate Analysis",
      });
    }

    // Market average argument
    const avgDiff = currentRate - marketIntelligence.averageRate;
    if (avgDiff > 0) {
      points.push({
        id: `market-average-${Date.now()}`,
        category: "market",
        title: "Rate Exceeds Market Average",
        text: `The current rate exceeds the market average by CHF ${Math.round(
          avgDiff
        ).toLocaleString()} per day (${Math.round(
          (avgDiff / currentRate) * 100
        )}%). Aligning with market averages would result in more competitive pricing while maintaining service quality.`,
        supportingData: `Market average: CHF ${marketIntelligence.averageRate.toLocaleString()}`,
        persuasivenessScore: 7,
        dataSource: "Market Statistics",
      });
    }

    return points;
  }

  // Generate volume-based arguments
  private static generateVolumePoints(
    config: TalkingPointsConfig
  ): TalkingPoint[] {
    const points: TalkingPoint[] = [];
    const volume = config.annualVolume || 220;

    if (volume >= 200) {
      const annualValue = config.currentRate * volume;
      const reduction = config.currentRate - config.targetRate;
      const annualSavings = reduction * volume;

      points.push({
        id: `volume-commitment-${Date.now()}`,
        category: "volume",
        title: "Significant Volume Commitment",
        text: `We're committing to ${volume} person-days annually, representing CHF ${annualValue.toLocaleString()} in annual business. This substantial volume warrants preferential pricing. A rate reduction to CHF ${config.targetRate.toLocaleString()} would still maintain CHF ${(
          config.targetRate * volume
        ).toLocaleString()} in annual revenue for the supplier.`,
        supportingData: `${volume} person-days/year = CHF ${annualValue.toLocaleString()} annual value`,
        persuasivenessScore: 8,
        dataSource: "Volume Analysis",
      });
    }

    if (volume >= 150) {
      points.push({
        id: `volume-discount-${Date.now()}`,
        category: "volume",
        title: "Volume Discount Justification",
        text: `Industry standard volume discounts for engagements of ${volume}+ person-days typically range from 10-15%. Our target rate represents a ${Math.round(
          ((config.currentRate - config.targetRate) / config.currentRate) * 100
        )}% reduction, which is within standard volume discount ranges.`,
        supportingData: `Volume: ${volume} person-days`,
        persuasivenessScore: 7,
        dataSource: "Industry Standards",
      });
    }

    return points;
  }

  // Generate competitive arguments
  private static generateCompetitivePoints(
    config: TalkingPointsConfig
  ): TalkingPoint[] {
    const points: TalkingPoint[] = [];
    const { targetRates, currentRate, targetRate } = config;

    // Alternative supplier argument
    points.push({
      id: `alternative-suppliers-${Date.now()}`,
      category: "competitive",
      title: "Alternative Supplier Options",
      text: `We have identified alternative suppliers offering ${
        config.role
      } (${config.level}) resources in ${
        config.location
      } at rates between CHF ${targetRates.market.p10.toLocaleString()} and CHF ${targetRates.market.p25.toLocaleString()}. While we value our current partnership, we need to ensure competitive pricing to justify continued engagement.`,
      supportingData: `Market range: CHF ${targetRates.market.p10.toLocaleString()} - CHF ${targetRates.market.p90.toLocaleString()}`,
      persuasivenessScore: 9,
      dataSource: "Supplier Market Analysis",
    });

    // Competitive pressure argument
    const savingsPercent = Math.round(
      ((currentRate - targetRate) / currentRate) * 100
    );
    points.push({
      id: `competitive-pressure-${Date.now()}`,
      category: "competitive",
      title: "Market Competitive Pressure",
      text: `Current market conditions show increasing competitive pressure in the ${config.role} space. Suppliers are offering more competitive rates to secure long-term partnerships. A ${savingsPercent}% rate adjustment would align with current market dynamics and ensure our continued partnership.`,
      supportingData: `Target reduction: ${savingsPercent}%`,
      persuasivenessScore: 7,
      dataSource: "Market Dynamics Analysis",
    });

    return points;
  }

  // Generate trend-based arguments
  private static generateTrendPoints(
    config: TalkingPointsConfig
  ): TalkingPoint[] {
    const points: TalkingPoint[] = [];
    const { trendAnalysis } = config;

    if (trendAnalysis.direction === "decreasing") {
      points.push({
        id: `declining-trend-${Date.now()}`,
        category: "market",
        title: "Market Rates Trending Downward",
        text: `Historical analysis shows ${config.role} rates in ${
          config.location
        } have been declining at CHF ${Math.abs(
          trendAnalysis.slope || 0
        ).toFixed(
          0
        )} per month over the past year. This downward trend is expected to continue, with 6-month forecasts predicting rates around CHF ${(
          trendAnalysis.forecast || 0
        ).toLocaleString()}. Adjusting rates now aligns with market trajectory.`,
        supportingData: `Trend: ${(trendAnalysis.slope || 0).toFixed(
          1
        )} CHF/month decline`,
        persuasivenessScore: 8,
        dataSource: "Historical Trend Analysis",
      });
    }

    if (trendAnalysis.direction === "stable" && trendAnalysis.volatility < 10) {
      points.push({
        id: `stable-market-${Date.now()}`,
        category: "market",
        title: "Stable Market Conditions",
        text: `Market analysis shows stable rate conditions with low volatility (${trendAnalysis.volatility.toFixed(
          1
        )}%). This stability provides confidence that the target rate of CHF ${config.targetRate.toLocaleString()} is sustainable and reflects true market value rather than temporary fluctuations.`,
        supportingData: `Volatility: ${trendAnalysis.volatility.toFixed(1)}%`,
        persuasivenessScore: 6,
        dataSource: "Market Stability Analysis",
      });
    }

    return points;
  }

  // Generate relationship-based arguments
  private static generateRelationshipPoints(
    config: TalkingPointsConfig
  ): TalkingPoint[] {
    const points: TalkingPoint[] = [];
    const years = config.relationshipYears || 2;

    if (years >= 2) {
      points.push({
        id: `long-term-partnership-${Date.now()}`,
        category: "relationship",
        title: "Long-Term Partnership Value",
        text: `We've maintained a ${years}-year partnership, demonstrating our commitment to long-term collaboration. This relationship has provided consistent revenue and reduced supplier acquisition costs. We're seeking a rate adjustment that reflects this mutual value and ensures continued partnership for years to come.`,
        supportingData: `${years} years of partnership`,
        persuasivenessScore: 7,
        dataSource: "Partnership History",
      });
    }

    // Mutual benefit argument
    const annualVolume = config.annualVolume || 220;
    points.push({
      id: `mutual-benefit-${Date.now()}`,
      category: "relationship",
      title: "Mutual Benefit Proposition",
      text: `A rate adjustment to CHF ${config.targetRate.toLocaleString()} maintains substantial value for both parties. The supplier retains CHF ${(
        config.targetRate * annualVolume
      ).toLocaleString()} in annual revenue with guaranteed volume, while we achieve market-competitive pricing. This creates a sustainable, win-win partnership.`,
      supportingData: `Retained annual value: CHF ${(
        config.targetRate * annualVolume
      ).toLocaleString()}`,
      persuasivenessScore: 8,
      dataSource: "Partnership Value Analysis",
    });

    return points;
  }

  // Generate fallback points when data is limited
  static generateFallbackPoints(
    config: Partial<TalkingPointsConfig>
  ): TalkingPoint[] {
    return [
      {
        id: `fallback-market-${Date.now()}`,
        category: "market",
        title: "Market Rate Alignment",
        text: "We are seeking to align our rates with current market conditions to ensure competitive pricing.",
        supportingData: "General market research",
        persuasivenessScore: 5,
        dataSource: "Market Research",
      },
      {
        id: `fallback-value-${Date.now()}`,
        category: "relationship",
        title: "Partnership Value",
        text: "We value our partnership and are looking for pricing that reflects our long-term commitment.",
        supportingData: "Partnership history",
        persuasivenessScore: 5,
        dataSource: "Internal Assessment",
      },
    ];
  }
}

// Utility functions for talking points
export const TalkingPointsUtils = {
  // Get category icon/color
  getCategoryStyle(category: TalkingPoint["category"]): {
    color: string;
    bgColor: string;
    label: string;
  } {
    const styles = {
      market: {
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        label: "Market Data",
      },
      volume: {
        color: "text-green-600",
        bgColor: "bg-green-50",
        label: "Volume",
      },
      competitive: {
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        label: "Competitive",
      },
      performance: {
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        label: "Performance",
      },
      relationship: {
        color: "text-pink-600",
        bgColor: "bg-pink-50",
        label: "Relationship",
      },
    };
    return styles[category];
  },

  // Get persuasiveness badge
  getPersuasivenessBadge(score: number): {
    label: string;
    className: string;
  } {
    if (score >= 8)
      return { label: "Strong", className: "bg-green-100 text-green-800" };
    if (score >= 6)
      return { label: "Moderate", className: "bg-yellow-100 text-yellow-800" };
    return { label: "Weak", className: "bg-gray-100 text-gray-800" };
  },

  // Export talking points to text format
  exportToText(points: TalkingPoint[]): string {
    let text = "NEGOTIATION TALKING POINTS\n";
    text += "=".repeat(50) + "\n\n";

    points.forEach((point, index) => {
      text += `${index + 1}. ${point.title}\n`;
      text += `   Category: ${point.category}\n`;
      text += `   Strength: ${
        this.getPersuasivenessBadge(point.persuasivenessScore).label
      }\n\n`;
      text += `   ${point.text}\n\n`;
      text += `   Supporting Data: ${point.supportingData}\n`;
      text += `   Source: ${point.dataSource}\n`;
      text += "-".repeat(50) + "\n\n";
    });

    return text;
  },
};
