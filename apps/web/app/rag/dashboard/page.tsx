'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Database, 
  FileText, 
  Bot, 
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface SystemHealth {
  status: 'healthy' | 'unhealthy'
  details: {
    initialized: boolean
    chromaConnected: boolean
    openAIConfigured: boolean
  }
}

interface RAGStats {
  totalDocuments: number
  totalContracts: number
  storageSize: string
}

interface ProcessingJob {
  id: string
  contractId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  chunksCreated: number
  processingTime: number
  createdAt: string
}

export default function RAGDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [stats, setStats] = useState<RAGStats | null>(null)
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const healthResponse = await fetch('/api/rag/health')
      const healthData = await healthResponse.json()
      setHealth(healthData)

      setStats({
        totalDocuments: 1250,
        totalContracts: 89,
        storageSize: '2.4 GB'
      })

      setJobs([
        {
          id: '1',
          contractId: 'contract-001',
          status: 'completed',
          chunksCreated: 15,
          processingTime: 2340,
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
        },
        {
          id: '2',
          contractId: 'contract-002',
          status: 'processing',
          chunksCreated: 0,
          processingTime: 0,
          createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString()
        },
        {
          id: '3',
          contractId: 'contract-003',
          status: 'failed',
          chunksCreated: 0,
          processingTime: 1200,
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        }
      ])

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">RAG System Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage your Retrieval-Augmented Generation system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/rag/chat">
            <Button>
              <Bot className="h-4 w-4 mr-2" />
              Open Chat
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <p className="text-lg font-semibold capitalize">
                  {health?.status || 'Loading...'}
                </p>
              </div>
              {health && getStatusIcon(health.status)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-lg font-semibold">
                  {stats?.totalDocuments.toLocaleString() || '0'}
                </p>
              </div>
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contracts Indexed</p>
                <p className="text-lg font-semibold">
                  {stats?.totalContracts || '0'}
                </p>
              </div>
              <Database className="h-4 w-4 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-lg font-semibold">
                  {stats?.storageSize || '0 MB'}
                </p>
              </div>
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="processing">Processing Jobs</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Processing Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {jobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(job.status)}
                        <div>
                          <p className="font-medium text-sm">{job.contractId}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {job.chunksCreated} chunks
                        </Badge>
                        {job.processingTime > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {job.processingTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/rag/chat">
                  <Button className="w-full justify-start">
                    <Bot className="h-4 w-4 mr-2" />
                    Open Chat Interface
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Process New Contract
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Database className="h-4 w-4 mr-2" />
                  Manage Vector Store
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="processing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium">{job.contractId}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{job.chunksCreated} chunks</p>
                        {job.processingTime > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {job.processingTime}ms
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant={job.status === 'completed' ? 'default' : 
                                job.status === 'failed' ? 'destructive' : 'secondary'}
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Components</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {health && (
                  <>
                    <div className="flex items-center justify-between">
                      <span>RAG Service</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${health.details.initialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{health.details.initialized ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Vector Database</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${health.details.chromaConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{health.details.chromaConnected ? 'Connected' : 'Disconnected'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>OpenAI API</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${health.details.openAIConfigured ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm">{health.details.openAIConfigured ? 'Configured' : 'Not Configured'}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Query Response Time</span>
                    <span>1.2s avg</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Embedding Generation</span>
                    <span>0.8s avg</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Vector Search</span>
                    <span>0.3s avg</span>
                  </div>
                  <Progress value={90} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Embedding Model</label>
                  <p className="text-sm text-muted-foreground">text-embedding-3-small</p>
                </div>
                <div>
                  <label className="text-sm font-medium">LLM Model</label>
                  <p className="text-sm text-muted-foreground">gpt-4-turbo-preview</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Chunk Size</label>
                  <p className="text-sm text-muted-foreground">1000 tokens</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Chunk Overlap</label>
                  <p className="text-sm text-muted-foreground">200 tokens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        Last updated: {lastRefresh.toLocaleString()}
      </div>
    </div>
  )
}
