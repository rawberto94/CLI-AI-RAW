'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Lightbulb, 
  Plus, 
  Trash2, 
  Edit2, 
  Copy, 
  Download, 
  Share2,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign
} from 'lucide-react'
import type { RoleRate, Geography } from '@/lib/use-cases/enhanced-rate-benchmarking-data'

interface Scenario {
  id: string
  name: string
  description: string
  assumptions: {
    volumeDiscount: number // percentage
    offshoreRatio: number // 0-100
    rateAdjustment: number // percentage
    customRates?: Map<string, number>
  }
  results: {
    totalCost: number
    savings: number
    savingsPercent: number
    qualityScore: number
    riskScore: number
  }
}

interface ScenarioModelingProps {
  selectedRoles: RoleRate[]
  geography: Geography
}

export function ScenarioModeling({ selectedRoles, geography }: ScenarioModelingProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: 'baseline',
      name: 'Current State',
      description: 'Existing rates and configuration',
      assumptions: {
        volumeDiscount: 0,
        offshoreRatio: 0,
        rateAdjustment: 0
      },
      results: {
        totalCost: 0,
        savings: 0,
        savingsPercent: 0,
        qualityScore: 85,
        riskScore: 20
      }
    }
  ])

  const [editingScenario, setEditingScenario] = useState<string | null>(null)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [newScenarioDescription, setNewScenarioDescription] = useState('')
  const [volumeDiscount, setVolumeDiscount] = useState(0)
  const [offshoreRatio, setOffshoreRatio] = useState(0)
  const [rateAdjustment, setRateAdjustment] = useState(0)

  // Calculate baseline cost
  const baselineCost = useMemo(() => {
    return selectedRoles.reduce((sum, role) => {
      const annualCost = role.hourlyRate * (role.fteCount || 1) * 2080
      return sum + annualCost
    }, 0)
  }, [selectedRoles])

  // Calculate scenario results
  const calculateScenarioResults = (assumptions: Scenario['assumptions']) => {
    let totalCost = 0
    
    selectedRoles.forEach(role => {
      const baseRate = role.hourlyRate
      const hours = (role.fteCount || 1) * 2080
      
      // Apply rate adjustment
      let adjustedRate = baseRate * (1 + assumptions.rateAdjustment / 100)
      
      // Apply volume discount
      adjustedRate = adjustedRate * (1 - assumptions.volumeDiscount / 100)
      
      // Apply offshore ratio (offshore is typically 40% cheaper)
      const onshoreRatio = (100 - assumptions.offshoreRatio) / 100
      const offshoreRatio = assumptions.offshoreRatio / 100
      const blendedRate = (adjustedRate * onshoreRatio) + (adjustedRate * 0.6 * offshoreRatio)
      
      totalCost += blendedRate * hours
    })

    const savings = baselineCost - totalCost
    const savingsPercent = baselineCost > 0 ? (savings / baselineCost) * 100 : 0

    // Quality score decreases with offshore ratio
    const qualityScore = Math.max(60, 85 - (assumptions.offshoreRatio * 0.25))
    
    // Risk score increases with offshore ratio and aggressive discounts
    const riskScore = Math.min(80, 20 + (assumptions.offshoreRatio * 0.3) + (assumptions.volumeDiscount * 0.5))

    return {
      totalCost,
      savings,
      savingsPercent,
      qualityScore: Math.round(qualityScore),
      riskScore: Math.round(riskScore)
    }
  }

  // Update baseline scenario
  React.useEffect(() => {
    setScenarios(prev => {
      const updated = [...prev]
      const baselineIndex = updated.findIndex(s => s.id === 'baseline')
      if (baselineIndex >= 0) {
        updated[baselineIndex] = {
          ...updated[baselineIndex],
          results: {
            totalCost: baselineCost,
            savings: 0,
            savingsPercent: 0,
            qualityScore: 85,
            riskScore: 20
          }
        }
      }
      return updated
    })
  }, [baselineCost])

  // Create new scenario
  const createScenario = () => {
    if (!newScenarioName.trim()) return

    const assumptions = {
      volumeDiscount,
      offshoreRatio,
      rateAdjustment
    }

    const results = calculateScenarioResults(assumptions)

    const newScenario: Scenario = {
      id: Date.now().toString(),
      name: newScenarioName,
      description: newScenarioDescription,
      assumptions,
      results
    }

    setScenarios(prev => [...prev, newScenario])
    
    // Reset form
    setNewScenarioName('')
    setNewScenarioDescription('')
    setVolumeDiscount(0)
    setOffshoreRatio(0)
    setRateAdjustment(0)
  }

  // Delete scenario
  const deleteScenario = (id: string) => {
    if (id === 'baseline') return
    setScenarios(prev => prev.filter(s => s.id !== id))
  }

  // Duplicate scenario
  const duplicateScenario = (scenario: Scenario) => {
    const newScenario: Scenario = {
      ...scenario,
      id: Date.now().toString(),
      name: `${scenario.name} (Copy)`
    }
    setScenarios(prev => [...prev, newScenario])
  }

  // Find optimal scenario
  const optimalScenario = useMemo(() => {
    if (scenarios.length <= 1) return null
    
    // Score based on savings, quality, and risk
    const scored = scenarios
      .filter(s => s.id !== 'baseline')
      .map(s => ({
        scenario: s,
        score: (s.results.savingsPercent * 0.5) + (s.results.qualityScore * 0.3) - (s.results.riskScore * 0.2)
      }))
      .sort((a, b) => b.score - a.score)
    
    return scored[0]?.scenario || null
  }, [scenarios])

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${Math.round(value)}`
  }

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-100'
    if (score >= 70) return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-700 bg-green-100'
    if (score <= 50) return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  return (
    <div className="space-y-6">
      {/* Scenario Builder */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            Create New Scenario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scenario Name *
                </label>
                <Input
                  placeholder="e.g., Aggressive Offshore Mix"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  placeholder="Brief description of this scenario"
                  value={newScenarioDescription}
                  onChange={(e) => setNewScenarioDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Volume Discount (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  value={volumeDiscount}
                  onChange={(e) => setVolumeDiscount(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Typical range: 5-15%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Offshore Ratio (%)
                </label>
                <div className="space-y-2">
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={offshoreRatio}
                    onChange={(e) => setOffshoreRatio(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>0% (All Onshore)</span>
                    <span className="font-semibold">{offshoreRatio}%</span>
                    <span>100% (All Offshore)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Adjustment (%)
                </label>
                <Input
                  type="number"
                  min="-50"
                  max="50"
                  step="1"
                  value={rateAdjustment}
                  onChange={(e) => setRateAdjustment(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Negative for reduction
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={createScenario}
                disabled={!newScenarioName.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Scenario
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Comparison Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-blue-600" />
              Scenario Comparison
            </span>
            {optimalScenario && (
              <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Optimal: {optimalScenario.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Scenario</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Cost</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Savings</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Quality</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Risk</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Assumptions</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(scenario => (
                  <tr
                    key={scenario.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      scenario.id === optimalScenario?.id ? 'bg-green-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {scenario.name}
                          {scenario.id === 'baseline' && (
                            <Badge variant="outline" className="text-xs">Baseline</Badge>
                          )}
                          {scenario.id === optimalScenario?.id && scenario.id !== 'baseline' && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Recommended
                            </Badge>
                          )}
                        </div>
                        {(scenario.description.length > 0) && (
                          <div className="text-sm text-gray-600">{scenario.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold">
                      {formatCurrency(scenario.results.totalCost)}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="font-semibold text-green-700">
                        {formatCurrency(scenario.results.savings)}
                      </div>
                      <div className="text-xs text-green-600">
                        {scenario.results.savingsPercent.toFixed(1)}%
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge className={getQualityColor(scenario.results.qualityScore)}>
                        {scenario.results.qualityScore}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge className={getRiskColor(scenario.results.riskScore)}>
                        {scenario.results.riskScore}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-600 space-y-1">
                        {scenario.assumptions.volumeDiscount > 0 && (
                          <div>Vol Disc: {scenario.assumptions.volumeDiscount}%</div>
                        )}
                        {scenario.assumptions.offshoreRatio > 0 && (
                          <div>Offshore: {scenario.assumptions.offshoreRatio}%</div>
                        )}
                        {scenario.assumptions.rateAdjustment !== 0 && (
                          <div>Rate Adj: {scenario.assumptions.rateAdjustment > 0 ? '+' : ''}{scenario.assumptions.rateAdjustment}%</div>
                        )}
                        {scenario.assumptions.volumeDiscount === 0 && 
                         scenario.assumptions.offshoreRatio === 0 && 
                         scenario.assumptions.rateAdjustment === 0 && (
                          <div className="text-gray-400">No adjustments</div>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {scenario.id !== 'baseline' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => duplicateScenario(scenario)}
                              title="Duplicate"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteScenario(scenario.id)}
                              title="Delete"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Scenario Cards */}
      {scenarios.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.filter(s => s.id !== 'baseline').map(scenario => (
            <Card
              key={scenario.id}
              className={`${
                scenario.id === optimalScenario?.id
                  ? 'border-2 border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{scenario.name}</span>
                  {scenario.id === optimalScenario?.id && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Cost:</span>
                      <span className="font-semibold">{formatCurrency(scenario.results.totalCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Savings:</span>
                      <span className="font-semibold text-green-700">
                        {formatCurrency(scenario.results.savings)} ({scenario.results.savingsPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Quality Score:</span>
                      <Badge className={getQualityColor(scenario.results.qualityScore)}>
                        {scenario.results.qualityScore}/100
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Risk Score:</span>
                      <Badge className={getRiskColor(scenario.results.riskScore)}>
                        {scenario.results.riskScore}/100
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Assumptions:</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div>• Volume Discount: {scenario.assumptions.volumeDiscount}%</div>
                      <div>• Offshore Ratio: {scenario.assumptions.offshoreRatio}%</div>
                      <div>• Rate Adjustment: {scenario.assumptions.rateAdjustment > 0 ? '+' : ''}{scenario.assumptions.rateAdjustment}%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Export Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">
          <Share2 className="w-4 h-4 mr-2" />
          Share Scenarios
        </Button>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export to PDF
        </Button>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <DollarSign className="w-4 h-4 mr-2" />
          Generate Business Case
        </Button>
      </div>
    </div>
  )
}
