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
    TestTube,
    CheckCircle,
    XCircle,
    AlertTriangle,
    TrendingUp,
    BarChart3,
    Target,
    Zap,
    Clock,
    DollarSign,
    Users,
    FileText,
    Play,
    Pause,
    RotateCcw,
    Download
} from 'lucide-react'

interface TestCase {
    id: string
    name: string
    category: 'savings_calculation' | 'market_intelligence' | 'negotiation_leverage' | 'supplier_analysis'
    status: 'passed' | 'failed' | 'running' | 'pending'
    executionTime: number
    accuracy: number
    expectedResult: any
    actualResult: any
    errorMessage?: string
    lastRun: Date
    runCount: number
}

interface TestSuite {
    id: string
    name: string
    description: string
    testCases: TestCase[]
    overallStatus: 'passed' | 'failed' | 'running' | 'pending'
    passRate: number
    avgAccuracy: number
    totalExecutionTime: number
}

interface RealWorldValidation {
    negotiationId: string
    supplier: string
    role: string
    initialRate: number
    finalRate: number
    actualSavings: number
    predictedSavings: number
    accuracy: number
    leverageFactors: {
        volume: number
        relationshipYears: number
        performanceScore: number
        alternatives: number
    }
    outcome: 'success' | 'partial' | 'failed'
    notes: string
}

