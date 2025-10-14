import { NextRequest, NextResponse } from 'next/server'

interface MarketDataRequest {
  role?: string
  geography?: string
  serviceLine?: string
  timeframe?: string
}

interface MarketDataResponse {
  success: boolean
  data?: {
    trends: Array<{
      period: string
      value: number
      change: number
      direction: 'up' | 'down' | 'stable'
    }>
    geographicRates: Array<{
      region: string
      country: string
      averageRate: number
      sampleSize: number
      confidence: number
      costOfLiving: number
      skillAvailability: 'high' | 'medium' | 'low'
      marketMaturity: 'mature' | 'developing' | 'emerging'
    }>
    supplierIntelligence: Array<{
      id: string
      name: string
      tier: 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore'
      marketShare: number
      averageRate: number
      rateRange: { min: number; max: number }
      specializations: string[]
      geographies: string[]
      clientSatisfaction: number
      financialHealth: number
      growthTrend: 'growing' | 'stable' | 'declining'
      negotiationFlexibility: 'high' | 'medium' | 'low'
      lastUpdated: string
    }>
    skillPremiums: Array<{
      skill: string
      category: string
      premiumPercentage: number
      demandLevel: 'high' | 'medium' | 'low'
      supplyTightness: number
      trendDirection: 'increasing' | 'stable' | 'decreasing'
      marketExamples: Array<{
        role: string
        baseRate: number
        premiumRate: number
      }>
    }>
    marketInsights: {
      keyTrends: string[]
      opportunities: string[]
      risks: string[]
      recommendations: string[]
    }
    dataQuality: {
      sampleSize: number
      confidence: number
      coverage: number
      lastUpdated: string
    }
  }
  error?: string
}

// Mock market intelligence service
class MarketIntelligenceService {
  async getMarketData(params: MarketDataRequest): Promise<MarketDataResponse['data']> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // In production, this would integrate with:
    // - Industry salary surveys (Mercer, Radford, etc.)
    // - Government labor statistics
    // - Supplier financial data (D&B, S&P, etc.)
    // - Internal contract database
    // - Third-party market intelligence providers

    const baseRates = this.getBaseRates(params.role || 'Senior Consultant')
    const geographicMultipliers = this.getGeographicMultipliers()
    
