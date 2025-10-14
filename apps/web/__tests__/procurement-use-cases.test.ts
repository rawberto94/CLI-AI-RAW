import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock test data based on real negotiation outcomes
const realNegotiationOutcomes = [
  {
    id: 'case-001',
    supplier: 'Deloitte Consulting',
    role: 'Senior Consultant',
    initialRate: 185,
    finalRate: 165,
    actualSavings: 41600, // (185-165) * 2080 hours
    negotiationDuration: 45, // days
    leverageFactors: {
      volume: 2080, // hours
      relationshipYears: 4,
      performanceScore: 88,
      alternatives: 3
    },
    outcome: 'success',
    notes: 'Leveraged multi-year commitment for 10.8% reduction'
  },
  {
    id: 'case-002',
    supplier: 'Accenture',
    role: 'Project Manager',
    initialRate: 175,
    finalRate: 158,
    actualSavings: 35360, // (175-158) * 2080 hours
    negotiationDuration: 60,
    leverageFactors: {
      volume: 2080,
      relationshipYears: 2,
      performanceScore: 92,
      alternatives: 4
    },
    outcome: 'success',
    notes: 'Performance-based pricing model achieved 9.7% reduction'
  },
  {
    id: 'case-003',
    supplier: 'Cognizant',
    role: 'Software Developer',
    initialRate: 135,
    finalRate: 125,
    actualSavings: 20800, // (135-125) * 2080 hours
    negotiationDuration: 30,
    leverageFactors: {
      volume: 4160, // 2 FTEs
      relationshipYears: 1,
      performanceScore: 85,
      alternatives: 5
    },
    outcome: 'success',
    notes: 'Volume discount for multiple resources'
  },
  {
    id: 'case-004',
    supplier: 'PwC',
    role: 'Business Analyst',
    initialRate: 145,
    finalRate: 145,
    actualSavings: 0,
    negotiationDuration: 90,
    leverageFactors: {
      volume: 1040, // part-time
      relationshipYears: 6,
      performanceScore: 95,
      alternatives: 2
    },
    outcome: 'no_change',
    notes: 'Supplier held firm due to specialized expertise and limited alternatives'
  }
]

