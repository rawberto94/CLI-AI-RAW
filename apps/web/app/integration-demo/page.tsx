'use client'

import React, { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Grid, 
  StatusIndicator, 
  AIBadge
} from '@/components/ui/design-system'
import {
  Activity,
  Brain,
  Zap,
  BarChart3,
  Network,
  Database,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  Globe,
  GitBranch,
  Layers,
  Server
} from 'lucide-react'

interface SystemMetrics {
  uptime: number
  activeJobs: number
  processedContracts: number
  systemLoad: number
  memoryUsage: number
  throughput: number
  latency: number
  successRate: number
  errorRate: number
  totalServices: number
  healthyServices: number
  eventHandlers: number
  activeProjections: number
}

interface ProcessingStage {
  id: string
  name: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress: number
  result?: any
}

export default function IntegrationDemoPage() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 0,
    activeJobs: 0,
    processedContracts: 0,
    systemLoad: 25,
    memoryUsage: 0,
    throughput: 0,
    latency: 245,
    successRate: 99.2,
    errorRate: 0.02,
    totalServices: 8,
    healthyServices: 8,
    eventHandlers: 12,
    activeProjections: 6
  })

  const [processingActive, setProcessingActive] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState('')
  const [systemLogs, setSystemLogs] = useState<string[]>([
    '[SYSTEM] Next-Gen Contract Intelligence System initialized',
    '[INTEGRATION] All subsystems online and healthy',
    '[ORCHESTRATOR] Processing pipeline ready',
    '[SERVICE-MESH] 8 services registered and healthy',
    '[EVENT-BUS] 12 handlers active, 6 projections running',
    '[VECTOR-DB] Embedding service ready',
    '[GRAPH-DB] Relationship analysis ready',
    '[TEMPORAL-STORE] Bitemporal storage active',
    '[READY] System ready for contract processing'
  ])

  const [stages] = useState<ProcessingStage[]>([
    { id: 'text-extraction', name: 'Text Extraction', status: 'pending', progress: 0 },
    { id: 'vector-embedding', name: 'Vector Embedding', status: 'pending', progress: 0 },
    { id: 'graph-analysis', name: 'Graph Analysis', status: 'pending', progress: 0 },
    { id: 'temporal-storage', name: 'Temporal Storage', status: 'pending', progress: 0 },
    { id: 'financial-analysis', name: 'Financial Analysis', status: 'pending', progress: 0 },
    { id: 'risk-analysis', name: 'Risk Analysis', status: 'pending', progress: 0 },
    { id: 'compliance-check', name: 'Compliance Check', status: 'pending', progress: 0 },
    { id: 'search-indexing', name: 'Search Indexing', status: 'pending', progress: 0 }
  ])

  const integrationFeatures = [
    {
      name: 'System Orchestrator',
      icon: Cpu,
      status: 'active',
      description: 'Event-driven microservices coordination',
      metrics: { jobs: metrics.activeJobs, completed: metrics.processedContracts }
    },
    {
      name: 'Service Mesh',
      icon: Network,
      status: 'active',
      description: 'Intelligent load balancing & circuit breaking',
      metrics: { services: metrics.totalServices, healthy: metrics.healthyServices }
    },
    {
      name: 'Event Bus',
      icon: GitBranch,
      status: 'active',
      description: 'CQRS & Event Sourcing architecture',
      metrics: { handlers: metrics.eventHandlers, projections: metrics.activeProjections }
    },
    {
      name: 'Vector Database',
      icon: Database,
      status: 'active',
      description: 'Semantic search & embeddings',
      metrics: { embeddings: '1.2M', similarity: '0.85' }
    },
    {
      name: 'Graph Database',
      icon: Globe,
      status: 'active',
      description: 'Relationship discovery & analysis',
      metrics: { entities: '45K', relationships: '128K' }
    },
    {
      name: 'Temporal Store',
      icon: Clock,
      status: 'active',
      description: 'Bitemporal data versioning',
      metrics: { versions: '2.3K', queries: '156/s' }
    },
    {
      name: 'Edge Processing',
      icon: Server,
      status: 'active',
      description: 'Distributed computing nodes',
      metrics: { nodes: 4, load: '67%' }
    },
    {
      name: 'Real-time Monitoring',
      icon: Activity,
      status: 'active',
      description: 'Advanced observability & metrics',
      metrics: { alerts: 0, uptime: '99.9%' }
    }
  ]

  // Simulate real-time metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        uptime: prev.uptime + 1000,
        throughput: Math.floor(Math.random() * 20) + 140,
        latency: Math.floor(Math.random() * 50) + 220,
        memoryUsage: Math.floor(Math.random() * 100) + 400
      }))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`
    setSystemLogs(prev => [...prev.slice(-20), logEntry])
  }

  const processContract = async () => {
    if (processingActive) return

    setProcessingActive(true)
    setProcessingProgress(0)
    addLog('[DEMO] Starting integrated contract processing')
    addLog('[ORCHESTRATOR] Executing 8-stage processing pipeline')

    const stageNames = [
      'Text Extraction', 'Vector Embedding', 'Graph Analysis', 'Temporal Storage',
      'Financial Analysis', 'Risk Analysis', 'Compliance Check', 'Search Indexing'
    ]

    for (let i = 0; i < stageNames.length; i++) {
      const stageName = stageNames[i]
      setCurrentStage(stageName)
      
      // Simulate processing time
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100))
        const overallProgress = Math.round(((i * 100 + progress) / (stageNames.length * 100)) * 100)
        setProcessingProgress(overallProgress)
      }

      addLog(`[PROCESSING] ${stageName}: 100% complete`)

      // Log specific results for key stages
      if (stageName === 'Financial Analysis') {
        addLog('[FINANCIAL] Contract value: $1,500,000')
        addLog('[FINANCIAL] Monthly payment: $125,000')
      } else if (stageName === 'Risk Analysis') {
        addLog('[RISK] Risk score: 35/100 (MEDIUM)')
      } else if (stageName === 'Compliance Check') {
        addLog('[COMPLIANCE] Compliance score: 92%')
      }
    }

    setProcessingProgress(100)
    setCurrentStage('Completed')
    addLog('[COMPLETED] Contract processing finished successfully')
    addLog('[RESULTS] Processing time: 6.8s')
    addLog('[RESULTS] All 8 analysis stages completed')

    setMetrics(prev => ({
      ...prev,
      processedContracts: prev.processedContracts + 1
    }))

    setTimeout(() => {
      setProcessingActive(false)
      setProcessingProgress(0)
      setCurrentStage('')
    }, 2000)
  }

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <DashboardLayout
      title="Next-Gen Integration Demo"
      description="Advanced AI-Powered Contract Analysis with Integrated Architecture"
      actions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh Metrics
          </Button>
          <Button 
            size="sm" 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={processContract}
            disabled={processingActive}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {processingActive ? 'Processing...' : 'Process Sample Contract'}
          </Button>
        </div>
      }
    >
      {/* System Status Banner */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200 mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span className="text-lg font-semibold text-green-800">System Healthy</span>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                All Systems Online
              </Badge>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-semibold text-green-800">Uptime</div>
                <div className="text-green-600">{formatUptime(metrics.uptime)}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-800">Active Jobs</div>
                <div className="text-blue-600">{metrics.activeJobs}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-800">Processed</div>
                <div className="text-purple-600">{metrics.processedContracts}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Features Grid */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Integration Layer Components
        </h3>
        <Grid cols={4} gap="md">
          {integrationFeatures.map((feature, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                  <StatusIndicator status={feature.status as any}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </StatusIndicator>
                </div>
                <CardTitle className="text-sm">{feature.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{feature.description}</p>
                <div className="space-y-1">
                  {Object.entries(feature.metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="capitalize">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Processing Demo */}
        <div className="lg:col-span-2 space-y-6">
          {/* Processing Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                Integrated Processing Pipeline
                <AIBadge>AI-Powered</AIBadge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Stage Indicators */}
                <div className="grid grid-cols-4 gap-2">
                  {stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className={`p-3 rounded-lg text-center text-xs transition-all ${
                        currentStage === stage.name
                          ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                          : processingProgress > (index / stages.length) * 100
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <div className="font-medium">{stage.name}</div>
                      {currentStage === stage.name && (
                        <div className="mt-1">
                          <div className="w-full bg-blue-200 rounded-full h-1">
                            <div className="bg-blue-600 h-1 rounded-full transition-all duration-300" style={{ width: '100%' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span>{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} className="h-3" />
                  <div className="text-sm text-muted-foreground">
                    {processingActive ? `Processing: ${currentStage}` : 'Ready to process'}
                  </div>
                </div>

                {/* Process Button */}
                <Button
                  onClick={processContract}
                  disabled={processingActive}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  size="lg"
                >
                  {processingActive ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Processing Contract...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Process Sample Contract
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Real-Time System Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Grid cols={4} gap="sm">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Wifi className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-800">{metrics.throughput}</div>
                  <div className="text-sm text-blue-600">Throughput (req/s)</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold text-green-800">{metrics.latency}ms</div>
                  <div className="text-sm text-green-600">Avg Latency</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-800">{metrics.successRate}%</div>
                  <div className="text-sm text-purple-600">Success Rate</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <HardDrive className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold text-orange-800">{metrics.memoryUsage}MB</div>
                  <div className="text-sm text-orange-600">Memory Usage</div>
                </div>
              </Grid>
            </CardContent>
          </Card>

          {/* Architecture Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                System Architecture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Cpu className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <h4 className="font-semibold">Event-Driven</h4>
                  <p className="text-sm text-muted-foreground">Microservices with CQRS</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Database className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h4 className="font-semibold">Multi-Modal AI</h4>
                  <p className="text-sm text-muted-foreground">Vector + Graph + Temporal</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <h4 className="font-semibold">Zero-Trust Security</h4>
                  <p className="text-sm text-muted-foreground">End-to-end encryption</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Globe className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                  <h4 className="font-semibold">Edge Computing</h4>
                  <p className="text-sm text-muted-foreground">Distributed processing</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-red-600" />
                  <h4 className="font-semibold">Real-Time</h4>
                  <p className="text-sm text-muted-foreground">Streaming analytics</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Server className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                  <h4 className="font-semibold">Auto-Scaling</h4>
                  <p className="text-sm text-muted-foreground">Adaptive resources</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Service Mesh</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Healthy</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Event Bus</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Vector DB</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Online</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Graph DB</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Ready</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Temporal Store</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Synced</Badge>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU Usage</span>
                    <span className="text-blue-600">{metrics.systemLoad}%</span>
                  </div>
                  <Progress value={metrics.systemLoad} className="h-2" />
                </div>
                
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span className="text-purple-600">{Math.round(metrics.memoryUsage / 10)}%</span>
                  </div>
                  <Progress value={metrics.memoryUsage / 10} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-h-80 overflow-y-auto">
                {systemLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Database className="h-4 w-4 mr-2" />
                Query Vector DB
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Network className="h-4 w-4 mr-2" />
                Service Mesh Status
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <GitBranch className="h-4 w-4 mr-2" />
                Event Stream
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}