'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { ScoreGauge } from '@/components/ui/data-visualization'
import {
    BarChart3,
    TrendingUp,
    Users,
    DollarSign,
    Target,
    Brain,
    Network,
    TestTube,
    Settings,
    Zap,
    Shield,
    Clock,
    Award,
    Rocket,
    Eye,
    Activity,
    CheckCircle,
    AlertTriangle,
    Lightbulb
} from 'lucide-react'

interface UseCaseModule {
    id: string
    name: string
    description: string
    status: 'active' | 'beta' | 'coming_soon'
    category: 'core' | 'advanced' | 'ai_powered' | 'integration'
    icon: React.ReactNode
    path: string
    metrics: {
        usage: number
        accuracy: number
        value: number
    }
    features: string[]
    lastUpdated: Date
}

export default function ProcurementHubPage() {
    const [selectedCategory, setSelectedCategory] = useState<string>('all')

    const useCaseModules: UseCaseModule[] = [
        {
            id: 'rate-benchmarking',
            name: 'Rate Benchmarking',
            description: 'Advanced rate comparison and market intelligence with real-time data',
            status: 'active',
            category: 'core',
            icon: <BarChart3 className="w-6 h-6" />,
            path: '/use-cases/rate-benchmarking',
            metrics: {
                usage: 94.2,
                accuracy: 96.8,
                value: 2400000
            },
            features: [
                'Real-time market data integration',
                'Enhanced savings calculator',
                'Market intelligence engine',
                'Negotiation leverage assessment'
            ],
            lastUpdated: new Date('2024-01-15')
        },
        {
            id: 'supplier-analytics',
            name: 'Supplier Analytics',
            description: 'Comprehensive supplier intelligence with financial health and performance metrics',
            status: 'active',
            category: 'advanced',
            icon: <Users className="w-6 h-6" />,
            path: '/use-cases/supplier-snapshots',
            metrics: {
                usage: 87.5,
                accuracy: 92.3,
                value: 1800000
            },
            features: [
                'Financial health scoring',
                'Performance benchmarking',
                'Risk assessment matrix',
                'Competitive positioning'
            ],
            lastUpdated: new Date('2024-01-14')
        },
        {
            id: 'ai-insights',
            name: 'AI Insights Engine',
            description: 'AI-powered predictive analytics and intelligent recommendations',
            status: 'active',
            category: 'ai_powered',
            icon: <Brain className="w-6 h-6" />,
            path: '/use-cases/ai-insights',
            metrics: {
                usage: 78.9,
                accuracy: 89.4,
                value: 3200000
            },
            features: [
                'Predictive market analysis',
                'Anomaly detection',
                'Optimization recommendations',
                'Risk alerts and forecasting'
            ],
            lastUpdated: new Date('2024-01-15')
        },
        {
            id: 'integration-hub',
            name: 'Integration Hub',
            description: 'Centralized integration management with real-time monitoring',
            status: 'active',
            category: 'integration',
            icon: <Network className="w-6 h-6" />,
            path: '/use-cases/integration-hub',
            metrics: {
                usage: 91.7,
                accuracy: 98.2,
                value: 950000
            },
            features: [
                'Real-time data synchronization',
                'System health monitoring',
                'API management',
                'Data flow visualization'
            ],
            lastUpdated: new Date('2024-01-15')
        },
        {
            id: 'testing-validation',
            name: 'Testing & Validation',
            description: 'Comprehensive testing suite with real-world validation',
            status: 'active',
            category: 'advanced',
            icon: <TestTube className="w-6 h-6" />,
            path: '/use-cases/testing',
            metrics: {
                usage: 85.3,
                accuracy: 95.1,
                value: 680000
            },
            features: [
                'Automated test execution',
                'Real-world validation',
                'Performance benchmarking',
                'Continuous monitoring'
            ],
            lastUpdated: new Date('2024-01-14')
        },
        {
            id: 'improvement-engine',
            name: 'Improvement Engine',
            description: 'AI-powered continuous improvement and optimization system',
            status: 'active',
            category: 'ai_powered',
            icon: <Target className="w-6 h-6" />,
            path: '/use-cases/improvement',
            metrics: {
                usage: 72.4,
                accuracy: 87.9,
                value: 1270000
            },
            features: [
                'Opportunity identification',
                'Performance benchmarking',
                'Implementation roadmapping',
                'ROI calculation'
            ],
            lastUpdated: new Date('2024-01-13')
        },
        {
            id: 'advanced-analytics',
            name: 'Advanced Analytics',
            description: 'Comprehensive analytics dashboard with predictive insights',
            status: 'active',
            category: 'advanced',
            icon: <Activity className="w-6 h-6" />,
            path: '/use-cases/analytics',
            metrics: {
                usage: 89.6,
                accuracy: 93.7,
                value: 2100000
            },
            features: [
                'Predictive forecasting',
                'Trend analysis',
                'Anomaly detection',
                'Performance tracking'
            ],
            lastUpdated: new Date('2024-01-15')
        },
        {
            id: 'healthcare-compliance',
            name: 'Healthcare Compliance',
            description: 'Specialized healthcare contract compliance and risk management',
            status: 'beta',
            category: 'core',
            icon: <Shield className="w-6 h-6" />,
            path: '/use-cases/healthcare-compliance',
            metrics: {
                usage: 67.8,
                accuracy: 91.2,
                value: 890000
            },
            features: [
                'HIPAA compliance tracking',
                'Patient data security',
                'Insurance gap analysis',
                'Regulatory monitoring'
            ],
            lastUpdated: new Date('2024-01-12')
        }
    ]

    const filteredModules = selectedCategory === 'all' 
        ? useCaseModules 
        : useCaseModules.filter(module => module.category === selectedCategory)

    const overallMetrics = {
        totalValue: useCaseModules.reduce((sum, module) => sum + module.metrics.value, 0),
        avgAccuracy: useCaseModules.reduce((sum, module) => sum + module.metrics.accuracy, 0) / useCaseModules.length,
        avgUsage: useCaseModules.reduce((sum, module) => sum + module.metrics.usage, 0) / useCaseModules.length,
        activeModules: useCaseModules.filter(module => module.status === 'active').length
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-50 border-green-200'
            case 'beta': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'coming_soon': return 'text-gray-600 bg-gray-50 border-gray-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'core': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'advanced': return 'text-purple-600 bg-purple-50 border-purple-200'
            case 'ai_powered': return 'text-green-600 bg-green-50 border-green-200'
            case 'integration': return 'text-orange-600 bg-orange-50 border-orange-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Procurement Intelligence Hub
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Comprehensive AI-powered procurement platform with advanced analytics and insights
                    </p>
                    
                    {/* Overall Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <MetricCard
                            title="Total Value"
                            value={`$${(overallMetrics.totalValue / 1000000).toFixed(1)}M`}
                            subtitle="Identified opportunities"
                            icon={<DollarSign className="w-5 h-5" />}
                            trend={{ value: 23.4, label: "increase", positive: true }}
                            color="green"
                        />
                        <MetricCard
                            title="Average Accuracy"
                            value={`${Math.round(overallMetrics.avgAccuracy)}%`}
                            subtitle="Prediction accuracy"
                            icon={<Target className="w-5 h-5" />}
                            trend={{ value: 4.2, label: "improvement", positive: true }}
                            color="blue"
                        />
                        <MetricCard
                            title="Platform Usage"
                            value={`${Math.round(overallMetrics.avgUsage)}%`}
                            subtitle="User adoption rate"
                            icon={<Activity className="w-5 h-5" />}
                            trend={{ value: 8.7, label: "growth", positive: true }}
                            color="purple"
                        />
                        <MetricCard
                            title="Active Modules"
                            value={overallMetrics.activeModules.toString()}
                            subtitle="Production ready"
                            icon={<CheckCircle className="w-5 h-5" />}
                            trend={{ value: 2, label: "new modules", positive: true }}
                            color="orange"
                        />
                    </div>
                </div>

                {/* Category Filter */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <Button
                        variant={selectedCategory === 'all' ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory('all')}
                        size="sm"
                    >
                        All Modules
                    </Button>
                    <Button
                        variant={selectedCategory === 'core' ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory('core')}
                        size="sm"
                    >
                        Core Features
                    </Button>
                    <Button
                        variant={selectedCategory === 'advanced' ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory('advanced')}
                        size="sm"
                    >
                        Advanced Analytics
                    </Button>
                    <Button
                        variant={selectedCategory === 'ai_powered' ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory('ai_powered')}
                        size="sm"
                    >
                        AI-Powered
                    </Button>
                    <Button
                        variant={selectedCategory === 'integration' ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory('integration')}
                        size="sm"
                    >
                        Integration
                    </Button>
                </div>

                {/* Use Case Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredModules.map((module) => (
                        <EnhancedCard
                            key={module.id}
                            variant="gradient"
                            hover
                            className="h-full"
                        >
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            {module.icon}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{module.name}</CardTitle>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Badge className={getStatusColor(module.status)} variant="outline">
                                            {module.status.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                        <Badge className={getCategoryColor(module.category)} variant="outline">
                                            {module.category.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600">{module.description}</p>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Performance Metrics */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-2 bg-white rounded border">
                                        <div className="text-lg font-bold text-blue-600">{module.metrics.usage}%</div>
                                        <div className="text-xs text-gray-600">Usage</div>
                                    </div>
                                    <div className="text-center p-2 bg-white rounded border">
                                        <div className="text-lg font-bold text-green-600">{module.metrics.accuracy}%</div>
                                        <div className="text-xs text-gray-600">Accuracy</div>
                                    </div>
                                    <div className="text-center p-2 bg-white rounded border">
                                        <div className="text-lg font-bold text-purple-600">
                                            ${(module.metrics.value / 1000).toFixed(0)}K
                                        </div>
                                        <div className="text-xs text-gray-600">Value</div>
                                    </div>
                                </div>

                                {/* Key Features */}
                                <div className="space-y-2">
                                    <h4 className="font-medium text-gray-900 text-sm">Key Features</h4>
                                    <div className="space-y-1">
                                        {module.features.slice(0, 3).map((feature, index) => (
                                            <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                                {feature}
                                            </div>
                                        ))}
                                        {module.features.length > 3 && (
                                            <div className="text-xs text-gray-500">
                                                +{module.features.length - 3} more features
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    <Link href={module.path} className="flex-1">
                                        <Button 
                                            size="sm" 
                                            className="w-full"
                                            disabled={module.status === 'coming_soon'}
                                        >
                                            {module.status === 'coming_soon' ? (
                                                <>
                                                    <Clock className="w-4 h-4 mr-2" />
                                                    Coming Soon
                                                </>
                                            ) : (
                                                <>
                                                    <Rocket className="w-4 h-4 mr-2" />
                                                    Launch
                                                </>
                                            )}
                                        </Button>
                                    </Link>
                                    <Button size="sm" variant="outline">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Last Updated */}
                                <div className="text-xs text-gray-500 text-center pt-2 border-t">
                                    Updated: {module.lastUpdated.toLocaleDateString()}
                                </div>
                            </CardContent>
                        </EnhancedCard>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="mt-12 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <Link href="/use-cases/rate-benchmarking">
                            <Button className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Start Rate Analysis
                            </Button>
                        </Link>
                        <Link href="/use-cases/ai-insights">
                            <Button variant="outline" className="flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                Generate AI Insights
                            </Button>
                        </Link>
                        <Link href="/use-cases/testing">
                            <Button variant="outline" className="flex items-center gap-2">
                                <TestTube className="w-4 h-4" />
                                Run Validation Tests
                            </Button>
                        </Link>
                        <Link href="/use-cases/integration-hub">
                            <Button variant="outline" className="flex items-center gap-2">
                                <Network className="w-4 h-4" />
                                Monitor Integrations
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Platform Benefits */}
                <div className="mt-16 bg-white rounded-2xl p-8 shadow-lg">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Platform Benefits</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <DollarSign className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Cost Optimization</h3>
                            <p className="text-gray-600 text-sm">
                                Average 18.5% cost reduction through AI-powered rate optimization and negotiation strategies
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Brain className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">AI Intelligence</h3>
                            <p className="text-gray-600 text-sm">
                                Advanced machine learning models with 94%+ prediction accuracy for market trends and risks
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-purple-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Process Efficiency</h3>
                            <p className="text-gray-600 text-sm">
                                60% reduction in negotiation prep time through automated analysis and intelligent recommendations
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}