// Savings Calculator Test Suite
describe('Savings Calculator Validation', () => {
  describe('Negotiation Leverage Calculation', () => {
    it('should correctly calculate leverage for high-volume, long-term relationships', () => {
      const params = {
        currentRate: 185,
        benchmarkRate: 165,
        annualVolume: 2080,
        relationshipYears: 4,
        performanceScore: 88,
        marketAlternatives: 3,
        scenario: 'moderate' as const
      }

      const leverage = calculateNegotiationLeverage(params)
      
      expect(leverage.marketPosition).toBe('strong')
      expect(leverage.volumeAdvantage).toBeGreaterThan(50)
      expect(leverage.relationshipScore).toBeGreaterThan(70)
      expect(leverage.expectedOutcome.probability).toBeGreaterThan(80)
    })

    it('should identify weak position for low-volume, short-term relationships', () => {
      const params = {
        currentRate: 145,
        benchmarkRate: 135,
        annualVolume: 520, // 0.25 FTE
        relationshipYears: 0.5,
        performanceScore: 70,
        marketAlternatives: 1,
        scenario: 'conservative' as const
      }

      const leverage = calculateNegotiationLeverage(params)
      
      expect(leverage.marketPosition).toBe('weak')
      expect(leverage.expectedOutcome.probability).toBeLessThan(60)
    })
  })

  describe('Savings Prediction Accuracy', () => {
    it('should predict savings within 15% of actual outcomes for successful negotiations', () => {
      const successfulCases = realNegotiationOutcomes.filter(c => c.outcome === 'success')
      
      successfulCases.forEach(testCase => {
        const params = {
          currentRate: testCase.initialRate,
          benchmarkRate: testCase.finalRate,
          annualVolume: testCase.leverageFactors.volume,
          relationshipYears: testCase.leverageFactors.relationshipYears,
          performanceScore: testCase.leverageFactors.performanceScore,
          marketAlternatives: testCase.leverageFactors.alternatives,
          scenario: 'moderate' as const
        }

        const analysis = calculateSavingsAnalysis(params)
        const predictionAccuracy = Math.abs(analysis.potentialSavings.annual - testCase.actualSavings) / testCase.actualSavings
        
        expect(predictionAccuracy).toBeLessThan(0.15) // Within 15%
      })
    })

    it('should correctly identify cases with low success probability', () => {
      const failedCase = realNegotiationOutcomes.find(c => c.outcome === 'no_change')
      
      if (failedCase) {
        const params = {
          currentRate: failedCase.initialRate,
          benchmarkRate: failedCase.initialRate * 0.9, // 10% target reduction
          annualVolume: failedCase.leverageFactors.volume,
          relationshipYears: failedCase.leverageFactors.relationshipYears,
          performanceScore: failedCase.leverageFactors.performanceScore,
          marketAlternatives: failedCase.leverageFactors.alternatives,
          scenario: 'aggressive' as const
        }

        const leverage = calculateNegotiationLeverage(params)
        
        // Should identify challenges due to low volume and limited alternatives
        expect(leverage.expectedOutcome.probability).toBeLessThan(70)
      }
    })
  })

  describe('Risk Adjustment Validation', () => {
    it('should apply appropriate risk adjustments based on market position', () => {
      const strongPosition = {
        currentRate: 175,
        benchmarkRate: 158,
        annualVolume: 4160, // 2 FTEs
        relationshipYears: 5,
        performanceScore: 95,
        marketAlternatives: 4,
        scenario: 'moderate' as const
      }

      const weakPosition = {
        ...strongPosition,
        annualVolume: 520, // 0.25 FTE
        relationshipYears: 1,
        performanceScore: 70,
        marketAlternatives: 1
      }

      const strongAnalysis = calculateSavingsAnalysis(strongPosition)
      const weakAnalysis = calculateSavingsAnalysis(weakPosition)

      // Strong position should have higher risk-adjusted savings
      expect(strongAnalysis.riskAdjustedSavings / strongAnalysis.potentialSavings.annual)
        .toBeGreaterThan(weakAnalysis.riskAdjustedSavings / weakAnalysis.potentialSavings.annual)
    })
  })

  describe('Scenario Modeling Validation', () => {
    it('should provide realistic probability ranges for different scenarios', () => {
      const scenarios = getScenarios(175)
      
      expect(scenarios.conservative.probability).toBeGreaterThan(85)
      expect(scenarios.moderate.probability).toBeBetween(70, 85)
      expect(scenarios.aggressive.probability).toBeLessThan(70)
      
      expect(scenarios.conservative.targetReduction).toBeLessThan(scenarios.moderate.targetReduction)
      expect(scenarios.moderate.targetReduction).toBeLessThan(scenarios.aggressive.targetReduction)
    })
  })
})

