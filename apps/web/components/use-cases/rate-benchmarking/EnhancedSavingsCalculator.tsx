'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { ScoreGauge } from '@/components/ui/data-visualization'
import {
    Calculator,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Target,
    AlertTriangle,
    CheckCircle,
    Clock,
    Zap,
    BarChart3,
    PieChart,
    Calendar,
    Shield
} from 'lucide-react'

interface CostSavingsAnalysis {
    currentAnnualSpend: number
    benchmarkRate: number
    targetRate: number
    potentialSavings: {
        annual: number
        threeYear: number
        percentage: number
    }
    riskAdjustedSavings: number
    implementationCost: number
    netSavings: number
    paybackPeriod: number
    confidence: number
}

interface NegotiationLeverage {
    marketPosition: 'strong' | 'moderate' | 'weak'
    volumeAdvantage: number
    relationshipScore: number
    competitiveAlternatives: number
    recommendedStrategy: string
    expectedOutcome: {
        minSavings: number
        maxSavings: number
        probability: number
    }
}

interface SavingsScenario {
    name: string
    targetReduction: number
    probability: number
    implementationRisk: 'low' | 'medium' | 'high'
    timeline: number
    description: string
}

export default function EnhancedSavingsCalculator() {
    const [currentRate, setCurrentRate] = useState(175)
    const [benchmarkRate, setBenchmarkRate] = useState(156)
    const [annualVolume, setAnnualVolume] = useState(2080) // hours
    const [relationshipYears, setRelationshipYears] = useState(3)
    const [performanceScore, setPerformanceScore] = useState(85)
    const [marketAlternatives, setMarketAlternatives] = useState(4)
    const [selectedScenario, setSelectedScenario] = useState<string>('conservative')

    // Predefined scenarios
    const scenarios: Record<string, SavingsScenario> = {
        conservative: {
            name: 'Conservative',
            targetReduction: 5,
            probability: 90,
            implementationRisk: 'low',
            timeline: 30,
            description: 'Low-risk approach with high success probability'
        },
        moderate: {
            name: 'Moderate',
            targetReduction: 12,
            probability: 75,
            implementationRisk: 'medium',
            timeline: 60,
            description: 'Balanced approach with good savings potential'
        },
        aggressive: {
            name: 'Aggressive',
            targetReduction: 20,
            probability: 60,
            implementationRisk: 'high',
            timeline: 90,
            description: 'High-impact approach requiring strong negotiation'
        },
        market: {
            name: 'Market Rate',
            targetReduction: ((currentRate - benchmarkRate) / currentRate) * 100,
            probability: 80,
            implementationRisk: 'medium',
            timeline: 45,
            description: 'Align with market benchmark rates'
        }
    }

    // Calculate negotiation leverage
    const negotiationLeverage = useMemo((): NegotiationLeverage => {
        const volumeScore = Math.min(100, (annualVolume / 2000) * 50)
        const relationshipScore = Math.min(100, relationshipYears * 20)
        const performanceBonus = performanceScore > 80 ? 20 : performanceScore > 60 ? 10 : 0
        const alternativesScore = Math.min(100, marketAlternatives * 15)

        const overallScore = (volumeScore + relationshipScore + performanceBonus + alternativesScore) / 4

        let marketPosition: 'strong' | 'moderate' | 'weak'
        if (overallScore >= 75) marketPosition = 'strong'
        else if (overallScore >= 50) marketPosition = 'moderate'
        else marketPosition = 'weak'

        const baseReduction = overallScore / 100 * 0.25 // Up to 25% reduction potential
        const minSavings = baseReduction * 0.6
        const maxSavings = baseReduction * 1.4

        return {
            marketPosition,
            volumeAdvantage: volumeScore,
            relationshipScore,
            competitiveAlternatives: alternativesScore,
            recommendedStrategy: getRecommendedStrategy(marketPosition, overallScore),
            expectedOutcome: {
                minSavings: minSavings * currentRate * annualVolume,
                maxSavings: maxSavings * currentRate * annualVolume,
                probability: Math.min(95, overallScore + 10)
            }
        }
    }, [currentRate, annualVolume, relationshipYears, performanceScore, marketAlternatives])

    // Calculate cost savings analysis
    const savingsAnalysis = useMemo((): CostSavingsAnalysis => {
        const scenario = scenarios[selectedScenario]
        const targetRate = currentRate * (1 - scenario.targetReduction / 100)
        const currentAnnualSpend = currentRate * annualVolume
        const targetAnnualSpend = targetRate * annualVolume
        const annualSavings = currentAnnualSpend - targetAnnualSpend
        const threeYearSavings = annualSavings * 3

        // Risk adjustment based on scenario and leverage
        const leverageMultiplier = negotiationLeverage.marketPosition === 'strong' ? 1.0 : 
                                 negotiationLeverage.marketPosition === 'moderate' ? 0.85 : 0.7
        const riskMultiplier = scenario.implementationRisk === 'low' ? 0.95 : 
                              scenario.implementationRisk === 'medium' ? 0.85 : 0.75

        const riskAdjustedSavings = annualSavings * leverageMultiplier * riskMultiplier

        // Implementation costs
        const implementationCost = Math.max(5000, annualSavings * 0.05) // 5% of savings or $5K minimum

        const netSavings = riskAdjustedSavings - implementationCost
        const paybackPeriod = implementationCost / (riskAdjustedSavings / 12) // months

        // Confidence calculation
        const confidence = scenario.probability * leverageMultiplier

        return {
            currentAnnualSpend,
            benchmarkRate: targetRate,
            targetRate,
            potentialSavings: {
                annual: annualSavings,
                threeYear: threeYearSavings,
                percentage: scenario.targetReduction
            },
            riskAdjustedSavings,
            implementationCost,
            netSavings,
            paybackPeriod,
            confidence
        }
    }, [currentRate, benchmarkRate, annualVolume, selectedScenario, negotiationLeverage])

    function getRecommendedStrategy(position: string, score: number): string {
        if (position === 'strong') {
            return 'Leverage volume and performance for aggressive rate reduction. Consider multi-year locks.'
        } else if (position === 'moderate') {
            return 'Focus on market alignment and performance-based pricing. Gradual reduction approach.'
        } else {
            return 'Emphasize relationship value and seek win-win solutions. Consider value-added services.'
        }
    }

    const getLeverageColor = (position: string) => {
        switch (position) {
            case 'strong': return 'text-green-600 bg-green-50 border-green-200'
            case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'weak': return 'text-red-600 bg-red-50 border-red-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'low': return 'text-green-600 bg-green-50 border-green-200'
            case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'high': return 'text-red-600 bg-red-50 border-red-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Enhanced Savings Calculator</h1>
                    <p className="text-gray-600 mt-1">Advanced cost savings analysis with risk adjustment and negotiation leverage</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Export Analysis
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Parameters */}
                <div className="space-y-6">
                    <EnhancedCard
                        title="Input Parameters"
                        subtitle="Configure your negotiation scenario"
                        className="h-fit"
                    >
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="currentRate">Current Hourly Rate (CHF)</Label>
                                <Input
                                    id="currentRate"
                                    type="number"
                                    value={currentRate}
                                    onChange={(e) => setCurrentRate(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>
                            
                            <div>
                                <Label htmlFor="benchmarkRate">Market Benchmark (CHF)</Label>
                                <Input
                                    id="benchmarkRate"
                                    type="number"
                                    value={benchmarkRate}
                                    onChange={(e) => setBenchmarkRate(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="annualVolume">Annual Hours</Label>
                                <Input
                                    id="annualVolume"
                                    type="number"
                                    value={annualVolume}
                                    onChange={(e) => setAnnualVolume(Number(e.target.value))}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label>Relationship Years: {relationshipYears}</Label>
                                <Slider
                                    value={[relationshipYears]}
                                    onValueChange={(value) => setRelationshipYears(value[0])}
                                    max={10}
                                    min={0}
                                    step={1}
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <Label>Performance Score: {performanceScore}%</Label>
                                <Slider
                                    value={[performanceScore]}
                                    onValueChange={(value) => setPerformanceScore(value[0])}
                                    max={100}
                                    min={0}
                                    step={5}
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <Label>Market Alternatives: {marketAlternatives}</Label>
                                <Slider
                                    value={[marketAlternatives]}
                                    onValueChange={(value) => setMarketAlternatives(value[0])}
                                    max={10}
                                    min={0}
                                    step={1}
                                    className="mt-2"
                                />
                            </div>
                        </div>
                    </EnhancedCard>

                    {/* Negotiation Leverage */}
                    <EnhancedCard
                        title="Negotiation Leverage"
                        subtitle="Your position strength analysis"
                        className="h-fit"
                    >
                        <div className="space-y-4">
                            <div className="text-center">
                                <Badge className={getLeverageColor(negotiationLeverage.marketPosition)}>
                                    {negotiationLeverage.marketPosition.toUpperCase()} POSITION
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Volume Advantage</span>
                                    <span className="font-medium">{Math.round(negotiationLeverage.volumeAdvantage)}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Relationship Score</span>
                                    <span className="font-medium">{Math.round(negotiationLeverage.relationshipScore)}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Alternatives</span>
                                    <span className="font-medium">{Math.round(negotiationLeverage.competitiveAlternatives)}%</span>
                                </div>
                            </div>

                            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                                <strong>Strategy:</strong> {negotiationLeverage.recommendedStrategy}
                            </div>

                            <div className="text-center">
                                <div className="text-sm text-gray-600">Expected Savings Range</div>
                                <div className="font-bold text-lg">
                                    CHF {Math.round(negotiationLeverage.expectedOutcome.minSavings).toLocaleString()} - 
                                    CHF {Math.round(negotiationLeverage.expectedOutcome.maxSavings).toLocaleString()}
                                </div>
                                <div className="text-sm text-green-600">
                                    {Math.round(negotiationLeverage.expectedOutcome.probability)}% probability
                                </div>
                            </div>
                        </div>
                    </EnhancedCard>
                </div>

                {/* Scenarios & Analysis */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Scenario Selection */}
                    <EnhancedCard
                        title="Negotiation Scenarios"
                        subtitle="Choose your approach strategy"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.entries(scenarios).map(([key, scenario]) => (
                                <div
                                    key={key}
                                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                        selectedScenario === key
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setSelectedScenario(key)}
                                >
                                    <div className="text-center">
                                        <div className="font-medium text-gray-900">{scenario.name}</div>
                                        <div className="text-2xl font-bold text-blue-600 my-2">
                                            {Math.round(scenario.targetReduction)}%
                                        </div>
                                        <div className="text-sm text-gray-600 mb-2">{scenario.description}</div>
                                        <div className="flex items-center justify-between text-xs">
                                            <Badge className={getRiskColor(scenario.implementationRisk)} variant="outline">
                                                {scenario.implementationRisk} risk
                                            </Badge>
                                            <span className="text-gray-500">{scenario.timeline}d</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </EnhancedCard>

                    {/* Savings Analysis Results */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard
                            title="Annual Savings"
                            value={`CHF ${Math.round(savingsAnalysis.potentialSavings.annual).toLocaleString()}`}
                            subtitle="Gross potential savings"
                            icon={<DollarSign className="w-5 h-5" />}
                            trend={{ value: savingsAnalysis.potentialSavings.percentage, label: "reduction", positive: true }}
                            color="green"
                        />
                        <MetricCard
                            title="Risk-Adjusted"
                            value={`CHF ${Math.round(savingsAnalysis.riskAdjustedSavings).toLocaleString()}`}
                            subtitle="Probability-weighted savings"
                            icon={<Shield className="w-5 h-5" />}
                            trend={{ value: savingsAnalysis.confidence, label: "confidence", positive: true }}
                            color="blue"
                        />
                        <MetricCard
                            title="Net Savings"
                            value={`CHF ${Math.round(savingsAnalysis.netSavings).toLocaleString()}`}
                            subtitle="After implementation costs"
                            icon={<Target className="w-5 h-5" />}
                            trend={{ value: savingsAnalysis.paybackPeriod, label: "months", positive: false }}
                            color="purple"
                        />
                    </div>

                    {/* Detailed Analysis */}
                    <EnhancedCard
                        title="Detailed Financial Analysis"
                        subtitle="Comprehensive savings breakdown"
                    >
                        <Tabs defaultValue="summary" className="space-y-4">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="summary">Summary</TabsTrigger>
                                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
                            </TabsList>

                            <TabsContent value="summary" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Current State</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Current Rate:</span>
                                                <span className="font-medium">CHF {currentRate}/hr</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Annual Hours:</span>
                                                <span className="font-medium">{annualVolume.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Annual Spend:</span>
                                                <span className="font-medium">CHF {Math.round(savingsAnalysis.currentAnnualSpend).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Target State</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Target Rate:</span>
                                                <span className="font-medium">CHF {Math.round(savingsAnalysis.targetRate)}/hr</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Rate Reduction:</span>
                                                <span className="font-medium text-green-600">
                                                    {Math.round(savingsAnalysis.potentialSavings.percentage)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">New Annual Spend:</span>
                                                <span className="font-medium">
                                                    CHF {Math.round(savingsAnalysis.currentAnnualSpend - savingsAnalysis.potentialSavings.annual).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                        <div className="p-3 bg-green-50 rounded border border-green-200">
                                            <div className="text-2xl font-bold text-green-900">
                                                CHF {Math.round(savingsAnalysis.potentialSavings.annual).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-green-600">Annual Savings</div>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                            <div className="text-2xl font-bold text-blue-900">
                                                CHF {Math.round(savingsAnalysis.potentialSavings.threeYear).toLocaleString()}
                                            </div>
                                            <div className="text-sm text-blue-600">3-Year Savings</div>
                                        </div>
                                        <div className="p-3 bg-purple-50 rounded border border-purple-200">
                                            <div className="text-2xl font-bold text-purple-900">
                                                {Math.round(savingsAnalysis.paybackPeriod * 10) / 10}
                                            </div>
                                            <div className="text-sm text-purple-600">Payback (Months)</div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="timeline">
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <ScoreGauge 
                                            score={savingsAnalysis.confidence} 
                                            size="lg"
                                            label="Success Probability"
                                        />
                                    </div>
                                    <div className="text-center text-sm text-gray-600">
                                        Implementation Timeline: {scenarios[selectedScenario].timeline} days
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="risks">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                                            <h4 className="font-medium text-yellow-900 mb-2">Implementation Risks</h4>
                                            <ul className="text-sm text-yellow-700 space-y-1">
                                                <li>• Supplier resistance to rate reduction</li>
                                                <li>• Service quality impact concerns</li>
                                                <li>• Contract renegotiation complexity</li>
                                                <li>• Market rate volatility</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-green-50 border border-green-200 rounded">
                                            <h4 className="font-medium text-green-900 mb-2">Mitigation Strategies</h4>
                                            <ul className="text-sm text-green-700 space-y-1">
                                                <li>• Phased implementation approach</li>
                                                <li>• Performance-based pricing model</li>
                                                <li>• Multi-year rate lock options</li>
                                                <li>• Alternative supplier evaluation</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </EnhancedCard>
                </div>
            </div>
        </div>
    )
}