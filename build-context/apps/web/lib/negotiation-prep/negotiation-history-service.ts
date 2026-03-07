/**
 * Negotiation History Service
 * Tracks negotiation outcomes and learns from past successes
 */

export interface NegotiationOutcome {
  id: string
  role: string
  level: string
  location: string
  supplier: string
  
  // Pre-negotiation
  initialRate: number
  targetRate: number
  strategyUsed: 'aggressive' | 'moderate' | 'conservative'
  
  // Post-negotiation
  finalRate: number
  achieved: boolean
  successLevel: 'exceeded' | 'met' | 'partial' | 'failed'
  
  // Metadata
  negotiationDate: Date
  duration: number // days
  notes?: string
  
  // Calculated
  savingsAchieved: number
  savingsPercent: number
  annualVolume: number
}

export interface StrategyEffectiveness {
  strategy: 'aggressive' | 'moderate' | 'conservative'
  totalAttempts: number
  successfulAttempts: number
  successRate: number
  averageSavings: number
  averageSavingsPercent: number
  bestOutcome: NegotiationOutcome | null
  worstOutcome: NegotiationOutcome | null
}

export interface SupplierHistory {
  supplier: string
  totalNegotiations: number
  successfulNegotiations: number
  successRate: number
  averageSavings: number
  bestStrategy: 'aggressive' | 'moderate' | 'conservative'
  lastNegotiation: Date
  outcomes: NegotiationOutcome[]
}

export class NegotiationHistoryService {
  private static outcomes: NegotiationOutcome[] = []

