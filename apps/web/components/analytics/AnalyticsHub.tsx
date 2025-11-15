'use client'

import React, { useState, useEffect } from 'react'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Sparkles
} from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  change?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

function MetricCard({ title, value, change, icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {change && (
              <div className="flex items-center gap-1 text-sm">
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                {trend === 'down' && <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />}
                <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalyticsHub() {
  const { dataMode, isRealData } = useDataMode()
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    totalContracts: 0,
    totalValue: 0,
    potentialSavings: 0,
    activeSuppliers: 0,
    upcomingRenewals: 0,
    artifactsProcessed: 0
  })

  useEffect(() => {
    loadMetrics()
  }, [dataMode])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      if (isRealData) {
        const response = await fetch('/api/analytics/metrics', {
          headers: { 'x-data-mode': dataMode }
        })
        const data = await response.json()
        setMetrics(data)
      } else {
        // Mock/AI data
        setMetrics({
          totalContracts: 247,
          totalValue: 45600000,
          potentialSavings: 6840000,
          activeSuppliers: 89,
          upcomingRenewals: 23,
          artifactsProcessed: 1847
        })
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-gray-500 mt-1">
            Real-time insights and metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={loadMetrics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Data Mode Indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        <Sparkles className="h-4 w-4" />
        <span>
          Showing <strong>{dataMode}</strong> data
          {!isRealData && ' - Switch to real mode for production data'}
        </span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Total Contracts"
          value={metrics.totalContracts.toLocaleString()}
          change="+12% from last month"
          trend="up"
          icon={<FileText className="h-6 w-6 text-blue-600" />}
        />
        <MetricCard
          title="Total Value"
          value={`$${(metrics.totalValue / 1000000).toFixed(1)}M`}
          change="+8% from last month"
          trend="up"
          icon={<DollarSign className="h-6 w-6 text-green-600" />}
        />
        <MetricCard
          title="Potential Savings"
          value={`$${(metrics.potentialSavings / 1000000).toFixed(1)}M`}
          change="15% of total value"
          trend="up"
          icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
        />
        <MetricCard
          title="Active Suppliers"
          value={metrics.activeSuppliers}
          change="+5 this quarter"
          trend="up"
          icon={<Users className="h-6 w-6 text-orange-600" />}
        />
        <MetricCard
          title="Upcoming Renewals"
          value={metrics.upcomingRenewals}
          change="Next 90 days"
          trend="neutral"
          icon={<Calendar className="h-6 w-6 text-red-600" />}
        />
        <MetricCard
          title="Artifacts Processed"
          value={metrics.artifactsProcessed.toLocaleString()}
          change="+234 this week"
          trend="up"
          icon={<BarChart3 className="h-6 w-6 text-indigo-600" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contract Value Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                <p>Chart visualization</p>
                <p className="text-sm">Line chart showing value over time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Suppliers by Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2" />
                <p>Chart visualization</p>
                <p className="text-sm">Bar chart showing top suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>View Artifacts</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <DollarSign className="h-6 w-6" />
              <span>Cost Savings</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar className="h-6 w-6" />
              <span>Renewals</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Users className="h-6 w-6" />
              <span>Suppliers</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Auto-generated default export
export default AnalyticsHub;
