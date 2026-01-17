'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Eye,
  TrendingUp,
  Server,
  Cpu,
  HardDrive
} from 'lucide-react'

interface ProcessingJob {
  id: string
  contractId: string
  filename: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'paused'
  currentStage: string
  totalProgress: number
  startTime: Date
  estimatedCompletion?: Date
  stages: ProcessingStage[]
  metadata: {
    fileSize: number
    uploadedBy?: string
  }
}

interface ProcessingStage {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startTime?: Date
  endTime?: Date
  error?: string
}

interface WorkerStatus {
  id: string
  name: string
  status: 'active' | 'idle' | 'error' | 'offline'
  currentJob?: string
  processedJobs: number
  averageProcessingTime: number
  lastActivity: Date
  cpuUsage: number
  memoryUsage: number
}

interface SystemMetrics {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  averageProcessingTime: number
  throughput: number
  queueDepth: number
  systemLoad: number
}

export default function ProcessingStatusDashboard() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')

  // Mock data for demonstration
  useEffect(() => {
    const mockJobs: ProcessingJob[] = [
      {
        id: 'job_001',
        contractId: 'contract_001',
        filename: 'service-agreement-2024.pdf',
        status: 'processing',
        currentStage: 'financial_analysis',
        totalProgress: 65,
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        estimatedCompletion: new Date(Date.now() + 2 * 60 * 1000),
        stages: [
          { id: 'text_extraction', name: 'Text Extraction', status: 'completed', progress: 100 },
          { id: 'metadata_extraction', name: 'Metadata Extraction', status: 'completed', progress: 100 },
          { id: 'financial_analysis', name: 'Financial Analysis', status: 'running', progress: 75 },
          { id: 'risk_assessment', name: 'Risk Assessment', status: 'pending', progress: 0 },
          { id: 'compliance_check', name: 'Compliance Check', status: 'pending', progress: 0 },
          { id: 'clause_extraction', name: 'Clause Extraction', status: 'pending', progress: 0 },
          { id: 'search_indexing', name: 'Search Indexing', status: 'pending', progress: 0 },
          { id: 'finalization', name: 'Finalization', status: 'pending', progress: 0 }
        ],
        metadata: {
          fileSize: 2048576,
          uploadedBy: 'john.doe@company.com'
        }
      },
      {
        id: 'job_002',
        contractId: 'contract_002',
        filename: 'purchase-order-Q1.docx',
        status: 'queued',
        currentStage: 'text_extraction',
        totalProgress: 0,
        startTime: new Date(Date.now() - 1 * 60 * 1000),
        stages: [
          { id: 'text_extraction', name: 'Text Extraction', status: 'pending', progress: 0 },
          { id: 'metadata_extraction', name: 'Metadata Extraction', status: 'pending', progress: 0 },
          { id: 'financial_analysis', name: 'Financial Analysis', status: 'pending', progress: 0 },
          { id: 'risk_assessment', name: 'Risk Assessment', status: 'pending', progress: 0 },
          { id: 'compliance_check', name: 'Compliance Check', status: 'pending', progress: 0 },
          { id: 'clause_extraction', name: 'Clause Extraction', status: 'pending', progress: 0 },
          { id: 'search_indexing', name: 'Search Indexing', status: 'pending', progress: 0 },
          { id: 'finalization', name: 'Finalization', status: 'pending', progress: 0 }
        ],
        metadata: {
          fileSize: 1024000,
          uploadedBy: 'jane.smith@company.com'
        }
      },
      {
        id: 'job_003',
        contractId: 'contract_003',
        filename: 'employment-contract.pdf',
        status: 'completed',
        currentStage: 'finalization',
        totalProgress: 100,
        startTime: new Date(Date.now() - 15 * 60 * 1000),
        stages: [
          { id: 'text_extraction', name: 'Text Extraction', status: 'completed', progress: 100 },
          { id: 'metadata_extraction', name: 'Metadata Extraction', status: 'completed', progress: 100 },
          { id: 'financial_analysis', name: 'Financial Analysis', status: 'completed', progress: 100 },
          { id: 'risk_assessment', name: 'Risk Assessment', status: 'completed', progress: 100 },
          { id: 'compliance_check', name: 'Compliance Check', status: 'completed', progress: 100 },
          { id: 'clause_extraction', name: 'Clause Extraction', status: 'completed', progress: 100 },
          { id: 'search_indexing', name: 'Search Indexing', status: 'completed', progress: 100 },
          { id: 'finalization', name: 'Finalization', status: 'completed', progress: 100 }
        ],
        metadata: {
          fileSize: 512000,
          uploadedBy: 'hr@company.com'
        }
      }
    ]

    const mockWorkers: WorkerStatus[] = [
      {
        id: 'worker_001',
        name: 'Text Extraction Worker',
        status: 'active',
        currentJob: 'job_001',
        processedJobs: 45,
        averageProcessingTime: 120000,
        lastActivity: new Date(),
        cpuUsage: 75,
        memoryUsage: 60
      },
      {
        id: 'worker_002',
        name: 'Financial Analysis Worker',
        status: 'active',
        currentJob: 'job_001',
        processedJobs: 38,
        averageProcessingTime: 180000,
        lastActivity: new Date(),
        cpuUsage: 85,
        memoryUsage: 70
      },
      {
        id: 'worker_003',
        name: 'Risk Assessment Worker',
        status: 'idle',
        processedJobs: 42,
        averageProcessingTime: 150000,
        lastActivity: new Date(Date.now() - 2 * 60 * 1000),
        cpuUsage: 15,
        memoryUsage: 25
      },
      {
        id: 'worker_004',
        name: 'Compliance Worker',
        status: 'idle',
        processedJobs: 35,
        averageProcessingTime: 200000,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000),
        cpuUsage: 10,
        memoryUsage: 20
      }
    ]

    const mockMetrics: SystemMetrics = {
      totalJobs: 156,
      activeJobs: 1,
      completedJobs: 142,
      failedJobs: 13,
      averageProcessingTime: 165000,
      throughput: 8.5,
      queueDepth: 1,
      systemLoad: 45
    }

    setJobs(mockJobs)
    setWorkers(mockWorkers)
    setMetrics(mockMetrics)
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      // In a real implementation, this would fetch fresh data from the API
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-red-500" />
      case 'processing': return <Activity className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
      case 'queued': return <Clock className="h-3.5 w-3.5 text-yellow-500" />
      case 'paused': return <Pause className="h-3.5 w-3.5 text-gray-500" />
      default: return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-green-100 text-green-800 px-3 py-1',
      failed: 'bg-red-100 text-red-800 px-3 py-1',
      processing: 'bg-blue-100 text-blue-800 px-3 py-1',
      queued: 'bg-yellow-100 text-yellow-800 px-3 py-1',
      paused: 'bg-gray-100 text-gray-800 px-3 py-1'
    }
    
    return (
      <Badge className={variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800 px-3 py-1'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true
    if (filter === 'active') return job.status === 'processing' || job.status === 'queued'
    return job.status === filter
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processing Status Dashboard</h1>
          <p className="text-muted-foreground">Monitor contract processing jobs and worker status</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-3.5 w-3.5 mr-2" /> : <Play className="h-3.5 w-3.5 mr-2" />}
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{metrics.totalJobs}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.activeJobs}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500 animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Queue Depth</p>
                  <p className="text-2xl font-bold text-yellow-600">{metrics.queueDepth}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">System Load</p>
                  <p className="text-2xl font-bold">{metrics.systemLoad}%</p>
                </div>
                <Server className="h-8 w-8 text-green-500" />
              </div>
              <Progress value={metrics.systemLoad} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Processing Jobs</CardTitle>
                <div className="flex gap-2.5">
                  {(['all', 'active', 'completed', 'failed'] as const).map((filterOption) => (
                    <Button
                      key={filterOption}
                      variant={filter === filterOption ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setFilter(filterOption)}
                    >
                      {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">{job.filename}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {getStatusBadge(job.status)}
                      <Button variant="ghost" size="sm" className="h-8">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Current Stage: {job.currentStage.replace('_', ' ')}</span>
                      <span>{formatFileSize(job.metadata.fileSize)}</span>
                    </div>
                    
                    <Progress value={job.totalProgress} className="h-2" />
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Started: {formatDuration(Date.now() - job.startTime.getTime())} ago</span>
                      <span>{job.totalProgress}% complete</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Worker Status */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Worker Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {workers.map((worker) => (
                <div key={worker.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{worker.name}</span>
                    <Badge 
                      className={
                        worker.status === 'active' ? 'bg-green-100 text-green-800 px-3 py-1' :
                        worker.status === 'idle' ? 'bg-gray-100 text-gray-800 px-3 py-1' :
                        worker.status === 'error' ? 'bg-red-100 text-red-800 px-3 py-1' :
                        'bg-gray-100 text-gray-800 px-3 py-1'
                      }
                    >
                      {worker.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Processed Jobs:</span>
                      <span>{worker.processedJobs}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Avg Time:</span>
                      <span>{formatDuration(worker.averageProcessingTime)}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>CPU:</span>
                        <span>{worker.cpuUsage}%</span>
                      </div>
                      <Progress value={worker.cpuUsage} className="h-1" />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Memory:</span>
                        <span>{worker.memoryUsage}%</span>
                      </div>
                      <Progress value={worker.memoryUsage} className="h-1" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Job Details */}
          {selectedJob && (
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{selectedJob.filename}</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Job ID: {selectedJob.id}</p>
                      <p>Contract ID: {selectedJob.contractId}</p>
                      <p>Uploaded by: {selectedJob.metadata.uploadedBy}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-2">Processing Stages</h5>
                    <div className="space-y-2">
                      {selectedJob.stages.map((stage) => (
                        <div key={stage.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(stage.status)}
                            <span>{stage.name}</span>
                          </div>
                          <span className="text-muted-foreground">{stage.progress}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}