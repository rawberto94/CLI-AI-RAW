import { RateCardRole } from './multi-client-rate-data'
import { TargetRates, MarketPercentiles } from './rate-history-types'

// Helper function to calculate market percentiles
function calculateMarketPercentiles(rates: number[]): MarketPercentiles {
  const sorted = [...rates].sort((a, b) => a - b)
  const getPercentile = (p: number) => {
    const index = Math.floor((p / 100) * sorted.length)
    return sorted[Math.min(index, sorted.length - 1)]
  }
  
  return {
    p10: getPercentile(10),
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90)
  }
}

export interface TargetRateConfig {
  role: string
  level: string
  location: string
  currentRate: number
  annualVolume?: number // person-days per year
  marketData: RateCardRole[]
  negotiationStyle?: 'aggressive' | 'moderate' | 'conservative'
}

export interface SavingsProjection {
  targetRate: number
  currentAnnualCost: number
  targetAnnualCost: number
  annualSavings: number
  savingsPercentage: number
  probability: number // likelihood of achieving this rate
  riskLevel: 'low' | 'medium' | 'high'
}

export class TargetRateCalculator {
  
  // Calculate comprehensive target rates with market analysis
  static calculateTargetRates(config: TargetRateConfig): TargetRates {
    const { role, level, location, currentRate, marketData } = config
    
    // Filter market data to matching roles
    const matchingRoles = marketData.filter(r => 
      r.role === role && 
      r.level === level && 
      r.location === location
    )
    
    if (matchingRoles.length === 0) {
      // No market data - return conservative estimates
      return this.getConservativeTargets(currentRate)
    }
    
    const rates = matchingRoles.map(r => r.dailyRateCHF)
    const market = calculateMarketPercentiles(rates)
    
    // Calculate targets based on market position
    const targets = {
      aggressive: market.p10, // Bottom 10% - very aggressive
      moderate: market.p25,   // Bottom 25% - reasonable target
      conservative: market.p50, // Median - safe target
      walkAway: Math.round(currentRate * 0.7) // 30% reduction is walk-away
    }
    
    // Calculate savings for each target
    const annualVolume = config.annualVolume || 220 // Default ~220 working days
    const savings = {
      aggressive: this.calculateSavings(currentRate, targets.aggressive, annualVolume),
      moderate: this.calculateSavings(currentRate, targets.moderate, annualVolume),
      conservative: this.calculateSavings(currentRate, targets.conservative, annualVolume)
    }
    
    return {
      current: currentRate,
      market,
      targets,
      savings
    }
  }
  
  // Calculate detailed savings projections for each scenario
  static calculateSavingsProjections(
    config: TargetRateConfig,
    targetRates: TargetRates
  ): {
    aggressive: SavingsProjection
    moderate: SavingsProjection
    conservative: SavingsProjection
  } {
    const annualVolume = config.annualVolume || 220
    
    return {
      aggressive: this.createProjection(
        config.currentRate,
        targetRates.targets.aggressive,
        annualVolume,
        0.3 // 30% probability - aggressive
      ),
      moderate: this.createProjection(
        config.currentRate,
        targetRates.targets.moderate,
        annualVolume,
        0.6 // 60% probability - moderate
      ),
      conservative: this.createProjection(
        config.currentRate,
        targetRates.targets.conservative,
        annualVolume,
        0.85 // 85% probability - conservative
      )
    }
  }
  
  // Create a single savings projection
  private static createProjection(
    currentRate: number,
    targetRate: number,
    annualVolume: number,
    probability: number
  ): SavingsProjection {
    const currentAnnualCost = currentRate * annualVolume
    const targetAnnualCost = targetRate * annualVolume
    const annualSavings = currentAnnualCost - targetAnnualCost
    const savingsPercentage = ((annualSavings / currentAnnualCost) * 100)
    
    // Determine risk level based on savings percentage
    let riskLevel: SavingsProjection['riskLevel']
    if (savingsPercentage > 25) riskLevel = 'high'
    else if (savingsPercentage > 15) riskLevel = 'medium'
    else riskLevel = 'low'
    
    return {
      targetRate,
      currentAnnualCost: Math.round(currentAnnualCost),
      targetAnnualCost: Math.round(targetAnnualCost),
      annualSavings: Math.round(annualSavings),
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      probability,
      riskLevel
    }
  }
  
