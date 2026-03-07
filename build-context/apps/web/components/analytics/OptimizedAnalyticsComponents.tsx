'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { ScoreGauge } from '@/components/ui/data-visualization'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    Clock,
    Target,
    Zap,
    Users,
    Building,
    FileText,
    Calendar,
    BarChart3,
    ArrowRight,
    ExternalLink,
    Download
} from 'lucide-react'

// Optimized Savings Opportunity Card
export function SavingsOpportunityCard({ opportunity, onViewDetails }: {
  opportunity: {
    supplier: string
    category: string
    potentialSavings: number
    confidence: number
    currentRate: number
    benchmarkRate: number
    annualVolume?: number
  }
  onViewDetails: () => void
}) {
  const savingsPercentage = ((opportunity.currentRate - opportunity.benchmarkRate) / opportunity.currentRate * 100)
  
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onViewDetails}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900">{opportunity.supplier}</h4>
            <p className="text-sm text-gray-600">{opportunity.category}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {Math.round(opportunity.confidence * 100)}% confidence
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-2xl font-bold text-green-600">
              ${(opportunity.potentialSavings / 1000).toFixed(0)}K
            </div>
            <div className="text-xs text-gray-500">Annual Savings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {savingsPercentage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Above Benchmark</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Current: ${opportunity.currentRate}/hr
          </div>
          <div className="text-gray-600">
            Target: ${opportunity.benchmarkRate}/hr
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Button size="sm" variant="outline" className="w-full">
            <Target className="w-3 h-3 mr-2" />
            Start Negotiation
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Optimized Renewal Alert Card
export function RenewalAlertCard({ renewal, onTakeAction }: {
  renewal: {
    contractId: string
    supplier: string
    expiryDate: string
    riskLevel: string
    value: number
    daysUntilExpiry: number
    category: string
  }
  onTakeAction: () => void
}) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-800'
      case 'high': return 'bg-orange-50 border-orange-200 text-orange-800'
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default: return 'bg-green-50 border-green-200 text-green-800'
    }
  }

  const getUrgencyIcon = (days: number) => {
    if (days <= 30) return <AlertTriangle className="w-4 h-4 text-red-500" />
    if (days <= 60) return <Clock className="w-4 h-4 text-orange-500" />
    return <Calendar className="w-4 h-4 text-violet-500" />
  }

  return (
    <Card className={`border-l-4 ${renewal.riskLevel === 'critical' ? 'border-l-red-500' : 
                                   renewal.riskLevel === 'high' ? 'border-l-orange-500' : 
                                   'border-l-yellow-500'} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getUrgencyIcon(renewal.daysUntilExpiry)}
            <div>
              <h4 className="font-semibold text-gray-900">{renewal.supplier}</h4>
              <p className="text-sm text-gray-600">{renewal.category}</p>
            </div>
          </div>
          <Badge className={getRiskColor(renewal.riskLevel)}>
            {renewal.riskLevel.toUpperCase()}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-3 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">{renewal.daysUntilExpiry}</div>
            <div className="text-xs text-gray-500">Days Left</div>
          </div>
          <div>
            <div className="text-lg font-bold text-violet-600">
              ${(renewal.value / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-gray-500">Contract Value</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {new Date(renewal.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-xs text-gray-500">Expires</div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onTakeAction}>
            <Zap className="w-3 h-3 mr-2" />
            Start RFx
          </Button>
          <Button size="sm" variant="ghost" className="flex-1">
            <FileText className="w-3 h-3 mr-2" />
            View Contract
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Optimized Compliance Issue Card
export function ComplianceIssueCard({ issue, onRemediate }: {
  issue: {
    issue: string
    frequency: number
    impact: string
    affectedContracts?: number
    estimatedEffort?: string
  }
  onRemediate: () => void
}) {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">{issue.issue}</h4>
            <p className="text-sm text-gray-600">
              {issue.frequency} contracts affected
              {issue.affectedContracts && ` (${Math.round(issue.frequency / issue.affectedContracts * 100)}% of portfolio)`}
            </p>
          </div>
          <Badge className={getImpactColor(issue.impact)}>
            {issue.impact.toUpperCase()}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {issue.estimatedEffort && `Est. effort: ${issue.estimatedEffort}`}
          </div>
          <Button size="sm" variant="outline" onClick={onRemediate}>
            <CheckCircle className="w-3 h-3 mr-2" />
            Create Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Optimized Supplier Performance Card
export function SupplierPerformanceCard({ supplier, onViewDetails }: {
  supplier: {
    name: string
    score: number
    riskLevel: string
    contractValue: number
    categories: string[]
    trend: 'up' | 'down' | 'stable'
    keyMetrics: {
      delivery: number
      quality: number
      cost: number
    }
  }
  onViewDetails: () => void
}) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onViewDetails}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">{supplier.name}</h4>
              {getTrendIcon(supplier.trend)}
            </div>
            <div className="flex flex-wrap gap-1">
              {supplier.categories.slice(0, 2).map((category, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
              {supplier.categories.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{supplier.categories.length - 2} more
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-violet-600">{supplier.score}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-sm font-medium">{supplier.keyMetrics.delivery}%</div>
            <div className="text-xs text-gray-600">Delivery</div>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-sm font-medium">{supplier.keyMetrics.quality}%</div>
            <div className="text-xs text-gray-600">Quality</div>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-sm font-medium">{supplier.keyMetrics.cost}%</div>
            <div className="text-xs text-gray-600">Cost Eff.</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">${(supplier.contractValue / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-gray-500">Contract Value</div>
          </div>
          <Badge className={getRiskColor(supplier.riskLevel)}>
            {supplier.riskLevel.toUpperCase()} RISK
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// Interactive Query Suggestions
export function QuerySuggestions({ onSelectQuery }: {
  onSelectQuery: (query: string) => void
}) {
  const suggestions = [
    {
      category: 'Savings',
      queries: [
        'Show me the top 5 savings opportunities',
        'Which suppliers are most expensive vs benchmarks?',
        'What are our biggest cost reduction opportunities?'
      ]
    },
    {
      category: 'Renewals',
      queries: [
        'Which contracts expire in the next 90 days?',
        'Show all auto-renewal contracts',
        'What renewals need immediate attention?'
      ]
    },
    {
      category: 'Compliance',
      queries: [
        'Which contracts have missing liability clauses?',
        'Show contracts with compliance scores below 70%',
        'What are our biggest compliance risks?'
      ]
    },
    {
      category: 'Suppliers',
      queries: [
        'Compare Accenture vs Deloitte performance',
        'Which suppliers have the highest risk scores?',
        'Show me our strategic suppliers'
      ]
    }
  ]

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">Popular Queries</h3>
      {suggestions.map((category, categoryIndex) => (
        <div key={categoryIndex} className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">{category.category}</h4>
          <div className="grid grid-cols-1 gap-2">
            {category.queries.map((query, queryIndex) => (
              <button
                key={queryIndex}
                onClick={() => onSelectQuery(query)}
                className="text-left p-3 bg-gray-50 hover:bg-violet-50 rounded-md text-sm transition-colors border border-transparent hover:border-violet-200"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Action Center Component
export function ActionCenter({ actions, onTakeAction }: {
  actions: Array<{
    id: string
    type: 'savings' | 'renewal' | 'compliance' | 'risk'
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    estimatedValue?: number
    dueDate?: string
    effort: 'low' | 'medium' | 'high'
  }>
  onTakeAction: (actionId: string) => void
}) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 border-red-200 text-red-800'
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default: return 'bg-green-50 border-green-200 text-green-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'savings': return <DollarSign className="w-4 h-4 text-green-600" />
      case 'renewal': return <Clock className="w-4 h-4 text-orange-600" />
      case 'compliance': return <CheckCircle className="w-4 h-4 text-violet-600" />
      case 'risk': return <AlertTriangle className="w-4 h-4 text-red-600" />
      default: return <Target className="w-4 h-4 text-gray-600" />
    }
  }

  const sortedActions = actions.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Recommended Actions</h3>
        <Badge variant="outline">{actions.length} pending</Badge>
      </div>
      
      {sortedActions.slice(0, 5).map((action) => (
        <Card key={action.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-gray-100">
                {getTypeIcon(action.type)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{action.title}</h4>
                    <p className="text-sm text-gray-600">{action.description}</p>
                  </div>
                  <Badge className={getPriorityColor(action.priority)}>
                    {action.priority.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    {action.estimatedValue && (
                      <span>Value: ${(action.estimatedValue / 1000).toFixed(0)}K</span>
                    )}
                    {action.dueDate && (
                      <span>Due: {new Date(action.dueDate).toLocaleDateString()}</span>
                    )}
                    <span>Effort: {action.effort}</span>
                  </div>
                  
                  <Button size="sm" onClick={() => onTakeAction(action.id)}>
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Take Action
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {actions.length > 5 && (
        <Button variant="outline" className="w-full">
          View All {actions.length} Actions
        </Button>
      )}
    </div>
  )
}

// Smart Insights Panel
export function SmartInsightsPanel({ insights }: {
  insights: Array<{
    id: string
    type: 'trend' | 'anomaly' | 'opportunity' | 'risk'
    title: string
    description: string
    confidence: number
    impact: string
    actionable: boolean
  }>
}) {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend': return <TrendingUp className="w-4 h-4 text-violet-600" />
      case 'anomaly': return <Zap className="w-4 h-4 text-orange-600" />
      case 'opportunity': return <Target className="w-4 h-4 text-green-600" />
      case 'risk': return <AlertTriangle className="w-4 h-4 text-red-600" />
      default: return <BarChart3 className="w-4 h-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">AI Insights</h3>
      
      {insights.map((insight) => (
        <Card key={insight.id} className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-violet-50">
                {getInsightIcon(insight.type)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{insight.title}</h4>
                    <p className="text-sm text-gray-600">{insight.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{Math.round(insight.confidence * 100)}%</div>
                    <div className="text-xs text-gray-500">Confidence</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {insight.impact.toUpperCase()} IMPACT
                  </Badge>
                  
                  {insight.actionable && (
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Learn More
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Quick Stats Grid
export function QuickStatsGrid({ stats }: {
  stats: {
    totalSavingsIdentified: number
    avgNegotiationTime: number
    complianceImprovement: number
    supplierPerformance: number
    renewalSuccess: number
    queryAccuracy: number
  }
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="text-2xl font-bold text-green-600">
          ${(stats.totalSavingsIdentified / 1000000).toFixed(1)}M
        </div>
        <div className="text-sm text-green-700">Savings Identified</div>
      </div>
      
      <div className="text-center p-4 bg-violet-50 rounded-lg border border-violet-200">
        <div className="text-2xl font-bold text-violet-600">
          {stats.avgNegotiationTime}
        </div>
        <div className="text-sm text-violet-700">Avg Days to Close</div>
      </div>
      
      <div className="text-center p-4 bg-violet-50 rounded-lg border border-violet-200">
        <div className="text-2xl font-bold text-violet-600">
          +{stats.complianceImprovement}%
        </div>
        <div className="text-sm text-violet-700">Compliance Improvement</div>
      </div>
      
      <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
        <div className="text-2xl font-bold text-orange-600">
          {stats.supplierPerformance}%
        </div>
        <div className="text-sm text-orange-700">Supplier Performance</div>
      </div>
      
      <div className="text-center p-4 bg-violet-50 rounded-lg border border-violet-200">
        <div className="text-2xl font-bold text-violet-600">
          {stats.renewalSuccess}%
        </div>
        <div className="text-sm text-violet-700">Renewal Success</div>
      </div>
      
      <div className="text-center p-4 bg-violet-50 rounded-lg border border-indigo-200">
        <div className="text-2xl font-bold text-violet-600">
          {stats.queryAccuracy}%
        </div>
        <div className="text-sm text-violet-700">Query Accuracy</div>
      </div>
    </div>
  )
}

// Default export for lazy loading
const OptimizedAnalyticsComponents = { 
  SavingsOpportunityCard,
  RenewalAlertCard,
  ComplianceIssueCard,
  SupplierPerformanceCard,
  QuerySuggestions,
  ActionCenter,
  SmartInsightsPanel,
  QuickStatsGrid
};
export default OptimizedAnalyticsComponents;
