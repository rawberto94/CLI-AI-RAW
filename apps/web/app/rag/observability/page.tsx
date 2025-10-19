'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/enhanced-card'
import { Tabs } from '@/components/ui/tabs'

export default function RAGObservabilityPage() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const tenantId = 'tenant-456' // TODO: Get from auth

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/rag/observability/status?tenantId=${tenantId}`)
      const data = await res.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to load status:', error)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Observability</h1>
          <p className="text-gray-600 mt-2">
            Real-time monitoring, metrics, and alerts
          </p>
        </div>
        <button
          onClick={loadStatus}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {status && (
        <>
          <SystemHealthCard status={status} />

          <Tabs
            tabs={[
              {
                id: 'metrics',
                label: 'Metrics',
                content: <MetricsView metrics={status.metrics} />
              },
              {
                id: 'components',
                label: 'Components',
                content: <ComponentsView components={status.components} />
              },
              {
                id: 'alerts',
                label: `Alerts (${status.alerts.length})`,
                content: <AlertsView alerts={status.alerts} />
              }
            ]}
          />
        </>
      )}
    </div>
  )
}

function SystemHealthCard({ status }: { status: any }) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200'
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'unhealthy': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'unhealthy': return '❌'
      default: return '❓'
    }
  }

  return (
    <Card className={`p-6 border-l-4 ${getHealthColor(status.overall)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{getHealthIcon(status.overall)}</div>
          <div>
            <h2 className="text-2xl font-bold capitalize">{status.overall}</h2>
            <p className="text-sm text-gray-600">Overall System Status</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Last Updated</div>
          <div className="text-sm font-medium">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>
    </Card>
  )
}

function MetricsView({ metrics }: { metrics: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">P50 Latency</h4>
          <div className="text-3xl font-bold text-blue-600">{metrics.latency.p50}ms</div>
          <div className="text-sm text-gray-500 mt-1">Median response time</div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">P95 Latency</h4>
          <div className="text-3xl font-bold text-purple-600">{metrics.latency.p95}ms</div>
          <div className="text-sm text-gray-500 mt-1">95th percentile</div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">P99 Latency</h4>
          <div className="text-3xl font-bold text-orange-600">{metrics.latency.p99}ms</div>
          <div className="text-sm text-gray-500 mt-1">99th percentile</div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Queries</h4>
          <div className="text-3xl font-bold text-green-600">{metrics.totalQueries}</div>
          <div className="text-sm text-gray-500 mt-1">Last hour</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Accuracy</h4>
          <div className="text-2xl font-bold">{(metrics.accuracy * 100).toFixed(1)}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${metrics.accuracy * 100}%` }}
            ></div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Error Rate</h4>
          <div className="text-2xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-red-600 h-2 rounded-full"
              style={{ width: `${metrics.errorRate * 100}%` }}
            ></div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Cost</h4>
          <div className="text-2xl font-bold">${metrics.cost.toFixed(2)}</div>
          <div className="text-sm text-gray-500 mt-1">Last hour</div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Performance Targets</h3>
        <div className="space-y-4">
          <PerformanceBar
            label="P95 Latency"
            value={metrics.latency.p95}
            target={2000}
            unit="ms"
            inverse
          />
          <PerformanceBar
            label="Accuracy"
            value={metrics.accuracy * 100}
            target={80}
            unit="%"
          />
          <PerformanceBar
            label="Error Rate"
            value={metrics.errorRate * 100}
            target={5}
            unit="%"
            inverse
          />
        </div>
      </Card>
    </div>
  )
}

function PerformanceBar({
  label,
  value,
  target,
  unit,
  inverse = false
}: {
  label: string
  value: number
  target: number
  unit: string
  inverse?: boolean
}) {
  const percentage = inverse
    ? Math.max(0, Math.min(100, ((target - value) / target) * 100))
    : Math.min(100, (value / target) * 100)

  const color = percentage >= 80 ? 'bg-green-600' : percentage >= 60 ? 'bg-yellow-600' : 'bg-red-600'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-gray-600">
          {value.toFixed(inverse ? 0 : 1)}{unit} / {target}{unit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${color} h-3 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}

function ComponentsView({ components }: { components: any }) {
  const getStatusColor = (status: string) => {
    if (status === 'healthy' || status.status === 'healthy') return 'text-green-600'
    if (status === 'degraded') return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(components).map(([name, component]: [string, any]) => (
        <Card key={name} className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg capitalize">{name}</h3>
              <p className={`text-sm font-medium ${getStatusColor(component.status || component)}`}>
                {typeof component === 'object' ? component.status : 'Active'}
              </p>
            </div>
            <div className="text-2xl">
              {(typeof component === 'object' ? component.status : component) === 'healthy' ? '✅' : '⚠️'}
            </div>
          </div>

          {typeof component === 'object' && (
            <div className="space-y-2 text-sm">
              {component.totalNodes !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Nodes</span>
                  <span className="font-medium">{component.totalNodes}</span>
                </div>
              )}
              {component.totalRelationships !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Relationships</span>
                  <span className="font-medium">{component.totalRelationships}</span>
                </div>
              )}
              {component.totalTables !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tables</span>
                  <span className="font-medium">{component.totalTables}</span>
                </div>
              )}
              {component.totalImages !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Images</span>
                  <span className="font-medium">{component.totalImages}</span>
                </div>
              )}
              {component.totalFeedback !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Feedback</span>
                  <span className="font-medium">{component.totalFeedback}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function AlertsView({ alerts }: { alerts: any[] }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      default: return 'border-blue-500 bg-blue-50'
    }
  }

  if (alerts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-green-600 mb-2">No Active Alerts</h3>
        <p className="text-gray-600">All systems operating normally</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert, idx) => (
        <Card key={idx} className={`p-6 border-l-4 ${getSeverityColor(alert.severity)}`}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg capitalize">{alert.type}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                  {alert.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(alert.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-gray-700">{alert.message}</p>
        </Card>
      ))}
    </div>
  )
}