// Market Intelligence Test Suite
describe('Market Intelligence Validation', () => {
  describe('Rate Trend Analysis', () => {
    it('should generate realistic rate trends with proper seasonality', () => {
      const trends = generateTrends(171, '12m')
      
      expect(trends).toHaveLength(12)
      
      // Check for realistic rate progression
      const rateRange = Math.max(...trends.map(t => t.value)) - Math.min(...trends.map(t => t.value))
      expect(rateRange).toBeLessThan(30) // Shouldn't vary more than 30 CHF over a year
      
      // Check for proper trend direction calculation
      trends.forEach((trend, index) => {
        if (index > 0) {
          const actualChange = trend.value - trends[index - 1].value
          if (Math.abs(actualChange) > 1) {
            expect(trend.direction).toBe(actualChange > 0 ? 'up' : 'down')
          } else {
            expect(trend.direction).toBe('stable')
          }
        }
      })
    })
  })

  describe('Geographic Rate Validation', () => {
    it('should apply realistic geographic multipliers', () => {
      const baseRate = 175
      const geoRates = generateGeographicRates(baseRate, {
        'United States': 1.0,
        'India': 0.26,
        'Switzerland': 0.94
      })

      const usRate = geoRates.find(r => r.country === 'United States')
      const indiaRate = geoRates.find(r => r.country === 'India')
      const swissRate = geoRates.find(r => r.country === 'Switzerland')

      expect(usRate?.averageRate).toBe(175)
      expect(indiaRate?.averageRate).toBe(Math.round(175 * 0.26))
      expect(swissRate?.averageRate).toBe(Math.round(175 * 0.94))
      
      // Confidence should correlate with sample size
      geoRates.forEach(rate => {
        expect(rate.confidence).toBeGreaterThan(85)
        if (rate.sampleSize > 1000) {
          expect(rate.confidence).toBeGreaterThan(95)
        }
      })
    })
  })

  describe('Supplier Intelligence Accuracy', () => {
    it('should provide realistic supplier rate ranges and market positioning', () => {
      const suppliers = generateSupplierIntelligence('Senior Consultant')
      
      suppliers.forEach(supplier => {
        // Rate range should be realistic (±25% of average)
        const rangeSpread = (supplier.rateRange.max - supplier.rateRange.min) / supplier.averageRate
        expect(rangeSpread).toBeBetween(0.3, 0.5)
        
        // Big 4 should generally have higher rates
        if (supplier.tier === 'Big 4') {
          expect(supplier.averageRate).toBeGreaterThan(160)
        }
        
        // Market share should be realistic
        expect(supplier.marketShare).toBeBetween(5, 25)
        
        // Satisfaction scores should be realistic
        expect(supplier.clientSatisfaction).toBeBetween(3.5, 5.0)
      })
    })
  })
})

// Integration Test Suite
describe('End-to-End Procurement Use Cases', () => {
  describe('Complete Negotiation Preparation Flow', () => {
    it('should provide comprehensive negotiation package', async () => {
      const negotiationRequest = {
        role: 'Senior Consultant',
        supplier: 'Deloitte Consulting',
        currentRate: 185,
        benchmarkRate: 165,
        annualVolume: 2080,
        relationshipYears: 4,
        performanceScore: 88,
        marketAlternatives: 3
      }

      // 1. Get market intelligence
      const marketData = await getMarketIntelligence(negotiationRequest.role)
      expect(marketData.supplierIntelligence).toContainEqual(
        expect.objectContaining({ name: negotiationRequest.supplier })
      )

      // 2. Calculate savings scenarios
      const savingsData = await calculateSavings({
        ...negotiationRequest,
        scenario: 'moderate'
      })
      expect(savingsData.savingsAnalysis.potentialSavings.annual).toBeGreaterThan(0)

      // 3. Generate talking points
      const talkingPoints = generateTalkingPoints(negotiationRequest, marketData, savingsData)
      expect(talkingPoints).toHaveLength.greaterThan(3)

      // 4. Create negotiation timeline
      const timeline = createNegotiationTimeline(savingsData.negotiationLeverage.marketPosition)
      expect(timeline.estimatedDuration).toBeBetween(30, 90)
    })
  })

  describe('ROI Validation Against Real Outcomes', () => {
    it('should demonstrate positive ROI for implemented recommendations', () => {
      const implementationCosts = {
        toolLicensing: 50000, // Annual
        training: 25000, // One-time
        processChange: 15000 // One-time
      }

      const totalImplementationCost = Object.values(implementationCosts).reduce((a, b) => a + b, 0)

      // Calculate savings from test cases
      const totalActualSavings = realNegotiationOutcomes
        .filter(c => c.outcome === 'success')
        .reduce((sum, c) => sum + c.actualSavings, 0)

      const roi = (totalActualSavings - totalImplementationCost) / totalImplementationCost
      
      expect(roi).toBeGreaterThan(2.0) // 200% ROI minimum
    })
  })
})