    return {
      trends: this.generateTrends(baseRates.current, params.timeframe || '12m'),
      geographicRates: this.generateGeographicRates(baseRates.current, geographicMultipliers),
      supplierIntelligence: this.generateSupplierIntelligence(params.role || 'Senior Consultant'),
      skillPremiums: this.generateSkillPremiums(),
      marketInsights: this.generateMarketInsights(),
      dataQuality: {
        sampleSize: 2847,
        confidence: 94.2,
        coverage: 87.5,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  private getBaseRates(role: string): { current: number; historical: number[] } {
    const roleRates: Record<string, number> = {
      'Senior Consultant': 171,
      'Project Manager': 158,
      'Business Analyst': 135,
      'Software Developer': 165,
      'QA Engineer': 125,
      'Technical Architect': 195,
      'Data Analyst': 145,
      'DevOps Engineer': 160
    }

    const current = roleRates[role] || 150
    const historical = Array.from({ length: 12 }, (_, i) => {
      const monthsAgo = 11 - i
      const baseVariation = Math.sin(monthsAgo * 0.5) * 5
      const trendGrowth = monthsAgo * -0.8 // Negative because we're going backwards
      return Math.round(current + baseVariation + trendGrowth)
    })

    return { current, historical }
  }

  private getGeographicMultipliers(): Record<string, number> {
    return {
      'United States': 1.0,
      'Switzerland': 0.94,
      'United Kingdom': 0.83,
      'Germany': 0.78,
      'India': 0.26,
      'Philippines': 0.20,
      'Mexico': 0.29,
      'Brazil': 0.28
    }
  }

  private generateTrends(currentRate: number, timeframe: string): MarketDataResponse['data']['trends'] {
    const months = timeframe === '6m' ? 6 : 12
    const trends = []
    
    for (let i = 0; i < months; i++) {
      const monthsAgo = months - 1 - i
      const date = new Date()
      date.setMonth(date.getMonth() - monthsAgo)
      
      const baseVariation = Math.sin(monthsAgo * 0.5) * 3
      const trendGrowth = monthsAgo * -0.7
      const value = Math.round(currentRate + baseVariation + trendGrowth)
      
      const prevValue = i > 0 ? trends[i - 1].value : value - 2
      const change = ((value - prevValue) / prevValue) * 100
      
      trends.push({
        period: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        value,
        change: Math.round(change * 10) / 10,
        direction: change > 1 ? 'up' : change < -1 ? 'down' : 'stable'
      })
    }
    
    return trends
  }

  private generateGeographicRates(baseRate: number, multipliers: Record<string, number>): MarketDataResponse['data']['geographicRates'] {
    const regions = {
      'United States': { region: 'North America', costOfLiving: 100, skillAvailability: 'high' as const, marketMaturity: 'mature' as const, sampleSize: 847 },
      'Switzerland': { region: 'Europe', costOfLiving: 125, skillAvailability: 'medium' as const, marketMaturity: 'mature' as const, sampleSize: 234 },
      'United Kingdom': { region: 'Europe', costOfLiving: 95, skillAvailability: 'high' as const, marketMaturity: 'mature' as const, sampleSize: 456 },
      'Germany': { region: 'Europe', costOfLiving: 85, skillAvailability: 'high' as const, marketMaturity: 'mature' as const, sampleSize: 312 },
      'India': { region: 'Asia Pacific', costOfLiving: 25, skillAvailability: 'high' as const, marketMaturity: 'mature' as const, sampleSize: 1234 },
      'Philippines': { region: 'Asia Pacific', costOfLiving: 22, skillAvailability: 'medium' as const, marketMaturity: 'developing' as const, sampleSize: 567 },
      'Mexico': { region: 'Latin America', costOfLiving: 35, skillAvailability: 'medium' as const, marketMaturity: 'developing' as const, sampleSize: 289 },
      'Brazil': { region: 'Latin America', costOfLiving: 32, skillAvailability: 'medium' as const, marketMaturity: 'developing' as const, sampleSize: 198 }
    }

    return Object.entries(regions).map(([country, data]) => ({
      region: data.region,
      country,
      averageRate: Math.round(baseRate * multipliers[country]),
      sampleSize: data.sampleSize,
      confidence: Math.min(98, 85 + (data.sampleSize / 50)),
      costOfLiving: data.costOfLiving,
      skillAvailability: data.skillAvailability,
      marketMaturity: data.marketMaturity
    }))
  }

  private generateSupplierIntelligence(role: string): MarketDataResponse['data']['supplierIntelligence'] {
    const suppliers = [
      {
        id: 'deloitte',
        name: 'Deloitte Consulting',
        tier: 'Big 4' as const,
        marketShare: 18.5,
        rateMultiplier: 1.15,
        specializations: ['Strategy', 'Digital Transformation', 'Operations'],
        geographies: ['North America', 'Europe', 'Asia Pacific'],
        clientSatisfaction: 4.3,
        financialHealth: 92,
        growthTrend: 'growing' as const,
        negotiationFlexibility: 'medium' as const
      },
      {
        id: 'accenture',
        name: 'Accenture',
        tier: 'Big 4' as const,
        marketShare: 22.1,
        rateMultiplier: 1.08,
        specializations: ['Technology', 'Digital', 'Operations'],
        geographies: ['Global'],
        clientSatisfaction: 4.4,
        financialHealth: 94,
        growthTrend: 'growing' as const,
        negotiationFlexibility: 'high' as const
      },
      {
        id: 'cognizant',
        name: 'Cognizant',
        tier: 'Tier 2' as const,
        marketShare: 12.3,
        rateMultiplier: 0.78,
        specializations: ['IT Services', 'Digital Engineering'],
        geographies: ['North America', 'Europe', 'India'],
        clientSatisfaction: 4.1,
        financialHealth: 87,
        growthTrend: 'stable' as const,
        negotiationFlexibility: 'high' as const
      }
    ]

    const baseRate = this.getBaseRates(role).current

    return suppliers.map(supplier => ({
      ...supplier,
      averageRate: Math.round(baseRate * supplier.rateMultiplier),
      rateRange: {
        min: Math.round(baseRate * supplier.rateMultiplier * 0.85),
        max: Math.round(baseRate * supplier.rateMultiplier * 1.25)
      },
      lastUpdated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    }))
  }

  private generateSkillPremiums(): MarketDataResponse['data']['skillPremiums'] {
    return [
      {
        skill: 'AI/Machine Learning',
        category: 'Technology',
        premiumPercentage: 35,
        demandLevel: 'high' as const,
        supplyTightness: 85,
        trendDirection: 'increasing' as const,
        marketExamples: [
          { role: 'ML Engineer', baseRate: 150, premiumRate: 203 },
          { role: 'Data Scientist', baseRate: 140, premiumRate: 189 }
        ]
      },
      {
        skill: 'Cloud Architecture',
        category: 'Technology',
        premiumPercentage: 25,
        demandLevel: 'high' as const,
        supplyTightness: 75,
        trendDirection: 'stable' as const,
        marketExamples: [
          { role: 'Cloud Architect', baseRate: 160, premiumRate: 200 },
          { role: 'DevOps Engineer', baseRate: 130, premiumRate: 163 }
        ]
      },
      {
        skill: 'Cybersecurity',
        category: 'Security',
        premiumPercentage: 30,
        demandLevel: 'high' as const,
        supplyTightness: 80,
        trendDirection: 'increasing' as const,
        marketExamples: [
          { role: 'Security Architect', baseRate: 170, premiumRate: 221 },
          { role: 'Security Consultant', baseRate: 145, premiumRate: 189 }
        ]
      }
    ]
  }

  private generateMarketInsights(): MarketDataResponse['data']['marketInsights'] {
    return {
      keyTrends: [
        'AI/ML skills commanding 35%+ premium across all regions',
        'Remote work driving geographic rate convergence',
        'Increased demand for specialized cybersecurity expertise',
        'Big 4 firms showing more rate flexibility in competitive situations'
      ],
      opportunities: [
        'Offshore delivery models offering 60-70% cost savings',
        'Hybrid engagement models reducing overall project costs',
        'Performance-based pricing gaining acceptance',
        'Multi-year contracts enabling 5-10% rate discounts'
      ],
      risks: [
        'Talent shortage driving rates up in specialized areas',
        'Inflation pressure on all service categories',
        'Currency fluctuations affecting offshore rates',
        'Increased competition for top-tier talent'
      ],
      recommendations: [
        'Lock in rates for specialized skills before further increases',
        'Consider hybrid delivery models for cost optimization',
        'Negotiate performance-based pricing for better value',
        'Diversify supplier base to reduce dependency risk'
      ]
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params: MarketDataRequest = {
      role: searchParams.get('role') || undefined,
      geography: searchParams.get('geography') || undefined,
      serviceLine: searchParams.get('serviceLine') || undefined,
      timeframe: searchParams.get('timeframe') || undefined
    }

    const service = new MarketIntelligenceService()
    const data = await service.getMarketData(params)

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Market intelligence API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market intelligence data'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const service = new MarketIntelligenceService()
    const data = await service.getMarketData(body)

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Market intelligence API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process market intelligence request'
      },
      { status: 500 }
    )
  }
}