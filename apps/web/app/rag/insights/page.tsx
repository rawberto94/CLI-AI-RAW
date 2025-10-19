'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/enhanced-card'
import { Tabs } from '@/components/ui/tabs'

export default function RAGInsightsPage() {
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const tenantId = 'tenant-456' // TODO: Get from auth

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    try {
      const res = await fetch(`/api/rag/learning/insights?tenantId=${tenantId}`)
      const data = await res.json()
      setInsights(data)
    } catch (error) {
      console.error('Failed to load insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Learning Insights</h1>
        <p className="text-gray-600 mt-2">
          System performance, user behavior, and quality metrics
        </p>
      </div>

      {insights && (
        <Tabs
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              content: <OverviewView insights={insights} />
            },
            {
              id: 'interactions',
              label: 'Interactions',
              content: <InteractionsView interactions={insights.interactions} />
            },
            {
              id: 'strategies',
              label: 'Strategies',
              content: <StrategiesView strategies={insights.strategies} />
            },
            {
              id: 'quality',
              label: 'Quality',
              content: <QualityView qualityIssues={insights.qualityIssues} />
            }
          ]}
        />
      )}
    </div>
  )
}

function OverviewView({ insights }: { insights: any }) {
  const { interactions, insights: learningInsights } = insights

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-3xl font-bold text-blue-600">
            {interactions.totalQueries}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Queries</div>
        </Card>

        <Card className="p-6">
          <div className="text-3xl font-bold text-green-600">
            {(interactions.successRate * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600 mt-1">Success Rate</div>
        </Card>

        <Card className="p-6">
          <div className="text-3xl font-bold text-purple-600">
            {interactions.avgResponseTime.toFixed(0)}ms
          </div>
          <div className="text-sm text-gray-600 mt-1">Avg Response Time</div>
        </Card>

        <Card className="p-6">
          <div className="text-3xl font-bold text-orange-600">
            {(interactions.avgRelevance * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600 mt-1">Avg Relevance</div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Top Query Patterns</h3>
        <div className="space-y-3">
          {learningInsights.slice(0, 5).map((insight: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <div className="font-medium">{insight.pattern}</div>
                <div className="text-sm text-gray-600">
                  Success rate: {(insight.successRate * 100).toFixed(1)}% • 
                  Avg relevance: {(insight.avgRelevance * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-sm font-medium text-blue-600">
                {(insight.frequency * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function InteractionsView({ interactions }: { interactions: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Response Time</h4>
          <div className="text-2xl font-bold">{interactions.avgResponseTime.toFixed(0)}ms</div>
          <div className="text-sm text-gray-500 mt-1">Average</div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Relevance</h4>
          <div className="text-2xl font-bold">{(interactions.avgRelevance * 100).toFixed(1)}%</div>
          <div className="text-sm text-gray-500 mt-1">Average</div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Success Rate</h4>
          <div className="text-2xl font-bold">{(interactions.successRate * 100).toFixed(1)}%</div>
          <div className="text-sm text-gray-500 mt-1">Overall</div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Top Queries</h3>
        <div className="space-y-2">
          {interactions.topQueries.map((query: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex-1 truncate">{query.query}</div>
              <div className="text-sm font-medium text-gray-600 ml-4">
                {query.count} times
              </div>
            </div>
          ))}
        </div>
      </Card>

      {interactions.failedQueries.length > 0 && (
        <Card className="p-6 border-l-4 border-red-500">
          <h3 className="font-semibold text-lg mb-4 text-red-700">Failed Queries</h3>
          <div className="space-y-2">
            {interactions.failedQueries.map((query: any, idx: number) => (
              <div key={idx} className="p-3 bg-red-50 rounded">
                <div className="font-medium text-red-900">{query.query}</div>
                <div className="text-sm text-red-600 mt-1">{query.reason}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function StrategiesView({ strategies }: { strategies: any[] }) {
  return (
    <div className="space-y-4">
      {strategies.map((strategy, idx) => (
        <Card key={idx} className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{strategy.strategy}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Success rate: {(strategy.successRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Recommended
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Example Queries</h4>
              <div className="space-y-1">
                {strategy.examples.map((example: string, i: number) => (
                  <div key={i} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
                    "{example}"
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {strategies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Not enough data to identify successful strategies yet
        </div>
      )}
    </div>
  )
}

function QualityView({ qualityIssues }: { qualityIssues: any }) {
  if (!qualityIssues.hasIssues) {
    return (
      <Card className="p-12 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-green-600 mb-2">All Systems Healthy</h3>
        <p className="text-gray-600">No quality issues detected</p>
      </Card>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500 bg-red-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      default: return 'border-blue-500 bg-blue-50'
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-l-4 border-orange-500">
        <h3 className="font-semibold text-lg text-orange-700 mb-4">
          {qualityIssues.issues.length} Quality Issue{qualityIssues.issues.length !== 1 ? 's' : ''} Detected
        </h3>
        <div className="space-y-3">
          {qualityIssues.issues.map((issue: any, idx: number) => (
            <div key={idx} className={`p-4 border-l-4 rounded ${getSeverityColor(issue.severity)}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium">{issue.type}</div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-white">
                  {issue.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-700">{issue.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Recommendations</h3>
        <ul className="space-y-2">
          {qualityIssues.recommendations.map((rec: string, idx: number) => (
            <li key={idx} className="flex items-start p-3 bg-blue-50 rounded">
              <span className="text-blue-600 mr-2">→</span>
              <span className="text-sm text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