// Helper functions (would be imported from actual implementation)
function calculateNegotiationLeverage(params: any) {
  const volumeScore = Math.min(100, (params.annualVolume / 2000) * 50)
  const relationshipScore = Math.min(100, params.relationshipYears * 20)
  const performanceBonus = params.performanceScore > 80 ? 20 : params.performanceScore > 60 ? 10 : 0
  const alternativesScore = Math.min(100, params.marketAlternatives * 15)

  const overallScore = (volumeScore + relationshipScore + performanceBonus + alternativesScore) / 4

  let marketPosition: 'strong' | 'moderate' | 'weak'
  if (overallScore >= 75) marketPosition = 'strong'
  else if (overallScore >= 50) marketPosition = 'moderate'
  else marketPosition = 'weak'

  return {
    marketPosition,
    volumeAdvantage: volumeScore,
    relationshipScore,
    competitiveAlternatives: alternativesScore,
    expectedOutcome: {
      probability: Math.min(95, overallScore + 10)
    }
  }
}

function calculateSavingsAnalysis(params: any) {
  const scenarios = getScenarios(params.currentRate)
  const scenario = scenarios[params.scenario]
  
  const targetRate = params.currentRate * (1 - scenario.targetReduction / 100)
  const annualSavings = (params.currentRate - targetRate) * params.annualVolume
  
  const leverage = calculateNegotiationLeverage(params)
  const leverageMultiplier = leverage.marketPosition === 'strong' ? 1.0 : 
                           leverage.marketPosition === 'moderate' ? 0.85 : 0.7
  
  return {
    potentialSavings: { annual: annualSavings },
    riskAdjustedSavings: annualSavings * leverageMultiplier
  }
}

function getScenarios(currentRate: number) {
  return {
    conservative: { targetReduction: 5, probability: 90 },
    moderate: { targetReduction: 12, probability: 75 },
    aggressive: { targetReduction: 20, probability: 60 }
  }
}

function generateTrends(currentRate: number, timeframe: string) {
  const months = 12
  return Array.from({ length: months }, (_, i) => ({
    period: `Month ${i + 1}`,
    value: currentRate + Math.sin(i) * 5,
    change: Math.random() * 4 - 2,
    direction: Math.random() > 0.5 ? 'up' : 'down' as const
  }))
}

function generateGeographicRates(baseRate: number, multipliers: Record<string, number>) {
  return Object.entries(multipliers).map(([country, multiplier]) => ({
    country,
    region: 'Test Region',
    averageRate: Math.round(baseRate * multiplier),
    sampleSize: Math.floor(Math.random() * 1000) + 100,
    confidence: 85 + Math.random() * 15,
    costOfLiving: 100,
    skillAvailability: 'high' as const,
    marketMaturity: 'mature' as const
  }))
}

function generateSupplierIntelligence(role: string) {
  return [
    {
      name: 'Deloitte Consulting',
      tier: 'Big 4' as const,
      averageRate: 185,
      rateRange: { min: 165, max: 220 },
      marketShare: 18.5,
      clientSatisfaction: 4.3,
      financialHealth: 92,
      growthTrend: 'growing' as const,
      negotiationFlexibility: 'medium' as const,
      specializations: ['Strategy'],
      geographies: ['Global']
    }
  ]
}

async function getMarketIntelligence(role: string) {
  return {
    supplierIntelligence: generateSupplierIntelligence(role)
  }
}

async function calculateSavings(params: any) {
  return {
    savingsAnalysis: calculateSavingsAnalysis(params),
    negotiationLeverage: calculateNegotiationLeverage(params)
  }
}

function generateTalkingPoints(request: any, marketData: any, savingsData: any) {
  return [
    'Market rate analysis shows 10.8% reduction opportunity',
    'Volume commitment justifies preferential pricing',
    'Performance history demonstrates value partnership'
  ]
}

function createNegotiationTimeline(position: string) {
  return {
    estimatedDuration: position === 'strong' ? 30 : position === 'moderate' ? 60 : 90
  }
}

// Custom Jest matchers
expect.extend({
  toBeBetween(received: number, min: number, max: number) {
    const pass = received >= min && received <= max
    return {
      message: () => `expected ${received} to be between ${min} and ${max}`,
      pass
    }
  }
})

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeBetween(min: number, max: number): R
    }
  }
}