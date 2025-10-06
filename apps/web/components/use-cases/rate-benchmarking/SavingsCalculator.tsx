'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calculator, TrendingDown, DollarSign, Users, AlertCircle, Download, Plus } from 'lucide-react'
import type { RoleRate, Geography } from '@/lib/use-cases/enhanced-rate-benchmarking-data'

interface VolumeInput {
  roleId: string
  roleName: string
  currentRate: number
  chainIQBenchmark: number
  annualHours: number
  fteCount: number
}

interface SavingsScenario {
  name: string
  targetRate: number
  percentile: string
  description: string
}

interface SavingsCalculatorProps {
  selectedRoles: RoleRate[]
  geography: Geography
}

const FTE_PRESETS = [
  { label: '0.5 FTE', hours: 1040 },
  { label: '1 FTE', hours: 2080 },
  { label: '2 FTE', hours: 4160 },
  { label: '5 FTE', hours: 10400 }
]

export function SavingsCalculator({ selectedRoles, geography }: SavingsCalculatorProps) {
  const [volumeInputs, setVolumeInputs] = useState<Map<string, VolumeInput>>(
    new Map(
      selectedRoles.map(role => [
        role.id,
        {
          roleId: role.id,
          roleName: role.role,
          currentRate: role.hourlyRate,
          chainIQBenchmark: role.chainIQBenchmark,
          annualHours: role.fteCount ? role.fteCount * 2080 : 2080,
          fteCount: role.fteCount || 1
        }
      ])
    )
  )

  const [portfolioContracts, setPortfolioContracts] = useState<Array<{
    id: string
    name: string
    totalSavings: number
  }>>([])

  // Update volume for a specific role
  const updateVolume = useCallback((roleId: string, field: 'annualHours' | 'fteCount', value: number) => {
    setVolumeInputs(prev => {
      const newMap = new Map(prev)
      const input = newMap.get(roleId)
      if (input) {
        if (field === 'fteCount') {
          input.fteCount = value
          input.annualHours = value * 2080
        } else {
          input.annualHours = value
          input.fteCount = Math.round((value / 2080) * 10) / 10
        }
        newMap.set(roleId, { ...input })
      }
      return newMap
    })
  }, [])

  // Apply FTE preset
  const applyPreset = useCallback((roleId: string, hours: number) => {
    updateVolume(roleId, 'annualHours', hours)
  }, [updateVolume])

  // Calculate savings scenarios
  const savingsAnalysis = useMemo(() => {
    const results = Array.from(volumeInputs.values()).map(input => {
      const currentAnnualCost = input.currentRate * input.annualHours
      
      // Scenario 1: ChainIQ Benchmark (P50)
      const benchmarkRate = input.chainIQBenchmark
      const benchmarkCost = benchmarkRate * input.annualHours
      const benchmarkSavings = currentAnnualCost - benchmarkCost
      const benchmarkPercent = currentAnnualCost > 0 ? (benchmarkSavings / currentAnnualCost) * 100 : 0

      // Scenario 2: P25 (Best in Class)
      const p25Rate = Math.round(input.chainIQBenchmark * 0.85)
      const p25Cost = p25Rate * input.annualHours
      const p25Savings = currentAnnualCost - p25Cost
      const p25Percent = currentAnnualCost > 0 ? (p25Savings / currentAnnualCost) * 100 : 0

      // Scenario 3: P10 (Aggressive Target)
      const p10Rate = Math.round(input.chainIQBenchmark * 0.75)
      const p10Cost = p10Rate * input.annualHours
      const p10Savings = currentAnnualCost - p10Cost
      const p10Percent = currentAnnualCost > 0 ? (p10Savings / currentAnnualCost) * 100 : 0

      // Negotiation gap
      const negotiationGap = input.currentRate - benchmarkRate
      const negotiationGapPercent = input.currentRate > 0 ? (negotiationGap / input.currentRate) * 100 : 0

      // Priority flag
      const isPriority = benchmarkSavings > 50000

      return {
        roleId: input.roleId,
        roleName: input.roleName,
        currentRate: input.currentRate,
        currentAnnualCost,
        fteCount: input.fteCount,
        annualHours: input.annualHours,
        scenarios: [
          {
            name: 'ChainIQ Benchmark',
            targetRate: benchmarkRate,
            percentile: 'P50',
            description: 'Market median rate',
            annualCost: benchmarkCost,
            savings: benchmarkSavings,
            savingsPercent: benchmarkPercent
          },
          {
            name: 'Best in Class',
            targetRate: p25Rate,
            percentile: 'P25',
            description: 'Top quartile performance',
            annualCost: p25Cost,
            savings: p25Savings,
            savingsPercent: p25Percent
          },
          {
            name: 'Aggressive Target',
            targetRate: p10Rate,
            percentile: 'P10',
            description: 'Exceptional negotiation',
            annualCost: p10Cost,
            savings: p10Savings,
            savingsPercent: p10Percent
          }
        ],
        negotiationGap,
        negotiationGapPercent,
        isPriority
      }
    })

    // Sort by savings potential (ChainIQ benchmark scenario)
    results.sort((a, b) => b.scenarios[0].savings - a.scenarios[0].savings)

    // Calculate totals
    const totalCurrentCost = results.reduce((sum, r) => sum + r.currentAnnualCost, 0)
    const totalBenchmarkSavings = results.reduce((sum, r) => sum + r.scenarios[0].savings, 0)
    const totalP25Savings = results.reduce((sum, r) => sum + r.scenarios[1].savings, 0)
    const totalP10Savings = results.reduce((sum, r) => sum + r.scenarios[2].savings, 0)

    return {
      roles: results,
      totals: {
        currentCost: totalCurrentCost,
        benchmarkSavings: totalBenchmarkSavings,
        p25Savings: totalP25Savings,
        p10Savings: totalP10Savings,
        benchmarkPercent: totalCurrentCost > 0 ? (totalBenchmarkSavings / totalCurrentCost) * 100 : 0,
        p25Percent: totalCurrentCost > 0 ? (totalP25Savings / totalCurrentCost) * 100 : 0,
        p10Percent: totalCurrentCost > 0 ? (totalP10Savings / totalCurrentCost) * 100 : 0
      }
    }
  }, [volumeInputs])

  // ROI Calculator
  const roiAnalysis = useMemo(() => {
    const implementationCost = 50000 // Estimated implementation cost
    const annualSavings = savingsAnalysis.totals.benchmarkSavings

    const roi1Year = annualSavings - implementationCost
    const roi3Year = (annualSavings * 3) - implementationCost
    const roi5Year = (annualSavings * 5) - implementationCost

    const paybackMonths = implementationCost > 0 && annualSavings > 0
      ? Math.ceil((implementationCost / annualSavings) * 12)
      : 0

    return {
      implementationCost,
      annualSavings,
      roi1Year,
      roi3Year,
      roi5Year,
      paybackMonths,
      roi1YearPercent: implementationCost > 0 ? (roi1Year / implementationCost) * 100 : 0,
      roi3YearPercent: implementationCost > 0 ? (roi3Year / implementationCost) * 100 : 0,
      roi5YearPercent: implementationCost > 0 ? (roi5Year / implementationCost) * 100 : 0
    }
  }, [savingsAnalysis])

  // Add to portfolio
  const addToPortfolio = useCallback(() => {
    const contractName = `Contract ${portfolioContracts.length + 1}`
    setPortfolioContracts(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: contractName,
        totalSavings: savingsAnalysis.totals.benchmarkSavings
      }
    ])
  }, [portfolioContracts.length, savingsAnalysis.totals.benchmarkSavings])

  // Portfolio totals
  const portfolioTotal = useMemo(() => {
    return portfolioContracts.reduce((sum, contract) => sum + contract.totalSavings, 0)
  }, [portfolioContracts])

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${Math.round(value)}`
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Annual Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(savingsAnalysis.totals.currentCost)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ChainIQ Savings</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(savingsAnalysis.totals.benchmarkSavings)}
                </p>
                <p className="text-xs text-green-600">
                  {savingsAnalysis.totals.benchmarkPercent.toFixed(1)}% reduction
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Best in Class (P25)</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(savingsAnalysis.totals.p25Savings)}
                </p>
                <p className="text-xs text-purple-600">
                  {savingsAnalysis.totals.p25Percent.toFixed(1)}% reduction
                </p>
              </div>
              <Calculator className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total FTEs</p>
                <p className="text-2xl font-bold text-orange-700">
                  {Array.from(volumeInputs.values()).reduce((sum, v) => sum + v.fteCount, 0).toFixed(1)}
                </p>
                <p className="text-xs text-orange-600">
                  {volumeInputs.size} roles
                </p>
              </div>
              <Users className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Volume Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from(volumeInputs.values()).map(input => (
              <div key={input.roleId} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{input.roleName}</h4>
                    <p className="text-sm text-gray-600">
                      Current: ${input.currentRate}/hr • ChainIQ: ${input.chainIQBenchmark}/hr
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      FTE Count
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={input.fteCount}
                      onChange={(e) => updateVolume(input.roleId, 'fteCount', parseFloat(e.target.value) || 0)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Annual Hours
                    </label>
                    <Input
                      type="number"
                      step="100"
                      min="0"
                      value={input.annualHours}
                      onChange={(e) => updateVolume(input.roleId, 'annualHours', (parseInt(e.target.value) !== 0) || 0)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quick Presets
                    </label>
                    <div className="flex gap-2">
                      {FTE_PRESETS.map(preset => (
                        <Button
                          key={preset.label}
                          size="sm"
                          variant="outline"
                          onClick={() => applyPreset(input.roleId, preset.hours)}
                          className="text-xs"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-600">
                    Current Annual Spend: <span className="font-semibold text-gray-900">
                      {formatCurrency(input.currentRate * input.annualHours)}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Savings Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" />
            Savings Scenarios by Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {savingsAnalysis.roles.map(role => (
              <div key={role.roleId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      {role.roleName}
                      {role.isPriority && (
                        <Badge className="bg-red-100 text-red-700 border-red-300">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          High Priority
                        </Badge>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {role.fteCount} FTE • {role.annualHours} hours/year
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Negotiation Gap</p>
                    <p className="text-lg font-semibold text-orange-600">
                      ${role.negotiationGap}/hr ({role.negotiationGapPercent.toFixed(1)}%)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {role.scenarios.map((scenario, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-2 ${
                        idx === 0
                          ? 'bg-blue-50 border-blue-300'
                          : idx === 1
                          ? 'bg-green-50 border-green-300'
                          : 'bg-purple-50 border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">
                          {scenario.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {scenario.percentile}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">
                          Target Rate: <span className="font-medium">${scenario.targetRate}/hr</span>
                        </p>
                        <p className="text-lg font-bold text-green-700">
                          {formatCurrency(scenario.savings)}
                        </p>
                        <p className="text-xs text-green-600">
                          {scenario.savingsPercent.toFixed(1)}% savings
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ROI Calculator */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            ROI & Payback Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Investment</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Implementation Cost:</span>
                  <span className="font-semibold">{formatCurrency(roiAnalysis.implementationCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Annual Savings:</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(roiAnalysis.annualSavings)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-900 font-semibold">Payback Period:</span>
                  <span className="font-bold text-indigo-700">
                    {roiAnalysis.paybackMonths} months
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Return on Investment</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">1 Year ROI:</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(roiAnalysis.roi1Year)} ({roiAnalysis.roi1YearPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">3 Year ROI:</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(roiAnalysis.roi3Year)} ({roiAnalysis.roi3YearPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">5 Year ROI:</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(roiAnalysis.roi5Year)} ({roiAnalysis.roi5YearPercent.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Aggregation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Portfolio Aggregation
            </span>
            <Button onClick={addToPortfolio} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add to Portfolio
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioContracts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No contracts in portfolio. Add this analysis to start building your portfolio view.
            </p>
          ) : (
            <div className="space-y-3">
              {portfolioContracts.map(contract => (
                <div key={contract.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">{contract.name}</span>
                  <span className="text-green-700 font-semibold">
                    {formatCurrency(contract.totalSavings)} savings
                  </span>
                </div>
              ))}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">Portfolio Total:</span>
                  <span className="text-2xl font-bold text-green-700">
                    {formatCurrency(portfolioTotal + savingsAnalysis.totals.benchmarkSavings)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Analysis
        </Button>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Calculator className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </div>
    </div>
  )
}
