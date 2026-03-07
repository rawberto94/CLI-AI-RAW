/**
 * AI Recommendation Engine for Negotiation Prep
 * Analyzes market position and provides intelligent negotiation strategies
 */

export interface MarketPosition {
  currentRate: number
  marketMedian: number
  percentile: number
  competitorsAbove: number
  competitorsBelow: number
}

export interface HistoricalPattern {
  trend: 'increasing' | 'decreasing' | 'stable'
  volatility: 'high' | 'medium' | 'low'
  seasonality?: string
  averageChange: number
}

export interface NegotiationContext {
  role: string
  level: string
  location: string
  supplier: string
  relationshipYears: number
  annualVolume: number
  marketPosition: MarketPosition
  historicalPattern?: HistoricalPattern
}

export interface RecommendationStrategy {
  approach: 'aggressive' | 'moderate' | 'conservative'
  targetRate: number
  expectedSavings: number
  confidence: number // 0-100
  reasoning: string[]
  risks: string[]
  opportunities: string[]
  tactics: string[]
}

export interface AIRecommendation {
  primaryStrategy: RecommendationStrategy
  alternativeStrategies: RecommendationStrategy[]
  marketInsights: string[]
  negotiationTiming: {
    optimal: boolean
    reasoning: string
  }
  leveragePoints: string[]
}

export class AIRecommendationEngine {
  /**
   * Generate AI-powered negotiation recommendations
   */
  static async generateRecommendation(
    context: NegotiationContext
  ): Promise<AIRecommendation> {
    // Analyze market position
    const positionAnalysis = this.analyzeMarketPosition(context.marketPosition)
    
    // Determine optimal strategy
    const primaryStrategy = this.determineStrategy(context, positionAnalysis)
    
    // Generate alternative strategies
    const alternativeStrategies = this.generateAlternatives(context, primaryStrategy)
    
    // Extract market insights
    const marketInsights = this.extractMarketInsights(context)
    
    // Assess negotiation timing
    const negotiationTiming = this.assessTiming(context)
    
    // Identify leverage points
    const leveragePoints = this.identifyLeveragePoints(context)
    
    return {
      primaryStrategy,
      alternativeStrategies,
      marketInsights,
      negotiationTiming,
      leveragePoints
    }
  }

  /**
   * Analyze market position to determine negotiation strength
   */
  private static analyzeMarketPosition(position: MarketPosition): {
    strength: 'strong' | 'moderate' | 'weak'
    savingsPotential: 'high' | 'medium' | 'low'
    competitiveAdvantage: boolean
  } {
    const { percentile, currentRate, marketMedian } = position
    
    // Strong position: Below 40th percentile (competitive rates)
    // Moderate: 40-70th percentile
    // Weak: Above 70th percentile (expensive rates)
    const strength = percentile < 40 ? 'strong' : percentile < 70 ? 'moderate' : 'weak'
    
    // Calculate savings potential
    const savingsPercent = ((currentRate - marketMedian) / currentRate) * 100
    const savingsPotential = savingsPercent > 20 ? 'high' : savingsPercent > 10 ? 'medium' : 'low'
    
    // Competitive advantage if below median
    const competitiveAdvantage = currentRate < marketMedian
    
    return { strength, savingsPotential, competitiveAdvantage }
  }

  /**
   * Determine optimal negotiation strategy
   */
  private static determineStrategy(
    context: NegotiationContext,
    analysis: ReturnType<typeof AIRecommendationEngine.analyzeMarketPosition>
  ): RecommendationStrategy {
    const { marketPosition, relationshipYears, annualVolume } = context
    const { strength, savingsPotential } = analysis
    
    // Determine approach based on position and relationship
    let approach: 'aggressive' | 'moderate' | 'conservative'
    let confidence: number
    
    if (strength === 'weak' && savingsPotential === 'high') {
      // High savings potential, push hard
      approach = 'aggressive'
      confidence = 85
    } else if (strength === 'weak' && relationshipYears < 2) {
      // New relationship, be moderate
      approach = 'moderate'
      confidence = 70
    } else if (strength === 'strong') {
      // Already competitive, maintain position
      approach = 'conservative'
      confidence = 90
    } else {
      // Default to moderate
      approach = 'moderate'
      confidence = 75
    }
    
    // Calculate target rate based on approach
    const targetRate = this.calculateTargetRate(marketPosition, approach)
    const expectedSavings = (marketPosition.currentRate - targetRate) * annualVolume
    
    // Generate reasoning
    const reasoning = this.generateReasoning(context, approach, analysis)
    
    // Identify risks
    const risks = this.identifyRisks(context, approach)
    
    // Find opportunities
    const opportunities = this.findOpportunities(context, analysis)
    
    // Suggest tactics
    const tactics = this.suggestTactics(approach, context)
    
    return {
      approach,
      targetRate,
      expectedSavings,
      confidence,
      reasoning,
      risks,
      opportunities,
      tactics
    }
  }

