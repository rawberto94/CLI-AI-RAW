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
    TrendingUp,
    TrendingDown,
    Globe,
    Users,
    Building,
    Zap,
    AlertTriangle,
    CheckCircle,
    Clock,
    BarChart3,
    LineChart,
    PieChart,
    MapPin,
    Star,
    Shield,
    Target,
    Briefcase
} from 'lucide-react'

interface MarketTrend {
    period: string
    value: number
    change: number
    direction: 'up' | 'down' | 'stable'
}

interface GeographicRate {
    region: string
    country: string
    averageRate: number
    sampleSize: number
    confidence: number
    costOfLiving: number
    skillAvailability: 'high' | 'medium' | 'low'
    marketMaturity: 'mature' | 'developing' | 'emerging'
}

interface SupplierIntelligence {
    id: string
    name: string
    tier: 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore'
    marketShare: number
    averageRate: number
    rateRange: { min: number; max: number }
    specializations: string[]
    geographies: string[]
    clientSatisfaction: number
    financialHealth: number
    growthTrend: 'growing' | 'stable' | 'declining'
    negotiationFlexibility: 'high' | 'medium' | 'low'
    lastUpdated: Date
}

interface SkillPremium {
    skill: string
    category: string
    premiumPercentage: number
    demandLevel: 'high' | 'medium' | 'low'
    supplyTightness: number
    trendDirection: 'increasing' | 'stable' | 'decreasing'
    marketExamples: {
        role: string
        baseRate: number
        premiumRate: number
    }[]
}

interface MarketIntelligenceData {
    lastUpdated: Date
    dataQuality: {
        sampleSize: number
        confidence: number
        coverage: number
    }
    trends: MarketTrend[]
    geographicRates: GeographicRate[]
    supplierIntelligence: SupplierIntelligence[]
    skillPremiums: SkillPremium[]
    marketInsights: {
        keyTrends: string[]
        opportunities: string[]
        risks: string[]
        recommendations: string[]
    }
}

