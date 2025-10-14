'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { ScoreGauge } from '@/components/ui/data-visualization'
import { LoadingState } from '@/components/ui/loading-states'
import {
    Brain,
    Zap,
    Target,
    TrendingUp,
    AlertTriangle,
    Lightbulb,
    Eye,
    Cpu,
    BarChart3,
    PieChart,
    Activity,
    Clock,
    DollarSign,
    Users,
    Shield,
    Rocket,
    Star,
    CheckCircle
} from 'lucide-react'

interface AIInsight {
    id: string
    type: 'prediction' | 'recommendation' | 'anomaly' | 'optimization' | 'risk_alert'
    title: string
    description: string
    confidence: number
    impact: 'low' | 'medium' | 'high' | 'critical'
    category: 'cost_savings' | 'risk_management' | 'process_optimization' | 'market_intelligence'
    value: number
    timeframe: string
    actionable: boolean
    aiModel: string
    dataPoints: number
    lastUpdated: Date
    recommendations: string[]
    evidence: string[]
}

interface PredictiveModel {
    id: string
    name: string
    type: 'regression' | 'classification' | 'clustering' | 'neural_network'
    accuracy: number
    precision: number
    recall: number
    f1Score: number
    trainingData: number
    lastTrained: Date
    status: 'active' | 'training' | 'deprecated'
    predictions: number
    successRate: number
}

interface MarketPrediction {
    metric: string
    currentValue: number
    predictedValue: number
    timeframe: string
    confidence: number
    trend: 'increasing' | 'decreasing' | 'stable'
    factors: string[]
}

