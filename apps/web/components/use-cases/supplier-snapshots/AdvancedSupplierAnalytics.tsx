'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { ScoreGauge, DataPoint } from '@/components/ui/data-visualization'
import { LoadingState } from '@/components/ui/loading-states'
import {
    Building,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Shield,
    AlertTriangle,
    CheckCircle,
    Clock,
    Users,
    BarChart3,
    PieChart,
    Target,
    Zap,
    Globe,
    Award,
    FileText,
    Calculator
} from 'lucide-react'

interface FinancialHealthScore {
    creditRating: string
    debtToEquity: number
    cashFlow: number
    revenueStability: number
    overallScore: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    recommendations: string[]
    trends: {
        quarter: string
        score: number
        change: number
    }[]
}

interface PerformanceBenchmark {
    metrics: {
        deliveryPerformance: number
        qualityScore: number
        responsiveness: number
        innovation: number
    }
    industryComparison: {
        percentile: number
        peerAverage: number
        topQuartile: number
    }
    trendAnalysis: {
        improving: boolean
        trajectory: number
        forecast: number
    }
    detailedMetrics: {
        onTimeDelivery: number
        budgetAdherence: number
        scopeCompliance: number
        clientSatisfaction: number
        teamRetention: number
        certificationLevel: number
    }
}

interface RiskAssessment {
    categories: {
        financial: number
        operational: number
        strategic: number
        compliance: number
        cybersecurity: number
        geopolitical: number
    }
    mitigationStrategies: {
        risk: string
        impact: 'low' | 'medium' | 'high' | 'critical'
        probability: number
        mitigation: string
        cost: number
        timeline: number
    }[]
    overallRiskScore: number
    riskTrend: 'improving' | 'stable' | 'deteriorating'
    contingencyPlans: string[]
}

interface SupplierAnalyticsData {
    supplierId: string
    supplierName: string
    tier: 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore'
    financialHealth: FinancialHealthScore
    performance: PerformanceBenchmark
    riskAssessment: RiskAssessment
    competitivePosition: {
        marketShare: number
        rateCompetitiveness: number
        serviceQuality: number
        innovation: number
        overallRanking: number
    }
    relationshipMetrics: {
        contractValue: number
        relationshipDuration: number
        renewalProbability: number
        expansionOpportunity: number
        strategicImportance: 'low' | 'medium' | 'high' | 'critical'
    }
    recommendations: {
        immediate: string[]
        shortTerm: string[]
        longTerm: string[]
    }
}