  /**
   * Calculate target rate based on strategy approach
   */
  private static calculateTargetRate(
    position: MarketPosition,
    approach: 'aggressive' | 'moderate' | 'conservative'
  ): number {
    const { currentRate, marketMedian } = position
    
    switch (approach) {
      case 'aggressive':
        // Target 25th percentile or 15% below current
        return Math.min(
          marketMedian * 0.85,
          currentRate * 0.85
        )
      
      case 'moderate':
        // Target median or 10% below current
        return Math.min(
          marketMedian,
          currentRate * 0.90
        )
      
      case 'conservative':
        // Target 5% below current
        return currentRate * 0.95
      
      default:
        return currentRate * 0.90
    }
  }

  /**
   * Generate reasoning for the recommendation
   */
  private static generateReasoning(
    context: NegotiationContext,
    approach: string,
    analysis: ReturnType<typeof AIRecommendationEngine.analyzeMarketPosition>
  ): string[] {
    const reasoning: string[] = []
    const { marketPosition, relationshipYears, annualVolume } = context
    
    // Market position reasoning
    if (marketPosition.percentile > 75) {
      reasoning.push(`Your current rate is in the ${marketPosition.percentile.toFixed(0)}th percentile, significantly above market median`)
      reasoning.push('Strong negotiating position due to high current rates')
    } else if (marketPosition.percentile < 25) {
      reasoning.push(`Your current rate is competitive at the ${marketPosition.percentile.toFixed(0)}th percentile`)
      reasoning.push('Focus on maintaining this advantageous position')
    }
    
    // Volume leverage
    if (annualVolume > 200) {
      reasoning.push(`High annual volume (${annualVolume} days) provides significant leverage`)
    }
    
    // Relationship factor
    if (relationshipYears > 3) {
      reasoning.push(`Long-term relationship (${relationshipYears} years) enables collaborative negotiation`)
    } else if (relationshipYears < 1) {
      reasoning.push('New relationship requires balanced approach to build trust')
    }
    
    // Savings potential
    if (analysis.savingsPotential === 'high') {
      reasoning.push('High savings potential justifies assertive negotiation stance')
    }
    
    return reasoning
  }

  /**
   * Identify risks for the strategy
   */
  private static identifyRisks(
    context: NegotiationContext,
    approach: string
  ): string[] {
    const risks: string[] = []
    
    if (approach === 'aggressive') {
      risks.push('Supplier may resist significant rate reductions')
      risks.push('Risk of damaging relationship if pushed too hard')
      if (context.relationshipYears < 2) {
        risks.push('New relationship may not support aggressive tactics')
      }
    }
    
    if (context.marketPosition.competitorsBelow < 3) {
      risks.push('Limited competitive alternatives may reduce leverage')
    }
    
    if (context.annualVolume < 150) {
      risks.push('Lower volume may limit negotiating power')
    }
    
    return risks
  }

  /**
   * Find opportunities in the negotiation
   */
  private static findOpportunities(
    context: NegotiationContext,
    analysis: ReturnType<typeof AIRecommendationEngine.analyzeMarketPosition>
  ): string[] {
    const opportunities: string[] = []
    
    if (analysis.savingsPotential === 'high') {
      opportunities.push('Significant cost reduction potential available')
    }
    
    if (context.marketPosition.competitorsBelow > 5) {
      opportunities.push(`${context.marketPosition.competitorsBelow} competitors offer lower rates`)
    }
    
    if (context.annualVolume > 200) {
      opportunities.push('High volume can be leveraged for volume discounts')
    }
    
    if (context.relationshipYears > 3) {
      opportunities.push('Long-term partnership can support win-win negotiations')
    }
    
    return opportunities
  }

  /**
   * Suggest negotiation tactics
   */
  private static suggestTactics(
    approach: string,
    context: NegotiationContext
  ): string[] {
    const tactics: string[] = []
    
    // Common tactics
    tactics.push('Present market data showing competitive rates')
    tactics.push('Emphasize long-term partnership value')
    
    if (approach === 'aggressive') {
      tactics.push('Lead with ambitious target to anchor negotiation')
      tactics.push('Reference specific competitor rates as benchmarks')
      tactics.push('Consider multi-year commitment for better rates')
    } else if (approach === 'moderate') {
      tactics.push('Propose gradual rate reduction over time')
      tactics.push('Explore volume-based discounts')
      tactics.push('Discuss performance-based pricing models')
    } else {
      tactics.push('Focus on maintaining current competitive position')
      tactics.push('Explore value-added services at current rates')
      tactics.push('Negotiate favorable terms and conditions')
    }
    
    if (context.annualVolume > 200) {
      tactics.push('Highlight volume commitment as leverage')
    }
    
    return tactics
  }