export default function ProcurementAIEngine() {
    const [insights, setInsights] = useState<AIInsight[]>([])
    const [models, setModels] = useState<PredictiveModel[]>([])
    const [predictions, setPredictions] = useState<MarketPrediction[]>([])
    const [loading, setLoading] = useState(true)
    const [processingInsights, setProcessingInsights] = useState(false)

    useEffect(() => {
        loadAIData()
    }, [])

    const loadAIData = async () => {
        setLoading(true)
        
        // Mock AI insights data
        const mockInsights: AIInsight[] = [
            {
                id: 'ai-001',
                type: 'prediction',
                title: 'Q1 2025 Rate Increase Forecast',
                description: 'AI predicts 8-12% rate increases across IT consulting services in Q1 2025 due to talent shortage and inflation',
                confidence: 87.3,
                impact: 'high',
                category: 'market_intelligence',
                value: 450000,
                timeframe: 'Q1 2025',
                actionable: true,
                aiModel: 'Market Trend Predictor v2.1',
                dataPoints: 15420,
                lastUpdated: new Date('2024-01-15T14:30:00'),
                recommendations: [
                    'Lock in current rates with multi-year contracts before Q1 2025',
                    'Negotiate rate caps with existing suppliers',
                    'Explore alternative geographic markets with lower rate pressure'
                ],
                evidence: [
                    'Historical Q1 rate increase pattern (2019-2024)',
                    'Current talent shortage indicators in IT sector',
                    'Inflation correlation analysis showing 0.85 coefficient'
                ]
            },
            {
                id: 'ai-002',
                type: 'optimization',
                title: 'Negotiation Timing Optimization',
                description: 'AI identifies optimal negotiation timing: 73% higher success rate when initiated 45-60 days before contract expiry',
                confidence: 94.1,
                impact: 'medium',
                category: 'process_optimization',
                value: 180000,
                timeframe: 'Ongoing',
                actionable: true,
                aiModel: 'Negotiation Success Predictor v1.8',
                dataPoints: 8750,
                lastUpdated: new Date('2024-01-15T13:45:00'),
                recommendations: [
                    'Implement automated alerts 60 days before contract expiry',
                    'Prioritize negotiations during supplier fiscal year-end periods',
                    'Avoid negotiation during peak business seasons'
                ],
                evidence: [
                    'Analysis of 847 successful negotiations over 3 years',
                    'Supplier decision-making pattern analysis',
                    'Seasonal business cycle correlation study'
                ]
            },
            {
                id: 'ai-003',
                type: 'anomaly',
                title: 'Unusual Supplier Performance Pattern',
                description: 'AI detected 23% performance degradation in Supplier X over last 90 days, correlating with their recent acquisition',
                confidence: 91.7,
                impact: 'critical',
                category: 'risk_management',
                value: -320000,
                timeframe: 'Last 90 days',
                actionable: true,
                aiModel: 'Anomaly Detection Engine v3.2',
                dataPoints: 4560,
                lastUpdated: new Date('2024-01-15T12:20:00'),
                recommendations: [
                    'Initiate immediate performance review with Supplier X',
                    'Activate backup supplier for critical services',
                    'Renegotiate SLAs with enhanced penalties'
                ],
                evidence: [
                    'Delivery time increased from 2.3 to 3.8 days average',
                    'Quality score dropped from 94% to 72%',
                    'Customer satisfaction declined by 18 points'
                ]
            },
            {
                id: 'ai-004',
                type: 'recommendation',
                title: 'Supplier Consolidation Opportunity',
                description: 'AI recommends consolidating 5 small suppliers into 2 strategic partners, projecting 15% cost reduction',
                confidence: 82.9,
                impact: 'high',
                category: 'cost_savings',
                value: 280000,
                timeframe: '6 months',
                actionable: true,
                aiModel: 'Portfolio Optimization Engine v2.0',
                dataPoints: 12340,
                lastUpdated: new Date('2024-01-15T11:15:00'),
                recommendations: [
                    'Conduct RFP for consolidated services',
                    'Negotiate volume discounts with preferred suppliers',
                    'Implement phased transition plan over 6 months'
                ],
                evidence: [
                    'Volume discount analysis showing 12-18% savings potential',
                    'Administrative cost reduction of $45K annually',
                    'Risk assessment showing improved supplier stability'
                ]
            }
        ]

        const mockModels: PredictiveModel[] = [
            {
                id: 'model-001',
                name: 'Market Trend Predictor',
                type: 'neural_network',
                accuracy: 87.3,
                precision: 89.1,
                recall: 85.7,
                f1Score: 87.4,
                trainingData: 15420,
                lastTrained: new Date('2024-01-10T09:00:00'),
                status: 'active',
                predictions: 1247,
                successRate: 84.2
            },
            {
                id: 'model-002',
                name: 'Negotiation Success Predictor',
                type: 'classification',
                accuracy: 94.1,
                precision: 92.8,
                recall: 95.3,
                f1Score: 94.0,
                trainingData: 8750,
                lastTrained: new Date('2024-01-12T14:30:00'),
                status: 'active',
                predictions: 892,
                successRate: 91.7
            },
            {
                id: 'model-003',
                name: 'Anomaly Detection Engine',
                type: 'clustering',
                accuracy: 91.7,
                precision: 88.4,
                recall: 94.2,
                f1Score: 91.2,
                trainingData: 4560,
                lastTrained: new Date('2024-01-08T16:45:00'),
                status: 'active',
                predictions: 234,
                successRate: 89.3
            }
        ]

        const mockPredictions: MarketPrediction[] = [
            {
                metric: 'Average IT Consulting Rate',
                currentValue: 175,
                predictedValue: 189,
                timeframe: 'Q1 2025',
                confidence: 87.3,
                trend: 'increasing',
                factors: ['Talent shortage', 'Inflation pressure', 'Increased demand']
            },
            {
                metric: 'Supplier Performance Index',
                currentValue: 91.2,
                predictedValue: 88.7,
                timeframe: 'Next 6 months',
                confidence: 82.1,
                trend: 'decreasing',
                factors: ['Market consolidation', 'Resource constraints', 'Quality pressure']
            },
            {
                metric: 'Negotiation Success Rate',
                currentValue: 87.3,
                predictedValue: 91.8,
                timeframe: 'Next quarter',
                confidence: 94.1,
                trend: 'increasing',
                factors: ['Process optimization', 'Better timing', 'Enhanced preparation']
            }
        ]

        await new Promise(resolve => setTimeout(resolve, 2000))
        
        setInsights(mockInsights)
        setModels(mockModels)
        setPredictions(mockPredictions)
        setLoading(false)
    }

    const generateNewInsights = async () => {
        setProcessingInsights(true)
        
        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Add a new insight
        const newInsight: AIInsight = {
            id: `ai-${Date.now()}`,
            type: 'recommendation',
            title: 'New Cost Optimization Opportunity Detected',
            description: 'AI identified potential 12% savings through renegotiating payment terms with top 3 suppliers',
            confidence: 89.4,
            impact: 'medium',
            category: 'cost_savings',
            value: 220000,
            timeframe: '3 months',
            actionable: true,
            aiModel: 'Cost Optimization Engine v1.5',
            dataPoints: 6780,
            lastUpdated: new Date(),
            recommendations: [
                'Propose early payment discounts of 2-3%',
                'Negotiate extended payment terms for better cash flow',
                'Bundle payments across multiple contracts'
            ],
            evidence: [
                'Payment term analysis across 156 suppliers',
                'Cash flow impact modeling',
                'Supplier financial health assessment'
            ]
        }
        
        setInsights(prev => [newInsight, ...prev])
        setProcessingInsights(false)
    }

    const getInsightTypeColor = (type: string) => {
        switch (type) {
            case 'prediction': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'recommendation': return 'text-green-600 bg-green-50 border-green-200'
            case 'anomaly': return 'text-red-600 bg-red-50 border-red-200'
            case 'optimization': return 'text-purple-600 bg-purple-50 border-purple-200'
            case 'risk_alert': return 'text-orange-600 bg-orange-50 border-orange-200'
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
            case 'prediction': return <Eye className="w-5 h-5" />
            case 'recommendation': return <Lightbulb className="w-5 h-5" />
            case 'anomaly': return <AlertTriangle className="w-5 h-5" />
            case 'optimization': return <Target className="w-5 h-5" />
            case 'risk_alert': return <Shield className="w-5 h-5" />
            default: return <Brain className="w-5 h-5" />
        }
    }

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'increasing': return <TrendingUp className="w-4 h-4 text-red-600" />
            case 'decreasing': return <TrendingUp className="w-4 h-4 text-green-600 rotate-180" />
            case 'stable': return <Activity className="w-4 h-4 text-gray-600" />
            default: return <Activity className="w-4 h-4 text-gray-600" />
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState 
                    title="Initializing AI Engine"
                    description="Loading predictive models and generating insights"
                />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Procurement AI Engine</h1>
                    <p className="text-gray-600 mt-1">AI-powered insights, predictions, and recommendations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        onClick={generateNewInsights}
                        disabled={processingInsights}
                        variant="outline" 
                        size="sm"
                    >
                        {processingInsights ? (
                            <>
                                <Cpu className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Brain className="w-4 h-4 mr-2" />
                                Generate Insights
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* AI Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Active Models"
                    value={models.filter(m => m.status === 'active').length.toString()}
                    subtitle="AI models running"
                    icon={<Cpu className="w-5 h-5" />}
                    trend={{ value: 2, label: "new models", positive: true }}
                    color="blue"
                />
                <MetricCard
                    title="Prediction Accuracy"
                    value={`${Math.round(models.reduce((sum, m) => sum + m.accuracy, 0) / models.length)}%`}
                    subtitle="Average model accuracy"
                    icon={<Target className="w-5 h-5" />}
                    trend={{ value: 3.2, label: "improvement", positive: true }}
                    color="green"
                />
                <MetricCard
                    title="Insights Generated"
                    value={insights.length.toString()}
                    subtitle="Active AI insights"
                    icon={<Lightbulb className="w-5 h-5" />}
                    trend={{ value: 15, label: "this week", positive: true }}
                    color="purple"
                />
                <MetricCard
                    title="Potential Value"
                    value={`$${Math.round(insights.reduce((sum, i) => sum + Math.abs(i.value), 0) / 1000)}K`}
                    subtitle="Identified opportunities"
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={{ value: 23, label: "increase", positive: true }}
                    color="orange"
                />
            </div>

            {/* Main Content */}
            <Tabs defaultValue="insights" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="insights">AI Insights</TabsTrigger>
                    <TabsTrigger value="predictions">Market Predictions</TabsTrigger>
                    <TabsTrigger value="models">AI Models</TabsTrigger>
                    <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
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
                                            <div className={`p-2 rounded ${getInsightTypeColor(insight.type)}`}>
                                                {getInsightIcon(insight.type)}
                                            </div>
                                            <Badge className={getInsightTypeColor(insight.type)}>
                                                {insight.type.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="text-center space-y-2">
                                            <ScoreGauge 
                                                score={insight.confidence} 
                                                size="sm"
                                                label="Confidence"
                                            />
                                            <Badge className={getImpactColor(insight.impact)}>
                                                {insight.impact.toUpperCase()} IMPACT
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Value & AI Model */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">AI Analysis</h4>
                                        <div className="space-y-2">
                                            <div className="text-center p-3 bg-gray-50 rounded border">
                                                <div className={`text-2xl font-bold ${
                                                    insight.value > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {insight.value > 0 ? '+' : ''}${Math.abs(insight.value / 1000).toFixed(0)}K
                                                </div>
                                                <div className="text-sm text-gray-600">Estimated Impact</div>
                                            </div>
                                            <div className="text-xs text-gray-500 text-center">
                                                Model: {insight.aiModel}
                                            </div>
                                            <div className="text-xs text-gray-500 text-center">
                                                Data Points: {insight.dataPoints.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recommendations */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">AI Recommendations</h4>
                                        <div className="space-y-2">
                                            {insight.recommendations.slice(0, 3).map((rec, index) => (
                                                <div key={index} className="text-sm p-2 bg-blue-50 border border-blue-200 rounded">
                                                    • {rec}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Timeframe: {insight.timeframe}
                                        </div>
                                    </div>

                                    {/* Evidence & Actions */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Supporting Evidence</h4>
                                        <div className="space-y-2">
                                            {insight.evidence.slice(0, 2).map((evidence, index) => (
                                                <div key={index} className="text-xs p-2 bg-gray-50 border border-gray-200 rounded">
                                                    • {evidence}
                                                </div>
                                            ))}
                                        </div>
                                        {insight.actionable && (
                                            <Button size="sm" variant="outline" className="w-full mt-3">
                                                <Rocket className="w-4 h-4 mr-2" />
                                                Implement Recommendation
                                            </Button>
                                        )}
                                        <div className="text-xs text-gray-500 text-center">
                                            Updated: {insight.lastUpdated.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Market Predictions Tab */}
                <TabsContent value="predictions" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {predictions.map((prediction, index) => (
                            <EnhancedCard
                                key={index}
                                title={prediction.metric}
                                subtitle={`Prediction for ${prediction.timeframe}`}
                                className="border-l-4 border-l-purple-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    <div className="text-center space-y-3">
                                        <div className="text-3xl font-bold text-gray-900">{prediction.currentValue}</div>
                                        <div className="text-sm text-gray-600">Current Value</div>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-0.5 bg-gray-300"></div>
                                            {getTrendIcon(prediction.trend)}
                                            <div className="w-8 h-0.5 bg-gray-300"></div>
                                        </div>
                                    </div>

                                    <div className="text-center space-y-3">
                                        <div className={`text-3xl font-bold ${
                                            prediction.trend === 'increasing' ? 'text-red-600' : 
                                            prediction.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600'
                                        }`}>
                                            {prediction.predictedValue}
                                        </div>
                                        <div className="text-sm text-gray-600">Predicted Value</div>
                                        <div className="text-xs">
                                            <span className={`font-medium ${
                                                prediction.trend === 'increasing' ? 'text-red-600' : 
                                                prediction.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600'
                                            }`}>
                                                {prediction.trend === 'increasing' ? '+' : prediction.trend === 'decreasing' ? '' : '±'}
                                                {Math.abs(prediction.predictedValue - prediction.currentValue).toFixed(1)}
                                            </span>
                                            <span className="text-gray-500 ml-1">
                                                ({Math.abs((prediction.predictedValue - prediction.currentValue) / prediction.currentValue * 100).toFixed(1)}%)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="text-center">
                                            <ScoreGauge 
                                                score={prediction.confidence} 
                                                size="sm"
                                                label="Confidence"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-medium text-gray-900 text-sm">Key Factors</h4>
                                            {prediction.factors.map((factor, idx) => (
                                                <div key={idx} className="text-xs p-1 bg-gray-50 rounded">
                                                    • {factor}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* AI Models Tab */}
                <TabsContent value="models" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {models.map((model) => (
                            <EnhancedCard
                                key={model.id}
                                title={model.name}
                                subtitle={`${model.type.replace('_', ' ')} model`}
                                className="border-l-4 border-l-green-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    <div className="space-y-3">
                                        <div className="text-center">
                                            <Badge className={
                                                model.status === 'active' ? 'text-green-600 bg-green-50 border-green-200' :
                                                model.status === 'training' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                                                'text-gray-600 bg-gray-50 border-gray-200'
                                            }>
                                                {model.status.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">{model.accuracy}%</div>
                                            <div className="text-sm text-gray-600">Accuracy</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Performance Metrics</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Precision:</span>
                                                <span className="font-medium">{model.precision}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Recall:</span>
                                                <span className="font-medium">{model.recall}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">F1 Score:</span>
                                                <span className="font-medium">{model.f1Score}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Training Data</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Data Points:</span>
                                                <span className="font-medium">{model.trainingData.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Last Trained:</span>
                                                <span className="font-medium">{model.lastTrained.toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Predictions:</span>
                                                <span className="font-medium">{model.predictions}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Success Rate</h4>
                                        <div className="text-center">
                                            <ScoreGauge 
                                                score={model.successRate} 
                                                size="sm"
                                                label="Success Rate"
                                            />
                                        </div>
                                        <Button size="sm" variant="outline" className="w-full">
                                            <Activity className="w-4 h-4 mr-2" />
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Performance Analytics Tab */}
                <TabsContent value="analytics" className="space-y-6">
                    <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Performance Analytics</h3>
                        <p className="text-gray-600">Detailed AI model performance metrics and analytics coming soon...</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}