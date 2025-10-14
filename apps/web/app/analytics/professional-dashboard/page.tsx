'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-states'
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service'
import {
  Search,
  RefreshCw,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Clock,
  Users,
  BarChart3,
  Brain,
  ArrowRight,
  Target,
  Zap,
  FileText,
  Calendar,
  Award
} from 'lucide-react'

interface DashboardData {
  overview: any
  rateCard: any
  renewals: any
  compliance: any
  suppliers: any
  nlq: any
  insights: any[]
  actions: any[]
  stats: any
  metadata: any
}

export default function ProfessionalAnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState<any>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [selectedView, setSelectedView] = useState('overview')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const dashboardData = await analyticalIntelligenceService.getDashboardData('default', false)
      setData(dashboardData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const dashboardData = await analyticalIntelligenceService.getDashboardData('default', true)
      setData(dashboardData)
    } catch (error) {
      console.error('Failed to refresh dashboard:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleQuery = async () => {
    if (!query.trim()) return
    
    try {
      setQueryLoading(true)
      const result = await analyticalIntelligenceService.processNaturalLanguageQuery(
        query,
        { tenantId: 'default', sessionId: `session-${Date.now()}`, userId: 'user-1' }
      )
      setQueryResult(result)
    } catch (error) {
      console.error('Query failed:', error)
      setQueryResult({ error: 'Query failed. Please try again.' })
    } finally {
      setQueryLoading(false)
    }
  }

  const handleTakeAction = (actionId: string) => {
    console.log('Taking action:', actionId)
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState 
          message="Loading analytics dashboard..."
          details="Connecting to analytical engines and processing real-time data"
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-600 mb-4">Unable to connect to analytical engines</p>
          <Button onClick={loadDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Portfolio summary' },
    { id: 'savings', label: 'Savings', icon: DollarSign, description: 'Cost optimization' },
    { id: 'renewals', label: 'Renewals', icon: Calendar, description: 'Contract renewals' },
    { id: 'compliance', label: 'Compliance', icon: CheckCircle, description: 'Risk & compliance' },
    { id: 'suppliers', label: 'Suppliers', icon: Users, description: 'Supplier performance' }
  ]

  const quickStats = [
    {
      label: 'Total Contracts',
      value: data.overview.totalContracts.toLocaleString(),
      icon: FileText,
      color: 'blue',
      change: '+12%'
    },
    {
      label: 'Portfolio Value',
      value: `$${(data.overview.totalValue / 1000000).toFixed(1)}M`,
      icon: DollarSign,
      color: 'green',
      change: '+8.5%'
    },
    {
      label: 'Savings Identified',
      value: `$${(data.stats.totalSavingsIdentified / 1000000).toFixed(1)}M`,
      icon: TrendingUp,
      color: 'purple',
      change: '+24%'
    },
    {
      label: 'Compliance Score',
      value: `${data.overview.complianceScore}%`,
      icon: Award,
      color: 'orange',
      change: '+5.2%'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Procurement Analytics</h1>
              <p className="text-gray-600 mt-1">
                Real-time insights from {data.metadata?.contractsProcessed || 0} contracts processed
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            {/* AI Query Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">Ask AI</span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about contracts, rates, or suppliers..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                />
                <Button 
                  onClick={handleQuery} 
                  disabled={queryLoading || !query.trim()} 
                  size="sm"
                  className="w-full"
                >
                  <Search className="w-3 h-3 mr-2" />
                  {queryLoading ? 'Processing...' : 'Ask'}
                </Button>
              </div>
              
              {queryResult && (
                <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                  {queryResult.error ? (
                    <div className="text-red-600 text-sm">{queryResult.error}</div>
                  ) : (
                    <div>
                      <div className="text-sm text-gray-900 mb-2">{queryResult.answer}</div>
                      <div className="text-xs text-blue-600">
                        Confidence: {Math.round(queryResult.confidence * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Analytics
              </div>
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = selectedView === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <div className="text-left">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                  </button>
                )
              })}
            </nav>

            {/* Priority Actions */}
            <div className="mt-8">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Priority Actions
              </div>
              <div className="space-y-2">
                {data.actions.slice(0, 3).map((action: any, index: number) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => handleTakeAction(action.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {action.title}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          {action.description}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              action.priority === 'critical' ? 'border-red-200 text-red-700' :
                              action.priority === 'high' ? 'border-orange-200 text-orange-700' :
                              'border-yellow-200 text-yellow-700'
                            }`}
                          >
                            {action.priority.toUpperCase()}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {quickStats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                        <p className="text-sm text-green-600 mt-1">{stat.change}</p>
                      </div>
                      <div className={`p-3 rounded-full bg-${stat.color}-50`}>
                        <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Main Content Area */}
          <div className="space-y-6">
            {selectedView === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Savings Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.rateCard.topOpportunities.slice(0, 3).map((opportunity: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{opportunity.supplier}</div>
                            <div className="text-sm text-gray-600">{opportunity.category}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              ${(opportunity.potentialSavings / 1000).toFixed(0)}K
                            </div>
                            <div className="text-xs text-gray-500">
                              {Math.round(opportunity.confidence * 100)}% confidence
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      Upcoming Renewals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.renewals.upcomingRenewals.slice(0, 3).map((renewal: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{renewal.supplier}</div>
                            <div className="text-sm text-gray-600">Expires: {renewal.expiryDate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{renewal.daysUntilExpiry} days</div>
                            <Badge 
                              variant="outline"
                              className={`text-xs ${
                                renewal.riskLevel === 'high' ? 'border-red-200 text-red-700' :
                                renewal.riskLevel === 'medium' ? 'border-orange-200 text-orange-700' :
                                'border-green-200 text-green-700'
                              }`}
                            >
                              {renewal.riskLevel.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {selectedView === 'savings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.rateCard.topOpportunities.map((opportunity: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{opportunity.supplier}</h3>
                          <p className="text-sm text-gray-600">{opportunity.category}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(opportunity.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Potential Savings</span>
                          <span className="font-bold text-green-600">
                            ${(opportunity.potentialSavings / 1000).toFixed(0)}K
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Current Rate</span>
                          <span className="text-sm text-gray-900">${opportunity.currentRate}/hr</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Benchmark Rate</span>
                          <span className="text-sm text-gray-900">${opportunity.benchmarkRate}/hr</span>
                        </div>
                      </div>
                      
                      <Button className="w-full mt-4" size="sm">
                        <Target className="w-3 h-3 mr-2" />
                        Start Negotiation
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedView === 'renewals' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.renewals.upcomingRenewals.map((renewal: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{renewal.supplier}</h3>
                          <p className="text-sm text-gray-600">{renewal.category}</p>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            renewal.riskLevel === 'high' ? 'border-red-200 text-red-700' :
                            renewal.riskLevel === 'medium' ? 'border-orange-200 text-orange-700' :
                            'border-green-200 text-green-700'
                          }`}
                        >
                          {renewal.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Days Until Expiry</span>
                          <span className="font-bold text-orange-600">{renewal.daysUntilExpiry}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Contract Value</span>
                          <span className="text-sm text-gray-900">
                            ${(renewal.value / 1000000).toFixed(1)}M
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Expiry Date</span>
                          <span className="text-sm text-gray-900">{renewal.expiryDate}</span>
                        </div>
                      </div>
                      
                      <Button className="w-full mt-4" size="sm">
                        <Zap className="w-3 h-3 mr-2" />
                        Start RFx Process
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedView === 'compliance' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.compliance.topIssues.map((issue: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">{issue.issue}</h3>
                          <p className="text-sm text-gray-600">
                            {issue.frequency} contracts affected
                          </p>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            issue.impact === 'critical' ? 'border-red-200 text-red-700' :
                            issue.impact === 'high' ? 'border-orange-200 text-orange-700' :
                            'border-yellow-200 text-yellow-700'
                          }`}
                        >
                          {issue.impact.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="text-sm text-gray-600">
                          Estimated effort: {issue.estimatedEffort}
                        </div>
                      </div>
                      
                      <Button className="w-full" size="sm">
                        <CheckCircle className="w-3 h-3 mr-2" />
                        Create Remediation Plan
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedView === 'suppliers' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.suppliers.topPerformers.map((supplier: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {supplier.categories.slice(0, 2).map((category: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">{supplier.score}</div>
                          <div className="text-xs text-gray-500">Score</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="text-sm font-medium">{supplier.keyMetrics.delivery}%</div>
                          <div className="text-xs text-gray-600">Delivery</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="text-sm font-medium">{supplier.keyMetrics.quality}%</div>
                          <div className="text-xs text-gray-600">Quality</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="text-sm font-medium">{supplier.keyMetrics.cost}%</div>
                          <div className="text-xs text-gray-600">Cost Eff.</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">
                            ${(supplier.contractValue / 1000000).toFixed(1)}M
                          </div>
                          <div className="text-xs text-gray-500">Contract Value</div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            supplier.riskLevel === 'high' ? 'border-red-200 text-red-700' :
                            supplier.riskLevel === 'medium' ? 'border-orange-200 text-orange-700' :
                            'border-green-200 text-green-700'
                          }`}
                        >
                          {supplier.riskLevel.toUpperCase()} RISK
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}