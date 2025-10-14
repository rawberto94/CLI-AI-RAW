'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { LoadingState } from '@/components/ui/loading-states'
import { ScoreGauge, DataPoint } from '@/components/ui/data-visualization'
import {
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  Brain,
  Zap,
  Target,
  AlertCircle
} from 'lucide-react'

interface RateAnalytics {
  totalRateCards: number;
  totalRates: number;
  averageRate: number;
  rateVariance: number;
  marketPosition: string;
  trendDirection: string;
  confidenceScore: number;
  topSuppliers: Array<{
    supplierId: string;
    supplierName: string;
    averageRate: number;
    rateCount: number;
    marketPosition: number;
  }>;
  roleDistribution: Array<{
    role: string;
    count: number;
    averageRate: number;
    marketVariance: number;
  }>;
}

interface QueryResult {
  query: string;
  results: any[];
  summary: string;
  confidence: number;
  suggestions: string[];
  visualizationType?: 'table' | 'chart' | 'comparison' | 'trend';
}

export default function RateIntelligencePage() {
  const [analytics, setAnalytics] = useState<RateAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analytics/rate-intelligence?action=analytics')
      const data = await response.json()
      
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Failed to load rate analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuery = async () => {
    if (!query.trim()) return

    try {
      setQueryLoading(true)
      const response = await fetch('/api/analytics/rate-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          query: query.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setQueryResult(data.data)
      }
    } catch (error) {
      console.error('Failed to process query:', error)
    } finally {
      setQueryLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingState message="Loading rate intelligence..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            Rate Card Intelligence Center
          </h1>
          <p className="text-gray-600 mt-2">
            Comprehensive analytics and intelligence for your rate card portfolio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Natural Language Query */}
      <EnhancedCard variant="gradient" className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <CardTitle className="flex items-center gap-3">
            <Zap className="w-6 h-6" />
            Ask About Your Rate Data
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex gap-3 mb-4">
            <Input
              placeholder="Ask anything about your rates... e.g., 'Show me all rates above $150/hour'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              className="flex-1"
            />
            <Button onClick={handleQuery} disabled={queryLoading}>
              {queryLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Query Suggestions */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              "Show me rates above $150/hour",
              "Compare supplier rates for developers",
              "What's the trend for consultant rates?",
              "Which suppliers have the best rates?"
            ].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs"
              >
                {suggestion}
              </Button>
            ))}
          </div>

          {/* Query Results */}
          {queryResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Query Results</h4>
                <Badge variant="secondary">
                  Confidence: {Math.round(queryResult.confidence * 100)}%
                </Badge>
              </div>
              <p className="text-gray-700 mb-3">{queryResult.summary}</p>
              
              {queryResult.results.length > 0 && (
                <div className="max-h-64 overflow-y-auto">
                  <div className="grid gap-2">
                    {queryResult.results.slice(0, 5).map((result, index) => (
                      <div key={index} className="p-3 bg-white rounded border text-sm">
                        <div className="font-medium">
                          {result.supplierName || result.supplier_id || result.role || 'Result'}
                        </div>
                        <div className="text-gray-600">
                          {result.averageRate && `$${result.averageRate}/hr`}
                          {result.hourly_rate && `$${result.hourly_rate}/hr`}
                          {result.count && ` • ${result.count} rates`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </EnhancedCard>

      {analytics && (
        <>
          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              title="Total Rate Cards"
              value={analytics.totalRateCards}
              subtitle="Across all suppliers"
              icon={<BarChart3 className="w-5 h-5" />}
              color="blue"
            />
            <MetricCard
              title="Total Rates"
              value={analytics.totalRates}
              subtitle="Individual rate entries"
              icon={<DollarSign className="w-5 h-5" />}
              color="green"
            />
            <MetricCard
              title="Average Rate"
              value={`$${Math.round(analytics.averageRate)}`}
              subtitle="Per hour across portfolio"
              icon={<TrendingUp className="w-5 h-5" />}
              color="purple"
            />
            <MetricCard
              title="Market Position"
              value={analytics.marketPosition}
              subtitle={`${analytics.trendDirection} trend`}
              icon={<Target className="w-5 h-5" />}
              color="orange"
            />
          </div>

          {/* Confidence Score */}
          <EnhancedCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Analysis Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ScoreGauge
                  score={Math.round(analytics.confidenceScore * 100)}
                  size="lg"
                  showLabel
                />
                <div>
                  <p className="text-gray-700 mb-2">
                    Analysis confidence based on data quality and sample size
                  </p>
                  <div className="text-sm text-gray-600">
                    Sample size: {analytics.totalRates} rates from {analytics.totalRateCards} rate cards
                  </div>
                </div>
              </div>
            </CardContent>
          </EnhancedCard>

          {/* Top Suppliers */}
          <EnhancedCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top Suppliers by Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topSuppliers.slice(0, 5).map((supplier, index) => (
                  <div key={supplier.supplierId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {supplier.supplierName || supplier.supplierId}
                        </div>
                        <div className="text-sm text-gray-600">
                          {supplier.rateCount} rates • P{Math.round(supplier.marketPosition)} position
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ${Math.round(supplier.averageRate)}/hr
                      </div>
                      <div className="text-sm text-gray-600">
                        Average rate
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </EnhancedCard>

          {/* Role Distribution */}
          <EnhancedCard>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Rate Distribution by Role
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.roleDistribution.slice(0, 8).map((role) => (
                  <div key={role.role} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{role.role}</span>
                        <span className="text-sm text-gray-600">
                          ${Math.round(role.averageRate)}/hr
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (role.count / analytics.totalRates) * 100 * 10)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12">
                          {role.count}
                        </span>
                        <Badge 
                          variant={role.marketVariance > 10 ? "destructive" : role.marketVariance < -10 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {role.marketVariance > 0 ? '+' : ''}{Math.round(role.marketVariance)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </EnhancedCard>
        </>
      )}
    </div>
  )
}