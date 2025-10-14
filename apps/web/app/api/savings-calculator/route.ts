import { NextRequest, NextResponse } from 'next/server'

interface SavingsCalculationRequest {
  currentRate: number
  benchmarkRate: number
  annualVolume: number
  relationshipYears: number
  performanceScore: number
  marketAlternatives: number
  scenario: 'conservative' | 'moderate' | 'aggressive' | 'market'
}

interface SavingsCalculationResponse {
  success: boolean
  data?: {
    savingsAnalysis: {
      currentAnnualSpend: number
      benchmarkRate: number
      targetRate: number
      potentialSavings: {
        annual: number
        threeYear: number
        percentage: number
      }
      riskAdjustedSavings: number
      implementationCost: number
      netSavings: number
      paybackPeriod: number
      confidence: number
    }
    negotiationLeverage: {
      marketPosition: 'strong' | 'moderate' | 'weak'
      volumeAdvantage: number
      relationshipScore: number
      competitiveAlternatives: number
      recommendedStrategy: string
      expectedOutcome: {
        minSavings: number
        maxSavings: number
        probability: number
      }
    }
    scenarios: Array<{
      name: string
      targetReduction: number
      probability: number
      implementationRisk: 'low' | 'medium' | 'high'
      timeline: number
      description: string
      projectedSavings: number
      riskAdjustedSavings: number
    }>
    recommendations: string[]
  }
  error?: string
}

class SavingsCalculatorService {
  async calculateSavings(params: SavingsCalculationRequest): Promise<SavingsCalculationResponse['data']> {
    // Simulate calculation delay
    await new Promise(resolve => setTimeout(resolve, 200))

    const scenarios = this.getScenarios(params.currentRate)
    const selectedScenario = scenarios[params.scenario]
    
    const negotiationLeverage = this.calculateNegotiationLeverage(params)
    const savingsAnalysis = this.calculateSavingsAnalysis(params, selectedScenario, negotiationLeverage)
    
    return {
      savingsAnalysis,
      negotiationLeverage,
      scenarios: Object.entries(scenarios).map(([key, scenario]) => ({
        ...scenario,
        projectedSavings: params.currentRate * params.annualVolume * (scenario.targetReduction / 100),
        riskAdjustedSavings: params.currentRate * params.annualVolume * (scenario.targetReduction / 100) * (scenario.probability / 100)
      })),
      recommendations: this.generateRecommendations(params, negotiationLeverage, savingsAnalysis)
    }
  }

  private getScenarios(currentRate: number) {
    return {
      conservative: {
        name: 'Conservative',
        targetReduction: 5,
        probability: 90,
        implementationRisk: 'low' as const,
        timeline: 30,
        description: 'Low-risk approach with high success probability'
      },
      moderate: {
        name: 'Moderate',
        targetReduction: 12,
        probability: 75,
        implementationRisk: 'medium' as const,
        timeline: 60,
        description: 'Balanced approach with good savings potential'
      },
      aggressive: {
        name: 'Aggressive',
        targetReduction: 20,
        probability: 60,
        implementationRisk: 'high' as const,
        timeline: 90,
        description: 'High-impact approach requiring strong negotiation'
      },
      market: {
        name: 'Market Rate',
        targetReduction: Math.max(0, ((currentRate - 156) / currentRate) * 100), // Assuming 156 as market benchmark
        probability: 80,
        implementationRisk: 'medium' as const,
        timeline: 45,
        description: 'Align with market benchmark rates'
      }
    }
  }