export default function MarketIntelligenceEngine() {
    const [selectedRole, setSelectedRole] = useState('Senior Consultant')
    const [selectedRegion, setSelectedRegion] = useState('all')
    const [timeframe, setTimeframe] = useState('12m')
    const [loading, setLoading] = useState(false)

    // Mock comprehensive market intelligence data
    const marketData = useMemo((): MarketIntelligenceData => {
        return {
            lastUpdated: new Date(),
            dataQuality: {
                sampleSize: 2847,
                confidence: 94.2,
                coverage: 87.5
            },
            trends: [
                { period: 'Jan 2024', value: 156, change: 2.1, direction: 'up' },
                { period: 'Feb 2024', value: 158, change: 1.3, direction: 'up' },
                { period: 'Mar 2024', value: 159, change: 0.6, direction: 'up' },
                { period: 'Apr 2024', value: 161, change: 1.3, direction: 'up' },
                { period: 'May 2024', value: 159, change: -1.2, direction: 'down' },
                { period: 'Jun 2024', value: 162, change: 1.9, direction: 'up' },
                { period: 'Jul 2024', value: 164, change: 1.2, direction: 'up' },
                { period: 'Aug 2024', value: 163, change: -0.6, direction: 'down' },
                { period: 'Sep 2024', value: 165, change: 1.2, direction: 'up' },
                { period: 'Oct 2024', value: 167, change: 1.2, direction: 'up' },
                { period: 'Nov 2024', value: 169, change: 1.2, direction: 'up' },
                { period: 'Dec 2024', value: 171, change: 1.2, direction: 'up' }
            ],
            geographicRates: [
                {
                    region: 'North America',
                    country: 'United States',
                    averageRate: 175,
                    sampleSize: 847,
                    confidence: 96.2,
                    costOfLiving: 100,
                    skillAvailability: 'high',
                    marketMaturity: 'mature'
                },
                {
                    region: 'Europe',
                    country: 'Switzerland',
                    averageRate: 165,
                    sampleSize: 234,
                    confidence: 91.5,
                    costOfLiving: 125,
                    skillAvailability: 'medium',
                    marketMaturity: 'mature'
                },
                {
                    region: 'Europe',
                    country: 'United Kingdom',
                    averageRate: 145,
                    sampleSize: 456,
                    confidence: 93.8,
                    costOfLiving: 95,
                    skillAvailability: 'high',
                    marketMaturity: 'mature'
                },
                {
                    region: 'Asia Pacific',
                    country: 'India',
                    averageRate: 45,
                    sampleSize: 1234,
                    confidence: 97.1,
                    costOfLiving: 25,
                    skillAvailability: 'high',
                    marketMaturity: 'mature'
                },
                {
                    region: 'Asia Pacific',
                    country: 'Philippines',
                    averageRate: 35,
                    sampleSize: 567,
                    confidence: 89.3,
                    costOfLiving: 22,
                    skillAvailability: 'medium',
                    marketMaturity: 'developing'
                }
            ],
            supplierIntelligence: [
                {
                    id: 'deloitte',
                    name: 'Deloitte Consulting',
                    tier: 'Big 4',
                    marketShare: 18.5,
                    averageRate: 185,
                    rateRange: { min: 165, max: 220 },
                    specializations: ['Strategy', 'Digital Transformation', 'Operations'],
                    geographies: ['North America', 'Europe', 'Asia Pacific'],
                    clientSatisfaction: 4.3,
                    financialHealth: 92,
                    growthTrend: 'growing',
                    negotiationFlexibility: 'medium',
                    lastUpdated: new Date('2024-01-15')
                },
                {
                    id: 'accenture',
                    name: 'Accenture',
                    tier: 'Big 4',
                    marketShare: 22.1,
                    averageRate: 175,
                    rateRange: { min: 155, max: 210 },
                    specializations: ['Technology', 'Digital', 'Operations'],
                    geographies: ['Global'],
                    clientSatisfaction: 4.4,
                    financialHealth: 94,
                    growthTrend: 'growing',
                    negotiationFlexibility: 'high',
                    lastUpdated: new Date('2024-01-20')
                },
                {
                    id: 'cognizant',
                    name: 'Cognizant',
                    tier: 'Tier 2',
                    marketShare: 12.3,
                    averageRate: 125,
                    rateRange: { min: 95, max: 165 },
                    specializations: ['IT Services', 'Digital Engineering'],
                    geographies: ['North America', 'Europe', 'India'],
                    clientSatisfaction: 4.1,
                    financialHealth: 87,
                    growthTrend: 'stable',
                    negotiationFlexibility: 'high',
                    lastUpdated: new Date('2024-01-18')
                }
            ],
            skillPremiums: [
                {
                    skill: 'AI/Machine Learning',
                    category: 'Technology',
                    premiumPercentage: 35,
                    demandLevel: 'high',
                    supplyTightness: 85,
                    trendDirection: 'increasing',
                    marketExamples: [
                        { role: 'ML Engineer', baseRate: 150, premiumRate: 203 },
                        { role: 'Data Scientist', baseRate: 140, premiumRate: 189 }
                    ]
                },
                {
                    skill: 'Cloud Architecture',
                    category: 'Technology',
                    premiumPercentage: 25,
                    demandLevel: 'high',
                    supplyTightness: 75,
                    trendDirection: 'stable',
                    marketExamples: [
                        { role: 'Cloud Architect', baseRate: 160, premiumRate: 200 },
                        { role: 'DevOps Engineer', baseRate: 130, premiumRate: 163 }
                    ]
                },
                {
                    skill: 'Cybersecurity',
                    category: 'Security',
                    premiumPercentage: 30,
                    demandLevel: 'high',
                    supplyTightness: 80,
                    trendDirection: 'increasing',
                    marketExamples: [
                        { role: 'Security Architect', baseRate: 170, premiumRate: 221 },
                        { role: 'Security Consultant', baseRate: 145, premiumRate: 189 }
                    ]
                }
            ],
            marketInsights: {
                keyTrends: [
                    'AI/ML skills commanding 35%+ premium across all regions',
                    'Remote work driving geographic rate convergence',
                    'Increased demand for specialized cybersecurity expertise',
                    'Big 4 firms showing more rate flexibility in competitive situations'
                ],
                opportunities: [
                    'Offshore delivery models offering 60-70% cost savings',
                    'Hybrid engagement models reducing overall project costs',
                    'Performance-based pricing gaining acceptance',
                    'Multi-year contracts enabling 5-10% rate discounts'
                ],
                risks: [
                    'Talent shortage driving rates up in specialized areas',
                    'Inflation pressure on all service categories',
                    'Currency fluctuations affecting offshore rates',
                    'Increased competition for top-tier talent'
                ],
                recommendations: [
                    'Lock in rates for specialized skills before further increases',
                    'Consider hybrid delivery models for cost optimization',
                    'Negotiate performance-based pricing for better value',
                    'Diversify supplier base to reduce dependency risk'
                ]
            }
        }
    }, [selectedRole, selectedRegion, timeframe])

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 95) return 'text-green-600 bg-green-50 border-green-200'
        if (confidence >= 85) return 'text-blue-600 bg-blue-50 border-blue-200'
        if (confidence >= 75) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
        return 'text-red-600 bg-red-50 border-red-200'
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'Big 4': return 'text-purple-600 bg-purple-50 border-purple-200'
            case 'Tier 2': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'Boutique': return 'text-green-600 bg-green-50 border-green-200'
            case 'Offshore': return 'text-orange-600 bg-orange-50 border-orange-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getDemandColor = (level: string) => {
        switch (level) {
            case 'high': return 'text-red-600 bg-red-50 border-red-200'
            case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'low': return 'text-green-600 bg-green-50 border-green-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState 
                    message="Loading market intelligence..."
                    details="Analyzing global rate data and market trends"
                />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Market Intelligence Engine</h1>
                    <p className="text-gray-600 mt-1">Real-time market data, trends, and competitive intelligence</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className={getConfidenceColor(marketData.dataQuality.confidence)}>
                        {marketData.dataQuality.confidence}% Confidence
                    </Badge>
                    <Button variant="outline" size="sm">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Data Quality Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Sample Size"
                    value={marketData.dataQuality.sampleSize.toLocaleString()}
                    subtitle="Data points analyzed"
                    icon={<Users className="w-5 h-5" />}
                    color="blue"
                />
                <MetricCard
                    title="Market Coverage"
                    value={`${marketData.dataQuality.coverage}%`}
                    subtitle="Geographic coverage"
                    icon={<Globe className="w-5 h-5" />}
                    color="green"
                />
                <MetricCard
                    title="Last Updated"
                    value="Real-time"
                    subtitle={marketData.lastUpdated.toLocaleDateString()}
                    icon={<Clock className="w-5 h-5" />}
                    color="purple"
                />
            </div>

            {/* Main Content */}
            <Tabs defaultValue="trends" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="trends">Market Trends</TabsTrigger>
                    <TabsTrigger value="geography">Geographic Rates</TabsTrigger>
                    <TabsTrigger value="suppliers">Supplier Intelligence</TabsTrigger>
                    <TabsTrigger value="skills">Skill Premiums</TabsTrigger>
                    <TabsTrigger value="insights">Market Insights</TabsTrigger>
                </TabsList>

                {/* Market Trends Tab */}
                <TabsContent value="trends" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Rate Trend Analysis"
                            subtitle="12-month rate evolution for Senior Consultant"
                        >
                            <div className="space-y-4">
                                <div className="h-64 flex items-center justify-center border border-gray-200 rounded bg-gray-50">
                                    <div className="text-center">
                                        <LineChart className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <div className="text-sm text-gray-600">Interactive trend chart</div>
                                        <div className="text-xs text-gray-500">CHF 156 → CHF 171 (+9.6%)</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="p-3 bg-green-50 rounded border border-green-200">
                                        <div className="text-lg font-bold text-green-900">+9.6%</div>
                                        <div className="text-sm text-green-600">YoY Growth</div>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-lg font-bold text-blue-900">CHF 171</div>
                                        <div className="text-sm text-blue-600">Current Rate</div>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                                        <div className="text-lg font-bold text-purple-900">8/12</div>
                                        <div className="text-sm text-purple-600">Months Up</div>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Trend Drivers"
                            subtitle="Key factors influencing rate changes"
                        >
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
                                        <TrendingUp className="w-5 h-5 text-red-600" />
                                        <div>
                                            <div className="font-medium text-red-900">Talent Shortage</div>
                                            <div className="text-sm text-red-600">15% increase in demand, 5% decrease in supply</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded">
                                        <TrendingUp className="w-5 h-5 text-orange-600" />
                                        <div>
                                            <div className="font-medium text-orange-900">Inflation Pressure</div>
                                            <div className="text-sm text-orange-600">Cost of living increases driving rate adjustments</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                        <Zap className="w-5 h-5 text-blue-600" />
                                        <div>
                                            <div className="font-medium text-blue-900">Digital Transformation</div>
                                            <div className="text-sm text-blue-600">Increased demand for specialized skills</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
                                        <Globe className="w-5 h-5 text-green-600" />
                                        <div>
                                            <div className="font-medium text-green-900">Remote Work</div>
                                            <div className="text-sm text-green-600">Geographic arbitrage opportunities</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>
                </TabsContent>

                {/* Geographic Rates Tab */}
                <TabsContent value="geography" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {marketData.geographicRates.map((geo, index) => (
                            <EnhancedCard
                                key={index}
                                title={`${geo.country} (${geo.region})`}
                                subtitle={`Average rate: CHF ${geo.averageRate}/hr`}
                                className="border-l-4 border-l-blue-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-blue-600">CHF {geo.averageRate}</div>
                                        <div className="text-sm text-gray-600">Hourly Rate</div>
                                        <Badge className={getConfidenceColor(geo.confidence)} variant="outline">
                                            {geo.confidence}% confidence
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Market Characteristics</h4>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Sample Size:</span>
                                                <span className="font-medium">{geo.sampleSize}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Cost of Living:</span>
                                                <span className="font-medium">{geo.costOfLiving}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Market Maturity:</span>
                                                <Badge variant="outline">{geo.marketMaturity}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Skill Availability</h4>
                                        <div className="text-center">
                                            <Badge className={getDemandColor(geo.skillAvailability)}>
                                                {geo.skillAvailability.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-gray-500 text-center">
                                            Talent pool depth and accessibility
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Cost Advantage</h4>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {Math.round(((175 - geo.averageRate) / 175) * 100)}%
                                            </div>
                                            <div className="text-sm text-gray-600">vs US rates</div>
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Supplier Intelligence Tab */}
                <TabsContent value="suppliers" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {marketData.supplierIntelligence.map((supplier) => (
                            <EnhancedCard
                                key={supplier.id}
                                title={supplier.name}
                                subtitle={`${supplier.tier} • ${supplier.marketShare}% market share`}
                                className="border-l-4 border-l-purple-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Rate Information</h4>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-purple-600">CHF {supplier.averageRate}</div>
                                            <div className="text-sm text-gray-600">Average Rate</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Range: CHF {supplier.rateRange.min} - {supplier.rateRange.max}
                                            </div>
                                        </div>
                                        <Badge className={getTierColor(supplier.tier)}>
                                            {supplier.tier}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Performance Metrics</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Client Satisfaction</span>
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-4 h-4 text-yellow-500" />
                                                    <span className="font-medium">{supplier.clientSatisfaction}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Financial Health</span>
                                                <span className="font-medium">{supplier.financialHealth}%</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Growth Trend</span>
                                                <Badge variant="outline">{supplier.growthTrend}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Specializations</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {supplier.specializations.map((spec, index) => (
                                                <Badge key={index} variant="outline" className="text-xs">
                                                    {spec}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Coverage: {supplier.geographies.join(', ')}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Negotiation Intel</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Flexibility</span>
                                                <Badge className={
                                                    supplier.negotiationFlexibility === 'high' ? 'text-green-600 bg-green-50 border-green-200' :
                                                    supplier.negotiationFlexibility === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                                    'text-red-600 bg-red-50 border-red-200'
                                                }>
                                                    {supplier.negotiationFlexibility}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Last updated: {supplier.lastUpdated.toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Skill Premiums Tab */}
                <TabsContent value="skills" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {marketData.skillPremiums.map((skill, index) => (
                            <EnhancedCard
                                key={index}
                                title={skill.skill}
                                subtitle={`${skill.category} • ${skill.premiumPercentage}% premium`}
                                className="border-l-4 border-l-orange-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="text-center space-y-3">
                                        <div className="text-3xl font-bold text-orange-600">+{skill.premiumPercentage}%</div>
                                        <div className="text-sm text-gray-600">Rate Premium</div>
                                        <Badge className={getDemandColor(skill.demandLevel)}>
                                            {skill.demandLevel} demand
                                        </Badge>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Market Dynamics</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Supply Tightness</span>
                                                <span className="font-medium">{skill.supplyTightness}%</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Trend Direction</span>
                                                <div className="flex items-center gap-1">
                                                    {skill.trendDirection === 'increasing' ? (
                                                        <TrendingUp className="w-4 h-4 text-red-500" />
                                                    ) : skill.trendDirection === 'decreasing' ? (
                                                        <TrendingDown className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <div className="w-4 h-4 bg-gray-400 rounded-full" />
                                                    )}
                                                    <span className="text-sm font-medium">{skill.trendDirection}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Market Examples</h4>
                                        <div className="space-y-2">
                                            {skill.marketExamples.map((example, idx) => (
                                                <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                                                    <div className="font-medium">{example.role}</div>
                                                    <div className="text-gray-600">
                                                        CHF {example.baseRate} → CHF {example.premiumRate}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Market Insights Tab */}
                <TabsContent value="insights" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Key Market Trends"
                            subtitle="Current market dynamics"
                            className="border-l-4 border-l-blue-500"
                        >
                            <div className="space-y-3">
                                {marketData.marketInsights.keyTrends.map((trend, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                        <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div className="text-sm text-blue-900">{trend}</div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Market Opportunities"
                            subtitle="Cost optimization potential"
                            className="border-l-4 border-l-green-500"
                        >
                            <div className="space-y-3">
                                {marketData.marketInsights.opportunities.map((opportunity, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
                                        <Target className="w-5 h-5 text-green-600 mt-0.5" />
                                        <div className="text-sm text-green-900">{opportunity}</div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Market Risks"
                            subtitle="Potential challenges"
                            className="border-l-4 border-l-red-500"
                        >
                            <div className="space-y-3">
                                {marketData.marketInsights.risks.map((risk, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                                        <div className="text-sm text-red-900">{risk}</div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Strategic Recommendations"
                            subtitle="Actionable insights"
                            className="border-l-4 border-l-purple-500"
                        >
                            <div className="space-y-3">
                                {marketData.marketInsights.recommendations.map((recommendation, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded">
                                        <Briefcase className="w-5 h-5 text-purple-600 mt-0.5" />
                                        <div className="text-sm text-purple-900">{recommendation}</div>
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