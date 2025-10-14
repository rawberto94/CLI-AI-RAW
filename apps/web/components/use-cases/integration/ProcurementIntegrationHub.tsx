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
    Network,
    Zap,
    Database,
    Cloud,
    Shield,
    TrendingUp,
    Users,
    Settings,
    CheckCircle,
    AlertTriangle,
    Clock,
    BarChart3,
    Target,
    Workflow,
    Globe,
    Lock,
    Cpu,
    Activity
} from 'lucide-react'

interface IntegrationEndpoint {
    id: string
    name: string
    type: 'api' | 'webhook' | 'database' | 'file_sync' | 'real_time'
    status: 'active' | 'inactive' | 'error' | 'syncing'
    provider: string
    description: string
    lastSync: Date
    dataVolume: number
    errorRate: number
    latency: number
    uptime: number
}

interface DataFlow {
    id: string
    source: string
    destination: string
    dataType: string
    frequency: string
    volume: number
    status: 'active' | 'paused' | 'error'
    lastProcessed: Date
    processingTime: number
    errorCount: number
}

interface SystemHealth {
    overall: number
    components: {
        api: number
        database: number
        processing: number
        integrations: number
    }
    alerts: {
        critical: number
        warning: number
        info: number
    }
    performance: {
        responseTime: number
        throughput: number
        errorRate: number
        availability: number
    }
}

