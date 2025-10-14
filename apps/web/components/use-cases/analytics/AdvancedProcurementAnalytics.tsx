'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { ScoreGauge } from '@/components/ui/data-visualization'
import {
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart,
    LineChart,
    Target,
    DollarSign,
    Users,
    Clock,
    Zap,
    Brain,
    Award,
    AlertTriangle,
    CheckCircle
} from 'lucide-react'

interface AnalyticsInsight {
    id: string
    type: 'trend' | 'anomaly' | 'opportunity' | 'risk'
    title: string
    description: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    confidence: number
    value: number
    timeframe: string
    actionable: boolean
    recommendations: string[]
}

interface ProcurementMetrics {
    totalSpend: number
    avgSavings: number
    negotiationSuccessRate: number
    supplierPerformance: number
    complianceRate: number
    processEfficiency: number
    riskScore: number
    innovationIndex: number
}

interface TrendData {
    period: string
    savings: number
    negotiations: number
    successRate: number
    avgDuration: number
}

export default function AdvancedProcurementAnalytics() {
    const [selectedTimeframe, setSelectedTimeframe] = useState('12m')
    const [selectedMetric, setSelectedMetric] = useState('savings')

    // Mock comprehensive analytics data
    const procurementMetrics: ProcurementMetrics = {
        totalSpend: 45600000,
        avgSavings: 18.5,
        negotiationSuccessRate: 87.3,
        supplierPerformance: 91.2,
        complianceRate: 94.7,
        processEfficiency: 89.1,
        riskScore: 23.4,
        innovationIndex: 76.8
    }

    const trendData: TrendData[] = [
        { period: 'Jan 2024', savings: 15.2, negotiations: 23, successRate: 82.6, avgDuration: 45 },
        { period: 'Feb 2024', savings: 16.8, negotiations: 28, successRate: 85.7, avgDuration: 42 },
        { period: 'Mar 2024', savings: 18.1, negotiations: 31, successRate: 87.1, avgDuration: 38 },
        { period: 'Apr 2024', savings: 17.9, negotiations: 29, successRate: 86.2, avgDuration: 41 },
        { period: 'May 2024', savings: 19.3, negotiations: 34, successRate: 88.2, avgDuration: 36 },
        { period: 'Jun 2024', savings: 18.7, negotiations: 32, successRate: 87.5, avgDuration: 39 },
        { period: 'Jul 2024', savings: 20.1, negotiations: 36, successRate: 89.1, avgDuration: 34 },
        { period: 'Aug 2024', savings: 19.8, negotiations: 35, successRate: 88.6, avgDuration: 37 },
        { period: 'Sep 2024', savings: 21.2, negotiations: 38, successRate: 90.2, avgDuration: 32 },
        { period: 'Oct 2024', savings: 20.9, negotiations: 37, successRate: 89.7, avgDuration: 35 },
        { period: 'Nov 2024', savings: 22.1, negotiations: 41, successRate: 91.5, avgDuration: 30 },
        { period: 'Dec 2024', savings: 21.8, negotiations: 39, successRate: 90.8, avgDuration: 33 }
    ]

    const insights: AnalyticsInsight[] = [
        {
            id: 'insight-001',
            type: 'opportunity',
            title: 'Seasonal Negotiation Pattern Identified',
            description: 'Q4 negotiations show 15% higher success rates due to supplier year-end targets',
            impact: 'high',
            confidence: 92.3,
            value: 340000,
            timeframe: 'Q4 annually',
            actionable: true,
            recommendations: [
                'Schedule major negotiations for Q4 when possible',
                'Leverage supplier year-end pressure for better terms',
                'Prepare negotiation pipeline for Q4 execution'
            ]
        },
        {
            id: 'insight-002',
            type: 'trend',
            title: 'Negotiation Duration Optimization',
            description: 'Average negotiation time reduced by 33% over 12 months through process improvements',
            impact: 'medium',
            confidence: 96.7,
            value: 180000,
            timeframe: '12 months',
            actionable: false,
            recommendations: [
                'Document and standardize successful negotiation processes',
                'Train team on optimized negotiation workflows',
                'Implement automated preparation tools'
            ]
        },
        {
            id: 'insight-003',
            type: 'risk',
            title: 'Supplier Concentration Risk',
            description: '68% of critical services depend on top 3 suppliers, creating concentration risk',
            impact: 'critical',
            confidence: 88.9,
            value: -750000,
            timeframe: 'Ongoing',
            actionable: true,
            recommendations: [
                'Diversify supplier base for critical services',
                'Develop backup suppliers for key categories',
                'Implement supplier risk monitoring system'
            ]
        },
        {
            id: 'insight-004',
            type: 'anomaly',
            title: 'Unusual Rate Variance in APAC Region',
            description: 'APAC supplier rates increased 23% above normal variance in last quarter',
            impact: 'medium',
            confidence: 84.2,
            value: -120000,
            timeframe: 'Last 3 months',
            actionable: true,
            recommendations: [
                'Investigate APAC market conditions',
                'Renegotiate contracts with affected suppliers',
                'Consider alternative geographic sourcing'
            ]
        }
    ]

    const getInsightColor = (type: string) => {
        switch (type) {
            case 'opportunity': return 'text-green-600 bg-green-50 border-green-200'
            case 'trend': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'risk': return 'text-red-600 bg-red-50 border-red-200'
            case 'anomaly': return 'text-orange-600 bg-orange-50 border-orange-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'critical': return 'text-red-600 bg-red-50 border-red-200'
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
            case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'low': return 'text-green-600 bg-green-50 border-green-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'opportunity': return <Target className="w-5 h-5" />
            case 'trend': return <TrendingUp className="w-5 h-5" />
            case 'risk': return <AlertTriangle className="w-5 h-5" />
            case 'anomaly': return <Zap className="w-5 h-5" />
            default: return <Brain className="w-5 h-5" />
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Advanced Procurement Analytics</h1>
                    <p className="text-gray-600 mt-1">AI-powered insights and predictive analytics</p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedTimeframe}
                        onChange={(e) => setSelectedTimeframe(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                        <option value="3m">Last 3 months</option>
                        <option value="6m">Last 6 months</option>
                        <option value="12m">Last 12 months</option>
                        <option value="24m">Last 24 months</option>
                    </select>
                    <Button variant="outline" size="sm">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Export Analytics
                    </Button>
                </div>
            </div>

            {/* Key Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Spend"
                    value={`$${(procurementMetrics.totalSpend / 1000000).toFixed(1)}M`}
                    subtitle="Annual procurement spend"
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={{ value: 12.3, label: "vs last year", positive: true }}
                    color="blue"
                />
                <MetricCard
                    title="Average Savings"
                    value={`${procurementMetrics.avgSavings}%`}
                    subtitle="Cost reduction achieved"
                    icon={<TrendingUp className="w-5 h-5" />}
                    trend={{ value: 3.2, label: "improvement", positive: true }}
                    color="green"
                />
                <MetricCard
                    title="Success Rate"
                    value={`${procurementMetrics.negotiationSuccessRate}%`}
                    subtitle="Negotiation success rate"
                    icon={<Target className="w-5 h-5" />}
                    trend={{ value: 5.1, label: "increase", positive: true }}
                    color="purple"
                />
                <MetricCard
                    title="Risk Score"
                    value={`${procurementMetrics.riskScore}/100`}
                    subtitle="Overall risk level"
                    icon={<AlertTriangle className="w-5 h-5" />}
                    trend={{ value: 2.3, label: "reduction", positive: true }}
                    color="orange"
                />
            </div>

            {/* Main Analytics */}
            <Tabs defaultValue="insights" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="insights">AI Insights</TabsTrigger>
                    <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
                    <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
                    <TabsTrigger value="predictions">Predictions</TabsTrigger>
                </TabsList>

                {/* AI Insights Tab */}
                <TabsContent value="insights" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {insights.map((insight) => (
                            <EnhancedCard
                                key={insight.id}
                                title={insight.title}
                                subtitle={insight.description}
                                className="border-l-4 border-l-blue-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    {/* Insight Overview */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded ${getInsightColor(insight.type)}`}>
                                                {getInsightIcon(insight.type)}
                                            </div>
                                            <Badge className={getInsightColor(insight.type)}>
                                                {insight.type.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-gray-900">{insight.confidence}%</div>
                                            <div className="text-sm text-gray-600">Confidence</div>
                                        </div>
                                        <Badge className={getImpactColor(insight.impact)}>
                                            {insight.impact.toUpperCase()} IMPACT
                                        </Badge>
                                    </div>

                                    {/* Value & Timeframe */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Financial Impact</h4>
                                        <div className="space-y-2">
                                            <div className="text-center p-3 bg-gray-50 rounded border">
                                                <div className={`text-2xl font-bold ${
                                                    insight.value > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {insight.value > 0 ? '+' : ''}${Math.abs(insight.value / 1000).toFixed(0)}K
                                                </div>
                                                <div className="text-sm text-gray-600">Estimated Value</div>
                                            </div>
                                            <div className="text-sm text-gray-600 text-center">
                                                Timeframe: {insight.timeframe}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actionability */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Action Required</h4>
                                        <div className="text-center">
                                            {insight.actionable ? (
                                                <div className="flex items-center gap-2 justify-center p-3 bg-green-50 border border-green-200 rounded">
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                    <span className="text-sm font-medium text-green-900">Actionable</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 justify-center p-3 bg-blue-50 border border-blue-200 rounded">
                                                    <Brain className="w-5 h-5 text-blue-600" />
                                                    <span className="text-sm font-medium text-blue-900">Informational</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recommendations */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Recommendations</h4>
                                        <div className="space-y-2">
                                            {insight.recommendations.map((rec, index) => (
                                                <div key={index} className="text-sm p-2 bg-blue-50 border border-blue-200 rounded">
                                                    • {rec}
                                                </div>
                                            ))}
                                        </div>
                                        {insight.actionable && (
                                            <Button size="sm" variant="outline" className="w-full mt-3">
                                                <Zap className="w-4 h-4 mr-2" />
                                                Take Action
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Trend Analysis Tab */}
                <TabsContent value="trends" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Savings Trend Analysis"
                            subtitle="12-month savings performance"
                        >
                            <div className="space-y-4">
                                <div className="h-64 flex items-center justify-center border border-gray-200 rounded bg-gray-50">
                                    <div className="text-center">
                                        <LineChart className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <div className="text-sm text-gray-600">Savings Trend Chart</div>
                                        <div className="text-xs text-gray-500">15.2% → 21.8% (+43% improvement)</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="p-3 bg-green-50 rounded border border-green-200">
                                        <div className="text-lg font-bold text-green-900">+43%</div>
                                        <div className="text-sm text-green-600">YoY Growth</div>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-lg font-bold text-blue-900">21.8%</div>
                                        <div className="text-sm text-blue-600">Current Rate</div>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                                        <div className="text-lg font-bold text-purple-900">11/12</div>
                                        <div className="text-sm text-purple-600">Months Up</div>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Success Rate Evolution"
                            subtitle="Negotiation success rate trends"
                        >
                            <div className="space-y-4">
                                <div className="h-64 flex items-center justify-center border border-gray-200 rounded bg-gray-50">
                                    <div className="text-center">
                                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <div className="text-sm text-gray-600">Success Rate Chart</div>
                                        <div className="text-xs text-gray-500">82.6% → 90.8% (+10% improvement)</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="p-3 bg-green-50 rounded border border-green-200">
                                        <div className="text-lg font-bold text-green-900">90.8%</div>
                                        <div className="text-sm text-green-600">Current Rate</div>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-lg font-bold text-blue-900">+10%</div>
                                        <div className="text-sm text-blue-600">Improvement</div>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>
                </TabsContent>

                {/* Performance Metrics Tab */}
                <TabsContent value="performance" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="text-center space-y-3">
                            <ScoreGauge 
                                score={procurementMetrics.supplierPerformance} 
                                size="md"
                                label="Supplier Performance"
                            />
                        </div>
                        <div className="text-center space-y-3">
                            <ScoreGauge 
                                score={procurementMetrics.complianceRate} 
                                size="md"
                                label="Compliance Rate"
                            />
                        </div>
                        <div className="text-center space-y-3">
                            <ScoreGauge 
                                score={procurementMetrics.processEfficiency} 
                                size="md"
                                label="Process Efficiency"
                            />
                        </div>
                        <div className="text-center space-y-3">
                            <ScoreGauge 
                                score={procurementMetrics.innovationIndex} 
                                size="md"
                                label="Innovation Index"
                            />
                        </div>
                    </div>
                </TabsContent>

                {/* Predictions Tab */}
                <TabsContent value="predictions" className="space-y-6">
                    <div className="text-center py-12">
                        <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Predictive Analytics</h3>
                        <p className="text-gray-600">AI-powered predictions and forecasting coming soon...</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}