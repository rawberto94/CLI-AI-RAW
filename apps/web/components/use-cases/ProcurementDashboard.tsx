'use client'

import React, { useState, useEffect } from 'react'
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
    AlertTriangle,
    CheckCircle,
    Clock,
    DollarSign,
    Users,
    FileText,
    Shield,
    Target,
    Calendar,
    BarChart3,
    PieChart,
    Activity
} from 'lucide-react'

interface VendorContract {
    id: string
    vendorName: string
    contractType: string
    value: number
    startDate: Date
    endDate: Date
    riskScore: number
    performanceScore: number
    complianceStatus: 'compliant' | 'warning' | 'violation'
    renewalDate: Date
    keyTerms: {
        paymentTerms: string
        deliveryTerms: string
        penaltyClauses: string[]
        terminationClauses: string[]
    }
    riskFactors: {
        financial: number
        operational: number
        legal: number
        reputational: number
    }
}

interface ProcurementMetrics {
    totalContracts: number
    totalValue: number
    avgProcessingTime: number
    riskDistribution: {
        low: number
        medium: number
        high: number
        critical: number
    }
    complianceRate: number
    renewalsNext30Days: number
    costSavingsOpportunities: number
    vendorPerformance: {
        excellent: number
        good: number
        fair: number
        poor: number
    }
}