  private calculateNegotiationLeverage(params: SavingsCalculationRequest) {
    const volumeScore = Math.min(100, (params.annualVolume / 2000) * 50)
    const relationshipScore = Math.min(100, params.relationshipYears * 20)
    const performanceBonus = params.performanceScore > 80 ? 20 : params.performanceScore > 60 ? 10 : 0
    const alternativesScore = Math.min(100, params.marketAlternatives * 15)

    const overallScore = (volumeScore + relationshipScore + performanceBonus + alternativesScore) / 4

    let marketPosition: 'strong' | 'moderate' | 'weak'
    if (overallScore >= 75) marketPosition = 'strong'
    else if (overallScore >= 50) marketPosition = 'moderate'
    else marketPosition = 'weak'

    const baseReduction = overallScore / 100 * 0.25 // Up to 25% reduction potential
    const minSavings = baseReduction * 0.6
    const maxSavings = baseReduction * 1.4

    return {
      marketPosition,
      volumeAdvantage: volumeScore,
      relationshipScore,
      competitiveAlternatives: alternativesScore,
      recommendedStrategy: this.getRecommendedStrategy(marketPosition, overallScore),
      expectedOutcome: {
        minSavings: minSavings * params.currentRate * params.annualVolume,
        maxSavings: maxSavings * params.currentRate * params.annualVolume,
        probability: Math.min(95, overallScore + 10)
      }
    }
  }

  private calculateSavingsAnalysis(
    params: SavingsCalculationRequest, 
    scenario: any, 
    leverage: any
  ) {
    const targetRate = params.currentRate * (1 - scenario.targetReduction / 100)
    const currentAnnualSpend = params.currentRate * params.annualVolume
    const targetAnnualSpend = targetRate * params.annualVolume
    const annualSavings = currentAnnualSpend - targetAnnualSpend
    const threeYearSavings = annualSavings * 3

    // Risk adjustment based on scenario and leverage
    const leverageMultiplier = leverage.marketPosition === 'strong' ? 1.0 : 
                             leverage.marketPosition === 'moderate' ? 0.85 : 0.7
    const riskMultiplier = scenario.implementationRisk === 'low' ? 0.95 : 
                          scenario.implementationRisk === 'medium' ? 0.85 : 0.75

    const riskAdjustedSavings = annualSavings * leverageMultiplier * riskMultiplier

    // Implementation costs
    const implementationCost = Math.max(5000, annualSavings * 0.05) // 5% of savings or $5K minimum

    const netSavings = riskAdjustedSavings - implementationCost
    const paybackPeriod = implementationCost / (riskAdjustedSavings / 12) // months

    // Confidence calculation
    const confidence = scenario.probability * leverageMultiplier

    return {
      currentAnnualSpend,
      benchmarkRate: targetRate,
      targetRate,
      potentialSavings: {
        annual: annualSavings,
        threeYear: threeYearSavings,
        percentage: scenario.targetReduction
      },
      riskAdjustedSavings,
      implementationCost,
      netSavings,
      paybackPeriod,
      confidence
    }
  }

  private getRecommendedStrategy(position: string, score: number): string {
    if (position === 'strong') {
      return 'Leverage volume and performance for aggressive rate reduction. Consider multi-year locks.'
    } else if (position === 'moderate') {
      return 'Focus on market alignment and performance-based pricing. Gradual reduction approach.'
    } else {
      return 'Emphasize relationship value and seek win-win solutions. Consider value-added services.'
    }
  }

  private generateRecommendations(
    params: SavingsCalculationRequest,
    leverage: any,
    analysis: any
  ): string[] {
    const recommendations = []

    if (leverage.marketPosition === 'strong') {
      recommendations.push('Your strong negotiation position allows for aggressive rate reduction targets')
      recommendations.push('Consider bundling multiple roles or services for additional volume discounts')
    }

    if (params.performanceScore > 85) {
      recommendations.push('Leverage your excellent performance history in negotiations')
    }

    if (analysis.paybackPeriod < 6) {
      recommendations.push('Quick payback period makes this a high-priority initiative')
    }

    if (params.marketAlternatives >= 3) {
      recommendations.push('Multiple alternatives strengthen your negotiation position')
    }

    if (analysis.confidence > 80) {
      recommendations.push('High confidence level suggests proceeding with implementation')
    }

    return recommendations
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SavingsCalculationRequest = await request.json()
    
    // Validate required fields
    const requiredFields = ['currentRate', 'benchmarkRate', 'annualVolume', 'relationshipYears', 'performanceScore', 'marketAlternatives', 'scenario']
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field: ${field}`
          },
          { status: 400 }
        )
      }
    }

    const service = new SavingsCalculatorService()
    const data = await service.calculateSavings(body)

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Savings calculator API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate savings'
      },
      { status: 500 }
    )
  }
}