'use client'

import React, { useState } from 'react'
import { NegotiationScenario } from '@/lib/use-cases/rate-history-types'
import { 
  ScenarioModeler, 
  ScenarioConfig,
  ScenarioUtils,
  TradeOffAnalysis
} from '@/lib/use-cases/scenario-modeling'
import { formatCHF } from '@/lib/use-cases/rate-normalizer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  GitCompare, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  DollarSign,
  BarChart3,
  Lightbulb
} from 'lucide-react'

interface ScenarioComparisonProps {
  currentRate: number
  annualVolume: number
  marketPercentiles?: { p10: number; p25: number; p50: number }
  onSelectScenario?: (scenario: NegotiationScenario) => void
}

export function ScenarioComparisonComponent({
  currentRate,
  annualVolume,
  marketPercentiles,
  onSelectScenario
}: ScenarioComparisonProps) {
  // Initialize with standard scenarios if market data available
  const [scenarios, setScenarios] = useState<NegotiationScenario[]>(() => {
    if (marketPercentiles) {
      return ScenarioModeler.generateStandardScenarios(
        currentRate,
        annualVolume,
        marketPercentiles
      )
    }
    return []
  })
  
  const [showAddScenario, setShowAddScenario] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [newScenarioRate, setNewScenarioRate] = useState(currentRate * 0.9)
  const [newScenarioProbability, setNewScenarioProbability] = useState(0.5)
  
  // Compare scenarios
  const comparison = scenarios.length > 0 
    ? ScenarioModeler.compareScenarios(scenarios)
    : null
  
  // Add new scenario
  const handleAddScenario = () => {
    if (!newScenarioName.trim()) return
    
    const config: ScenarioConfig = {
      name: newScenarioName,
      targetRate: newScenarioRate,
      probability: newScenarioProbability,
      annualVolume,
      currentRate
    }
    
    const newScenario = ScenarioModeler.createScenario(config)
    setScenarios([...scenarios, newScenario])
    
    // Reset form
    setNewScenarioName('')
    setNewScenarioRate(currentRate * 0.9)
    setNewScenarioProbability(0.5)
    setShowAddScenario(false)
  }
  
  // Remove scenario
  const handleRemoveScenario = (id: string) => {
    setScenarios(scenarios.filter(s => s.id !== id))
  }
  
  // Render scenario card
  const renderScenarioCard = (scenario: NegotiationScenario, analysis?: TradeOffAnalysis) => {
    const isRecommended = analysis?.recommendation === 'recommended'
    const isNotRecommended = analysis?.recommendation === 'not_recommended'
    
    return (
      <div
        key={scenario.id}
        className={`p-4 rounded-lg border-2 ${
          isRecommended 
            ? 'border-green-300 bg-green-50' 
            : isNotRecommended
            ? 'border-red-300 bg-red-50'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-lg">{scenario.name}</h4>
            {analysis && (
              <Badge className={ScenarioUtils.getRecommendationBadge(analysis.recommendation).className}>
                {ScenarioUtils.getRecommendationBadge(analysis.recommendation).label}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveScenario(scenario.id)}
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-sm text-gray-600">Target Rate</span>
              <div className="text-xl font-bold text-blue-600">
                {formatCHF(scenario.targetRate, { decimals: 0 })}
              </div>
              <div className="text-xs text-gray-500">
                {scenario.savingsPercentage.toFixed(1)}% reduction
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Annual Savings</span>
              <div className="text-xl font-bold text-green-600">
                {formatCHF(scenario.savings, { decimals: 0 })}
              </div>
              <div className="text-xs text-gray-500">
                {(scenario.probability * 100).toFixed(0)}% probability
              </div>
            </div>
          </div>
          
          {/* Probability Bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Success Probability</span>
              <span className="font-semibold">{(scenario.probability * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  scenario.probability > 0.7 ? 'bg-green-600' :
                  scenario.probability > 0.4 ? 'bg-yellow-600' :
                  'bg-red-600'
                }`}
                style={{ width: `${scenario.probability * 100}%` }}
              />
            </div>
          </div>
          
          {/* Trade-off Analysis */}
          {analysis && (
            <div className="space-y-2 text-sm">
              {/* Score */}
              <div className="flex items-center justify-between p-2 bg-white rounded">
                <span className="font-medium">Overall Score</span>
                <span className={`text-lg font-bold ${ScenarioUtils.getScoreColor(analysis.score)}`}>
                  {analysis.score}/100
                </span>
              </div>
              
              {/* Pros */}
              {analysis.pros.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-green-700 font-medium mb-1">
                    <CheckCircle className="w-4 h-4" />
                    Advantages
                  </div>
                  <ul className="space-y-1 ml-5">
                    {analysis.pros.map((pro, i) => (
                      <li key={i} className="text-gray-700 text-xs">• {pro}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Cons */}
              {analysis.cons.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-red-700 font-medium mb-1">
                    <XCircle className="w-4 h-4" />
                    Disadvantages
                  </div>
                  <ul className="space-y-1 ml-5">
                    {analysis.cons.map((con, i) => (
                      <li key={i} className="text-gray-700 text-xs">• {con}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Risk Factors */}
              {analysis.riskFactors.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-orange-700 font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Risk Factors
                  </div>
                  <ul className="space-y-1 ml-5">
                    {analysis.riskFactors.map((risk, i) => (
                      <li key={i} className="text-gray-700 text-xs">• {risk}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Notes */}
          {scenario.notes && (
            <div className="text-xs text-gray-600 italic p-2 bg-gray-50 rounded">
              {scenario.notes}
            </div>
          )}
          
          {/* Action Button */}
          {onSelectScenario && (
            <Button
              onClick={() => onSelectScenario(scenario)}
              className="w-full"
              variant={isRecommended ? 'default' : 'outline'}
            >
              <Target className="w-4 h-4 mr-2" />
              Select This Scenario
            </Button>
          )}
        </div>
      </div>
    )
  }
  
  if (scenarios.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-blue-600" />
            Scenario Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <GitCompare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 mb-4">No scenarios to compare yet</p>
            <Button onClick={() => setShowAddScenario(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Scenario
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Generate trade-off analyses
  const analyses = scenarios.map(scenario => 
    ScenarioModeler.analyzeTradeOffs(scenario, currentRate)
  )
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-blue-600" />
            <CardTitle>Scenario Comparison</CardTitle>
            <Badge variant="outline">{scenarios.length} scenarios</Badge>
          </div>
          <Button onClick={() => setShowAddScenario(!showAddScenario)} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Scenario
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add Scenario Form */}
        {showAddScenario && (
          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg space-y-3">
            <h4 className="font-semibold">Create New Scenario</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scenario Name
              </label>
              <input
                type="text"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="e.g., Optimistic, Realistic, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Rate (CHF/day)
              </label>
              <input
                type="number"
                value={newScenarioRate}
                onChange={(e) => setNewScenarioRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current rate: {formatCHF(currentRate, { decimals: 0 })}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Success Probability: {(newScenarioProbability * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={newScenarioProbability}
                onChange={(e) => setNewScenarioProbability(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleAddScenario} className="flex-1">
                Create Scenario
              </Button>
              <Button onClick={() => setShowAddScenario(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {/* Comparison Summary */}
        {comparison && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-blue-700">Best Case</div>
              <div className="text-xl font-bold text-blue-900">
                {formatCHF(comparison.bestCase.savings, { decimals: 0 })}
              </div>
              <div className="text-xs text-blue-600">{comparison.bestCase.name}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-green-700">Most Likely</div>
              <div className="text-xl font-bold text-green-900">
                {formatCHF(comparison.mostLikely.savings, { decimals: 0 })}
              </div>
              <div className="text-xs text-green-600">{comparison.mostLikely.name}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-purple-700">Expected Value</div>
              <div className="text-xl font-bold text-purple-900">
                {formatCHF(comparison.expectedValue, { decimals: 0 })}
              </div>
              <div className="text-xs text-purple-600">Probability-weighted</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-orange-700">Risk Level</div>
              <div className="text-xl font-bold text-orange-900">
                {comparison.riskAssessment.level.toUpperCase()}
              </div>
              <Badge className={ScenarioUtils.getRiskBadge(comparison.riskAssessment.level).className}>
                {ScenarioUtils.getRiskBadge(comparison.riskAssessment.level).label}
              </Badge>
            </div>
          </div>
        )}
        
        {/* Risk Assessment */}
        {comparison && comparison.riskAssessment.factors.length > 0 && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-900 mb-2">Risk Factors</h4>
                <ul className="space-y-1 text-sm text-orange-800">
                  {comparison.riskAssessment.factors.map((factor, i) => (
                    <li key={i}>• {factor}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario, index) => 
            renderScenarioCard(scenario, analyses[index])
          )}
        </div>
        
        {/* Recommendations */}
        {comparison && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Recommendations</h4>
                <div className="space-y-2 text-sm text-green-800">
                  <p>
                    • Focus on the <strong>{comparison.mostLikely.name}</strong> scenario with {(comparison.mostLikely.probability * 100).toFixed(0)}% probability
                  </p>
                  <p>
                    • Expected value across all scenarios: <strong>{formatCHF(comparison.expectedValue, { decimals: 0 })}</strong>
                  </p>
                  {comparison.riskAssessment.level === 'low' && (
                    <p>• Low risk profile supports confident negotiation</p>
                  )}
                  {comparison.riskAssessment.level === 'high' && (
                    <p>• Consider focusing on more conservative scenarios to reduce risk</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