  /**
   * Generate alternative strategies
   */
  private static generateAlternatives(
    context: NegotiationContext,
    primary: RecommendationStrategy
  ): RecommendationStrategy[] {
    const alternatives: RecommendationStrategy[] = []
    
    // Generate more aggressive alternative if primary isn't aggressive
    if (primary.approach !== 'aggressive') {
      const aggressiveTarget = this.calculateTargetRate(context.marketPosition, 'aggressive')
      alternatives.push({
        approach: 'aggressive',
        targetRate: aggressiveTarget,
        expectedSavings: (context.marketPosition.currentRate - aggressiveTarget) * context.annualVolume,
        confidence: primary.confidence - 15,
        reasoning: ['Push for maximum savings', 'Leverage competitive market data'],
        risks: ['Higher risk of supplier resistance', 'May strain relationship'],
        opportunities: ['Maximum cost reduction', 'Set strong precedent'],
        tactics: ['Lead with ambitious target', 'Reference lowest market rates']
      })
    }
    
    // Generate more conservative alternative if primary isn't conservative
    if (primary.approach !== 'conservative') {
      const conservativeTarget = this.calculateTargetRate(context.marketPosition, 'conservative')
      alternatives.push({
        approach: 'conservative',
        targetRate: conservativeTarget,
        expectedSavings: (context.marketPosition.currentRate - conservativeTarget) * context.annualVolume,
        confidence: primary.confidence + 10,
        reasoning: ['Maintain strong relationship', 'Achieve modest savings'],
        risks: ['Lower savings potential', 'May miss opportunities'],
        opportunities: ['Preserve partnership', 'Build trust for future'],
        tactics: ['Focus on value optimization', 'Explore non-rate benefits']
      })
    }
    
    return alternatives
  }

  /**
   * Extract market insights
   */
  private static extractMarketInsights(context: NegotiationContext): string[] {
    const insights: string[] = []
    const { marketPosition } = context
    
    insights.push(`Market median rate: CHF ${marketPosition.marketMedian.toLocaleString()}`)
    insights.push(`Your position: ${marketPosition.percentile.toFixed(0)}th percentile`)
    
    if (marketPosition.competitorsBelow > 0) {
      insights.push(`${marketPosition.competitorsBelow} suppliers offer lower rates`)
    }
    
    if (marketPosition.competitorsAbove > 0) {
      insights.push(`${marketPosition.competitorsAbove} suppliers charge higher rates`)
    }
    
    const savingsPercent = ((marketPosition.currentRate - marketPosition.marketMedian) / marketPosition.currentRate) * 100
    if (savingsPercent > 0) {
      insights.push(`Potential to save ${savingsPercent.toFixed(1)}% by moving to median`)
    }
    
    return insights
  }

  /**
   * Assess optimal timing for negotiation
   */
  private static assessTiming(context: NegotiationContext): {
    optimal: boolean
    reasoning: string
  } {
    // In a real implementation, this would consider:
    // - Contract renewal dates
    // - Market trends
    // - Seasonal factors
    // - Company budget cycles
    
    const { relationshipYears, marketPosition } = context
    
    if (marketPosition.percentile > 75) {
      return {
        optimal: true,
        reasoning: 'High current rates make this an ideal time to negotiate'
      }
    }
    
    if (relationshipYears > 2) {
      return {
        optimal: true,
        reasoning: 'Established relationship supports rate review discussion'
      }
    }
    
    return {
      optimal: true,
      reasoning: 'Market conditions support negotiation'
    }
  }

  /**
   * Identify leverage points
   */
  private static identifyLeveragePoints(context: NegotiationContext): string[] {
    const leverage: string[] = []
    
    if (context.annualVolume > 200) {
      leverage.push(`High volume commitment (${context.annualVolume} days/year)`)
    }
    
    if (context.relationshipYears > 3) {
      leverage.push(`Long-term partnership (${context.relationshipYears} years)`)
    }
    
    if (context.marketPosition.competitorsBelow > 3) {
      leverage.push(`Multiple competitive alternatives available`)
    }
    
    if (context.marketPosition.percentile > 70) {
      leverage.push('Current rates significantly above market')
    }
    
    leverage.push('Market data and benchmarking analysis')
    leverage.push('Professional negotiation preparation')
    
    return leverage
  }
}