export default function ProcurementIntegrationHub() {
    const [integrations, setIntegrations] = useState<IntegrationEndpoint[]>([])
    const [dataFlows, setDataFlows] = useState<DataFlow[]>([])
    const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)

    useEffect(() => {
        loadIntegrationData()
    }, [])

    const loadIntegrationData = async () => {
        setLoading(true)
        
        // Mock integration data
        const mockIntegrations: IntegrationEndpoint[] = [
            {
                id: 'erp-sap',
                name: 'SAP ERP Integration',
                type: 'api',
                status: 'active',
                provider: 'SAP',
                description: 'Real-time procurement data sync with SAP ERP system',
                lastSync: new Date('2024-01-15T14:30:00'),
                dataVolume: 15420,
                errorRate: 0.2,
                latency: 145,
                uptime: 99.8
            },
            {
                id: 'market-data',
                name: 'Market Intelligence Feed',
                type: 'real_time',
                status: 'active',
                provider: 'Mercer/Radford',
                description: 'Live market rate data and salary benchmarks',
                lastSync: new Date('2024-01-15T14:35:00'),
                dataVolume: 8750,
                errorRate: 0.1,
                latency: 89,
                uptime: 99.9
            },
            {
                id: 'supplier-portal',
                name: 'Supplier Portal API',
                type: 'webhook',
                status: 'active',
                provider: 'Internal',
                description: 'Supplier performance and contract updates',
                lastSync: new Date('2024-01-15T14:28:00'),
                dataVolume: 3240,
                errorRate: 0.5,
                latency: 234,
                uptime: 99.5
            },
            {
                id: 'financial-system',
                name: 'Financial System Sync',
                type: 'database',
                status: 'syncing',
                provider: 'Oracle Financials',
                description: 'Contract spend and budget data synchronization',
                lastSync: new Date('2024-01-15T14:20:00'),
                dataVolume: 12680,
                errorRate: 1.2,
                latency: 567,
                uptime: 98.7
            },
            {
                id: 'compliance-db',
                name: 'Compliance Database',
                type: 'database',
                status: 'error',
                provider: 'GRC Platform',
                description: 'Regulatory compliance and audit data',
                lastSync: new Date('2024-01-15T13:45:00'),
                dataVolume: 890,
                errorRate: 15.3,
                latency: 1200,
                uptime: 95.2
            }
        ]

        const mockDataFlows: DataFlow[] = [
            {
                id: 'flow-001',
                source: 'SAP ERP',
                destination: 'Procurement Analytics',
                dataType: 'Contract Data',
                frequency: 'Real-time',
                volume: 1250,
                status: 'active',
                lastProcessed: new Date('2024-01-15T14:35:00'),
                processingTime: 2.3,
                errorCount: 0
            },
            {
                id: 'flow-002',
                source: 'Market Intelligence',
                destination: 'Rate Benchmarking',
                dataType: 'Market Rates',
                frequency: 'Hourly',
                volume: 850,
                status: 'active',
                lastProcessed: new Date('2024-01-15T14:00:00'),
                processingTime: 1.8,
                errorCount: 2
            },
            {
                id: 'flow-003',
                source: 'Supplier Portal',
                destination: 'Performance Analytics',
                dataType: 'Performance Metrics',
                frequency: 'Daily',
                volume: 340,
                status: 'active',
                lastProcessed: new Date('2024-01-15T08:00:00'),
                processingTime: 4.2,
                errorCount: 1
            }
        ]

        const mockSystemHealth: SystemHealth = {
            overall: 96.8,
            components: {
                api: 98.2,
                database: 94.5,
                processing: 97.1,
                integrations: 96.8
            },
            alerts: {
                critical: 1,
                warning: 3,
                info: 7
            },
            performance: {
                responseTime: 245,
                throughput: 15420,
                errorRate: 0.8,
                availability: 99.2
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1500))
        
        setIntegrations(mockIntegrations)
        setDataFlows(mockDataFlows)
        setSystemHealth(mockSystemHealth)
        setLoading(false)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-50 border-green-200'
            case 'syncing': return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'error': return 'text-red-600 bg-red-50 border-red-200'
            case 'inactive': return 'text-gray-600 bg-gray-50 border-gray-200'
            default: return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'api': return <Zap className="w-4 h-4" />
            case 'webhook': return <Network className="w-4 h-4" />
            case 'database': return <Database className="w-4 h-4" />
            case 'file_sync': return <Cloud className="w-4 h-4" />
            case 'real_time': return <Activity className="w-4 h-4" />
            default: return <Settings className="w-4 h-4" />
        }
    }

    const getHealthColor = (score: number) => {
        if (score >= 95) return 'text-green-600'
        if (score >= 90) return 'text-blue-600'
        if (score >= 80) return 'text-yellow-600'
        return 'text-red-600'
    }

    if (loading) {
        return (
            <div className="p-6">
                <LoadingState 
                    title="Loading Integration Hub"
                    description="Initializing system connections and data flows"
                />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Procurement Integration Hub</h1>
                    <p className="text-gray-600 mt-1">Centralized integration management and monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className={systemHealth ? getStatusColor('active') : getStatusColor('error')}>
                        System Health: {systemHealth?.overall}%
                    </Badge>
                    <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                    </Button>
                </div>
            </div>

            {/* System Health Overview */}
            {systemHealth && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <MetricCard
                        title="Overall Health"
                        value={`${systemHealth.overall}%`}
                        subtitle="System performance"
                        icon={<Activity className="w-5 h-5" />}
                        trend={{ value: 2.1, label: "improvement", positive: true }}
                        color="green"
                    />
                    <MetricCard
                        title="Response Time"
                        value={`${systemHealth.performance.responseTime}ms`}
                        subtitle="Average latency"
                        icon={<Clock className="w-5 h-5" />}
                        trend={{ value: 15, label: "faster", positive: true }}
                        color="blue"
                    />
                    <MetricCard
                        title="Throughput"
                        value={`${(systemHealth.performance.throughput / 1000).toFixed(1)}K`}
                        subtitle="Records per hour"
                        icon={<BarChart3 className="w-5 h-5" />}
                        trend={{ value: 8.3, label: "increase", positive: true }}
                        color="purple"
                    />
                    <MetricCard
                        title="Availability"
                        value={`${systemHealth.performance.availability}%`}
                        subtitle="System uptime"
                        icon={<Shield className="w-5 h-5" />}
                        trend={{ value: 0.3, label: "uptime", positive: true }}
                        color="orange"
                    />
                </div>
            )}

            {/* Main Content */}
            <Tabs defaultValue="integrations" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="integrations">Active Integrations</TabsTrigger>
                    <TabsTrigger value="dataflows">Data Flows</TabsTrigger>
                    <TabsTrigger value="monitoring">System Monitoring</TabsTrigger>
                    <TabsTrigger value="configuration">Configuration</TabsTrigger>
                </TabsList>

                {/* Active Integrations Tab */}
                <TabsContent value="integrations" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {integrations.map((integration) => (
                            <EnhancedCard
                                key={integration.id}
                                title={integration.name}
                                subtitle={integration.description}
                                className="border-l-4 border-l-blue-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                    {/* Integration Status */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            {getTypeIcon(integration.type)}
                                            <Badge variant="outline">{integration.type.toUpperCase()}</Badge>
                                        </div>
                                        <div className="text-center">
                                            <Badge className={getStatusColor(integration.status)}>
                                                {integration.status.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Provider: {integration.provider}
                                        </div>
                                    </div>

                                    {/* Performance Metrics */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Performance</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Uptime:</span>
                                                <span className={`font-medium ${getHealthColor(integration.uptime)}`}>
                                                    {integration.uptime}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Latency:</span>
                                                <span className="font-medium">{integration.latency}ms</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Error Rate:</span>
                                                <span className={`font-medium ${
                                                    integration.errorRate < 1 ? 'text-green-600' : 
                                                    integration.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                    {integration.errorRate}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Data Volume:</span>
                                                <span className="font-medium">{integration.dataVolume.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sync Information */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Synchronization</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Last Sync:</span>
                                                <span className="font-medium">
                                                    {integration.lastSync.toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Status:</span>
                                                <div className="flex items-center gap-1">
                                                    {integration.status === 'active' ? (
                                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                                    ) : integration.status === 'error' ? (
                                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                                    ) : (
                                                        <Clock className="w-4 h-4 text-blue-600" />
                                                    )}
                                                    <span className="text-xs">
                                                        {integration.status === 'active' ? 'Healthy' :
                                                         integration.status === 'error' ? 'Issues Detected' :
                                                         'Synchronizing'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Actions</h4>
                                        <div className="space-y-2">
                                            <Button size="sm" variant="outline" className="w-full">
                                                <Activity className="w-4 h-4 mr-2" />
                                                View Details
                                            </Button>
                                            <Button size="sm" variant="outline" className="w-full">
                                                <Settings className="w-4 h-4 mr-2" />
                                                Configure
                                            </Button>
                                            {integration.status === 'error' && (
                                                <Button size="sm" variant="outline" className="w-full text-red-600">
                                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                                    Troubleshoot
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* Data Flows Tab */}
                <TabsContent value="dataflows" className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        {dataFlows.map((flow) => (
                            <EnhancedCard
                                key={flow.id}
                                className="border-l-4 border-l-green-500"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Source</h4>
                                        <div className="text-sm text-gray-600">{flow.source}</div>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-0.5 bg-gray-300"></div>
                                            <Network className="w-4 h-4 text-gray-400" />
                                            <div className="w-8 h-0.5 bg-gray-300"></div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Destination</h4>
                                        <div className="text-sm text-gray-600">{flow.destination}</div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Data Type</h4>
                                        <div className="text-sm text-gray-600">{flow.dataType}</div>
                                        <Badge variant="outline" className="text-xs">
                                            {flow.frequency}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-gray-900">Performance</h4>
                                        <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Volume:</span>
                                                <span className="font-medium">{flow.volume}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Processing:</span>
                                                <span className="font-medium">{flow.processingTime}s</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Errors:</span>
                                                <span className={`font-medium ${
                                                    flow.errorCount === 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {flow.errorCount}
                                                </span>
                                            </div>
                                        </div>
                                        <Badge className={getStatusColor(flow.status)}>
                                            {flow.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                </div>
                            </EnhancedCard>
                        ))}
                    </div>
                </TabsContent>

                {/* System Monitoring Tab */}
                <TabsContent value="monitoring" className="space-y-6">
                    {systemHealth && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <EnhancedCard
                                title="Component Health"
                                subtitle="Individual system component status"
                            >
                                <div className="space-y-4">
                                    {Object.entries(systemHealth.components).map(([component, score]) => (
                                        <div key={component} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600 capitalize">{component}</span>
                                                <span className={`font-medium ${getHealthColor(score)}`}>{score}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full ${
                                                        score >= 95 ? 'bg-green-500' : 
                                                        score >= 90 ? 'bg-blue-500' : 
                                                        score >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${score}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </EnhancedCard>

                            <EnhancedCard
                                title="System Alerts"
                                subtitle="Current system notifications"
                            >
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="p-3 bg-red-50 rounded border border-red-200">
                                            <div className="text-2xl font-bold text-red-900">{systemHealth.alerts.critical}</div>
                                            <div className="text-sm text-red-600">Critical</div>
                                        </div>
                                        <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                                            <div className="text-2xl font-bold text-yellow-900">{systemHealth.alerts.warning}</div>
                                            <div className="text-sm text-yellow-600">Warning</div>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                            <div className="text-2xl font-bold text-blue-900">{systemHealth.alerts.info}</div>
                                            <div className="text-sm text-blue-600">Info</div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
                                            <AlertTriangle className="w-5 h-5 text-red-600" />
                                            <div className="text-sm text-red-900">
                                                Compliance Database connection timeout
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                            <Clock className="w-5 h-5 text-yellow-600" />
                                            <div className="text-sm text-yellow-900">
                                                Financial System sync delayed by 15 minutes
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </EnhancedCard>
                        </div>
                    )}
                </TabsContent>

                {/* Configuration Tab */}
                <TabsContent value="configuration" className="space-y-6">
                    <div className="text-center py-12">
                        <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Integration Configuration</h3>
                        <p className="text-gray-600">Advanced integration settings and configuration options coming soon...</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}