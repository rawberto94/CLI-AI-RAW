'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  FileText,
  Send,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkflowExecutionViewerProps {
  executionId: string
  contractId?: string
  onUpdate?: () => void
}

export function WorkflowExecutionViewer({
  executionId,
  contractId,
  onUpdate,
}: WorkflowExecutionViewerProps) {
  const [execution, setExecution] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    loadExecution()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId])

  const loadExecution = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/executions/${executionId}`)
      if (response.ok) {
        const data = await response.json()
        setExecution(data.execution)
      }
    } catch (error) {
      console.error('Failed to load execution:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!execution) return
    
    setActionLoading(true)
    try {
      const response = await fetch(`/api/workflows/executions/${executionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: comment.trim() || undefined,
        }),
      })

      if (response.ok) {
        await loadExecution()
        setComment('')
        setSelectedAction(null)
        if (onUpdate) onUpdate()
      }
    } catch (error) {
      console.error('Failed to perform action:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 }
      case 'REJECTED':
        return { color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle }
      case 'IN_PROGRESS':
        return { color: 'bg-blue-100 text-blue-700 border-blue-300', icon: RefreshCw }
      case 'PENDING':
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock }
      case 'CANCELLED':
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: XCircle }
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: Clock }
    }
  }

  const getStepStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { color: 'bg-green-500', icon: CheckCircle2, label: 'Completed' }
      case 'IN_PROGRESS':
        return { color: 'bg-blue-500 animate-pulse', icon: RefreshCw, label: 'In Progress' }
      case 'PENDING':
        return { color: 'bg-gray-300', icon: Clock, label: 'Pending' }
      case 'SKIPPED':
        return { color: 'bg-gray-400', icon: ArrowRight, label: 'Skipped' }
      default:
        return { color: 'bg-gray-300', icon: Clock, label: 'Pending' }
    }
  }

  if (loading) {
    return (
      <Card className="shadow-xl border-0">
        <CardContent className="p-12 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  if (!execution) {
    return (
      <Card className="shadow-xl border-0">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Workflow execution not found</p>
        </CardContent>
      </Card>
    )
  }

  const statusConfig = getStatusConfig(execution.status)
  const StatusIcon = statusConfig.icon
  const currentStepExecution = execution.steps?.find((s: any) => s.status === 'IN_PROGRESS')
  const canTakeAction = currentStepExecution && !actionLoading

  return (
    <div className="space-y-6">
      {/* Execution Header */}
      <Card className="shadow-xl border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {execution.workflow?.name || 'Workflow Execution'}
              </h2>
              <div className="flex items-center gap-3">
                <Badge className={statusConfig.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {execution.status}
                </Badge>
                {contractId && (
                  <span className="text-sm text-gray-600">
                    Contract: <strong>{contractId}</strong>
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  Started {new Date(execution.startedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <Button variant="outline" onClick={loadExecution}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card className="shadow-xl border-0">
        <CardHeader className="border-b">
          <CardTitle>Approval Progress</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {execution.steps?.map((stepExec: any, idx: number) => {
              const stepConfig = getStepStatusConfig(stepExec.status)
              const StepIcon = stepConfig.icon
              const isActive = stepExec.status === 'IN_PROGRESS'

              return (
                <div key={stepExec.id} className="relative">
                  <div className={cn(
                    'flex items-start gap-4 p-5 rounded-xl border-2 transition-all',
                    isActive && 'border-blue-300 bg-blue-50 shadow-lg',
                    stepExec.status === 'COMPLETED' && 'border-green-200 bg-green-50',
                    stepExec.status === 'PENDING' && 'border-gray-200 bg-gray-50'
                  )}>
                    {/* Step Indicator */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg',
                        stepConfig.color
                      )}>
                        <StepIcon className="h-6 w-6" />
                      </div>
                      {idx < execution.steps.length - 1 && (
                        <div className={cn(
                          'w-0.5 h-12',
                          stepExec.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'
                        )} />
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {stepExec.step?.name || `Step ${idx + 1}`}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {stepExec.step?.description || stepExec.step?.stepType}
                          </p>
                        </div>
                        <Badge variant="outline" className={stepConfig.color.replace('bg-', 'border-')}>
                          {stepConfig.label}
                        </Badge>
                      </div>

                      {/* Assignment Info */}
                      {stepExec.assignedTo && (
                        <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                          <User className="h-4 w-4" />
                          <span>Assigned to: <strong>{stepExec.step?.assigneeName || stepExec.assignedTo}</strong></span>
                          {stepExec.assignedAt && (
                            <span className="text-gray-500">
                              on {new Date(stepExec.assignedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Due Date */}
                      {stepExec.dueAt && stepExec.status !== 'COMPLETED' && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Clock className="h-4 w-4" />
                          <span>Due: {new Date(stepExec.dueAt).toLocaleString()}</span>
                        </div>
                      )}

                      {/* Action Result */}
                      {stepExec.decision && (
                        <div className={cn(
                          'mt-3 p-3 rounded-lg border-l-4',
                          stepExec.decision === 'APPROVED' && 'bg-green-50 border-green-500',
                          stepExec.decision === 'REJECTED' && 'bg-red-50 border-red-500'
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            {stepExec.decision === 'APPROVED' ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {stepExec.decision} by {stepExec.actionedBy || 'Unknown'}
                            </span>
                            {stepExec.actionedAt && (
                              <span className="text-sm text-gray-500">
                                on {new Date(stepExec.actionedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {stepExec.comment && (
                            <p className="text-sm text-gray-700 ml-7">{stepExec.comment}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Panel */}
      {canTakeAction && (
        <Card className="shadow-xl border-0 border-t-4 border-t-blue-500">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-blue-600" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-gray-700">
              You are assigned to review this step. Please provide your decision:
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment (optional)
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your comments or feedback..."
                rows={4}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={() => handleAction('approve')}
                disabled={actionLoading}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {actionLoading && selectedAction === 'approve' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                onClick={() => handleAction('reject')}
                disabled={actionLoading}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                {actionLoading && selectedAction === 'reject' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ThumbsDown className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comments/History */}
      {execution.comments && execution.comments.length > 0 && (
        <Card className="shadow-xl border-0">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comments & Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {execution.comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                  <User className="h-5 w-5 text-gray-600 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{comment.userName}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{comment.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
