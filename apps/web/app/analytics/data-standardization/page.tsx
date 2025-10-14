'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { LoadingState } from '@/components/ui/loading-states'
import { ScoreGauge } from '@/components/ui/data-visualization'
import {
  Settings,
  Zap,
  Target,
  Users,
  Building2,
  Briefcase,
  Award,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Filter,
  Search,
  Layers
} from 'lucide-react'

interface StandardizationAnalytics {
  lineOfService: ClusteringAnalysis;
  suppliers: ClusteringAnalysis;
  roles: ClusteringAnalysis;
  summary: {
    totalItemsProcessed: number;
    standardizationRate: number;
    clustersCreated: number;
    recommendations: string[];
  };
}

interface ClusteringAnalysis {
  category: string;
  totalItems: number;
  clusteredItems: number;
  clusters: Array<{
    name: string;
    standardValue: string;
    memberCount: number;
    confidence: number;
    examples: string[];
  }>;
  unclustered: string[];
  recommendations: string[];
}

interface StandardizationResult {
  originalValue: string;
  standardValue: string;
  confidence: number;
  cluster?: string;
  suggestions?: string[];
}

export default function DataStandardizationPage() {
  const [analytics, setAnalytics] = useState<StandardizationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [testValue, setTestValue] = useState('')
  const [testCategory, setTestCategory] = useState('supplier')
  const [testResult, setTestResult] = useState<StandardizationResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analytics/data-standardization?action=analytics')
      const data = await response.json()
      
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Failed to load standardization analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const runFullStandardization = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analytics/data-standardization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_full_standardization'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Failed to run standardization:', error)
    } finally {
      setLoading(false)
    }
  }

  const testStandardization = async () => {
    if (!testValue.trim()) return

    try {
      setTestLoading(true)
      const response = await fetch(
        `/api/analytics/data-standardization?action=standardize_value&value=${encodeURIComponent(testValue)}&category=${testCategory}`
      )
      const data = await response.json()
      
      if (data.success) {
        setTestResult(data.data)
      }
    } catch (error) {
      console.error('Failed to test standardization:', error)
    } finally {
      setTestLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'line_of_service': return <Briefcase className="w-5 h-5" />
      case 'supplier': return <Building2 className="w-5 h-5" />
      case 'role': return <Users className="w-5 h-5" />
      default: return <Target className="w-5 h-5" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'line_of_service': return 'blue'
      case 'supplier': return 'green'
      case 'role': return 'purple'
      default: return 'gray'
    }
  }

  if (loading && !analytics) {
    return (
      <div className="container mx-auto p-6">
        <LoadingState message="Loading data standardization analytics..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <Settings className="w-8 h-8 text-white" />
            </div>
            Data Standardization & Clustering
          </h1>
          <p className="text-gray-600 mt-2">
            Standardize and cluster similar data across suppliers, roles, and services
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={runFullStandardization} disabled={loading}>
            <Zap className="w-4 h-4 mr-2" />
            Run Standardization
          </Button>
        </div>
      </div>

      {/* Test Standardization */}
      <EnhancedCard variant="gradient" className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <CardTitle className="flex items-center gap-3">
            <Target className="w-6 h-6" />
            Test Standardization
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex gap-3 mb-4">
            <select
              value={testCategory}
              onChange={(e) => setTestCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="supplier">Supplier</option>
              <option value="role">Role</option>
              <option value="line_of_service">Line of Service</option>
              <option value="seniority">Seniority</option>
            </select>
            <Input
              placeholder="Enter value to standardize..."
              value={testValue}
              onChange={(e) => setTestValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && testStandardization()}
              className="flex-1"
            />
            <Button onClick={testStandardization} disabled={testLoading}>
              {testLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {testResult && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Standardization Result</h4>
                <Badge variant={testResult.confidence > 0.8 ? "default" : "secondary"}>
                  {Math.round(testResult.confidence * 100)}% confidence
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Original:</span>
                  <div className="font-medium">{testResult.originalValue}</div>
                </div>
                <div>
                  <span className="text-gray-600">Standardized:</span>
                  <div className="font-medium text-blue-600">{testResult.standardValue}</div>
                </div>
              </div>
              {testResult.suggestions && testResult.suggestions.length > 0 && (
                <div className="mt-3">
                  <span className="text-gray-600 text-sm">Suggestions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {testResult.suggestions.map((suggestion, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {suggestion}
                      </Badge>
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
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              title="Items Processed"
              value={analytics.summary.totalItemsProcessed}
              subtitle="Total data points"
              icon={<Layers className="w-5 h-5" />}
              color="blue"
            />
            <MetricCard
              title="Standardization Rate"
              value={`${Math.round(analytics.summary.standardizationRate)}%`}
              subtitle="Successfully standardized"
              icon={<CheckCircle className="w-5 h-5" />}
              color="green"
            />
            <MetricCard
              title="Clusters Created"
              value={analytics.summary.clustersCreated}
              subtitle="Data groupings"
              icon={<Target className="w-5 h-5" />}
              color="purple"
            />
            <MetricCard
              title="Recommendations"
              value={analytics.summary.recommendations.length}
              subtitle="Improvement suggestions"
              icon={<TrendingUp className="w-5 h-5" />}
              color="orange"
            />
          </div>

          {/* Category Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[analytics.lineOfService, analytics.suppliers, analytics.roles].map((categoryData) => (
              <EnhancedCard key={categoryData.category} variant="elevated">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getCategoryIcon(categoryData.category)}
                    {categoryData.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Standardization Progress</span>
                        <span className="text-sm font-medium">
                          {Math.round((categoryData.clusteredItems / categoryData.totalItems) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full bg-${getCategoryColor(categoryData.category)}-500`}
                          style={{ 
                            width: `${Math.round((categoryData.clusteredItems / categoryData.totalItems) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Total Items</div>
                        <div className="font-semibold">{categoryData.totalItems}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Clusters</div>
                        <div className="font-semibold">{categoryData.clusters.length}</div>
                      </div>
                    </div>

                    {/* Top Clusters */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Top Clusters</h4>
                      <div className="space-y-2">
                        {categoryData.clusters.slice(0, 3).map((cluster, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {cluster.standardValue}
                              </div>
                              <div className="text-xs text-gray-600">
                                {cluster.memberCount} items
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(cluster.confidence * 100)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Unclustered Items */}
                    {categoryData.unclustered.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium text-gray-900">
                            Needs Review ({categoryData.unclustered.length})
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {categoryData.unclustered.slice(0, 3).join(', ')}
                          {categoryData.unclustered.length > 3 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </EnhancedCard>
            ))}
          </div>

          {/* Recommendations */}
          {analytics.summary.recommendations.length > 0 && (
            <EnhancedCard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.summary.recommendations.slice(0, 5).map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                      </div>
                      <div className="text-sm text-gray-700">{recommendation}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </EnhancedCard>
          )}

          {/* Detailed Cluster Analysis */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[analytics.suppliers, analytics.roles].map((categoryData) => (
              <EnhancedCard key={`detailed-${categoryData.category}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getCategoryIcon(categoryData.category)}
                    {categoryData.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Clusters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {categoryData.clusters.map((cluster, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{cluster.standardValue}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {cluster.memberCount} items
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(cluster.confidence * 100)}%
                            </Badge>
                          </div>
                        </div>
                        {cluster.examples.length > 0 && (
                          <div className="text-xs text-gray-600">
                            Examples: {cluster.examples.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </EnhancedCard>
            ))}
          </div>
        </>
      )}
    </div>
  )
}