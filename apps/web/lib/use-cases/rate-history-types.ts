// Shared types for rate history and negotiation features

export interface MarketPercentiles {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface TargetRates {
  current: number
  market: MarketPercentiles
  targets: {
    aggressive: number
    moderate: number
    conservative: number
    walkAway: number
  }
  savings: {
    aggressive: number
    moderate: number
    conservative: number
  }
}

export interface MarketIntelligence {
  averageRate: number
  medianRate: number
  minRate: number
  maxRate: number
  competitivePosition: {
    marketRank: number
    competitorsBelow: number
    competitorsAbove: number
    percentile: number
  }
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  percentChange: number
  volatility: number
  confidence: 'high' | 'medium' | 'low'
}

export interface TalkingPoint {
  id: string
  category: 'market' | 'volume' | 'competitive' | 'trend' | 'relationship' | 'value'
  title: string
  description: string
  supportingData: string[]
  persuasivenessScore: number // 1-10
  counterArguments?: string[]
  responseStrategies?: string[]
}

export interface NegotiationScenario {
  id: string
  name: string
  description: string
  targetRate: number
  probability: number // 0-1
  expectedSavings: number
  riskLevel: 'low' | 'medium' | 'high'
  strategy: string
  keyTalkingPoints: string[]
}