  // Calculate simple savings
  private static calculateSavings(
    currentRate: number,
    targetRate: number,
    annualVolume: number
  ): number {
    return Math.round((currentRate - targetRate) * annualVolume)
  }
  
  // Get conservative targets when no market data available
  private static getConservativeTargets(currentRate: number): TargetRates {
    return {
      current: currentRate,
      market: {
        p10: Math.round(currentRate * 0.85),
        p25: Math.round(currentRate * 0.90),
        p50: Math.round(currentRate * 0.95),
        p75: Math.round(currentRate * 1.05),
        p90: Math.round(currentRate * 1.15)
      },
      targets: {
        aggressive: Math.round(currentRate * 0.85),
        moderate: Math.round(currentRate * 0.90),
        conservative: Math.round(currentRate * 0.95),
        walkAway: Math.round(currentRate * 0.70)
      },
      savings: {
        aggressive: Math.round(currentRate * 0.15 * 220),
        moderate: Math.round(currentRate * 0.10 * 220),
        conservative: Math.round(currentRate * 0.05 * 220)
      }
    }
  }
  
  // Recommend negotiation strategy based on market position
  static recommendStrategy(
    currentRate: number,
    marketPercentile: number
  ): {
    strategy: 'aggressive' | 'moderate' | 'conservative'
    reasoning: string
    targetPercentile: number
  } {
    if (marketPercentile > 75) {
      return {
        strategy: 'aggressive',
        reasoning: 'Your current rate is in the top 25% (expensive). Strong negotiation position.',
        targetPercentile: 25
      }
    } else if (marketPercentile > 50) {
      return {
        strategy: 'moderate',
        reasoning: 'Your current rate is above median. Good opportunity for reduction.',
        targetPercentile: 35
      }
    } else {
      return {
        strategy: 'conservative',
        reasoning: 'Your current rate is already competitive. Focus on maintaining value.',
        targetPercentile: 45
      }
    }
  }
}

// Utility functions for target rate calculations
export const TargetRateUtils = {
  
  // Format savings with color coding
  formatSavings(savings: number, showCurrency: boolean = true): {
    text: string
    color: string
  } {
    const formatted = showCurrency ? `CHF ${savings.toLocaleString()}` : savings.toLocaleString()
    const color = savings > 0 ? 'text-green-600' : savings < 0 ? 'text-red-600' : 'text-gray-600'
    
    return { text: formatted, color }
  },
  
  // Get risk badge styling
  getRiskBadge(risk: SavingsProjection['riskLevel']): {
    label: string
    className: string
  } {
    const config = {
      low: { label: 'Low Risk', className: 'bg-green-100 text-green-800' },
      medium: { label: 'Medium Risk', className: 'bg-yellow-100 text-yellow-800' },
      high: { label: 'High Risk', className: 'bg-red-100 text-red-800' }
    }
    return config[risk]
  },
  
  // Get probability badge styling
  getProbabilityBadge(probability: number): {
    label: string
    className: string
  } {
    if (probability > 0.7) {
      return { label: 'High Probability', className: 'bg-green-100 text-green-800' }
    } else if (probability > 0.4) {
      return { label: 'Medium Probability', className: 'bg-yellow-100 text-yellow-800' }
    } else {
      return { label: 'Low Probability', className: 'bg-red-100 text-red-800' }
    }
  },
  
  // Calculate expected value (probability-weighted savings)
  calculateExpectedValue(projection: SavingsProjection): number {
    return Math.round(projection.annualSavings * projection.probability)
  }
}
