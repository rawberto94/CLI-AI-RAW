'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingState } from '@/components/ui/loading-states'
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service'
import {
  SavingsOpportunityCard,
  RenewalAlertCard,
  ComplianceIssueCard,
  SupplierPerformanceCard,
  QuerySuggestions,
  ActionCenter,
  SmartInsightsPanel,
  QuickStatsGrid
} from '@/components/analytics/OptimizedAnalyticsComponents'
import {
  Search,
  RefreshCw,
  Download,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  DollarSign,
  Clock,
  Target,
  Brain,
  BarChart3
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

export default function EnhancedAnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState<any>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

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

  const handleSelectQuery = (selectedQuery: string) => {
    setQuery(selectedQuery)
    handleQuery()
  }

  const handleTakeAction = (actionId: string) => {
    console.log('Taking action:', actionId)
    // In production, would trigger actual action
  }

  const handleViewDetails = (item: any) => {
    console.log('Viewing details:', item)
    // In production, would navigate to detail view
  }

  const handleRemediate = (issue: any) => {
    console.log('Creating remediation plan:', issue)
    // In production, would create remediation plan
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState 
          message="Loading enhanced analytics dashboard..."
          details="Connecting to all analytical engines and aggregating real-time data"
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time insights powered by advanced analytical engines
          </p>
          {data.metadata && (
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>Last updated: {new Date(data.metadata.lastUpdated).toLocaleTimeString()}</span>
              <Badge variant="outline" className="text-green-600 border-green-200">
                {data.metadata.dataFreshness}
              </Badge>
            </div>
          )}
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

      {/* Quick Stats */}
      <QuickStatsGrid stats={data.stats} />

      {/* Natural Language Query */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            AI-Powered Procurement Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask me anything about your contracts, rates, suppliers, or compliance..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              />
            </div>
            <Button onClick={handleQuery} disabled={queryLoading || !query.trim()} size="lg">
              <Search className="w-4 h-4 mr-2" />
              {queryLoading ? 'Processing...' : 'Ask AI'}
            </Button>
          </div>
          
          {queryResult && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              {queryResult.error ? (
                <div className="text-red-600">{queryResult.error}</div>
              ) : (
                <div>
                  <div className="font-medium text-gray-900 mb-2">{queryResult.answer}</div>
                  {queryResult.evidence && queryResult.evidence.length > 0 && (
                    <div className="text-sm text-gray-600 mb-3">
                      <div className="font-medium mb-1">Evidence:</div>
                      {queryResult.evidence.map((evidence: any, index: number) => (
                        <div key={index} className="ml-2 flex items-center gap-2">
                          <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                          {evidence.excerpt}
                        </div>
                      ))}
                    </div>
                  )}
                  {queryResult.suggestions && queryResult.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {queryResult.suggestions.map((suggestion: any, index: number) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectQuery(suggestion.text)}
                          className="text-xs"
                        >
                          {suggestion.text}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-600">
                    Confidence: {Math.round(queryResult.confidence * 100)}% | 
                    Processing time: {queryResult.metadata?.processingTime}ms
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="savings">Savings</TabsTrigger>
              <TabsTrigger value="renewals">Renewals</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Portfolio Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center space-y-4">
                      <div className="text-3xl font-bold text-green-600">
                        ${(data.stats.totalSavingsIdentified / 1000000).toFixed(1)}M
                      </div>
                      <div className="text-sm text-gray-600">Total Savings Identified</div>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-blue-600">{data.overview.totalContracts}</div>
                          <div className="text-xs text-gray-600">Active Contracts</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-purple-600">{data.overview.activeSuppliers}</div>
                          <div className="text-xs text-gray-600">Active Suppliers</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Key Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Compliance Score</span>
                        <span className="font-medium">{data.overview.complianceScore}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Supplier Performance</span>
                        <span className="font-medium">{data.stats.supplierPerformance}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Renewal Success Rate</span>
                        <span className="font-medium">{data.stats.renewalSuccess}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Query Accuracy</span>
                        <span className="font-medium">{data.stats.queryAccuracy}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="savings" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.rateCard.topOpportunities.map((opportunity: any, index: number) => (
                  <SavingsOpportunityCard
                    key={index}
                    opportunity={opportunity}
                    onViewDetails={() => handleViewDetails(opportunity)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="renewals" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.renewals.upcomingRenewals.map((renewal: any, index: number) => (
                  <RenewalAlertCard
                    key={index}
                    renewal={renewal}
                    onTakeAction={() => handleViewDetails(renewal)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.compliance.topIssues.map((issue: any, index: number) => (
                  <ComplianceIssueCard
                    key={index}
                    issue={issue}
                    onRemediate={() => handleRemediate(issue)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.suppliers.topPerformers.map((supplier: any, index: number) => (
                  <SupplierPerformanceCard
                    key={index}
                    supplier={supplier}
                    onViewDetails={() => handleViewDetails(supplier)}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Action Center */}
          <ActionCenter
            actions={data.actions}
            onTakeAction={handleTakeAction}
          />

          {/* AI Insights */}
          <SmartInsightsPanel insights={data.insights} />

          {/* Query Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <QuerySuggestions onSelectQuery={handleSelectQuery} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}