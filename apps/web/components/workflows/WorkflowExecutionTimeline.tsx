'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  MessageSquare,
  Calendar,
  Timer,
  ArrowRight,
  Pause,
  Play,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface WorkflowExecutionStep {
  id: string;
  stepName: string;
  stepOrder: number;
  status: 'PENDING' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'REJECTED';
  assignedTo: string;
  assignedToName?: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  slaHours?: number;
  comment?: string;
  result?: any;
}

interface WorkflowExecution {
  id: string;
  workflowName: string;
  contractTitle: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  currentStep: number;
  startedAt: string;
  completedAt?: string;
  dueDate?: string;
  steps: WorkflowExecutionStep[];
  initiatedBy: string;
  initiatedByName?: string;
}

interface WorkflowExecutionTimelineProps {
  execution: WorkflowExecution;
  onStepAction?: (stepId: string, action: 'approve' | 'reject' | 'skip') => void;
  showActions?: boolean;
  className?: string;
}

export function WorkflowExecutionTimeline({
  execution,
  onStepAction,
  showActions = false,
  className,
}: WorkflowExecutionTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'FAILED':
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'IN_PROGRESS':
        return <Play className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'WAITING':
        return <Pause className="w-5 h-5 text-slate-400" />;
      case 'SKIPPED':
        return <SkipForward className="w-5 h-5 text-slate-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      COMPLETED: 'bg-green-100 text-green-700 border-green-200',
      FAILED: 'bg-red-100 text-red-700 border-red-200',
      REJECTED: 'bg-red-100 text-red-700 border-red-200',
      IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      WAITING: 'bg-slate-100 text-slate-600 border-slate-200',
      SKIPPED: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    
    return (
      <Badge variant="outline" className={cn('text-xs', variants[status as keyof typeof variants] || variants.PENDING)}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getExecutionStatusBadge = (status: string) => {
    const variants = {
      COMPLETED: 'bg-green-500',
      FAILED: 'bg-red-500',
      IN_PROGRESS: 'bg-blue-500',
      PENDING: 'bg-amber-500',
      CANCELLED: 'bg-slate-500',
    };
    
    return (
      <Badge className={cn('text-white border-0', variants[status as keyof typeof variants] || variants.PENDING)}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const calculateProgress = () => {
    const completedSteps = execution.steps.filter((s) => s.status === 'COMPLETED').length;
    return (completedSteps / execution.steps.length) * 100;
  };

  const calculateSLAStatus = (step: WorkflowExecutionStep) => {
    if (!step.startedAt || !step.slaHours) return null;
    
    const startDate = new Date(step.startedAt);
    const now = new Date();
    const endDate = step.completedAt ? new Date(step.completedAt) : now;
    const hoursElapsed = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed > step.slaHours) {
      return { status: 'breached', hours: Math.floor(hoursElapsed - step.slaHours) };
    } else if (hoursElapsed > step.slaHours * 0.8) {
      return { status: 'warning', hours: Math.floor(step.slaHours - hoursElapsed) };
    }
    return { status: 'ok', hours: Math.floor(step.slaHours - hoursElapsed) };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const progress = calculateProgress();

  return (
    <div className={cn('space-y-6', className)}>
      {/* Execution Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-lg">{execution.workflowName}</CardTitle>
                {getExecutionStatusBadge(execution.status)}
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Contract: {execution.contractTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Started {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}</span>
                  {execution.dueDate && (
                    <>
                      <span className="text-slate-400">•</span>
                      <span>Due {format(new Date(execution.dueDate), 'MMM d, yyyy')}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Initiated by {execution.initiatedByName || execution.initiatedBy}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-600 dark:text-slate-400">Progress</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 shadow-sm"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Workflow completion progress"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span>
                {execution.steps.filter((s) => s.status === 'COMPLETED').length} of {execution.steps.length} steps completed
              </span>
              <span>Step {execution.currentStep} of {execution.steps.length}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

        {/* Steps */}
        <div className="space-y-6">
          {execution.steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const slaStatus = calculateSLAStatus(step);
            const isCurrentStep = step.stepOrder === execution.currentStep;

            return (
              <div key={step.id} className="relative">
                {/* Timeline Node */}
                <div
                  className={cn(
                    'absolute left-6 -translate-x-1/2 w-12 h-12 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center z-10 transition-all duration-200',
                    step.status === 'COMPLETED' && 'bg-green-500 shadow-lg shadow-green-200 dark:shadow-green-900/50',
                    step.status === 'FAILED' && 'bg-red-500 shadow-lg shadow-red-200 dark:shadow-red-900/50',
                    step.status === 'REJECTED' && 'bg-red-500 shadow-lg shadow-red-200 dark:shadow-red-900/50',
                    step.status === 'IN_PROGRESS' && 'bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900/50 animate-pulse',
                    step.status === 'PENDING' && 'bg-amber-500 shadow-lg shadow-amber-200 dark:shadow-amber-900/50',
                    (step.status === 'WAITING' || step.status === 'SKIPPED') && 'bg-slate-300 dark:bg-slate-600',
                    isCurrentStep && 'ring-4 ring-indigo-200'
                  )}
                >
                  <div className="text-white">
                    {getStatusIcon(step.status)}
                  </div>
                </div>

                {/* Step Card */}
                <Card
                  className={cn(
                    'ml-20 cursor-pointer transition-all',
                    isCurrentStep && 'ring-2 ring-indigo-300 shadow-lg',
                    isExpanded && 'shadow-xl'
                  )}
                  onClick={() => toggleStep(step.id)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Step Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{step.stepName}</span>
                            {getStatusBadge(step.status)}
                            {isCurrentStep && (
                              <Badge className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700 text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <User className="w-4 h-4" />
                            <span>{step.assignedToName || step.assignedTo}</span>
                          </div>
                        </div>
                        {slaStatus && (
                          <div
                            className={cn(
                              'flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
                              slaStatus.status === 'breached' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                              slaStatus.status === 'warning' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                              slaStatus.status === 'ok' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            )}
                            role="status"
                            aria-label={`SLA status: ${slaStatus.status}`}
                          >
                            <Timer className="w-3 h-3" />
                            {slaStatus.status === 'breached'
                              ? `${slaStatus.hours}h overdue`
                              : `${slaStatus.hours}h remaining`}
                          </div>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                          {step.startedAt && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <Calendar className="w-4 h-4" />
                              <span>Started: {format(new Date(step.startedAt), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                          )}
                          
                          {step.completedAt && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <CheckCircle className="w-4 h-4" />
                              <span>Completed: {format(new Date(step.completedAt), 'MMM d, yyyy h:mm a')}</span>
                              {step.completedByName && (
                                <>
                                  <span className="text-slate-400">by</span>
                                  <span className="font-medium">{step.completedByName}</span>
                                </>
                              )}
                            </div>
                          )}

                          {step.comment && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-slate-600 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-slate-700 mb-1">Comment:</div>
                                  <div className="text-sm text-slate-600">{step.comment}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {step.status === 'FAILED' && step.result?.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-red-700 mb-1">Error:</div>
                                  <div className="text-sm text-red-600">{step.result.error}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Step Actions */}
                          {showActions && step.status === 'IN_PROGRESS' && onStepAction && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStepAction(step.id, 'approve');
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-1.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStepAction(step.id, 'reject');
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-1.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStepAction(step.id, 'skip');
                                }}
                              >
                                <SkipForward className="w-4 h-4 mr-1.5" />
                                Skip
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Click hint */}
                      {!isExpanded && (
                        <div className="text-xs text-slate-400 text-center pt-1">
                          Click for details
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution Footer */}
      {execution.completedAt && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <div className="font-semibold text-green-900">Workflow Completed</div>
                <div className="text-sm text-green-700">
                  Finished on {format(new Date(execution.completedAt), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