  /**
   * Record a negotiation outcome
   */
  static recordOutcome(outcome: Omit<NegotiationOutcome, 'id' | 'savingsAchieved' | 'savingsPercent'>): NegotiationOutcome {
    const savingsAchieved = (outcome.initialRate - outcome.finalRate) * outcome.annualVolume
    const savingsPercent = ((outcome.initialRate - outcome.finalRate) / outcome.initialRate) * 100

    const fullOutcome: NegotiationOutcome = {
      ...outcome,
      id: `neg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      savingsAchieved,
      savingsPercent
    }

    this.outcomes.push(fullOutcome)
    return fullOutcome
  }

  /**
   * Get all outcomes
   */
  static getAllOutcomes(): NegotiationOutcome[] {
    return [...this.outcomes]
  }

  /**
   * Get outcomes for specific role/level/location
   */
  static getOutcomesByRole(role: string, level: string, location: string): NegotiationOutcome[] {
    return this.outcomes.filter(o => 
      o.role === role && o.level === level && o.location === location
    )
  }

  /**
   * Get outcomes for specific supplier
   */
  static getOutcomesBySupplier(supplier: string): NegotiationOutcome[] {
    return this.outcomes.filter(o => o.supplier === supplier)
  }

  /**
   * Analyze strategy effectiveness
   */
  static analyzeStrategyEffectiveness(
    role?: string,
    level?: string,
    location?: string
  ): StrategyEffectiveness[] {
    let relevantOutcomes = this.outcomes

    if (role && level && location) {
      relevantOutcomes = this.getOutcomesByRole(role, level, location)
    }

    const strategies: Array<'aggressive' | 'moderate' | 'conservative'> = ['aggressive', 'moderate', 'conservative']
    
    return strategies.map(strategy => {
      const strategyOutcomes = relevantOutcomes.filter(o => o.strategyUsed === strategy)
      const successfulOutcomes = strategyOutcomes.filter(o => o.achieved)

      const totalAttempts = strategyOutcomes.length
      const successfulAttempts = successfulOutcomes.length
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0

      const averageSavings = successfulOutcomes.length > 0
        ? successfulOutcomes.reduce((sum, o) => sum + o.savingsAchieved, 0) / successfulOutcomes.length
        : 0

      const averageSavingsPercent = successfulOutcomes.length > 0
        ? successfulOutcomes.reduce((sum, o) => sum + o.savingsPercent, 0) / successfulOutcomes.length
        : 0

      const bestOutcome = strategyOutcomes.length > 0
        ? strategyOutcomes.reduce((best, current) => 
            current.savingsAchieved > best.savingsAchieved ? current : best
          )
        : null

      const worstOutcome = strategyOutcomes.length > 0
        ? strategyOutcomes.reduce((worst, current) => 
            current.savingsAchieved < worst.savingsAchieved ? current : worst
          )
        : null

      return {
        strategy,
        totalAttempts,
        successfulAttempts,
        successRate,
        averageSavings,
        averageSavingsPercent,
        bestOutcome,
        worstOutcome
      }
    })
  }

  /**
   * Get supplier history
   */
  static getSupplierHistory(supplier: string): SupplierHistory {
    const outcomes = this.getOutcomesBySupplier(supplier)
    const successfulOutcomes = outcomes.filter(o => o.achieved)

    const totalNegotiations = outcomes.length
    const successfulNegotiations = successfulOutcomes.length
    const successRate = totalNegotiations > 0 ? (successfulNegotiations / totalNegotiations) * 100 : 0

    const averageSavings = successfulOutcomes.length > 0
      ? successfulOutcomes.reduce((sum, o) => sum + o.savingsAchieved, 0) / successfulOutcomes.length
      : 0

    // Determine best strategy
    const strategySuccess = {
      aggressive: outcomes.filter(o => o.strategyUsed === 'aggressive' && o.achieved).length,
      moderate: outcomes.filter(o => o.strategyUsed === 'moderate' && o.achieved).length,
      conservative: outcomes.filter(o => o.strategyUsed === 'conservative' && o.achieved).length
    }

    type StrategyType = 'aggressive' | 'moderate' | 'conservative';
    const entries = Object.entries(strategySuccess) as [StrategyType, number][];
    const bestStrategy = entries.reduce<StrategyType>((best, [strategy, count]) => 
      count > strategySuccess[best] ? strategy : best
    , 'moderate')

    const lastNegotiation = outcomes.length > 0
      ? outcomes.reduce((latest, current) => 
          current.negotiationDate > latest.negotiationDate ? current : latest
        ).negotiationDate
      : new Date()

    return {
      supplier,
      totalNegotiations,
      successfulNegotiations,
      successRate,
      averageSavings,
      bestStrategy,
      lastNegotiation,
      outcomes
    }
  }

  /**
   * Get recommended strategy based on history
   */
  static getRecommendedStrategy(
    role: string,
    level: string,
    location: string,
    supplier?: string
  ): {
    strategy: 'aggressive' | 'moderate' | 'conservative'
    confidence: number
    reasoning: string[]
  } {
    const effectiveness = this.analyzeStrategyEffectiveness(role, level, location)
    
    // If we have supplier-specific history, use that
    if (supplier) {
      const supplierHistory = this.getSupplierHistory(supplier)
      if (supplierHistory.totalNegotiations > 0) {
        return {
          strategy: supplierHistory.bestStrategy,
          confidence: supplierHistory.successRate,
          reasoning: [
            `Based on ${supplierHistory.totalNegotiations} past negotiations with ${supplier}`,
            `${supplierHistory.bestStrategy} strategy has ${supplierHistory.successRate.toFixed(0)}% success rate`,
            `Average savings: CHF ${supplierHistory.averageSavings.toLocaleString()}`
          ]
        }
      }
    }

    // Otherwise, use general role-based history
    const bestStrategy = effectiveness.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    )

    if (bestStrategy.totalAttempts === 0) {
      return {
        strategy: 'moderate',
        confidence: 50,
        reasoning: ['No historical data available', 'Defaulting to moderate approach']
      }
    }

    return {
      strategy: bestStrategy.strategy,
      confidence: bestStrategy.successRate,
      reasoning: [
        `Based on ${bestStrategy.totalAttempts} past negotiations`,
        `${bestStrategy.strategy} strategy has ${bestStrategy.successRate.toFixed(0)}% success rate`,
        `Average savings: ${bestStrategy.averageSavingsPercent.toFixed(1)}%`
      ]
    }
  }

  /**
   * Get insights from history
   */
  static getInsights(): string[] {
    const insights: string[] = []
    
    if (this.outcomes.length === 0) {
      return ['No negotiation history available yet']
    }

    const totalNegotiations = this.outcomes.length
    const successfulNegotiations = this.outcomes.filter(o => o.achieved).length
    const overallSuccessRate = (successfulNegotiations / totalNegotiations) * 100

    insights.push(`${totalNegotiations} total negotiations recorded`)
    insights.push(`${overallSuccessRate.toFixed(0)}% overall success rate`)

    const effectiveness = this.analyzeStrategyEffectiveness()
    const bestStrategy = effectiveness.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    )

    if (bestStrategy.totalAttempts > 0) {
      insights.push(`${bestStrategy.strategy} strategy performs best (${bestStrategy.successRate.toFixed(0)}% success)`)
    }

    const totalSavings = this.outcomes
      .filter(o => o.achieved)
      .reduce((sum, o) => sum + o.savingsAchieved, 0)

    insights.push(`CHF ${totalSavings.toLocaleString()} total savings achieved`)

    return insights
  }

  /**
   * Clear all history (for testing)
   */
  static clearHistory(): void {
    this.outcomes = []
  }

  /**
   * Load sample data for demonstration
   */
  static loadSampleData(): void {
    const sampleOutcomes: Array<Omit<NegotiationOutcome, 'id' | 'savingsAchieved' | 'savingsPercent'>> = [
      {
        role: 'Software Engineer',
        level: 'Senior',
        location: 'Zurich',
        supplier: 'TechStaff AG',
        initialRate: 1200,
        targetRate: 1050,
        strategyUsed: 'moderate',
        finalRate: 1080,
        achieved: true,
        successLevel: 'partial',
        negotiationDate: new Date('2024-01-15'),
        duration: 14,
        annualVolume: 220,
        notes: 'Supplier was willing to negotiate, achieved 80% of target'
      },
      {
        role: 'Software Engineer',
        level: 'Senior',
        location: 'Zurich',
        supplier: 'SwissDev GmbH',
        initialRate: 1150,
        targetRate: 950,
        strategyUsed: 'aggressive',
        finalRate: 1000,
        achieved: true,
        successLevel: 'partial',
        negotiationDate: new Date('2024-02-20'),
        duration: 21,
        annualVolume: 220,
        notes: 'Aggressive approach worked but took longer'
      },
      {
        role: 'Project Manager',
        level: 'Senior',
        location: 'Zurich',
        supplier: 'PMExperts AG',
        initialRate: 1100,
        targetRate: 1000,
        strategyUsed: 'conservative',
        finalRate: 1050,
        achieved: true,
        successLevel: 'met',
        negotiationDate: new Date('2024-03-10'),
        duration: 7,
        annualVolume: 200,
        notes: 'Quick negotiation, maintained good relationship'
      }
    ]

    sampleOutcomes.forEach(outcome => this.recordOutcome(outcome))
  }
}