export default function AdvancedSupplierAnalytics() {
    const [selectedSupplier, setSelectedSupplier] = useState('deloitte')
    const [loading, setLoading] = useState(false)
    const [timeframe, setTimeframe] = useState('12m')

    // Mock comprehensive supplier analytics data
    const supplierData = useMemo((): SupplierAnalyticsData => {
        const suppliers = {
            deloitte: {
                supplierId: 'deloitte',
                supplierName: 'Deloitte Consulting',
                tier: 'Big 4' as const,
                financialHealth: {
                    creditRating: 'AA-',
                    debtToEquity: 0.32,
                    cashFlow: 2.8, // Billion USD
                    revenueStability: 94,
                    overallScore: 92,
                    riskLevel: 'low' as const,
                    recommendations: [
                        'Excellent financial position with strong cash flow',
                        'Low debt levels provide stability during market downturns',
                        'Consider multi-year contracts to lock in favorable terms'
                    ],
                    trends: [
                        { quarter: 'Q1 2024', score: 89, change: 2 },
                        { quarter: 'Q2 2024', score: 91, change: 2 },
                        { quarter: 'Q3 2024', score: 92, change: 1 },
                        { quarter: 'Q4 2024', score: 92, change: 0 }
                    ]
                },
                performance: {
                    metrics: {
                        deliveryPerformance: 94,
                        qualityScore: 91,
                        responsiveness: 88,
                        innovation: 87
                    },
                    industryComparison: {
                        percentile: 85,
                        peerAverage: 82,
                        topQuartile: 90
                    },
                    trendAnalysis: {
                        improving: true,
                        trajectory: 3.2,
                        forecast: 93
                    },
                    detailedMetrics: {
                        onTimeDelivery: 96,
                        budgetAdherence: 92,
                        scopeCompliance: 89,
                        clientSatisfaction: 4.3,
                        teamRetention: 87,
                        certificationLevel: 95
                    }
                },
                riskAssessment: {
                    categories: {
                        financial: 15,
                        operational: 25,
                        strategic: 20,
                        compliance: 10,
                        cybersecurity: 18,
                        geopolitical: 12
                    },
                    mitigationStrategies: [
                        {
                            risk: 'Key personnel turnover',
                            impact: 'medium' as const,
                            probability: 30,
                            mitigation: 'Implement knowledge transfer protocols and backup resources',
                            cost: 25000,
                            timeline: 60
                        },
                        {
                            risk: 'Rate increase pressure',
                            impact: 'high' as const,
                            probability: 60,
                            mitigation: 'Negotiate multi-year rate locks with volume commitments',
                            cost: 0,
                            timeline: 30
                        }
                    ],
                    overallRiskScore: 18,
                    riskTrend: 'stable' as const,
                    contingencyPlans: [
                        'Maintain pre-qualified alternative suppliers',
                        'Develop internal capability for critical functions',
                        'Establish clear SLA penalties and remediation procedures'
                    ]
                },
                competitivePosition: {
                    marketShare: 18.5,
                    rateCompetitiveness: 72, // Lower is more competitive
                    serviceQuality: 91,
                    innovation: 87,
                    overallRanking: 2
                },
                relationshipMetrics: {
                    contractValue: 2400000,
                    relationshipDuration: 4.5,
                    renewalProbability: 85,
                    expansionOpportunity: 78,
                    strategicImportance: 'high' as const
                },
                recommendations: {
                    immediate: [
                        'Negotiate rate freeze for next renewal cycle',
                        'Implement performance-based pricing model',
                        'Establish quarterly business reviews'
                    ],
                    shortTerm: [
                        'Explore bundling opportunities for additional services',
                        'Develop joint innovation initiatives',
                        'Implement shared risk/reward mechanisms'
                    ],
                    longTerm: [
                        'Consider strategic partnership agreement',
                        'Evaluate co-investment opportunities',
                        'Develop exclusive capability arrangements'
                    ]
                }
            },
            accenture: {
                supplierId: 'accenture',
                supplierName: 'Accenture',
                tier: 'Big 4' as const,
                financialHealth: {
                    creditRating: 'A+',
                    debtToEquity: 0.28,
                    cashFlow: 3.2,
                    revenueStability: 96,
                    overallScore: 94,
                    riskLevel: 'low' as const,
                    recommendations: [
                        'Outstanding financial metrics across all categories',
                        'Strong growth trajectory and market position',
                        'Excellent partner for long-term strategic initiatives'
                    ],
                    trends: [
                        { quarter: 'Q1 2024', score: 92, change: 1 },
                        { quarter: 'Q2 2024', score: 93, change: 1 },
                        { quarter: 'Q3 2024', score: 94, change: 1 },
                        { quarter: 'Q4 2024', score: 94, change: 0 }
                    ]
                },
                performance: {
                    metrics: {
                        deliveryPerformance: 96,
                        qualityScore: 93,
                        responsiveness: 91,
                        innovation: 92
                    },
                    industryComparison: {
                        percentile: 92,
                        peerAverage: 82,
                        topQuartile: 90
                    },
                    trendAnalysis: {
                        improving: true,
                        trajectory: 4.1,
                        forecast: 95
                    },
                    detailedMetrics: {
                        onTimeDelivery: 98,
                        budgetAdherence: 94,
                        scopeCompliance: 92,
                        clientSatisfaction: 4.4,
                        teamRetention: 91,
                        certificationLevel: 97
                    }
                },
                riskAssessment: {
                    categories: {
                        financial: 12,
                        operational: 18,
                        strategic: 15,
                        compliance: 8,
                        cybersecurity: 14,
                        geopolitical: 10
                    },
                    mitigationStrategies: [
                        {
                            risk: 'Over-dependence on single supplier',
                            impact: 'high' as const,
                            probability: 40,
                            mitigation: 'Diversify supplier base and develop internal capabilities',
                            cost: 150000,
                            timeline: 180
                        }
                    ],
                    overallRiskScore: 14,
                    riskTrend: 'improving' as const,
                    contingencyPlans: [
                        'Maintain active relationships with 2-3 alternative suppliers',
                        'Develop transition plans for critical services',
                        'Establish clear performance metrics and escalation procedures'
                    ]
                },
                competitivePosition: {
                    marketShare: 22.1,
                    rateCompetitiveness: 75,
                    serviceQuality: 93,
                    innovation: 92,
                    overallRanking: 1
                },
                relationshipMetrics: {
                    contractValue: 3200000,
                    relationshipDuration: 6.2,
                    renewalProbability: 92,
                    expansionOpportunity: 85,
                    strategicImportance: 'critical' as const
                },
                recommendations: {
                    immediate: [
                        'Leverage strong performance for rate optimization',
                        'Expand scope to additional service lines',
                        'Implement joint KPI dashboard'
                    ],
                    shortTerm: [
                        'Develop center of excellence partnership',
                        'Explore offshore delivery optimization',
                        'Implement innovation sharing agreements'
                    ],
                    longTerm: [
                        'Consider exclusive strategic partnership',
                        'Evaluate joint venture opportunities',
                        'Develop proprietary solution partnerships'
                    ]
                }
            }
        }

        return suppliers[selectedSupplier as keyof typeof suppliers] || suppliers.deloitte
    }, [selectedSupplier])

    const getRiskColor = (score: number) => {
        if (score <= 20) return 'text-green-600 bg-green-50 border-green-200'
        if (score <= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
        if (score <= 60) return 'text-orange-600 bg-orange-50 border-orange-200'
        return 'text-red-600 bg-red-50 border-red-200'
    }

    const getPerformanceColor = (score: number) => {
        if (score >= 90) return 'text-green-600 bg-green-50 border-green-200'
        if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200'
        if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
        return 'text-red-600 bg-red-50 border-red-200'
    }

    const getImportanceColor = (importance: string) => {
        switch (importance) {
            case 'critical': return 'text-red-600 bg-red-50 border-red-200'
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
            case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'low': return 'text-green-600 bg-green-50 border-green-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState 
                    message="Loading supplier analytics..."
                    details="Analyzing financial health, performance metrics, and risk factors"
                />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Advanced Supplier Analytics</h1>
                    <p className="text-gray-600 mt-1">Comprehensive supplier intelligence and risk assessment</p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                        <option value="deloitte">Deloitte Consulting</option>
                        <option value="accenture">Accenture</option>
                    </select>
                    <Button variant="outline" size="sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Supplier Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Financial Health"
                    value={`${supplierData.financialHealth.overallScore}/100`}
                    subtitle={supplierData.financialHealth.creditRating}
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={{ value: 2.1, label: "improvement", positive: true }}
                    color="green"
                />
                <MetricCard
                    title="Performance Score"
                    value={`${Math.round((supplierData.performance.metrics.deliveryPerformance + supplierData.performance.metrics.qualityScore) / 2)}/100`}
                    subtitle={`${supplierData.performance.industryComparison.percentile}th percentile`}
                    icon={<Target className="w-5 h-5" />}
                    trend={{ value: supplierData.performance.trendAnalysis.trajectory, label: "trajectory", positive: supplierData.performance.trendAnalysis.improving }}
                    color="blue"
                />
                <MetricCard
                    title="Risk Score"
                    value={`${supplierData.riskAssessment.overallRiskScore}/100`}
                    subtitle={supplierData.financialHealth.riskLevel.toUpperCase()}
                    icon={<Shield className="w-5 h-5" />}
                    trend={{ value: 1.2, label: "risk change", positive: false }}
                    color="orange"
                />
                <MetricCard
                    title="Contract Value"
                    value={`$${(supplierData.relationshipMetrics.contractValue / 1000000).toFixed(1)}M`}
                    subtitle={`${supplierData.relationshipMetrics.relationshipDuration} years`}
                    icon={<Building className="w-5 h-5" />}
                    trend={{ value: 15.3, label: "growth", positive: true }}
                    color="purple"
                />
            </div>

            {/* Main Analytics */}
            <Tabs defaultValue="financial" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="financial">Financial Health</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
                    <TabsTrigger value="competitive">Market Position</TabsTrigger>
                    <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                </TabsList>

                {/* Financial Health Tab */}
                <TabsContent value="financial" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Financial Health Score"
                            subtitle="Overall financial stability assessment"
                        >
                            <div className="text-center space-y-4">
                                <ScoreGauge 
                                    score={supplierData.financialHealth.overallScore} 
                                    size="lg"
                                    label="Financial Health"
                                />
                                <Badge className={getRiskColor(100 - supplierData.financialHealth.overallScore)}>
                                    {supplierData.financialHealth.riskLevel.toUpperCase()} RISK
                                </Badge>
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Key Financial Metrics"
                            subtitle="Detailed financial indicators"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Credit Rating</span>
                                    <Badge variant="outline" className="font-mono">
                                        {supplierData.financialHealth.creditRating}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Debt-to-Equity</span>
                                    <span className="font-medium">{supplierData.financialHealth.debtToEquity}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Cash Flow</span>
                                    <span className="font-medium">${supplierData.financialHealth.cashFlow}B</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Revenue Stability</span>
                                    <span className="font-medium">{supplierData.financialHealth.revenueStability}%</span>
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>

                    <EnhancedCard
                        title="Financial Health Trends"
                        subtitle="Quarterly progression analysis"
                    >
                        <div className="grid grid-cols-4 gap-4">
                            {supplierData.financialHealth.trends.map((trend, index) => (
                                <div key={index} className="text-center p-3 bg-gray-50 rounded border">
                                    <div className="text-sm text-gray-600">{trend.quarter}</div>
                                    <div className="text-xl font-bold text-gray-900">{trend.score}</div>
                                    <div className={`text-sm flex items-center justify-center gap-1 ${
                                        trend.change > 0 ? 'text-green-600' : trend.change < 0 ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                        {trend.change > 0 ? <TrendingUp className="w-3 h-3" /> : 
                                         trend.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                        {trend.change > 0 ? '+' : ''}{trend.change}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </EnhancedCard>

                    <EnhancedCard
                        title="Financial Recommendations"
                        subtitle="Strategic financial insights"
                        className="border-l-4 border-l-green-500"
                    >
                        <div className="space-y-3">
                            {supplierData.financialHealth.recommendations.map((rec, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
                                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                    <div className="text-sm text-green-900">{rec}</div>
                                </div>
                            ))}
                        </div>
                    </EnhancedCard>
                </TabsContent>

                {/* Performance Tab */}
                <TabsContent value="performance" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Performance Metrics"
                            subtitle="Key performance indicators"
                        >
                            <div className="space-y-4">
                                {Object.entries(supplierData.performance.metrics).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 capitalize">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                            <span className="font-medium">{value}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className={`h-2 rounded-full ${
                                                    value >= 90 ? 'bg-green-500' : 
                                                    value >= 80 ? 'bg-blue-500' : 
                                                    value >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${value}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Industry Comparison"
                            subtitle="Benchmarking against peers"
                        >
                            <div className="space-y-4">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-blue-600">
                                        {supplierData.performance.industryComparison.percentile}th
                                    </div>
                                    <div className="text-sm text-gray-600">Industry Percentile</div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Your Supplier</span>
                                        <span className="font-medium">
                                            {Math.round((Object.values(supplierData.performance.metrics).reduce((a, b) => a + b, 0) / 4))}%
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Peer Average</span>
                                        <span className="font-medium">{supplierData.performance.industryComparison.peerAverage}%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Top Quartile</span>
                                        <span className="font-medium">{supplierData.performance.industryComparison.topQuartile}%</span>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>

                    <EnhancedCard
                        title="Detailed Performance Metrics"
                        subtitle="Comprehensive operational assessment"
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {Object.entries(supplierData.performance.detailedMetrics).map(([key, value]) => (
                                <div key={key} className="text-center p-4 bg-gray-50 rounded border">
                                    <div className="text-2xl font-bold text-gray-900">
                                        {key === 'clientSatisfaction' ? value : `${value}%`}
                                    </div>
                                    <div className="text-sm text-gray-600 capitalize">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </div>
                                    <Badge className={getPerformanceColor(typeof value === 'number' ? value : value * 20)} variant="outline">
                                        {value >= 90 || value >= 4.5 ? 'Excellent' : 
                                         value >= 80 || value >= 4.0 ? 'Good' : 
                                         value >= 70 || value >= 3.5 ? 'Fair' : 'Poor'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </EnhancedCard>
                </TabsContent>

                {/* Risk Assessment Tab */}
                <TabsContent value="risk" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Risk Categories"
                            subtitle="Risk distribution analysis"
                        >
                            <div className="space-y-4">
                                {Object.entries(supplierData.riskAssessment.categories).map(([category, score]) => (
                                    <div key={category} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600 capitalize">{category}</span>
                                            <span className={`font-medium ${
                                                score <= 20 ? 'text-green-600' : 
                                                score <= 40 ? 'text-yellow-600' : 
                                                score <= 60 ? 'text-orange-600' : 'text-red-600'
                                            }`}>
                                                {score}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className={`h-2 rounded-full ${
                                                    score <= 20 ? 'bg-green-500' : 
                                                    score <= 40 ? 'bg-yellow-500' : 
                                                    score <= 60 ? 'bg-orange-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${score}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Overall Risk Assessment"
                            subtitle="Comprehensive risk evaluation"
                        >
                            <div className="text-center space-y-4">
                                <ScoreGauge 
                                    score={100 - supplierData.riskAssessment.overallRiskScore} 
                                    size="lg"
                                    label="Risk Score"
                                />
                                <Badge className={getRiskColor(supplierData.riskAssessment.overallRiskScore)}>
                                    {supplierData.riskAssessment.overallRiskScore}% RISK
                                </Badge>
                                <div className="text-sm text-gray-600">
                                    Trend: {supplierData.riskAssessment.riskTrend}
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>

                    <EnhancedCard
                        title="Risk Mitigation Strategies"
                        subtitle="Actionable risk management plans"
                    >
                        <div className="space-y-4">
                            {supplierData.riskAssessment.mitigationStrategies.map((strategy, index) => (
                                <div key={index} className="p-4 border border-gray-200 rounded">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="font-medium text-gray-900">{strategy.risk}</div>
                                        <Badge className={
                                            strategy.impact === 'critical' ? 'text-red-600 bg-red-50 border-red-200' :
                                            strategy.impact === 'high' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                                            strategy.impact === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                            'text-green-600 bg-green-50 border-green-200'
                                        }>
                                            {strategy.impact} impact
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-gray-600 mb-3">{strategy.mitigation}</div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>Probability: {strategy.probability}%</span>
                                        <span>Cost: ${strategy.cost.toLocaleString()}</span>
                                        <span>Timeline: {strategy.timeline} days</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </EnhancedCard>
                </TabsContent>

                {/* Market Position Tab */}
                <TabsContent value="competitive" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            title="Market Share"
                            value={`${supplierData.competitivePosition.marketShare}%`}
                            subtitle="Industry position"
                            icon={<PieChart className="w-5 h-5" />}
                            color="blue"
                        />
                        <MetricCard
                            title="Rate Competitiveness"
                            value={`${supplierData.competitivePosition.rateCompetitiveness}/100`}
                            subtitle="Lower is better"
                            icon={<DollarSign className="w-5 h-5" />}
                            color="green"
                        />
                        <MetricCard
                            title="Service Quality"
                            value={`${supplierData.competitivePosition.serviceQuality}/100`}
                            subtitle="Quality ranking"
                            icon={<Award className="w-5 h-5" />}
                            color="purple"
                        />
                        <MetricCard
                            title="Innovation Score"
                            value={`${supplierData.competitivePosition.innovation}/100`}
                            subtitle="Innovation capability"
                            icon={<Zap className="w-5 h-5" />}
                            color="orange"
                        />
                    </div>

                    <EnhancedCard
                        title="Relationship Metrics"
                        subtitle="Partnership value assessment"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Contract Value</span>
                                    <span className="font-medium">${(supplierData.relationshipMetrics.contractValue / 1000000).toFixed(1)}M</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Relationship Duration</span>
                                    <span className="font-medium">{supplierData.relationshipMetrics.relationshipDuration} years</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Renewal Probability</span>
                                    <span className="font-medium">{supplierData.relationshipMetrics.renewalProbability}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Expansion Opportunity</span>
                                    <span className="font-medium">{supplierData.relationshipMetrics.expansionOpportunity}%</span>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="mb-4">
                                    <Badge className={getImportanceColor(supplierData.relationshipMetrics.strategicImportance)}>
                                        {supplierData.relationshipMetrics.strategicImportance.toUpperCase()} IMPORTANCE
                                    </Badge>
                                </div>
                                <div className="text-sm text-gray-600">Strategic Importance Level</div>
                            </div>
                        </div>
                    </EnhancedCard>
                </TabsContent>

                {/* Recommendations Tab */}
                <TabsContent value="recommendations" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <EnhancedCard
                            title="Immediate Actions"
                            subtitle="Next 30 days"
                            className="border-l-4 border-l-red-500"
                        >
                            <div className="space-y-3">
                                {supplierData.recommendations.immediate.map((rec, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                                        <Clock className="w-5 h-5 text-red-600 mt-0.5" />
                                        <div className="text-sm text-red-900">{rec}</div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Short-term Initiatives"
                            subtitle="Next 3-6 months"
                            className="border-l-4 border-l-yellow-500"
                        >
                            <div className="space-y-3">
                                {supplierData.recommendations.shortTerm.map((rec, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <Target className="w-5 h-5 text-yellow-600 mt-0.5" />
                                        <div className="text-sm text-yellow-900">{rec}</div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Long-term Strategy"
                            subtitle="6+ months"
                            className="border-l-4 border-l-green-500"
                        >
                            <div className="space-y-3">
                                {supplierData.recommendations.longTerm.map((rec, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
                                        <Globe className="w-5 h-5 text-green-600 mt-0.5" />
                                        <div className="text-sm text-green-900">{rec}</div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}