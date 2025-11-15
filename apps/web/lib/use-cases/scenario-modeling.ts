import { NegotiationScenario } from './rate-history-types'

export interface ScenarioConfig {
  name: string
  targetRate: number
  probability: number
  annualVolume: number
  currentRate: number
  additionalCosts?: number
  qualityImpact?: 'positive' | 'neutral' | 'negative'
  relationshipImpact?: 'positive' | 'neutral' | 'negative'
  notes?: string
}

export interface ScenarioComparison {
  scenarios: NegotiationScenario[]
  bestCase: NegotiationScenario
  worstCase: NegotiationScenario
  mostLikely: NegotiationScenario
  expectedValue: number
  totalPotentialSavings: number
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  }
}

export interface TradeOffAnalysis {
  scenario: NegotiationScenario
  pros: string[]
  cons: string[]
  riskFactors: string[]
  opportunities: string[]
  recommendation: 'recommended' | 'acceptable' | 'not_recommended'
  score: number // 0-100
}

export class ScenarioModeler {
  
  // Create a negotiation scenario
  static createScenario(config: ScenarioConfig): NegotiationScenario {
    const annualCost = config.targetRate * config.annualVolume
    const currentAnnualCost = config.currentRate * config.annualVolume
    const savings = currentAnnualCost - annualCost
    const savingsPercentage = (savings / currentAnnualCost) * 100
    
    return {
      id: `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      description: config.notes || '',
      targetRate: config.targetRate,
      probability: config.probability,
      annualVolume: config.annualVolume,
      annualCost,
      savings: Math.round(savings),
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      notes: config.notes,
      expectedSavings: Math.round(savings * config.probability),
      riskLevel: config.probability > 0.7 ? 'low' : config.probability > 0.4 ? 'medium' : 'high',
      strategy: '',
      keyTalkingPoints: [],
    } as NegotiationScenario;
  }
  
  // Compare multiple scenarios
  static compareScenarios(scenarios: NegotiationScenario[]): ScenarioComparison {
    if (scenarios.length === 0) {
      throw new Error('At least one scenario is required for comparison')
    }
    
    // Find best, worst, and most likely scenarios
    const bestCase = scenarios.reduce((best, current) => 
      current.savings > best.savings ? current : best
    )
    
    const worstCase = scenarios.reduce((worst, current) => 
      current.savings < worst.savings ? current : worst
    )
    
    const mostLikely = scenarios.reduce((likely, current) => 
      current.probability > likely.probability ? current : likely
    )
    
    // Calculate expected value (probability-weighted savings)
    const expectedValue = Math.round(
      scenarios.reduce((sum, scenario) => 
        sum + (scenario.savings * scenario.probability), 0
      )
    )
    
    // Calculate total potential savings
    const totalPotentialSavings = scenarios.reduce((sum, scenario) => 
      sum + scenario.savings, 0
    )
    
    // Risk assessment
    const riskAssessment = this.assessRisk(scenarios)
    
    return {
      scenarios,
      bestCase,
      worstCase,
      mostLikely,
      expectedValue,
      totalPotentialSavings,
      riskAssessment
    }
  }
  
  // Assess risk across scenarios
  private static assessRisk(scenarios: NegotiationScenario[]): {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  } {
    const factors: string[] = []
    
    // Check savings variance
    const savingsValues = scenarios.map(s => s.savings)
    const avgSavings = savingsValues.reduce((a, b) => a + b, 0) / savingsValues.length
    const variance = savingsValues.reduce((sum, val) => 
      sum + Math.pow(val - avgSavings, 2), 0
    ) / savingsValues.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = (stdDev / avgSavings) * 100
    
    if (coefficientOfVariation > 50) {
      factors.push('High variance in potential outcomes')
    }
    
    // Check probability distribution
    const avgProbability = scenarios.reduce((sum, s) => sum + s.probability, 0) / scenarios.length
    if (avgProbability < 0.5) {
      factors.push('Low average probability of success')
    }
    
    // Check for extreme scenarios
    const maxSavingsPercent = Math.max(...scenarios.map(s => s.savingsPercentage))
    if (maxSavingsPercent > 30) {
      factors.push('Some scenarios require aggressive rate reductions')
    }
    
    // Determine overall risk level
    let level: 'low' | 'medium' | 'high'
    if (factors.length === 0) {
      level = 'low'
      factors.push('All scenarios show reasonable risk profiles')
    } else if (factors.length <= 2) {
      level = 'medium'
    } else {
      level = 'high'
    }
    
    return { level, factors }
  }
  
  // Analyze trade-offs for a specific scenario
  static analyzeTradeOffs(
    scenario: NegotiationScenario,
    currentRate: number,
    config?: {
      qualityImpact?: 'positive' | 'neutral' | 'negative'
      relationshipImpact?: 'positive' | 'neutral' | 'negative'
      marketPosition?: number // percentile
    }
  ): TradeOffAnalysis {
    const pros: string[] = []
    const cons: string[] = []
    const riskFactors: string[] = []
    const opportunities: string[] = []
    
    const reductionPercent = scenario.savingsPercentage
    
    // Analyze savings
    if (scenario.savings > 0) {
      pros.push(`Annual savings of CHF ${scenario.savings.toLocaleString()} (${reductionPercent.toFixed(1)}%)`)
      
      if (scenario.savings > 50000) {
        pros.push('Significant cost reduction enables budget reallocation')
      }
    } else {
      cons.push('No cost savings in this scenario')
    }
    
    // Analyze probability
    if (scenario.probability > 0.7) {
      pros.push(`High probability of success (${(scenario.probability * 100).toFixed(0)}%)`)
    } else if (scenario.probability < 0.4) {
      cons.push(`Low probability of success (${(scenario.probability * 100).toFixed(0)}%)`)
      riskFactors.push('Supplier may reject this rate')
    }
    
    // Analyze rate reduction magnitude
    if (reductionPercent > 25) {
      riskFactors.push('Aggressive rate reduction may strain supplier relationship')
      cons.push('May require significant negotiation effort')
    } else if (reductionPercent > 15) {
      pros.push('Moderate rate reduction is achievable with good negotiation')
    } else if (reductionPercent > 0) {
      pros.push('Conservative approach maintains supplier relationship')
    }
    
    // Quality impact analysis
    if (config?.qualityImpact === 'positive') {
      pros.push('Potential for improved service quality')
      opportunities.push('Negotiate for enhanced SLAs at new rate')
    } else if (config?.qualityImpact === 'negative') {
      cons.push('Risk of reduced service quality')
      riskFactors.push('Quality degradation could offset savings')
    }
    
    // Relationship impact analysis
    if (config?.relationshipImpact === 'positive') {
      pros.push('Strengthens long-term partnership')
      opportunities.push('Build foundation for future collaborations')
    } else if (config?.relationshipImpact === 'negative') {
      cons.push('May damage supplier relationship')
      riskFactors.push('Could limit future negotiation flexibility')
    }
    
    // Market position analysis
    if (config?.marketPosition !== undefined) {
      if (config.marketPosition > 75) {
        opportunities.push('Strong market position supports aggressive negotiation')
      } else if (config.marketPosition < 25) {
        riskFactors.push('Already at competitive rate, limited room for reduction')
      }
    }
    
    // Calculate recommendation score
    let score = 50 // Start at neutral
    
    // Positive factors
    score += Math.min(scenario.probability * 30, 30) // Up to +30 for probability
    score += Math.min(reductionPercent, 20) // Up to +20 for savings
    if (config?.qualityImpact === 'positive') score += 10
    if (config?.relationshipImpact === 'positive') score += 10
    
    // Negative factors
    if (scenario.probability < 0.3) score -= 20
    if (reductionPercent > 30) score -= 15
    if (config?.qualityImpact === 'negative') score -= 15
    if (config?.relationshipImpact === 'negative') score -= 15
    
    score = Math.max(0, Math.min(100, score))
    
    // Determine recommendation
    let recommendation: TradeOffAnalysis['recommendation']
    if (score >= 70) recommendation = 'recommended'
    else if (score >= 40) recommendation = 'acceptable'
    else recommendation = 'not_recommended'
    
    return {
      scenario,
      pros,
      cons,
      riskFactors,
      opportunities,
      recommendation,
      score: Math.round(score)
    }
  }
  
  // Generate standard scenarios (aggressive, moderate, conservative)
  static generateStandardScenarios(
    currentRate: number,
    annualVolume: number,
    marketPercentiles: { p10: number; p25: number; p50: number }
  ): NegotiationScenario[] {
    return [
      this.createScenario({
        name: 'Aggressive',
        targetRate: marketPercentiles.p10,
        probability: 0.3,
        annualVolume,
        currentRate,
        notes: 'Target bottom 10% of market. High savings, lower probability.'
      }),
      this.createScenario({
        name: 'Moderate',
        targetRate: marketPercentiles.p25,
        probability: 0.6,
        annualVolume,
        currentRate,
        notes: 'Target bottom 25% of market. Balanced approach.'
      }),
      this.createScenario({
        name: 'Conservative',
        targetRate: marketPercentiles.p50,
        probability: 0.85,
        annualVolume,
        currentRate,
        notes: 'Target median rate. Safe, high probability.'
      })
    ]
  }
  
  // Calculate break-even analysis
  static calculateBreakEven(
    scenario: NegotiationScenario,
    negotiationCosts: number
  ): {
    breakEvenMonths: number
    breakEvenDays: number
    worthwhile: boolean
    roi: number
  } {
    const monthlySavings = scenario.savings / 12
    const breakEvenMonths = negotiationCosts / monthlySavings
    const breakEvenDays = Math.round(breakEvenMonths * 30)
    const roi = ((scenario.savings - negotiationCosts) / negotiationCosts) * 100
    
    return {
      breakEvenMonths: Math.round(breakEvenMonths * 10) / 10,
      breakEvenDays,
      worthwhile: breakEvenMonths < 12, // Should break even within a year
      roi: Math.round(roi)
    }
  }
  
  // Sensitivity analysis - how changes in volume affect outcomes
  static sensitivityAnalysis(
    baseScenario: NegotiationScenario,
    volumeChanges: number[] // e.g., [-20, -10, 0, 10, 20] for ±20%
  ): Array<{
    volumeChange: number
    newVolume: number
    newSavings: number
    newAnnualCost: number
  }> {
    return volumeChanges.map(change => {
      const multiplier = 1 + (change / 100)
      const newVolume = Math.round(baseScenario.annualVolume * multiplier)
      const newAnnualCost = baseScenario.targetRate * newVolume
      const currentAnnualCost = (baseScenario.annualCost + baseScenario.savings) / baseScenario.annualVolume * newVolume
      const newSavings = Math.round(currentAnnualCost - newAnnualCost)
      
      return {
        volumeChange: change,
        newVolume,
        newSavings,
        newAnnualCost: Math.round(newAnnualCost)
      }
    })
  }
}

// Utility functions for scenario modeling
export const ScenarioUtils = {
  
  // Format recommendation badge
  getRecommendationBadge(recommendation: TradeOffAnalysis['recommendation']): {
    label: string
    className: string
  } {
    const config = {
      recommended: { label: 'Recommended', className: 'bg-green-100 text-green-800' },
      acceptable: { label: 'Acceptable', className: 'bg-yellow-100 text-yellow-800' },
      not_recommended: { label: 'Not Recommended', className: 'bg-red-100 text-red-800' }
    }
    return config[recommendation]
  },
  
  // Get risk level badge
  getRiskBadge(level: 'low' | 'medium' | 'high'): {
    label: string
    className: string
  } {
    const config = {
      low: { label: 'Low Risk', className: 'bg-green-100 text-green-800' },
      medium: { label: 'Medium Risk', className: 'bg-yellow-100 text-yellow-800' },
      high: { label: 'High Risk', className: 'bg-red-100 text-red-800' }
    }
    return config[level]
  },
  
  // Get score color
  getScoreColor(score: number): string {
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }
}
