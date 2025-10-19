'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText
} from 'lucide-react'
import { useSocket } from '@/lib/websocket/use-socket'

interface BackgroundJob {
  id: string
  jobId: string
  userId: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export function BackgroundJobsPanel() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  const { subscribeToBackgroundJobs } = useSocket({
    userId: 'demo-user-id', // TODO: Get from auth
    autoConnect: true
  })

  // Load jobs
  useEffect(() => {
    loadJobs()
  }, [])

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToBackgroundJobs((update) => {
      setJobs(prev => {
        const index = prev.findIndex(j => j.jobId === update.jobId)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            status: update.status,
            progress: update.progress,
            result: update.result,
            error: update.error,
            updatedAt: new Date(update.timestamp)
          }
          return updated
        }
        return prev
      })
    })

    return unsubscribe
  }, [subscribeToBackgroundJobs])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/background-jobs')
      if (response.ok) {
        const { data } = await response.json()
        setJobs(data || [])
      }
    } catch (error) {
      console.error('Failed to load background jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissJob = async (id: string) => {
    try {
      await fetch(`/api/background-jobs/${id}`, {
        method: 'DELETE'
      })
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch (error) {
      console.error('Failed to dismiss job:', error)
    }
  }

  const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending')
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const failedJobs = jobs.filter(j => j.status === 'failed')

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 w-96">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-600">Loading jobs...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (jobs.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 z-50">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Background Jobs</CardTitle>
              {activeJobs.length > 0 && (
                <Badge variant="secondary" className="animate-pulse">
                  {activeJobs.length} active
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {/* Active Jobs */}
              {activeJobs.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    In Progress
                  </h4>
                  {activeJobs.map(job => (
                    <JobItem key={job.id} job={job} onDismiss={dismissJob} />
                  ))}
                </div>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    Completed
                  </h4>
                  {completedJobs.slice(0, 3).map(job => (
                    <JobItem key={job.id} job={job} onDismiss={dismissJob} />
                  ))}
                </div>
              )}

              {/* Failed Jobs */}
              {failedJobs.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2">
                    Failed
                  </h4>
                  {failedJobs.slice(0, 2).map(job => (
                    <JobItem key={job.id} job={job} onDismiss={dismissJob} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function JobItem({ job, onDismiss }: { job: BackgroundJob; onDismiss: (id: string) => void }) {
  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      case 'processing':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className={`p-3 rounded-lg border ${getStatusColor()} mb-2`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getStatusIcon()}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {job.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onDismiss(job.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>

          {job.status === 'processing' && (
            <div className="space-y-1">
              <Progress value={job.progress} className="h-1" />
              <p className="text-xs text-gray-600">{job.progress}% complete</p>
            </div>
          )}

          {job.status === 'completed' && job.result && (
            <p className="text-xs text-green-700">
              Completed successfully
            </p>
          )}

          {job.status === 'failed' && job.error && (
            <p className="text-xs text-red-700">{job.error}</p>
          )}

          {job.metadata?.fileName && (
            <div className="flex items-center gap-1.5 mt-1">
              <FileText className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-600 truncate">
                {job.metadata.fileName}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BackgroundJobsPanel
