'use client'

import React, { useMemo, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Download,
  Building2,
  Briefcase,
  Users,
  Globe
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ViewMode } from './BenchmarkConfigurationPanel'
import {
  allRateData,
  suppliers,
  type ServiceLine,
  type Geography
} from '@/lib/use-cases/enhanced-rate-benchmarking-data'

interface BenchmarkVisualizationProps {
  selectedSupplier: string | null
  selectedServiceLine: ServiceLine | null
  selectedRoles: string[]
  selectedGeography: Geography
  viewMode: ViewMode
  onExport?: () => void
}

export default function BenchmarkVisualization({
  selectedSupplier,
  selectedServiceLine,
  selectedRoles,
  selectedGeography,
  viewMode,
  onExport
}: BenchmarkVisualizationProps) {
  const [sortColumn, setSortColumn] = useState<string>('role')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter rates based on selections
  const filteredRates = useMemo(() => {
    return allRateData.filter(rate => {
      if (selectedSupplier !== null && rate.supplierId !== selectedSupplier) return false
      if (selectedServiceLine !== null && rate.serviceLine !== selectedServiceLine) return false
      if (selectedRoles.length > 0 && !selectedRoles.includes(rate.role)) return false
      if (rate.geography !== selectedGeography) return false
      return true
    })
  }, [selectedSupplier, selectedServiceLine, selectedRoles, selectedGeography])

  // Calculate benchmarks for each role
  const roleAnalysis = useMemo(() => {
    const analysis = new Map<string, {
      role: string
      yourRate: number
      chainIQBenchmark: number
      variance: number
      variancePercent: number
      status: 'above-market' | 'at-market' | 'below-market'
      annualSavings: number
      sampleSize: number
      confidence: number
      supplier: string
      geography: string
      serviceLine: string
    }>()

    selectedRoles.forEach(role => {
      const roleRates = filteredRates.filter(r => r.role === role)
      if (roleRates.length === 0) return

      const yourRate = roleRates[0]?.hourlyRate ?? 0
      const supplierName = roleRates[0] ? suppliers.find(s => s.id === roleRates[0].supplierId)?.name ?? 'Unknown' : 'Unknown'
      const allRatesForRole = allRateData.filter(
        r => r.role === role && r.geography === selectedGeography
      )
      
      const hourlyRates = allRatesForRole.map(r => r.hourlyRate).sort((a, b) => a - b)
      const chainIQBenchmark = hourlyRates[Math.floor(hourlyRates.length / 2)] ?? yourRate
      
      const variance = yourRate - chainIQBenchmark
      const variancePercent = chainIQBenchmark > 0 ? (variance / chainIQBenchmark) * 100 : 0
      
      const status: 'above-market' | 'at-market' | 'below-market' = 
        variancePercent > 5 ? 'above-market' :
        variancePercent < -5 ? 'below-market' : 'at-market'
      
      const annualSavings = status === 'above-market' ? variance * 2080 : 0

      analysis.set(role, {
        role,
        yourRate,
        chainIQBenchmark,
        variance,
        variancePercent,
        status,
        annualSavings,
        sampleSize: allRatesForRole.length,
        confidence: Math.min(0.99, 0.5 + (allRatesForRole.length / 100) * 0.5),
        supplier: supplierName,
        geography: selectedGeography,
        serviceLine: selectedServiceLine || 'All'
      })
    })

    return Array.from(analysis.values())
  }, [filteredRates, selectedRoles, selectedGeography])

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...roleAnalysis]
    sorted.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortColumn) {
        case 'role':
          aVal = a.role
          bVal = b.role
          break
        case 'yourRate':
          aVal = a.yourRate
          bVal = b.yourRate
          break
        case 'chainIQBenchmark':
          aVal = a.chainIQBenchmark
          bVal = b.chainIQBenchmark
          break
        case 'variance':
          aVal = a.variancePercent
          bVal = b.variancePercent
          break
        case 'savings':
          aVal = a.annualSavings
          bVal = b.annualSavings
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return sorted
  }, [roleAnalysis, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Calculate summary metrics
  const summary = useMemo(() => {
    const totalRoles = roleAnalysis.length
    const aboveMarket = roleAnalysis.filter(r => r.status === 'above-market').length
    const atMarket = roleAnalysis.filter(r => r.status === 'at-market').length
    const belowMarket = roleAnalysis.filter(r => r.status === 'below-market').length
    const totalSavings = roleAnalysis.reduce((sum, r) => sum + r.annualSavings, 0)
    const avgConfidence = roleAnalysis.length > 0
      ? roleAnalysis.reduce((sum, r) => sum + r.confidence, 0) / roleAnalysis.length
      : 0

    return {
      totalRoles,
      aboveMarket,
      atMarket,
      belowMarket,
      totalSavings,
      avgConfidence
    }
  }, [roleAnalysis])

  if (selectedRoles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Select Roles to Analyze
          </h3>
          <p className="text-gray-600">
            Choose one or more roles from the configuration panel to see benchmark analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {summary.totalRoles}
            </div>
            <div className="text-sm text-blue-700">Roles Analyzed</div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-600">
              {summary.aboveMarket}
            </div>
            <div className="text-sm text-red-700">Above Market</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-gray-600">
              {summary.atMarket}
            </div>
            <div className="text-sm text-gray-700">At Market</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              ${Math.round(summary.totalSavings / 1000)}K
            </div>
            <div className="text-sm text-green-700">Annual Savings</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {Math.round(summary.avgConfidence * 100)}%
            </div>
            <div className="text-sm text-purple-700">Confidence</div>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Indicator */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {viewMode === 'supplier' && <Building2 className="w-5 h-5 text-blue-600" />}
              {viewMode === 'service-line' && <Briefcase className="w-5 h-5 text-blue-600" />}
              {viewMode === 'seniority' && <TrendingUp className="w-5 h-5 text-blue-600" />}
              {viewMode === 'geography' && <Globe className="w-5 h-5 text-blue-600" />}
              <div>
                <div className="font-semibold text-gray-900">
                  {viewMode === 'supplier' && 'Supplier Comparison View'}
                  {viewMode === 'service-line' && 'Service Line Comparison View'}
                  {viewMode === 'seniority' && 'Seniority Level Comparison View'}
                  {viewMode === 'geography' && 'Geographic Comparison View'}
                </div>
                <div className="text-sm text-gray-600">
                  {selectedSupplier !== null
                    ? `${suppliers.find(s => s.id === selectedSupplier)?.name ?? 'Unknown'} • ${selectedGeography}`
                    : `All Suppliers • ${selectedGeography}`}
                </div>
              </div>
            </div>
            {onExport !== undefined && (
              <Button onClick={onExport} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Rate Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Detailed Rate Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4">
                    <button
                      onClick={() => handleSort('role')}
                      className="flex items-center gap-1 hover:text-blue-600 font-semibold"
                    >
                      Role
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <span className="font-semibold">Supplier</span>
                  </th>
                  <th className="text-left py-3 px-4">
                    <span className="font-semibold">Location</span>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button
                      onClick={() => handleSort('yourRate')}
                      className="flex items-center gap-1 ml-auto hover:text-blue-600 font-semibold"
                    >
                      Your Rate
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button
                      onClick={() => handleSort('chainIQBenchmark')}
                      className="flex items-center gap-1 ml-auto hover:text-blue-600 font-semibold"
                    >
                      ChainIQ Benchmark
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button
                      onClick={() => handleSort('variance')}
                      className="flex items-center gap-1 ml-auto hover:text-blue-600 font-semibold"
                    >
                      Variance
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button
                      onClick={() => handleSort('savings')}
                      className="flex items-center gap-1 ml-auto hover:text-blue-600 font-semibold"
                    >
                      Annual Savings
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-4">
                    <span className="font-semibold">Status</span>
                  </th>
                  <th className="text-center py-3 px-4">
                    <span className="font-semibold">Data Quality</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-blue-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{item.role}</div>
                      <div className="text-xs text-gray-500">
                        {item.sampleSize} data points
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-700">{item.supplier}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-700">{item.geography}</div>
                      <div className="text-xs text-gray-500">{item.serviceLine}</div>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">
                      ${item.yourRate}/hr
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-blue-600">
                      ${item.chainIQBenchmark}/hr
                    </td>
                    <td className="text-right py-3 px-4">
                      <span
                        className={`font-semibold ${
                          item.variancePercent > 5
                            ? 'text-red-600'
                            : item.variancePercent < -5
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {item.variance > 0 ? '+' : ''}${Math.round(item.variance)}/hr
                        <span className="text-xs ml-1">
                          ({item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%)
                        </span>
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-green-600">
                      {item.annualSavings > 0 
                        ? `$${Math.round(item.annualSavings / 1000)}K`
                        : '-'}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.status === 'above-market' && (
                        <Badge className="bg-red-100 text-red-800">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Above
                        </Badge>
                      )}
                      {item.status === 'below-market' && (
                        <Badge className="bg-green-100 text-green-800">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Below
                        </Badge>
                      )}
                      {item.status === 'at-market' && (
                        <Badge className="bg-gray-100 text-gray-800">
                          <Minus className="w-3 h-3 mr-1" />
                          At Market
                        </Badge>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge 
                        variant="outline"
                        className={
                          item.confidence > 0.9 ? 'border-green-500 text-green-700' :
                          item.confidence > 0.7 ? 'border-yellow-500 text-yellow-700' :
                          'border-red-500 text-red-700'
                        }
                      >
                        {Math.round(item.confidence * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {summary.aboveMarket > 0 && (
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <TrendingUp className="w-5 h-5" />
              Savings Opportunities Identified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-orange-800">
                <strong>{summary.aboveMarket}</strong> role{summary.aboveMarket !== 1 ? 's are' : ' is'} priced above market median.
                Potential annual savings: <strong>${Math.round(summary.totalSavings / 1000)}K</strong>
              </p>
              <div className="text-sm text-orange-700">
                💡 Focus negotiation efforts on roles with highest variance for maximum impact
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
