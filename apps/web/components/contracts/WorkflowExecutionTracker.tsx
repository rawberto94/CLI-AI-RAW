'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  User,
  Calendar,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  RefreshCw,
  PlayCircle,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkflowStep {
  id: string
  name: string
  assignedTo: string
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'completed'
  completedAt?: string
  comment?: string
  order: number
}

interface WorkflowExecution {
  id: string
  workflowName: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'
  startedAt: string
  completedAt?: string
  currentStep?: string
  steps: WorkflowStep[]
  initiatedBy: string
}

interface WorkflowExecutionTrackerProps {
  contractId: string
  onApprove?: (stepId: string, comment?: string) => Promise<void>
  onReject?: (stepId: string, comment: string) => Promise<void>
}

export function WorkflowExecutionTracker({
  contractId,
  onApprove,
  onReject,
}: WorkflowExecutionTrackerProps) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadExecutions()
  }, [contractId])

  const loadExecutions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/contracts/${contractId}/workflows/executions`)
      if (!response.ok) throw new Error('Failed to load workflow executions')
      const data = await response.json()
      setExecutions(data.executions || [])
    } catch (error) {
      console.error('Failed to load workflow executions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 }
      case 'in_progress':
        return { color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Clock }
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock }
      case 'rejected':
        return { color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle }
      case 'cancelled':
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: AlertCircle }
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: Clock }
    }
  }

  if (loading) {
    return (
      <Card className="shadow-xl border-0">
        <CardContent className="p-8 flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    )
  }

  if (executions.length === 0) {
    return (
      <Card className="shadow-xl border-0 bg-gradient-to-br from-gray-50 to-slate-50">
        <CardContent className="p-8 text-center">
          <Workflow className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">No active workflows</p>
          <p className="text-gray-500 text-sm mt-2">Start a workflow to track approvals</p>
          <Button className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600">
            <PlayCircle className="h-4 w-4 mr-2" />
            Start Workflow
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {executions.map((execution) => {
        const statusConfig = getStatusConfig(execution.status)
        const StatusIcon = statusConfig.icon

        return (
          <Card key={execution.id} className="shadow-2xl border-0 overflow-hidden">
            <div className={cn(
              'h-2 bg-gradient-to-r',
              execution.status === 'completed' && 'from-green-500 to-emerald-500',
              execution.status === 'in_progress' && 'from-blue-500 to-indigo-500',
              execution.status === 'pending' && 'from-yellow-500 to-orange-500',
              execution.status === 'rejected' && 'from-red-500 to-pink-500'
            )}></div>
            
            <CardHeader className="border-b bg-gradient-to-br from-gray-50 to-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <Workflow className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{execution.workflowName}</CardTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>Started by {execution.initiatedBy}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(execution.startedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Badge className={statusConfig.color}>
                  <StatusIcon className="h-4 w-4 mr-1" />
                  {execution.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="space-y-4">
                {execution.steps
                  .sort((a, b) => a.order - b.order)
                  .map((step, index) => {
                    const stepConfig = getStatusConfig(step.status)
                    const StepIcon = stepConfig.icon
                    const isLast = index === execution.steps.length - 1

                    return (
                      <div key={step.id} className="relative">
                        <div className="flex items-start gap-4">
                          {/* Timeline Line */}
                          {!isLast && (
                            <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200"></div>
                          )}

                          {/* Step Icon */}
                          <div className={cn(
                            'relative z-10 p-3 rounded-full shadow-md',
                            step.status === 'completed' && 'bg-gradient-to-br from-green-500 to-emerald-600',
                            step.status === 'approved' && 'bg-gradient-to-br from-green-500 to-emerald-600',
                            step.status === 'in_progress' && 'bg-gradient-to-br from-blue-500 to-indigo-600',
                            step.status === 'pending' && 'bg-gray-200',
                            step.status === 'rejected' && 'bg-gradient-to-br from-red-500 to-pink-600'
                          )}>
                            <StepIcon className={cn(
                              'h-5 w-5',
                              (step.status === 'completed' || step.status === 'approved' || step.status === 'in_progress' || step.status === 'rejected') ? 'text-white' : 'text-gray-600'
                            )} />
                          </div>

                          {/* Step Content */}
                          <div className="flex-1">
                            <div className={cn(
                              'p-4 rounded-xl border-2 transition-all',
                              step.status === 'in_progress' && 'border-blue-300 bg-blue-50 shadow-md',
                              step.status === 'completed' && 'border-green-200 bg-green-50',
                              step.status === 'approved' && 'border-green-200 bg-green-50',
                              step.status === 'pending' && 'border-gray-200 bg-gray-50',
                              step.status === 'rejected' && 'border-red-200 bg-red-50'
                            )}>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h4 className="font-bold text-gray-900">{step.name}</h4>
                                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                    <User className="h-4 w-4" />
                                    <span>{step.assignedTo}</span>
                                  </div>
                                </div>
                                <Badge className={stepConfig.color}>
                                  {step.status.replace('_', ' ')}
                                </Badge>
                              </div>

                              {step.comment && (
                                <div className="mt-3 p-3 bg-white/80 rounded-lg border border-gray-200">
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="h-4 w-4 text-gray-600 mt-0.5" />
                                    <p className="text-sm text-gray-700">{step.comment}</p>
                                  </div>
                                </div>
                              )}

                              {step.completedAt && (
                                <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Completed on {new Date(step.completedAt).toLocaleString()}</span>
                                </div>
                              )}

                              {/* Action Buttons */}
                              {step.status === 'in_progress' && (
                                <div className="flex items-center gap-2 mt-4">
                                  <Button
                                    size="sm"
                                    data-workflow-approve
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                    onClick={() => onApprove?.(step.id)}
                                  >
                                    <ThumbsUp className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-300 text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      const comment = prompt('Reason for rejection:')
                                      if (comment) onReject?.(step.id, comment)
                                    }}
                                  >
                                    <ThumbsDown className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Workflow Summary */}
              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Progress: {execution.steps.filter(s => s.status === 'completed' || s.status === 'approved').length} of {execution.steps.length} steps
                    </p>
                    {execution.currentStep && (
                      <p className="text-xs text-blue-700 mt-1">
                        Current: {execution.currentStep}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={loadExecutions}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
