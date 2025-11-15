/**
 * AI Insights Generator Service
 * 
 * Generates contextual, data-backed insights using GPT-4 for rate card benchmarks.
 * Provides AI-powered analysis of market position, anomalies, and strategic recommendations.
 * 
 * @module AIInsightsGeneratorService
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BenchmarkInsight {
  rateCardEntryId: string;
  summary: string;
  marketPosition: string;
  keyFindings: string[];
  recommendations: string[];
  confidence: number;
  dataPoints: number;
  generatedAt: Date;
}

export interface AnomalyExplanation {
  rateCardEntryId: string;
  anomalyType: 'HIGH_RATE' | 'LOW_RATE' | 'OUTLIER' | 'INCONSISTENT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
  possibleCauses: string[];
  recommendations: string[];
  confidence: number;
}

export interface StrategicRecommendation {
  id: string;
  category: 'COST_REDUCTION' | 'SUPPLIER_OPTIMIZATION' | 'MARKET_POSITIONING' | 'RISK_MITIGATION';
  title: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number;
  estimatedSavings?: number;
  affectedRateCards: number;
  actionItems: string[];
}

export interface InsightContext {
  rate: number;
  percentileRank: number;
  cohortSize: number;
  median: number;
  mean: number;
  variance: number;
  supplierName: string;
  role: string;
  seniority: string;
  country: string;
  marketTrends?: MarketTrendData;
  competitorRates?: CompetitorRateData[];
}

export interface MarketTrendData {
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  periodMonths: number;
  volatility: 'low' | 'medium' | 'high';
}

export interface CompetitorRateData {
  supplierName: string;
  rate: number;
  percentileRank: number;
}

// ============================================================================
// Prompt Templates
// ============================================================================

class PromptTemplates {
  /**
   * Benchmark insights prompt template
   */
  static benchmarkInsights(context: InsightContext): string {
    const direction = context.variance > 0 ? 'above' : 'below';
    const variancePercent = Math.abs((context.variance / context.median) * 100).toFixed(1);

    let marketTrendSection = '';
    if (context.marketTrends) {
      marketTrendSection = `\n**Market Trends:**
- Overall Trend: ${context.marketTrends.overallTrend} (${context.marketTrends.trendPercentage > 0 ? '+' : ''}${context.marketTrends.trendPercentage.toFixed(1)}% over ${context.marketTrends.periodMonths} months)
- Market Volatility: ${context.marketTrends.volatility}`;
    }

    let competitorSection = '';
    if (context.competitorRates && context.competitorRates.length > 0) {
      competitorSection = `\n**Competitor Rates:**\n${context.competitorRates
        .map(c => `- ${c.supplierName}: ${c.rate}/day (${c.percentileRank}th percentile)`)
        .join('\n')}`;
    }

    return `Analyze this rate card benchmark data and provide procurement insights:

**Rate Details:**
- Current Rate: ${context.rate}/day
- Supplier: ${context.supplierName}
- Role: ${context.role} (${context.seniority})
- Location: ${context.country}

**Market Position:**
- Percentile Rank: ${context.percentileRank}th percentile
- Market Median: ${context.median}/day
- Market Average: ${context.mean}/day
- Your Rate vs Median: ${variancePercent}% ${direction}
- Cohort Size: ${context.cohortSize} comparable rates${marketTrendSection}${competitorSection}

Provide a JSON response with:
1. "summary": 2-sentence market position summary that includes trend context
2. "marketPosition": Brief assessment (e.g., "Competitive", "Above Market", "Premium", "Below Market")
3. "keyFindings": Array of 3-4 specific, data-driven findings that incorporate market trends and competitor positioning
4. "recommendations": Array of 2-3 actionable recommendations prioritized by impact

Be specific, data-driven, and actionable. Focus on procurement value and cost optimization opportunities.`;
  }

  /**
   * Anomaly explanation prompt template
   */
  static anomalyExplanation(
    context: InsightContext,
    anomalyType: string,
    deviation: number
  ): string {
    return `Explain this rate card anomaly for procurement analysis:

**Anomaly Details:**
- Type: ${anomalyType}
- Rate: ${context.rate}/day
- Market Median: ${context.median}/day
- Deviation: ${deviation.toFixed(1)}%
- Percentile: ${context.percentileRank}th

**Context:**
- Role: ${context.role} (${context.seniority})
- Supplier: ${context.supplierName}
- Location: ${context.country}
- Cohort Size: ${context.cohortSize} rates

Provide a JSON response with:
1. "explanation": Clear explanation of why this is anomalous (2-3 sentences)
2. "possibleCauses": Array of 3-5 specific possible causes
3. "recommendations": Array of 2-3 actionable next steps
4. "riskLevel": Assessment of risk ("low", "medium", "high")

Focus on practical procurement implications and actionable insights.`;
  }

  /**
   * Strategic recommendations prompt template
   */
  static strategicRecommendations(
    totalRateCards: number,
    highCostCount: number,
    avgSavingsOpportunity: number,
    supplierConcentration: number,
    topSupplierName: string
  ): string {
    return `Analyze this procurement portfolio and provide strategic recommendations:

**Portfolio Overview:**
- Total Rate Cards: ${totalRateCards}
- Above-Market Rates: ${highCostCount} (${((highCostCount / totalRateCards) * 100).toFixed(1)}%)
- Average Savings Opportunity: $${avgSavingsOpportunity.toLocaleString()}/year per rate card
- Supplier Concentration: ${supplierConcentration.toFixed(1)}% with ${topSupplierName}

Provide a JSON response with:
1. "recommendations": Array of 3-5 strategic recommendations, each with:
   - "title": Brief title
   - "description": 2-3 sentence description
   - "category": One of ["COST_REDUCTION", "SUPPLIER_OPTIMIZATION", "MARKET_POSITIONING", "RISK_MITIGATION"]
   - "impact": "LOW", "MEDIUM", or "HIGH"
   - "effort": "LOW", "MEDIUM", or "HIGH"
   - "actionItems": Array of 2-4 specific action items

Prioritize by business impact and feasibility. Be specific and actionable.`;
  }

  /**
   * Negotiation talking points prompt template
   */
  static negotiationTalkingPoints(context: InsightContext): string {
    const savingsOpportunity = context.variance > 0 ? context.variance : 0;
    
    return `Generate negotiation talking points for this rate card:

**Current Situation:**
- Your Rate: ${context.rate}/day
- Market Median: ${context.median}/day
- Potential Savings: $${savingsOpportunity.toFixed(2)}/day
- Market Position: ${context.percentileRank}th percentile

**Details:**
- Role: ${context.role} (${context.seniority})
- Supplier: ${context.supplierName}
- Location: ${context.country}
- Market Data: ${context.cohortSize} comparable rates

Provide a JSON response with:
1. "talkingPoints": Array of 4-6 data-backed negotiation points, prioritized by impact
2. "targetRate": Recommended target rate for negotiation
3. "walkAwayRate": Maximum acceptable rate
4. "leveragePoints": Array of 2-3 key leverage points
5. "alternatives": Brief mention of competitive alternatives

Focus on data-driven arguments and specific market references.`;
  }
}

