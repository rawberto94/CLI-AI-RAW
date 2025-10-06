'use client'

import React, { useState, useMemo } from 'react'
import { 
  TargetRateCalculator as Calculator, 
  TargetRateConfig,
  TargetRateUtils,
  SavingsProjection
} from '@/lib/use-cases/target-rate-calculator'
import { TargetRates } from '@/lib/use-cases/rate-history-types'
import { RateCardRole } from '@/lib/use-cases/multi-client-rate-data'
import { formatCHF } from '@/lib/use-cases/rate-normalizer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Target, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  DollarSign,
  BarChart3
} from 'lucide-react'

interface TargetRateCalculatorProps {
  role: string
  level: string
  location: string
  supplier: string
  currentRate: number
  annualVolume?: number
  marketData: RateCardRole[]
  onSelectTarget?: (targetRate: number, scenario: 'aggressive' | 'moderate' | 'conservative') => void
}

export function TargetRateCalculatorComponent({
  role,
  level,
  location,
  supplier,
  currentRate,
  annualVolume = 220,
  marketData,
  onSelectTarget
}: TargetRateCalculatorProps) {
  const [selectedScenario, setSelectedScenario] = useState<'aggressive' | 'moderate' | 'conservative'>('moderate')
  const [customVolume, setCustomVolume] = useState(annualVolume)
  
  // Calculate target rates
  const config: TargetRateConfig = {
    role,
    level,
    location,
    currentRate,
    annualVolume: customVolume,
    marketData
  }
  
  const targetRates = useMemo(() => Calculator.calculateTargetRates(config), [config])
  const projections = useMemo(() => Calculator.calculateSavingsProjections(config, targetRates), [config, targetRates])
  
  // Calculate market position
  const matchingRates = marketData
    .filter(r => r.role === role && r.level === level && r.location === location)
    .map(r => r.dailyRateCHF)
  
  const marketPercentile = matchingRates.length > 0
    ? Math.round((matchingRates.filter(r => r > currentRate).length / matchingRates.length) * 100)
    : 50
  
  const strategy = Calculator.recommendStrategy(currentRate, marketPercentile)
  
  // Render scenario card
  const renderScenarioCard = (
    scenario: 'aggressive' | 'moderate' | 'conservative',
    projection: SavingsProjection,
    title: string,
    description: string
  ) => {
    const isSelected = selectedScenario === scenario
    const riskBadge = TargetRateUtils.getRiskBadge(projection.riskLevel)
    const probBadge = TargetRateUtils.getProbabilityBadge(projection.probability)
    const expectedValue = TargetRateUtils.calculateExpectedValue(projection)
    
    return (
      <div
        key={scenario}
        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-blue-300'
        }`}
        onClick={() => setSelectedScenario(scenario)}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-lg">{title}</h4>
          {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
        </div>
        
        <p className="text-sm text-gray-600 mb-3">{description}</p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Target Rate:</span>
            <span className="font-bold text-lg text-blue-600">
              {formatCHF(projection.targetRate, { decimals: 0 })}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Annual Savings:</span>
            <span className="font-bold text-green-600">
              {formatCHF(projection.annualSavings, { decimals: 0 })}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Savings %:</span>
            <span className="font-semibold text-green-600">
              {projection.savingsPercentage.toFixed(1)}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Expected Value:</span>
            <span className="font-semibold">
              {formatCHF(expectedValue, { decimals: 0 })}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-3">
          <Badge className={riskBadge.className}>{riskBadge.label}</Badge>
          <Badge className={probBadge.className}>{probBadge.label}</Badge>
        </div>
      </div>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <CardTitle>Target Rate Calculator</CardTitle>
          </div>
          <Badge className="bg-blue-100 text-blue-800">
            {supplier}
          </Badge>
        </div>
        
        <div className="text-sm text-gray-600">
          {role} • {level} • {location}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Rate & Market Position */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Current Rate</span>
              <div className="text-2xl font-bold text-gray-900">
                {formatCHF(currentRate, { decimals: 0 })}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Market Position</span>
              <div className="text-2xl font-bold text-blue-600">
                {marketPercentile}th percentile
              </div>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-white rounded border border-blue-200">
            <div className="flex items-start gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-blue-900">
                  Recommended Strategy: {strategy.strategy.charAt(0).toUpperCase() + strategy.strategy.slice(1)}
                </div>
                <div className="text-sm text-gray-600">{strategy.reasoning}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Annual Volume Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annual Volume (person-days)
          </label>
          <input
            type="number"
            value={customVolume}
            onChange={(e) => setCustomVolume(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="365"
          />
          <p className="text-xs text-gray-500 mt-1">
            Typical: 220 days/year for full-time contractor
          </p>
        </div>
        
        {/* Market Benchmarks */}
        <div>
          <h4 className="font-semibold mb-3">Market Benchmarks</h4>
          <div className="grid grid-cols-5 gap-2 text-sm">
            {[
              { label: 'P10', value: targetRates.market.p10 },
              { label: 'P25', value: targetRates.market.p25 },
              { label: 'P50', value: targetRates.market.p50 },
              { label: 'P75', value: targetRates.market.p75 },
              { label: 'P90', value: targetRates.market.p90 }
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-600">{label}</div>
                <div className="font-semibold">{formatCHF(value, { decimals: 0, showCurrency: false })}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Negotiation Scenarios */}
        <div>
          <h4 className="font-semibold mb-3">Negotiation Scenarios</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderScenarioCard(
              'aggressive',
              projections.aggressive,
              'Aggressive',
              'Target bottom 10% of market. High savings, lower probability.'
            )}
            {renderScenarioCard(
              'moderate',
              projections.moderate,
              'Moderate',
              'Target bottom 25% of market. Balanced approach.'
            )}
            {renderScenarioCard(
              'conservative',
              projections.conservative,
              'Conservative',
              'Target median rate. Safe, high probability.'
            )}
          </div>
        </div>
        
        {/* Walk-Away Threshold */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900">Walk-Away Threshold</h4>
              <p className="text-sm text-red-700 mt-1">
                If you cannot achieve a rate below {formatCHF(targetRates.targets.walkAway, { decimals: 0 })}, 
                consider alternative suppliers. This represents a 30% reduction from current rate.
              </p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        {onSelectTarget && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => onSelectTarget(
                projections[selectedScenario].targetRate,
                selectedScenario
              )}
              className="flex-1"
            >
              <Target className="w-4 h-4 mr-2" />
              Use {selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)} Target
            </Button>
            <Button variant="outline">
              <DollarSign className="w-4 h-4 mr-2" />
              Export Analysis
            </Button>
          </div>
        )}
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-green-50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-green-700">Best Case Savings</div>
            <div className="text-xl font-bold text-green-900">
              {formatCHF(projections.aggressive.annualSavings, { decimals: 0 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-green-700">Likely Savings</div>
            <div className="text-xl font-bold text-green-900">
              {formatCHF(projections.moderate.annualSavings, { decimals: 0 })}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-green-700">Safe Savings</div>
            <div className="text-xl font-bold text-green-900">
              {formatCHF(projections.conservative.annualSavings, { decimals: 0 })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
