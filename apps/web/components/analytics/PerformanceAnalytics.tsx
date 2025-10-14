'use client'

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Clock, 
  Zap, 
  Target, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  BarChart3,
  Activity,
  Gauge
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  change: number
  trend: 'up' | 'down' | 'stable'
  target?: number
  category: 'speed' | 'accuracy' | 'efficiency' | 'quality'
}

interface SystemHealth {
  overall: number
  components: {
    api: number
    intelligence: number
    processing: number
    storage: number
  }
}

export default function PerformanceAnalytics() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 98,
    components: {
      api: 99,
      intelligence: 97,
      processing: 98,
      storage: 99
    }
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading performance data
    const loadMetrics = () => {
      const performanceMetrics: PerformanceMetric[] = [
        {
          id: '1',
          name: 'Contract Processing Speed',
          value: 2.3,
          unit: 'seconds',
          change: -15,
          trend: 'up',
          target: 3.0,
          category: 'speed'
        },
        {
          id: '2',
          name: 'Intelligence Accuracy',
          value: 94.7,
          unit: '%',
          change: 2.1,
          trend: 'up',
          target: 95.0,
          category: 'accuracy'
        },
        {
          id: '3',
          name: 'Risk Detection Rate',
          value: 97.2,
          unit: '%',
          change: 1.8,
          trend: 'up',
          target: 96.0,
          category: 'accuracy'
        },
        {
          id: '4',
          name: 'User Productivity Gain',
          value: 67,
          unit: '%',
          change: 12,
          trend: 'up',
          target: 60,
          category: 'efficiency'
        },
        {
          id: '5',
          name: 'Average Response Time',
          value: 145,
          unit: 'ms',
          change: -23,
          trend: 'up',
          target: 200,
          category: 'speed'
        },
        {
          id: '6',
          name: 'Contract Quality Score',
          value: 8.9,
          unit: '/10',
          change: 0.3,
          trend: 'up',
          target: 8.5,
          category: 'quality'
        },
        {
          id: '7',
          name: 'Automation Rate',
          value: 78,
          unit: '%',
          change: 5,
          trend: 'up',
          target: 75,
          category: 'efficiency'
        },
        {
          id: '8',
          name: 'Error Rate',
          value: 0.3,
          unit: '%',
          change: -45,
          trend: 'up',
          target: 0.5,
          category: 'quality'
        }
      ]

      setMetrics(performanceMetrics)
      setIsLoading(false)
    }

    // Simulate real-time updates
    const updateMetrics = () => {
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: metric.value + (Math.random() - 0.5) * 0.1,
        change: metric.change + (Math.random() - 0.5) * 2
      })))

      setSystemHealth(prev => ({
        ...prev,
        overall: Math.max(95, Math.min(100, prev.overall + (Math.random() - 0.5) * 2)),
        components: {
          api: Math.max(95, Math.min(100, prev.components.api + (Math.random() - 0.5) * 2)),
          intelligence: Math.max(95, Math.min(100, prev.components.intelligence + (Math.random() - 0.5) * 2)),
          processing: Math.max(95, Math.min(100, prev.components.processing + (Math.random() - 0.5) * 2)),
          storage: Math.max(95, Math.min(100, prev.components.storage + (Math.random() - 0.5) * 2))
        }
      }))
    }

    loadMetrics()
    const interval = setInterval(updateMetrics, 5000)

    return () => clearInterval(interval)
  }, [])

  const getCategoryIcon = (category: PerformanceMetric['category']) => {
    switch (category) {
      case 'speed': return <Zap className="h-4 w-4" />
      case 'accuracy': return <Target className="h-4 w-4" />
      case 'efficiency': return <TrendingUp className="h-4 w-4" />
      case 'quality': return <CheckCircle className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: PerformanceMetric['category']) => {
    switch (category) {
      case 'speed': return 'text-blue-600 bg-blue-100'
      case 'accuracy': return 'text-green-600 bg-green-100'
      case 'efficiency': return 'text-purple-600 bg-purple-100'
      case 'quality': return 'text-orange-600 bg-orange-100'
    }
  }

  const getTrendIcon = (trend: PerformanceMetric['trend'], change: number) => {
    if (trend === 'up') {
      return <TrendingUp className="h-3 w-3 text-green-500" />
    }
    return <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />
  }

  const getHealthColor = (health: number) => {
    if (health >= 98) return 'text-green-600 bg-green-100'
    if (health >= 95) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getHealthIcon = (health: number) => {
    if (health >= 98) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (health >= 95) return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    return <AlertTriangle className="h-4 w-4 text-red-600" />
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-1">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="30"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-gray-200"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="30"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 30}`}
                      strokeDashoffset={`${2 * Math.PI * 30 * (1 - systemHealth.overall / 100)}`}
                      className="text-green-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-green-600">
                      {Math.round(systemHealth.overall)}%
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium">Overall Health</p>
              </div>
            </div>
            
            <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(systemHealth.components).map(([component, health]) => (
                <div key={component} className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    {getHealthIcon(health)}
                  </div>
                  <div className="text-lg font-semibold">{Math.round(health)}%</div>
                  <div className="text-sm text-muted-foreground capitalize">{component}</div>
                  <Progress value={health} className="mt-2 h-2" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-full ${getCategoryColor(metric.category)}`}>
                    {getCategoryIcon(metric.category)}
                  </div>
                  <span className="truncate">{metric.name}</span>
                </div>
                <Badge variant="outline" className="text-xs capitalize">
                  {metric.category}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                  </span>
                  <span className="text-sm text-muted-foreground">{metric.unit}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {getTrendIcon(metric.trend, metric.change)}
                    <span className={`text-sm font-medium ${
                      metric.change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">vs last week</span>
                </div>

                {metric.target && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Target: {metric.target}{metric.unit}</span>
                      <span className={
                        metric.value >= metric.target ? 'text-green-600' : 'text-orange-600'
                      }>
                        {metric.value >= metric.target ? 'Met' : 'Below'}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (metric.value / metric.target) * 100)} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Excellent Performance</span>
              </div>
              <p className="text-sm text-green-700">
                Contract processing speed improved by 15% this week. Intelligence accuracy is above target.
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Optimization Opportunity</span>
              </div>
              <p className="text-sm text-blue-700">
                User productivity gains are trending upward. Consider expanding automation features.
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-800">System Efficiency</span>
              </div>
              <p className="text-sm text-purple-700">
                Overall system health at 98%. All components operating within optimal parameters.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}