'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  X,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react'
import { processContractWithProgress } from '@/lib/services/contract-processing-with-progress'
import { useJobProgress } from '@/lib/websocket/use-socket'

interface QueuedFile {
  id: string
  file: File
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  jobId?: string
  error?: string
  result?: any
}

interface BatchUploadQueueProps {
  files: File[]
  onComplete?: (results: any[]) => void
  onCancel?: () => void
}

export function BatchUploadQueue({ files, onComplete, onCancel }: BatchUploadQueueProps) {
  const [queue, setQueue] = useState<QueuedFile[]>(
    files.map((file, index) => ({
      id: `file-${index}-${Date.now()}`,
      file,
      status: 'queued',
      progress: 0
    }))
  )
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const startProcessing = async () => {
    setIsProcessing(true)
    setIsPaused(false)

    for (const item of queue) {
      if (isPaused) break
      if (item.status !== 'queued') continue

      // Update status to processing
      setQueue(prev =>
        prev.map(q =>
          q.id === item.id ? { ...q, status: 'processing' as const } : q
        )
      )

      try {
        const result = await processContractWithProgress({
          userId: 'demo-user-id', // TODO: Get from auth
          file: item.file
        })

        // Update with result
        setQueue(prev =>
          prev.map(q =>
            q.id === item.id
              ? {
                  ...q,
                  status: result.success ? 'completed' : 'failed',
                  progress: 100,
                  jobId: result.jobId,
                  result: result.success ? result : undefined,
                  error: result.error
                }
              : q
          )
        )
      } catch (error: any) {
        setQueue(prev =>
          prev.map(q =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'failed',
                  error: error.message
                }
              : q
          )
        )
      }
    }

    setIsProcessing(false)

    // Check if all completed
    const allCompleted = queue.every(q => q.status === 'completed' || q.status === 'failed')
    if (allCompleted) {
      const results = queue.map(q => q.result).filter(Boolean)
      onComplete?.(results)
    }
  }

  const pauseProcessing = () => {
    setIsPaused(true)
    setIsProcessing(false)
  }

  const removeFile = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  const moveUp = (id: string) => {
    setQueue(prev => {
      const index = prev.findIndex(q => q.id === id)
      if (index <= 0) return prev
      const newQueue = [...prev]
      ;[newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]]
      return newQueue
    })
  }

  const moveDown = (id: string) => {
    setQueue(prev => {
      const index = prev.findIndex(q => q.id === id)
      if (index >= prev.length - 1) return prev
      const newQueue = [...prev]
      ;[newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]]
      return newQueue
    })
  }

  const queuedCount = queue.filter(q => q.status === 'queued').length
  const processingCount = queue.filter(q => q.status === 'processing').length
  const completedCount = queue.filter(q => q.status === 'completed').length
  const failedCount = queue.filter(q => q.status === 'failed').length
  const overallProgress = Math.round((completedCount / queue.length) * 100)

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Batch Upload Queue</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {queue.length} file{queue.length !== 1 ? 's' : ''} in queue
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isProcessing && queuedCount > 0 && (
              <Button onClick={startProcessing} size="sm">
                <Play className="w-4 h-4 mr-2" />
                Start Processing
              </Button>
            )}

            {isProcessing && (
              <Button onClick={pauseProcessing} variant="outline" size="sm">
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}

            {onCancel && (
              <Button onClick={onCancel} variant="ghost" size="sm">
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Progress</span>
            <div className="flex items-center gap-3">
              {completedCount > 0 && (
                <Badge variant="default">{completedCount} completed</Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="destructive">{failedCount} failed</Badge>
              )}
              <span className="font-medium">{overallProgress}%</span>
            </div>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {queue.map((item, index) => (
            <QueueItem
              key={item.id}
              item={item}
              index={index}
              total={queue.length}
              onRemove={removeFile}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
              canReorder={!isProcessing && item.status === 'queued'}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function QueueItem({
  item,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  canReorder
}: {
  item: QueuedFile
  index: number
  total: number
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  canReorder: boolean
}) {
  const { progress } = useJobProgress(item.jobId || null)

  const getStatusIcon = () => {
    switch (item.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (item.status) {
      case 'completed':
        return 'border-green-200 bg-green-50'
      case 'failed':
        return 'border-red-200 bg-red-50'
      case 'processing':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-white'
    }
  }

  const currentProgress = progress?.progress || item.progress

  return (
    <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="mt-0.5">{getStatusIcon()}</div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {item.file.name}
            </p>
            <div className="flex items-center gap-1">
              {canReorder && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onMoveUp(item.id)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onMoveDown(item.id)}
                    disabled={index === total - 1}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </>
              )}
              {item.status === 'queued' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onRemove(item.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-600 mb-2">
            {(item.file.size / 1024 / 1024).toFixed(2)} MB
          </p>

          {/* Progress Bar */}
          {item.status === 'processing' && (
            <div className="space-y-1">
              <Progress value={currentProgress} className="h-1.5" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  {progress?.message || 'Processing...'}
                </p>
                <p className="text-xs text-gray-600">{currentProgress}%</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {item.status === 'failed' && item.error && (
            <p className="text-xs text-red-700">{item.error}</p>
          )}

          {/* Success Message */}
          {item.status === 'completed' && (
            <p className="text-xs text-green-700">Processing complete</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default BatchUploadQueue
