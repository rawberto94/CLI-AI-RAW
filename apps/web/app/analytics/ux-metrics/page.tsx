'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  TrendingUp,
  CheckCircle,
  HelpCircle,
  Layout,
  Activity,
  Clock,
  Target
} from 'lucide-react'

interface UXMetrics {
  onboarding?: {
    total: number
    completed: number
    skipped: number
    completionRate: number
  }
  dashboard?: {
    totalCustomizations: number
    uniqueUsers: number
    customizationRate: number
  }
  help?: {
    totalViews: number
    toursCompleted: number
    uniqueUsers: number
    usageRate: number
  }
  engagement?: {
    featuresDiscovered: number
    keyboardShortcutsUsed: number
    averageSessionTime: number
  }
}

export default function UXMetricsPage() {
  const [metrics, setMetrics] = useState<UXMetrics>({})
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    loadMetrics()
  }, [timeRange])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/ux-metrics?timeRange=${timeRange}`)
      if (response.ok) {
        const { data } = await response.json()
        setMetrics(data)
      }
    } catch (error) {
      console.error('Failed to load UX metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="UX Metrics Dashboard"
      description="Monitor user experience and engagement metrics"
    >
      <div className="space-y-6">
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {['24h', '7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === '24h' ? 'Last 24 Hours' : 
               range === '7d' ? 'Last 7 Days' :
               range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>

        {/* Onboarding Metrics */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Onboarding Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.onboarding?.total || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {metrics.onboarding?.completed || 0}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {metrics.onboarding?.completionRate.toFixed(1) || 0}% completion rate
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Skipped
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">
                  {metrics.onboarding?.skipped || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress 
                    value={metrics.onboarding?.completionRate || 0} 
                    className="h-3"
                  />
                  <div className="text-sm text-gray-600">
                    Target: 85%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dashboard Customization Metrics */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Dashboard Customization
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Customizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.dashboard?.totalCustomizations || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Active Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {metrics.dashboard?.uniqueUsers || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Customization Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">
                    {metrics.dashboard?.customizationRate.toFixed(1) || 0}%
                  </div>
                  <div className="text-sm text-gray-600">
                    Target: 60%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Help System Metrics */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Help System Usage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Views
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.help?.totalViews || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Tours Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.help?.toursCompleted || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Active Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.help?.uniqueUsers || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Usage Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress 
                    value={metrics.help?.usageRate || 0} 
                    className="h-3"
                  />
                  <div className="text-sm text-gray-600">
                    Target: 70%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Success Criteria Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Success Criteria Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-5 h-5 ${
                    (metrics.onboarding?.completionRate || 0) >= 85 
                      ? 'text-green-500' 
                      : 'text-gray-400'
                  }`} />
                  <span className="font-medium">Onboarding completion rate &gt; 85%</span>
                </div>
                <Badge variant={(metrics.onboarding?.completionRate || 0) >= 85 ? 'default' : 'secondary'}>
                  {metrics.onboarding?.completionRate.toFixed(1) || 0}%
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-5 h-5 ${
                    (metrics.dashboard?.customizationRate || 0) >= 60 
                      ? 'text-green-500' 
                      : 'text-gray-400'
                  }`} />
                  <span className="font-medium">Dashboard customization rate &gt; 60%</span>
                </div>
                <Badge variant={(metrics.dashboard?.customizationRate || 0) >= 60 ? 'default' : 'secondary'}>
                  {metrics.dashboard?.customizationRate.toFixed(1) || 0}%
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-5 h-5 ${
                    (metrics.help?.usageRate || 0) >= 70 
                      ? 'text-green-500' 
                      : 'text-gray-400'
                  }`} />
                  <span className="font-medium">Help content usage &gt; 70%</span>
                </div>
                <Badge variant={(metrics.help?.usageRate || 0) >= 70 ? 'default' : 'secondary'}>
                  {metrics.help?.usageRate.toFixed(1) || 0}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
