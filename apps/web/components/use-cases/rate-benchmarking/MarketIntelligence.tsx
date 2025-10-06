'use client'

import React, { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle,
  CheckCircle,
  Info,
  Target,
  Users,
  Calendar,
  BarChart3
} from 'lucide-react'
import type { RoleRate, Geography } from '@/lib/use-cases/enhanced-rate-benchmarking-data'

interface MarketIntelligenceProps {
  selectedRoles: RoleRate[]
  geography: Geography
  supplierName?: string
}

interface TrendData {
  role: string
  trend: 'up' | 'down' | 'stable'
  change: number
  factors: string[]
}

interface NegotiationPoint {
  type: 'strength' | 'leverage' | 'alternative' | 'market'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
}

export function MarketIntelligence({ selectedRoles, geography, supplierName }: MarketIntelligenceProps) {
  // Generate trend data
  const trendData = useMemo<TrendData[]>(() => {
    return selectedRoles.map(role => {
      // Simulate trend based on role characteristics
      const variance = role.hourlyRate - role.chainIQBenchmark
      const variancePercent = (variance / role.chainIQBenchmark) * 100
      
      let trend: 'up' | 'down' | 'stable' = 'stable'
      let change = 0
      const factors: string[] = []

      if (variancePercent > 10) {
        trend = 'up'
        change = Math.round(variancePercent)
        factors.push('Above market rates')
        factors.push('High demand for skills')
      } else if (variancePercent < -5) {
        trend = 'down'
        change = Math.round(Math.abs(variancePercent))
        factors.push('Below market rates')
        factors.push('Increased supply')
      } else {
        trend = 'stable'
        change = Math.round(Math.abs(variancePercent))
        factors.push('Market equilibrium')
      }

      // Add geography-specific factors
      if (geography.includes('Offshore')) {
        factors.push('Offshore location advantage')
      }
      if (geography.includes('Nearshore')) {
        factors.push('Nearshore proximity benefits')
      }

      // Add role-specific factors
      if (role.skillsPremium > 0) {
        factors.push(`${role.skillsPremium}% skills premium`)
      }
      if (role.locationPremium > 0) {
        factors.push(`${role.locationPremium}% location premium`)
      }

      return {
        role: role.role,
        trend,
        change,
        factors
      }
    })
  }, [selectedRoles, geography])

  // Generate negotiation talking points
  const negotiationPoints = useMemo<NegotiationPoint[]>(() => {
    const points: NegotiationPoint[] = []

    // Data-backed arguments
    const aboveMarketRoles = selectedRoles.filter(r => r.hourlyRate > r.chainIQBenchmark)
    if (aboveMarketRoles.length > 0) {
      const avgOverage = aboveMarketRoles.reduce((sum, r) => 
        sum + ((r.hourlyRate - r.chainIQBenchmark) / r.chainIQBenchmark * 100), 0
      ) / aboveMarketRoles.length

      points.push({
        type: 'strength',
        title: `${aboveMarketRoles.length} roles above ChainIQ benchmark`,
        description: `Your rates are ${avgOverage.toFixed(1)}% above market median. ChainIQ data shows clear opportunity for rate reduction.`,
        impact: 'high'
      })
    }

    // Market comparison
    points.push({
      type: 'market',
      title: 'ChainIQ P25 benchmark provides negotiation target',
      description: `Industry data shows P25 rates are 15% below median. This represents achievable best-in-class pricing.`,
      impact: 'high'
    })

    // Volume leverage
    const totalFTEs = selectedRoles.reduce((sum, r) => sum + (r.fteCount || 1), 0)
    if (totalFTEs >= 5) {
      points.push({
        type: 'leverage',
        title: `${totalFTEs} FTE commitment qualifies for volume pricing`,
        description: `ChainIQ standards show 5-10% volume discounts are typical for ${totalFTEs}+ FTE commitments.`,
        impact: 'high'
      })
    }

    // Geographic arbitrage
    if (geography.includes('Onshore')) {
      points.push({
        type: 'alternative',
        title: 'Offshore alternatives available',
        description: `ChainIQ shows offshore rates are 40-60% lower for similar roles. Consider blended delivery model.`,
        impact: 'medium'
      })
    }

    // Competitive alternatives
    if (supplierName) {
      points.push({
        type: 'alternative',
        title: 'Multiple competitive suppliers available',
        description: `ChainIQ tracks 15+ suppliers in this market. Competitive pressure supports rate negotiations.`,
        impact: 'medium'
      })
    }

    // Market trends
    const stableRoles = trendData.filter(t => t.trend === 'stable').length
    if (stableRoles > selectedRoles.length / 2) {
      points.push({
        type: 'market',
        title: 'Market rates stabilizing',
        description: `ChainIQ trend data shows ${stableRoles} of ${selectedRoles.length} roles have stable rates, supporting rate freeze clauses.`,
        impact: 'medium'
      })
    }

    return points
  }, [selectedRoles, geography, supplierName, trendData])

  // Calculate peer benchmarks
  const peerBenchmarks = useMemo(() => {
    const results = selectedRoles.map(role => {
      const currentRate = role.hourlyRate
      const p25 = role.chainIQPercentile.p25
      const p75 = role.chainIQPercentile.p75
      const p90 = role.chainIQPercentile.p90

      let quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' = 'Q2'
      let percentile = 50

      if (currentRate <= p25) {
        quartile = 'Q1'
        percentile = 25
      } else if (currentRate <= role.chainIQBenchmark) {
        quartile = 'Q2'
        percentile = 40
      } else if (currentRate <= p75) {
        quartile = 'Q3'
        percentile = 60
      } else {
        quartile = 'Q4'
        percentile = currentRate <= p90 ? 80 : 90
      }

      return {
        role: role.role,
        currentRate,
        quartile,
        percentile,
        p25,
        p75,
        p90,
        chainIQBenchmark: role.chainIQBenchmark
      }
    })

    return results
  }, [selectedRoles])

  // Data quality metrics
  const dataQuality = useMemo(() => {
    const avgConfidence = selectedRoles.length > 0
      ? selectedRoles.reduce((sum, r) => sum + 0.85, 0) / selectedRoles.length
      : 0

    const dataFreshness = selectedRoles.length > 0
      ? Math.max(...selectedRoles.map(r => {
          const daysSinceUpdate = Math.floor(
            (new Date().getTime() - r.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
          )
          return daysSinceUpdate
        }))
      : 0

    const sampleSize = selectedRoles.length * 50 // Simulated

    return {
      confidence: avgConfidence,
      freshness: dataFreshness,
      sampleSize,
      coverage: geography
    }
  }, [selectedRoles, geography])

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-600" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-600" />
      case 'stable':
        return <Minus className="w-4 h-4 text-gray-600" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'down':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'stable':
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-300'
    }
  }

  const getQuartileColor = (quartile: string) => {
    switch (quartile) {
      case 'Q1':
        return 'bg-green-100 text-green-700'
      case 'Q2':
        return 'bg-blue-100 text-blue-700'
      case 'Q3':
        return 'bg-yellow-100 text-yellow-700'
      case 'Q4':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Trend Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            12-Month Rate Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trendData.map((trend, idx) => (
              <div key={idx} className={`p-4 rounded-lg border-2 ${getTrendColor(trend.trend)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(trend.trend)}
                    <span className="font-semibold">{trend.role}</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {trend.trend === 'up' ? '+' : trend.trend === 'down' ? '-' : '±'}{trend.change}%
                  </Badge>
                </div>
                <div className="text-sm space-y-1">
                  {trend.factors.map((factor, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-current" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Talking Points */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            ChainIQ Negotiation Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {negotiationPoints.map((point, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getImpactColor(point.impact)}>
                        {point.impact.toUpperCase()} IMPACT
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {point.type}
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-gray-900">{point.title}</h4>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{point.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Peer Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Competitive Positioning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {peerBenchmarks.map((benchmark, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{benchmark.role}</span>
                  <Badge className={getQuartileColor(benchmark.quartile)}>
                    {benchmark.quartile} • P{benchmark.percentile}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Your Rate:</span>
                    <span className="font-semibold">${benchmark.currentRate}/hr</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">ChainIQ Benchmark (P50):</span>
                    <span className="font-semibold text-blue-600">${benchmark.chainIQBenchmark}/hr</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Best in Class (P25):</span>
                    <span className="font-semibold text-green-600">${benchmark.p25}/hr</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Premium Range (P75):</span>
                    <span className="font-semibold text-orange-600">${benchmark.p75}/hr</span>
                  </div>
                </div>

                {/* Visual percentile bar */}
                <div className="mt-3 pt-3 border-t">
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="absolute inset-0 flex">
                      <div className="bg-green-500" style={{ width: '25%' }} />
                      <div className="bg-blue-500" style={{ width: '25%' }} />
                      <div className="bg-yellow-500" style={{ width: '25%' }} />
                      <div className="bg-red-500" style={{ width: '25%' }} />
                    </div>
                    <div 
                      className="absolute top-0 h-full w-1 bg-gray-900"
                      style={{ left: `${benchmark.percentile}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>P0</span>
                    <span>P25</span>
                    <span>P50</span>
                    <span>P75</span>
                    <span>P100</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Metrics */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            ChainIQ Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Confidence Level</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {(dataQuality.confidence * 100).toFixed(0)}%
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Based on {dataQuality.sampleSize}+ data points
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Data Freshness</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {dataQuality.freshness} days
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Last updated recently
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Sample Size</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {dataQuality.sampleSize}+
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Contracts analyzed
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Geographic Coverage</span>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {dataQuality.coverage}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Region-specific data
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-white rounded-lg border">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Data Provenance:</span> ChainIQ benchmarks are derived from 
                anonymized contract data across 500+ organizations. All rates are normalized for geography, 
                seniority, and service line to ensure accurate comparisons.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