export default function ProcurementDashboard() {
    const [metrics, setMetrics] = useState<ProcurementMetrics | null>(null)
    const [contracts, setContracts] = useState<VendorContract[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTimeframe, setSelectedTimeframe] = useState('30d')

    useEffect(() => {
        // Simulate API call to fetch procurement data
        const fetchProcurementData = async () => {
            setLoading(true)
            
            // Mock data - in real implementation, this would come from API
            const mockMetrics: ProcurementMetrics = {
                totalContracts: 2847,
                totalValue: 125600000,
                avgProcessingTime: 4.2,
                riskDistribution: {
                    low: 1420,
                    medium: 987,
                    high: 340,
                    critical: 100
                },
                complianceRate: 94.2,
                renewalsNext30Days: 23,
                costSavingsOpportunities: 8400000,
                vendorPerformance: {
                    excellent: 1200,
                    good: 1100,
                    fair: 400,
                    poor: 147
                }
            }

            const mockContracts: VendorContract[] = [
                {
                    id: 'PROC-001',
                    vendorName: 'TechCorp Solutions',
                    contractType: 'IT Services',
                    value: 2400000,
                    startDate: new Date('2024-01-15'),
                    endDate: new Date('2026-01-14'),
                    riskScore: 85,
                    performanceScore: 92,
                    complianceStatus: 'warning',
                    renewalDate: new Date('2025-11-15'),
                    keyTerms: {
                        paymentTerms: 'Net 30',
                        deliveryTerms: '24/7 Support SLA',
                        penaltyClauses: ['Service Level Penalties', 'Data Breach Penalties'],
                        terminationClauses: ['30-day notice', 'Material breach clause']
                    },
                    riskFactors: {
                        financial: 75,
                        operational: 90,
                        legal: 80,
                        reputational: 85
                    }
                },
                {
                    id: 'PROC-002',
                    vendorName: 'Global Manufacturing Inc',
                    contractType: 'Manufacturing',
                    value: 15600000,
                    startDate: new Date('2023-06-01'),
                    endDate: new Date('2025-05-31'),
                    riskScore: 45,
                    performanceScore: 88,
                    complianceStatus: 'compliant',
                    renewalDate: new Date('2025-03-01'),
                    keyTerms: {
                        paymentTerms: 'Net 45',
                        deliveryTerms: 'FOB Destination',
                        penaltyClauses: ['Quality Penalties', 'Delivery Penalties'],
                        terminationClauses: ['60-day notice', 'Force majeure clause']
                    },
                    riskFactors: {
                        financial: 40,
                        operational: 50,
                        legal: 45,
                        reputational: 45
                    }
                },
                {
                    id: 'PROC-003',
                    vendorName: 'Logistics Partners LLC',
                    contractType: 'Logistics',
                    value: 890000,
                    startDate: new Date('2024-03-01'),
                    endDate: new Date('2025-02-28'),
                    riskScore: 92,
                    performanceScore: 76,
                    complianceStatus: 'violation',
                    renewalDate: new Date('2024-12-01'),
                    keyTerms: {
                        paymentTerms: 'Net 15',
                        deliveryTerms: 'Next Day Delivery',
                        penaltyClauses: ['Delivery Penalties', 'Damage Penalties'],
                        terminationClauses: ['15-day notice', 'Performance failure clause']
                    },
                    riskFactors: {
                        financial: 95,
                        operational: 85,
                        legal: 90,
                        reputational: 98
                    }
                }
            ]

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            setMetrics(mockMetrics)
            setContracts(mockContracts)
            setLoading(false)
        }

        fetchProcurementData()
    }, [selectedTimeframe])

    const getRiskColor = (score: number) => {
        if (score >= 80) return 'text-red-600 bg-red-50 border-red-200'
        if (score >= 60) return 'text-orange-600 bg-orange-50 border-orange-200'
        if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
        return 'text-green-600 bg-green-50 border-green-200'
    }

    const getComplianceColor = (status: string) => {
        switch (status) {
            case 'compliant': return 'text-green-600 bg-green-50 border-green-200'
            case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
            case 'violation': return 'text-red-600 bg-red-50 border-red-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState 
                    message="Loading procurement dashboard..."
                    details="Analyzing contract portfolio and vendor performance"
                />
            </div>
        )
    }

    if (!metrics) return null

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Procurement Dashboard</h1>
                    <p className="text-gray-600 mt-1">Enterprise contract portfolio management and analytics</p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedTimeframe}
                        onChange={(e) => setSelectedTimeframe(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="1y">Last year</option>
                    </select>
                    <Button variant="outline" size="sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Contracts"
                    value={metrics.totalContracts.toLocaleString()}
                    subtitle="Active contracts"
                    icon={<FileText className="w-5 h-5" />}
                    trend={{ value: 12, positive: true }}
                    color="blue"
                />
                <MetricCard
                    title="Portfolio Value"
                    value={`$${(metrics.totalValue / 1000000).toFixed(1)}M`}
                    subtitle="Total contract value"
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={{ value: 8.5, positive: true }}
                    color="green"
                />
                <MetricCard
                    title="Avg Processing Time"
                    value={`${metrics.avgProcessingTime} days`}
                    subtitle="Contract review time"
                    icon={<Clock className="w-5 h-5" />}
                    trend={{ value: 15, positive: false }}
                    color="orange"
                />
                <MetricCard
                    title="Compliance Rate"
                    value={`${metrics.complianceRate}%`}
                    subtitle="Regulatory compliance"
                    icon={<Shield className="w-5 h-5" />}
                    trend={{ value: 2.1, positive: true }}
                    color="purple"
                />
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
                    <TabsTrigger value="vendors">Vendor Performance</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
                    <TabsTrigger value="renewals">Renewals</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Risk Distribution */}
                        <EnhancedCard
                            title="Risk Distribution"
                            subtitle="Contract risk levels across portfolio"
                            className="h-fit"
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-3 bg-green-50 rounded border border-green-200">
                                        <div className="text-2xl font-bold text-green-900">{metrics.riskDistribution.low}</div>
                                        <div className="text-sm text-green-600">Low Risk</div>
                                    </div>
                                    <div className="text-center p-3 bg-yellow-50 rounded border border-yellow-200">
                                        <div className="text-2xl font-bold text-yellow-900">{metrics.riskDistribution.medium}</div>
                                        <div className="text-sm text-yellow-600">Medium Risk</div>
                                    </div>
                                    <div className="text-center p-3 bg-orange-50 rounded border border-orange-200">
                                        <div className="text-2xl font-bold text-orange-900">{metrics.riskDistribution.high}</div>
                                        <div className="text-sm text-orange-600">High Risk</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded border border-red-200">
                                        <div className="text-2xl font-bold text-red-900">{metrics.riskDistribution.critical}</div>
                                        <div className="text-sm text-red-600">Critical Risk</div>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>

                        {/* Vendor Performance */}
                        <EnhancedCard
                            title="Vendor Performance"
                            subtitle="Performance distribution across vendors"
                            className="h-fit"
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-3 bg-emerald-50 rounded border border-emerald-200">
                                        <div className="text-2xl font-bold text-emerald-900">{metrics.vendorPerformance.excellent}</div>
                                        <div className="text-sm text-emerald-600">Excellent</div>
                                    </div>
                                    <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-2xl font-bold text-blue-900">{metrics.vendorPerformance.good}</div>
                                        <div className="text-sm text-blue-600">Good</div>
                                    </div>
                                    <div className="text-center p-3 bg-yellow-50 rounded border border-yellow-200">
                                        <div className="text-2xl font-bold text-yellow-900">{metrics.vendorPerformance.fair}</div>
                                        <div className="text-sm text-yellow-600">Fair</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded border border-red-200">
                                        <div className="text-2xl font-bold text-red-900">{metrics.vendorPerformance.poor}</div>
                                        <div className="text-sm text-red-600">Poor</div>
                                    </div>
                                </div>
                            </div>
                        </EnhancedCard>
                    </div>

                    {/* Key Alerts */}
                    <EnhancedCard
                        title="Key Alerts & Actions"
                        subtitle="Immediate attention required"
                        className="border-orange-200 bg-orange-50"
                    >
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <div className="flex-1">
                                    <div className="font-medium text-red-900">3 contracts in violation</div>
                                    <div className="text-sm text-red-600">Immediate compliance review required</div>
                                </div>
                                <Button size="sm" variant="outline">Review</Button>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <Calendar className="w-5 h-5 text-yellow-600" />
                                <div className="flex-1">
                                    <div className="font-medium text-yellow-900">{metrics.renewalsNext30Days} renewals due in 30 days</div>
                                    <div className="text-sm text-yellow-600">Start renewal negotiations</div>
                                </div>
                                <Button size="sm" variant="outline">Plan Renewals</Button>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
                                <Target className="w-5 h-5 text-green-600" />
                                <div className="flex-1">
                                    <div className="font-medium text-green-900">${(metrics.costSavingsOpportunities / 1000000).toFixed(1)}M savings opportunity</div>
                                    <div className="text-sm text-green-600">Contract renegotiation potential</div>
                                </div>
                                <Button size="sm" variant="outline">Analyze</Button>
                            </div>
                        </div>
                    </EnhancedCard>
                </TabsContent>

                {/* Risk Analysis Tab */}
                <TabsContent value="risk" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {contracts.map((contract) => (
                            <EnhancedCard
                                key={contract.id}
                                title={contract.vendorName}
                                subtitle={`${contract.contractType} • $${contract.value.toLocaleString()}`}
                                className="border-l-4 border-l-blue-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Overall Risk Score */}
                                    <div className="space-y-4">
                                        <div className="text-center">
                                            <ScoreGauge 
                                                score={contract.riskScore} 
                                                size="lg"
                                                label="Risk Score"
                                            />
                                        </div>
                                        <Badge className={getRiskColor(contract.riskScore)}>
                                            {contract.riskScore >= 80 ? 'Critical Risk' :
                                             contract.riskScore >= 60 ? 'High Risk' :
                                             contract.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'}
                                        </Badge>
                                    </div>

                                    {/* Risk Factors Breakdown */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Risk Factors</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Financial</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                                                        <div 
                                                            className="h-2 bg-red-500 rounded-full"
                                                            style={{ width: `${contract.riskFactors.financial}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">{contract.riskFactors.financial}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Operational</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                                                        <div 
                                                            className="h-2 bg-orange-500 rounded-full"
                                                            style={{ width: `${contract.riskFactors.operational}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">{contract.riskFactors.operational}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Legal</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                                                        <div 
                                                            className="h-2 bg-yellow-500 rounded-full"
                                                            style={{ width: `${contract.riskFactors.legal}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">{contract.riskFactors.legal}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Reputational</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                                                        <div 
                                                            className="h-2 bg-purple-500 rounded-full"
                                                            style={{ width: `${contract.riskFactors.reputational}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium">{contract.riskFactors.reputational}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Key Terms & Actions */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Key Information</h4>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-gray-600">Payment Terms:</span>
                                                <span className="ml-2 font-medium">{contract.keyTerms.paymentTerms}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Delivery:</span>
                                                <span className="ml-2 font-medium">{contract.keyTerms.deliveryTerms}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Renewal:</span>
                                                <span className="ml-2 font-medium">{contract.renewalDate.toLocaleDateString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-600">Compliance:</span>
                                                <Badge className={`ml-2 ${getComplianceColor(contract.complianceStatus)}`}>
                                                    {contract.complianceStatus}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <Button size="sm" variant="outline">View Details</Button>
                                            <Button size="sm" variant="outline">Risk Report</Button>
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Other tabs would be implemented similarly */}
                <TabsContent value="vendors">
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Vendor Performance Analysis</h3>
                        <p className="text-gray-600">Detailed vendor scorecards and performance metrics coming soon...</p>
                    </div>
                </TabsContent>

                <TabsContent value="compliance">
                    <div className="text-center py-12">
                        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Compliance Dashboard</h3>
                        <p className="text-gray-600">Regulatory compliance tracking and reporting coming soon...</p>
                    </div>
                </TabsContent>

                <TabsContent value="renewals">
                    <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Renewal Management</h3>
                        <p className="text-gray-600">Contract renewal tracking and negotiation tools coming soon...</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}