export default function ProcurementTestingDashboard() {
    const [testSuites, setTestSuites] = useState<TestSuite[]>([])
    const [realWorldData, setRealWorldData] = useState<RealWorldValidation[]>([])
    const [loading, setLoading] = useState(true)
    const [runningTests, setRunningTests] = useState(false)
    const [selectedSuite, setSelectedSuite] = useState<string | null>(null)

    useEffect(() => {
        loadTestData()
    }, [])

    const loadTestData = async () => {
        setLoading(true)
        
        // Mock test data - in production this would come from actual test runs
        const mockTestSuites: TestSuite[] = [
            {
                id: 'savings-calc',
                name: 'Savings Calculator Tests',
                description: 'Comprehensive testing of savings calculation algorithms',
                overallStatus: 'passed',
                passRate: 94.2,
                avgAccuracy: 91.5,
                totalExecutionTime: 2340,
                testCases: [
                    {
                        id: 'sc-001',
                        name: 'High Volume Negotiation Leverage',
                        category: 'savings_calculation',
                        status: 'passed',
                        executionTime: 120,
                        accuracy: 95.2,
                        expectedResult: { leverageScore: 85, savingsPotential: 180000 },
                        actualResult: { leverageScore: 87, savingsPotential: 175000 },
                        lastRun: new Date('2024-01-15T10:30:00'),
                        runCount: 47
                    },
                    {
                        id: 'sc-002',
                        name: 'Risk Adjustment Calculation',
                        category: 'savings_calculation',
                        status: 'passed',
                        executionTime: 95,
                        accuracy: 89.1,
                        expectedResult: { riskAdjustedSavings: 150000, confidence: 82 },
                        actualResult: { riskAdjustedSavings: 147000, confidence: 84 },
                        lastRun: new Date('2024-01-15T10:32:00'),
                        runCount: 52
                    },
                    {
                        id: 'sc-003',
                        name: 'Scenario Modeling Accuracy',
                        category: 'savings_calculation',
                        status: 'failed',
                        executionTime: 180,
                        accuracy: 67.3,
                        expectedResult: { conservativeScenario: 50000, aggressiveScenario: 200000 },
                        actualResult: { conservativeScenario: 45000, aggressiveScenario: 180000 },
                        errorMessage: 'Aggressive scenario prediction variance exceeds 10% threshold',
                        lastRun: new Date('2024-01-15T10:35:00'),
                        runCount: 23
                    }
                ]
            },
            {
                id: 'market-intel',
                name: 'Market Intelligence Tests',
                description: 'Validation of market data accuracy and trend analysis',
                overallStatus: 'passed',
                passRate: 96.8,
                avgAccuracy: 93.7,
                totalExecutionTime: 1890,
                testCases: [
                    {
                        id: 'mi-001',
                        name: 'Geographic Rate Validation',
                        category: 'market_intelligence',
                        status: 'passed',
                        executionTime: 200,
                        accuracy: 94.5,
                        expectedResult: { usRate: 175, indiaRate: 45, swissRate: 165 },
                        actualResult: { usRate: 175, indiaRate: 46, swissRate: 164 },
                        lastRun: new Date('2024-01-15T11:00:00'),
                        runCount: 31
                    },
                    {
                        id: 'mi-002',
                        name: 'Supplier Intelligence Accuracy',
                        category: 'market_intelligence',
                        status: 'passed',
                        executionTime: 150,
                        accuracy: 92.8,
                        expectedResult: { deloitteRate: 185, accentureRate: 175, flexibilityScore: 75 },
                        actualResult: { deloitteRate: 187, accentureRate: 173, flexibilityScore: 77 },
                        lastRun: new Date('2024-01-15T11:05:00'),
                        runCount: 28
                    }
                ]
            },
            {
                id: 'negotiation-leverage',
                name: 'Negotiation Leverage Tests',
                description: 'Testing negotiation position assessment algorithms',
                overallStatus: 'passed',
                passRate: 91.3,
                avgAccuracy: 88.9,
                totalExecutionTime: 1560,
                testCases: [
                    {
                        id: 'nl-001',
                        name: 'Strong Position Identification',
                        category: 'negotiation_leverage',
                        status: 'passed',
                        executionTime: 80,
                        accuracy: 92.1,
                        expectedResult: { position: 'strong', probability: 85 },
                        actualResult: { position: 'strong', probability: 87 },
                        lastRun: new Date('2024-01-15T11:10:00'),
                        runCount: 65
                    },
                    {
                        id: 'nl-002',
                        name: 'Weak Position Detection',
                        category: 'negotiation_leverage',
                        status: 'passed',
                        executionTime: 75,
                        accuracy: 85.7,
                        expectedResult: { position: 'weak', probability: 45 },
                        actualResult: { position: 'weak', probability: 48 },
                        lastRun: new Date('2024-01-15T11:12:00'),
                        runCount: 42
                    }
                ]
            }
        ]

        const mockRealWorldData: RealWorldValidation[] = [
            {
                negotiationId: 'NEG-2024-001',
                supplier: 'Deloitte Consulting',
                role: 'Senior Consultant',
                initialRate: 185,
                finalRate: 165,
                actualSavings: 41600,
                predictedSavings: 39200,
                accuracy: 94.2,
                leverageFactors: {
                    volume: 2080,
                    relationshipYears: 4,
                    performanceScore: 88,
                    alternatives: 3
                },
                outcome: 'success',
                notes: 'Leveraged multi-year commitment for 10.8% reduction'
            },
            {
                negotiationId: 'NEG-2024-002',
                supplier: 'Accenture',
                role: 'Project Manager',
                initialRate: 175,
                finalRate: 158,
                actualSavings: 35360,
                predictedSavings: 33800,
                accuracy: 95.6,
                leverageFactors: {
                    volume: 2080,
                    relationshipYears: 2,
                    performanceScore: 92,
                    alternatives: 4
                },
                outcome: 'success',
                notes: 'Performance-based pricing model achieved 9.7% reduction'
            },
            {
                negotiationId: 'NEG-2024-003',
                supplier: 'Cognizant',
                role: 'Software Developer',
                initialRate: 135,
                finalRate: 125,
                actualSavings: 20800,
                predictedSavings: 22400,
                accuracy: 92.9,
                leverageFactors: {
                    volume: 4160,
                    relationshipYears: 1,
                    performanceScore: 85,
                    alternatives: 5
                },
                outcome: 'success',
                notes: 'Volume discount for multiple resources'
            },
            {
                negotiationId: 'NEG-2024-004',
                supplier: 'PwC',
                role: 'Business Analyst',
                initialRate: 145,
                finalRate: 145,
                actualSavings: 0,
                predictedSavings: 7500,
                accuracy: 0,
                leverageFactors: {
                    volume: 1040,
                    relationshipYears: 6,
                    performanceScore: 95,
                    alternatives: 2
                },
                outcome: 'failed',
                notes: 'Supplier held firm due to specialized expertise and limited alternatives'
            }
        ]

        await new Promise(resolve => setTimeout(resolve, 1000))
        
        setTestSuites(mockTestSuites)
        setRealWorldData(mockRealWorldData)
        setLoading(false)
    }

    const runTestSuite = async (suiteId: string) => {
        setRunningTests(true)
        
        // Simulate test execution
        const suite = testSuites.find(s => s.id === suiteId)
        if (suite) {
            // Update test cases to running status
            const updatedSuites = testSuites.map(s => {
                if (s.id === suiteId) {
                    return {
                        ...s,
                        overallStatus: 'running' as const,
                        testCases: s.testCases.map(tc => ({ ...tc, status: 'running' as const }))
                    }
                }
                return s
            })
            setTestSuites(updatedSuites)

            // Simulate test execution delay
            await new Promise(resolve => setTimeout(resolve, 3000))

            // Update with results
            const finalSuites = testSuites.map(s => {
                if (s.id === suiteId) {
                    const passedTests = s.testCases.filter(tc => tc.status === 'passed').length
                    return {
                        ...s,
                        overallStatus: passedTests === s.testCases.length ? 'passed' as const : 'failed' as const,
                        testCases: s.testCases.map(tc => ({
                            ...tc,
                            status: Math.random() > 0.1 ? 'passed' as const : 'failed' as const,
                            lastRun: new Date(),
                            runCount: tc.runCount + 1
                        }))
                    }
                }
                return s
            })
            setTestSuites(finalSuites)
        }
        
        setRunningTests(false)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'passed': return 'text-green-600 bg-green-50 border-green-200'
            case 'failed': return 'text-red-600 bg-red-50 border-red-200'
            case 'running': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'pending': return 'text-gray-600 bg-gray-50 border-gray-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getAccuracyColor = (accuracy: number) => {
        if (accuracy >= 95) return 'text-green-600'
        if (accuracy >= 90) return 'text-blue-600'
        if (accuracy >= 80) return 'text-yellow-600'
        return 'text-red-600'
    }

    const overallStats = {
        totalTests: testSuites.reduce((sum, suite) => sum + suite.testCases.length, 0),
        passedTests: testSuites.reduce((sum, suite) => sum + suite.testCases.filter(tc => tc.status === 'passed').length, 0),
        avgAccuracy: testSuites.reduce((sum, suite) => sum + suite.avgAccuracy, 0) / testSuites.length,
        totalExecutionTime: testSuites.reduce((sum, suite) => sum + suite.totalExecutionTime, 0)
    }

    const realWorldStats = {
        totalNegotiations: realWorldData.length,
        successfulNegotiations: realWorldData.filter(n => n.outcome === 'success').length,
        avgAccuracy: realWorldData.reduce((sum, n) => sum + n.accuracy, 0) / realWorldData.length,
        totalSavings: realWorldData.reduce((sum, n) => sum + n.actualSavings, 0)
    }

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState 
                    title="Loading Testing Dashboard"
                    description="Initializing test suites and validation data"
                />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Procurement Testing Dashboard</h1>
                    <p className="text-gray-600 mt-1">Comprehensive testing and validation of procurement use cases</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => runTestSuite('all')}
                        disabled={runningTests}
                    >
                        {runningTests ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {runningTests ? 'Running...' : 'Run All Tests'}
                    </Button>
                    <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export Results
                    </Button>
                </div>
            </div>

            {/* Overall Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    title="Test Coverage"
                    value={`${overallStats.passedTests}/${overallStats.totalTests}`}
                    subtitle={`${Math.round((overallStats.passedTests / overallStats.totalTests) * 100)}% pass rate`}
                    icon={<TestTube className="w-5 h-5" />}
                    trend={{ value: 94.2, label: "pass rate", positive: true }}
                    color="blue"
                />
                <MetricCard
                    title="Prediction Accuracy"
                    value={`${Math.round(overallStats.avgAccuracy)}%`}
                    subtitle="Average accuracy across all tests"
                    icon={<Target className="w-5 h-5" />}
                    trend={{ value: 2.3, label: "improvement", positive: true }}
                    color="green"
                />
                <MetricCard
                    title="Real-World Validation"
                    value={`${realWorldStats.successfulNegotiations}/${realWorldStats.totalNegotiations}`}
                    subtitle={`${Math.round(realWorldStats.avgAccuracy)}% prediction accuracy`}
                    icon={<CheckCircle className="w-5 h-5" />}
                    trend={{ value: 1.8, label: "accuracy", positive: true }}
                    color="purple"
                />
                <MetricCard
                    title="Execution Time"
                    value={`${Math.round(overallStats.totalExecutionTime / 1000)}s`}
                    subtitle="Total test execution time"
                    icon={<Clock className="w-5 h-5" />}
                    trend={{ value: 15, label: "faster", positive: true }}
                    color="orange"
                />
            </div>

            {/* Main Content */}
            <Tabs defaultValue="test-suites" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="test-suites">Test Suites</TabsTrigger>
                    <TabsTrigger value="real-world">Real-World Validation</TabsTrigger>
                    <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
                    <TabsTrigger value="insights">Testing Insights</TabsTrigger>
                </TabsList>

                {/* Test Suites Tab */}
                <TabsContent value="test-suites" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {testSuites.map((suite) => (
                            <EnhancedCard
                                key={suite.id}
                                title={suite.name}
                                subtitle={suite.description}
                                className="border-l-4 border-l-blue-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    {/* Suite Overview */}
                                    <div className="space-y-4">
                                        <div className="text-center">
                                            <Badge className={getStatusColor(suite.overallStatus)}>
                                                {suite.overallStatus.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Pass Rate:</span>
                                                <span className="font-medium">{suite.passRate}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Avg Accuracy:</span>
                                                <span className={`font-medium ${getAccuracyColor(suite.avgAccuracy)}`}>
                                                    {suite.avgAccuracy}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Test Cases:</span>
                                                <span className="font-medium">{suite.testCases.length}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Execution Time:</span>
                                                <span className="font-medium">{Math.round(suite.totalExecutionTime / 1000)}s</span>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="w-full"
                                            onClick={() => runTestSuite(suite.id)}
                                            disabled={runningTests}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Run Suite
                                        </Button>
                                    </div>

                                    {/* Test Cases */}
                                    <div className="lg:col-span-3 space-y-3">
                                        <h4 className="font-medium text-gray-900">Test Cases</h4>
                                        <div className="space-y-2">
                                            {suite.testCases.map((testCase) => (
                                                <div key={testCase.id} className="p-3 border border-gray-200 rounded">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="font-medium text-gray-900">{testCase.name}</div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={getStatusColor(testCase.status)} variant="outline">
                                                                {testCase.status}
                                                            </Badge>
                                                            <span className={`text-sm font-medium ${getAccuracyColor(testCase.accuracy)}`}>
                                                                {testCase.accuracy}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <span>Execution: {testCase.executionTime}ms</span>
                                                        <span>Runs: {testCase.runCount}</span>
                                                        <span>Last: {testCase.lastRun.toLocaleDateString()}</span>
                                                    </div>
                                                    {testCase.errorMessage && (
                                                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                                            {testCase.errorMessage}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Real-World Validation Tab */}
                <TabsContent value="real-world" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <MetricCard
                            title="Success Rate"
                            value={`${Math.round((realWorldStats.successfulNegotiations / realWorldStats.totalNegotiations) * 100)}%`}
                            subtitle="Successful negotiations"
                            icon={<CheckCircle className="w-5 h-5" />}
                            color="green"
                        />
                        <MetricCard
                            title="Prediction Accuracy"
                            value={`${Math.round(realWorldStats.avgAccuracy)}%`}
                            subtitle="Average prediction accuracy"
                            icon={<Target className="w-5 h-5" />}
                            color="blue"
                        />
                        <MetricCard
                            title="Total Savings"
                            value={`$${Math.round(realWorldStats.totalSavings / 1000)}K`}
                            subtitle="Actual savings achieved"
                            icon={<DollarSign className="w-5 h-5" />}
                            color="purple"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {realWorldData.map((validation) => (
                            <EnhancedCard
                                key={validation.negotiationId}
                                className="border-l-4 border-l-green-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <div className="font-medium text-gray-900">{validation.supplier}</div>
                                        <div className="text-sm text-gray-600">{validation.role}</div>
                                        <Badge className={
                                            validation.outcome === 'success' ? 'text-green-600 bg-green-50 border-green-200' :
                                            validation.outcome === 'partial' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                            'text-red-600 bg-red-50 border-red-200'
                                        }>
                                            {validation.outcome.toUpperCase()}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Rate Changes</h4>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Initial:</span>
                                                <span className="font-medium">${validation.initialRate}/hr</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Final:</span>
                                                <span className="font-medium">${validation.finalRate}/hr</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Reduction:</span>
                                                <span className={`font-medium ${
                                                    validation.finalRate < validation.initialRate ? 'text-green-600' : 'text-gray-600'
                                                }`}>
                                                    {Math.round(((validation.initialRate - validation.finalRate) / validation.initialRate) * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Savings Analysis</h4>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Predicted:</span>
                                                <span className="font-medium">${validation.predictedSavings.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Actual:</span>
                                                <span className="font-medium">${validation.actualSavings.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Accuracy:</span>
                                                <span className={`font-medium ${getAccuracyColor(validation.accuracy)}`}>
                                                    {validation.accuracy}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Leverage Factors</h4>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Volume:</span>
                                                <span className="font-medium">{validation.leverageFactors.volume}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Relationship:</span>
                                                <span className="font-medium">{validation.leverageFactors.relationshipYears}y</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Performance:</span>
                                                <span className="font-medium">{validation.leverageFactors.performanceScore}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Alternatives:</span>
                                                <span className="font-medium">{validation.leverageFactors.alternatives}</span>
                                            </div>
                                        </div>
                                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                            {validation.notes}
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Performance Metrics Tab */}
                <TabsContent value="performance" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Test Execution Performance"
                            subtitle="Performance metrics across test suites"
                        >
                            <div className="space-y-4">
                                {testSuites.map((suite) => (
                                    <div key={suite.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">{suite.name}</span>
                                            <span className="font-medium">{Math.round(suite.totalExecutionTime / 1000)}s</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{ width: `${(suite.totalExecutionTime / 3000) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Accuracy Trends"
                            subtitle="Prediction accuracy over time"
                        >
                            <div className="text-center space-y-4">
                                <ScoreGauge 
                                    score={Math.round(overallStats.avgAccuracy)} 
                                    size="lg"
                                    label="Overall Accuracy"
                                />
                                <div className="text-sm text-gray-600">
                                    Trending upward with continuous improvements
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>
                </TabsContent>

                {/* Testing Insights Tab */}
                <TabsContent value="insights" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <EnhancedCard
                            title="Key Insights"
                            subtitle="Testing and validation insights"
                            className="border-l-4 border-l-green-500"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
                                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                    <div className="text-sm text-green-900">
                                        Savings calculations show 94.2% accuracy in successful negotiations
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                    <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="text-sm text-blue-900">
                                        Market intelligence accuracy improved 15% with enhanced data sources
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded">
                                    <Target className="w-5 h-5 text-purple-600 mt-0.5" />
                                    <div className="text-sm text-purple-900">
                                        Negotiation leverage assessment correctly identifies strong positions 92% of the time
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>

                        <EnhancedCard
                            title="Improvement Opportunities"
                            subtitle="Areas for enhancement"
                            className="border-l-4 border-l-orange-500"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded">
                                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                                    <div className="text-sm text-orange-900">
                                        Scenario modeling needs refinement for aggressive negotiation strategies
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                    <Zap className="w-5 h-5 text-yellow-600 mt-0.5" />
                                    <div className="text-sm text-yellow-900">
                                        Test execution time can be reduced by 25% with parallel processing
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                    <div className="text-sm text-red-900">
                                        Failed negotiation prediction needs better risk factor weighting
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}