// ============================================================================
// AI Insights Generator Service
// ============================================================================

export class AIInsightsGeneratorService {
  private prisma: PrismaClient;
  private openaiApiKey: string;
  private openaiModel: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
  }

  // ==========================================================================
  // Benchmark Insights
  // ==========================================================================

  /**
   * Generate AI-powered insights for a rate card benchmark
   */
  async generateBenchmarkInsights(rateCardEntryId: string): Promise<BenchmarkInsight> {
    // Get rate card and benchmark data
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    const benchmark = await this.prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!benchmark) {
      throw new Error('Benchmark data not available for this rate card');
    }

    // Build context with enrichment
    const context = await this.enrichContext({
      rate: Number(rateCard.dailyRateUSD),
      percentileRank: benchmark.percentileRank,
      cohortSize: benchmark.cohortSize,
      median: Number(benchmark.median),
      mean: Number(benchmark.average),
      variance: Number(rateCard.dailyRateUSD) - Number(benchmark.median),
      supplierName: rateCard.supplierName,
      role: rateCard.roleStandardized,
      seniority: rateCard.seniority,
      country: rateCard.country,
    }, rateCard.tenantId);

    // Check if AI features are enabled
    if (!this.isAIEnabled()) {
      return this.generateFallbackInsights(rateCardEntryId, context);
    }

    // Generate AI insights using prompt template
    try {
      const aiInsights = await this.callOpenAI(PromptTemplates.benchmarkInsights(context));
      return this.parseBenchmarkInsights(rateCardEntryId, aiInsights, context);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return this.generateFallbackInsights(rateCardEntryId, context);
    }
  }

  /**
   * Enrich context with market trends and competitor data
   */
  private async enrichContext(
    baseContext: InsightContext,
    tenantId: string
  ): Promise<InsightContext> {
    try {
      // Get market trends for this role/location combination
      const historicalRates = await this.prisma.rateCardEntry.findMany({
        where: {
          tenantId,
          roleStandardized: baseContext.role,
          country: baseContext.country,
          createdAt: {
            gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // Last 6 months
          },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          dailyRateUSD: true,
          createdAt: true,
        },
      });

      let marketTrends: MarketTrendData | undefined;
      if (historicalRates.length >= 2) {
        const firstRate = Number(historicalRates[0].dailyRateUSD);
        const lastRate = Number(historicalRates[historicalRates.length - 1].dailyRateUSD);
        const trendPercentage = ((lastRate - firstRate) / firstRate) * 100;
        
        // Calculate volatility
        const rates = historicalRates.map(r => Number(r.dailyRateUSD));
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / mean) * 100;

        marketTrends = {
          overallTrend: trendPercentage > 5 ? 'increasing' : trendPercentage < -5 ? 'decreasing' : 'stable',
          trendPercentage,
          periodMonths: 6,
          volatility: coefficientOfVariation > 15 ? 'high' : coefficientOfVariation > 8 ? 'medium' : 'low',
        };
      }

      // Get competitor rates (top 3 other suppliers for same role/location)
      const competitorRates = await this.prisma.rateCardEntry.findMany({
        where: {
          tenantId,
          roleStandardized: baseContext.role,
          country: baseContext.country,
          supplierName: { not: baseContext.supplierName },
        },
        include: {
          benchmarkSnapshots: {
            take: 1,
            orderBy: { snapshotDate: 'desc' },
          },
        },
        take: 3,
        orderBy: { dailyRateUSD: 'asc' },
      });

      const competitorData: CompetitorRateData[] = competitorRates
        .filter(rc => rc.benchmarkSnapshots.length > 0)
        .map(rc => ({
          supplierName: rc.supplierName,
          rate: Number(rc.dailyRateUSD),
          percentileRank: rc.benchmarkSnapshots[0].percentileRank,
        }));

      return {
        ...baseContext,
        marketTrends,
        competitorRates: competitorData.length > 0 ? competitorData : undefined,
      };
    } catch (error) {
      console.error('Error enriching context:', error);
      return baseContext;
    }
  }

  /**
   * Parse AI response into structured insights
   */
  private parseBenchmarkInsights(
    rateCardEntryId: string,
    aiResponse: string,
    context: InsightContext
  ): BenchmarkInsight {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        rateCardEntryId,
        summary: parsed.summary || '',
        marketPosition: parsed.marketPosition || '',
        keyFindings: parsed.keyFindings || [],
        recommendations: parsed.recommendations || [],
        confidence: this.calculateConfidence(context.cohortSize),
        dataPoints: context.cohortSize,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.generateFallbackInsights(rateCardEntryId, context);
    }
  }

  /**
   * Generate fallback insights when AI is unavailable
   */
  private generateFallbackInsights(
    rateCardEntryId: string,
    context: InsightContext
  ): BenchmarkInsight {
    const variancePercent = Math.abs((context.variance / context.median) * 100);
    const isAboveMarket = context.variance > 0;

    let marketPosition = 'Average';
    if (context.percentileRank >= 75) marketPosition = 'Above Market';
    else if (context.percentileRank >= 50) marketPosition = 'Slightly Above Average';
    else if (context.percentileRank <= 25) marketPosition = 'Competitive';

    const summary = isAboveMarket
      ? `Current rate of ${context.rate}/day is ${variancePercent.toFixed(1)}% above market median. This ${context.role} rate ranks in the ${context.percentileRank}th percentile among ${context.cohortSize} comparable rates.`
      : `Current rate of ${context.rate}/day is competitive, ${variancePercent.toFixed(1)}% below market median. This positions favorably in the ${context.percentileRank}th percentile.`;

    const keyFindings: string[] = [];
    if (isAboveMarket && variancePercent > 15) {
      keyFindings.push(`Rate is significantly above market median (${context.median}/day), indicating potential for cost optimization`);
    }
    if (context.cohortSize >= 20) {
      keyFindings.push(`Strong market data available with ${context.cohortSize} comparable rates, providing high confidence in benchmark`);
    } else if (context.cohortSize < 10) {
      keyFindings.push(`Limited market data (${context.cohortSize} rates) suggests benchmark should be used with caution`);
    }
    keyFindings.push(`Market average is ${context.mean}/day, with your rate at ${context.percentileRank}th percentile`);

    const recommendations: string[] = [];
    if (isAboveMarket && variancePercent > 10) {
      recommendations.push(`Consider negotiating toward market median of ${context.median}/day for potential savings`);
      recommendations.push(`Evaluate alternative suppliers offering competitive rates for this role and location`);
    } else {
      recommendations.push(`Current rate is competitive; focus on maintaining rate stability in future negotiations`);
    }

    return {
      rateCardEntryId,
      summary,
      marketPosition,
      keyFindings,
      recommendations,
      confidence: this.calculateConfidence(context.cohortSize),
      dataPoints: context.cohortSize,
      generatedAt: new Date(),
    };
  }

  // ==========================================================================
  // Anomaly Explanation
  // ==========================================================================

  /**
   * Generate AI explanation for statistical anomalies
   */
  async explainAnomaly(
    rateCardEntryId: string,
    anomalyType: AnomalyExplanation['anomalyType']
  ): Promise<AnomalyExplanation> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    const benchmark = await this.prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!benchmark) {
      throw new Error('Benchmark data not available');
    }

    // Determine severity
    const deviation = Math.abs(Number(rateCard.dailyRateUSD) - Number(benchmark.median));
    const deviationPercent = (deviation / Number(benchmark.median)) * 100;
    let severity: AnomalyExplanation['severity'] = 'LOW';
    if (deviationPercent > 50) severity = 'HIGH';
    else if (deviationPercent > 25) severity = 'MEDIUM';

    // Generate explanation
    const explanation = this.generateAnomalyExplanation(rateCard, benchmark, anomalyType);
    const possibleCauses = this.identifyPossibleCauses(anomalyType);
    const recommendations = this.generateAnomalyRecommendations(anomalyType, severity);

    return {
      rateCardEntryId,
      anomalyType,
      severity,
      explanation,
      possibleCauses,
      recommendations,
      confidence: this.calculateConfidence(benchmark.cohortSize),
    };
  }

  private generateAnomalyExplanation(rateCard: any, benchmark: any, anomalyType: string): string {
    const rate = Number(rateCard.dailyRateUSD);
    const median = Number(benchmark.median);
    const deviation = ((rate - median) / median * 100).toFixed(1);

    switch (anomalyType) {
      case 'HIGH_RATE':
        return `Rate of ${rate}/day is ${deviation}% above market median (${median}/day), placing it in the ${benchmark.percentileRank}th percentile. This represents a statistical outlier in the market.`;
      case 'LOW_RATE':
        return `Rate of ${rate}/day is ${Math.abs(Number(deviation))}% below market median (${median}/day). While competitive, this unusually low rate warrants investigation.`;
      case 'OUTLIER':
        return `Rate deviates significantly from market norms (>2 standard deviations). This outlier status suggests unique circumstances or data quality issues.`;
      case 'INCONSISTENT':
        return `Rate shows inconsistency with similar roles and market patterns. This may indicate misclassification or special contract terms.`;
      default:
        return `Anomaly detected in rate card data requiring review.`;
    }
  }

  private identifyPossibleCauses(anomalyType: string): string[] {
    const causes: string[] = [];

    if (anomalyType === 'HIGH_RATE') {
      causes.push('Premium supplier or specialized expertise');
      causes.push('Legacy contract with outdated rates');
      causes.push('Unique location or market conditions');
      causes.push('Additional services or value-adds included in rate');
    } else if (anomalyType === 'LOW_RATE') {
      causes.push('Volume discount or strategic partnership');
      causes.push('Offshore or nearshore delivery model');
      causes.push('Junior resources or different skill level');
      causes.push('Promotional or introductory pricing');
    } else if (anomalyType === 'OUTLIER') {
      causes.push('Data entry error or misclassification');
      causes.push('Currency conversion issue');
      causes.push('Unique contract terms or scope');
      causes.push('Temporary or project-specific rate');
    }

    return causes;
  }

  private generateAnomalyRecommendations(
    anomalyType: string,
    severity: AnomalyExplanation['severity']
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'HIGH') {
      recommendations.push('Immediate review recommended - verify data accuracy and contract terms');
    }

    if (anomalyType === 'HIGH_RATE') {
      recommendations.push('Benchmark against market rates and initiate renegotiation');
      recommendations.push('Evaluate alternative suppliers for cost optimization');
    } else if (anomalyType === 'LOW_RATE') {
      recommendations.push('Verify service quality and deliverables meet expectations');
      recommendations.push('Document special terms for future reference');
    } else if (anomalyType === 'OUTLIER' || anomalyType === 'INCONSISTENT') {
      recommendations.push('Validate data accuracy and role classification');
      recommendations.push('Review contract terms for special conditions');
    }

    return recommendations;
  }

  // ==========================================================================
  // Strategic Recommendations
  // ==========================================================================

  /**
   * Generate strategic recommendations across multiple rate cards
   */
  async generateStrategicRecommendations(tenantId: string): Promise<StrategicRecommendation[]> {
    // Get all rate cards for tenant
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: { tenantId },
      include: {
        benchmarkSnapshots: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        },
      },
    });

    const recommendations: StrategicRecommendation[] = [];

    // Analyze for cost reduction opportunities
    const highCostRates = rateCards.filter(
      rc => rc.percentileRank && rc.percentileRank > 75
    );
    if (highCostRates.length > 0) {
      const totalSavings = highCostRates.reduce((sum: number, rc: any) => {
        const savings = rc.savingsAmount ? Number(rc.savingsAmount) : 0;
        const volume = rc.volumeCommitted || 250;
        return sum + (savings * volume);
      }, 0);

      recommendations.push({
        id: 'cost-reduction-1',
        category: 'COST_REDUCTION',
        title: 'Optimize Above-Market Rate Cards',
        description: `${highCostRates.length} rate cards are in the top quartile (>75th percentile). Negotiating these to market median could yield significant savings.`,
        impact: totalSavings > 500000 ? 'HIGH' : totalSavings > 100000 ? 'MEDIUM' : 'LOW',
        effort: 'MEDIUM',
        priority: 1,
        estimatedSavings: totalSavings,
        affectedRateCards: highCostRates.length,
        actionItems: [
          'Prioritize rate cards with highest savings potential',
          'Prepare market data for negotiations',
          'Engage suppliers with competitive alternatives',
        ],
      });
    }

    // Analyze supplier concentration
    const supplierCounts = new Map<string, number>();
    rateCards.forEach((rc: any) => {
      supplierCounts.set(rc.supplierId, (supplierCounts.get(rc.supplierId) || 0) + 1);
    });
    const topSuppliers = Array.from(supplierCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topSuppliers.length > 0 && topSuppliers[0][1] > rateCards.length * 0.4) {
      recommendations.push({
        id: 'supplier-opt-1',
        category: 'SUPPLIER_OPTIMIZATION',
        title: 'Reduce Supplier Concentration Risk',
        description: `Top supplier represents ${((topSuppliers[0][1] / rateCards.length) * 100).toFixed(0)}% of rate cards. Consider diversifying to reduce dependency and improve negotiating position.`,
        impact: 'MEDIUM',
        effort: 'HIGH',
        priority: 2,
        affectedRateCards: topSuppliers[0][1],
        actionItems: [
          'Identify alternative suppliers for key roles',
          'Pilot projects with new suppliers',
          'Develop multi-supplier strategy',
        ],
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Check if AI features are enabled
   */
  private isAIEnabled(): boolean {
    return (
      process.env.ENABLE_AI_FEATURES === 'true' &&
      !!this.openaiApiKey &&
      this.openaiApiKey !== 'sk-your-openai-api-key-here'
    );
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.isAIEnabled()) {
      throw new Error('AI features are not enabled');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.openaiModel,
          messages: [
            {
              role: 'system',
              content: 'You are a procurement intelligence assistant specializing in rate card analysis and market benchmarking. Provide data-driven, actionable insights in JSON format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Calculate confidence score based on data points
   */
  private calculateConfidence(cohortSize: number): number {
    if (cohortSize >= 50) return 0.95;
    if (cohortSize >= 20) return 0.85;
    if (cohortSize >= 10) return 0.75;
    if (cohortSize >= 5) return 0.60;
    return 0.40;
  }
}
