'use client'

import React, { memo, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle2,
  MessageSquare,
  Users,
  DollarSign,
  ChevronRight,
  ChevronDown,
  Send,
  Sparkles,
  Bell,
  Play,
  Pause,
  XCircle,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface RenewalStep {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked'
  completedAt?: Date | string
  assignee?: string
  dueDate?: Date | string
}

interface ContractRenewalWorkflowCardProps {
  contractId: string
  contractTitle: string
  expirationDate: Date | string
  renewalStatus: 'not_started' | 'in_progress' | 'pending_approval' | 'approved' | 'declined' | 'completed'
  currentValue?: number
  proposedValue?: number
  autoRenewal?: boolean
  renewalNoticeRequired?: boolean
  noticePeriodDays?: number
  renewalSteps?: RenewalStep[]
  lastRenewalDate?: Date | string
  renewalCount?: number
  onStartRenewal?: () => void
  onPauseRenewal?: () => void
  onCancelRenewal?: () => void
  onResumeRenewal?: () => void
  onSendReminder?: () => void
  onViewDetails?: () => void
  onScheduleMeeting?: () => void
  onGenerateProposal?: () => void
  formatCurrency?: (value?: number) => string
  className?: string
}

const defaultSteps: RenewalStep[] = [
  { id: '1', name: 'Review Current Terms', status: 'pending', description: 'Analyze existing contract terms and performance' },
  { id: '2', name: 'Internal Approval', status: 'pending', description: 'Get stakeholder buy-in for renewal' },
  { id: '3', name: 'Negotiate Terms', status: 'pending', description: 'Discuss pricing and terms with counterparty' },
  { id: '4', name: 'Legal Review', status: 'pending', description: 'Have legal team review updated terms' },
  { id: '5', name: 'Final Approval', status: 'pending', description: 'Executive sign-off on renewal' },
  { id: '6', name: 'Execute Renewal', status: 'pending', description: 'Sign and execute the renewal agreement' },
]

const StepIcon = ({ status }: { status: RenewalStep['status'] }) => {
  const iconClass = "h-4 w-4"
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(iconClass, "text-emerald-500")} />
    case 'in_progress':
      return <RefreshCw className={cn(iconClass, "text-violet-500 animate-spin")} />
    case 'blocked':
      return <XCircle className={cn(iconClass, "text-red-500")} />
    case 'skipped':
      return <ChevronRight className={cn(iconClass, "text-slate-400")} />
    default:
      return <div className={cn("h-3 w-3 rounded-full border-2 border-slate-300 bg-white")} />
  }
}

export const ContractRenewalWorkflowCard = memo(function ContractRenewalWorkflowCard({
  contractId: _contractId,
  contractTitle,
  expirationDate,
  renewalStatus,
  currentValue,
  proposedValue,
  autoRenewal = false,
  renewalNoticeRequired = false,
  noticePeriodDays = 30,
  renewalSteps = defaultSteps,
  lastRenewalDate,
  renewalCount = 0,
  onStartRenewal,
  onPauseRenewal,
  onCancelRenewal: _onCancelRenewal,
  onResumeRenewal: _onResumeRenewal,
  onSendReminder,
  onViewDetails,
  onScheduleMeeting,
  onGenerateProposal,
  formatCurrency = (v) => v !== undefined ? `$${v.toLocaleString()}` : '—',
  className,
}: ContractRenewalWorkflowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Calculate days until expiration
  const daysUntilExpiration = useMemo(() => {
    const exp = new Date(expirationDate)
    const now = new Date()
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }, [expirationDate])
  
  // Calculate notice deadline
  const noticeDeadline = useMemo(() => {
    if (!renewalNoticeRequired) return null
    const exp = new Date(expirationDate)
    exp.setDate(exp.getDate() - noticePeriodDays)
    return exp
  }, [expirationDate, renewalNoticeRequired, noticePeriodDays])
  
  const daysUntilNoticeDeadline = useMemo(() => {
    if (!noticeDeadline) return null
    const now = new Date()
    return Math.ceil((noticeDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }, [noticeDeadline])
  
  // Calculate progress
  const completedSteps = renewalSteps.filter(s => s.status === 'completed').length
  const progress = Math.round((completedSteps / renewalSteps.length) * 100)
  
  // Status config
  const statusConfig = useMemo(() => {
    switch (renewalStatus) {
      case 'completed':
        return { 
          label: 'Completed', 
          color: 'bg-emerald-100 text-emerald-700',
          icon: CheckCircle2,
        }
      case 'approved':
        return { 
          label: 'Approved', 
          color: 'bg-blue-100 text-blue-700',
          icon: CheckCircle2,
        }
      case 'pending_approval':
        return { 
          label: 'Pending Approval', 
          color: 'bg-amber-100 text-amber-700',
          icon: Clock,
        }
      case 'in_progress':
        return { 
          label: 'In Progress', 
          color: 'bg-violet-100 text-violet-700',
          icon: RefreshCw,
        }
      case 'declined':
        return { 
          label: 'Declined', 
          color: 'bg-red-100 text-red-700',
          icon: XCircle,
        }
      default:
        return { 
          label: 'Not Started', 
          color: 'bg-slate-100 text-slate-600',
          icon: Clock,
        }
    }
  }, [renewalStatus])
  
  const StatusIcon = statusConfig.icon
  
  // Urgency level
  const urgencyLevel = useMemo(() => {
    if (daysUntilExpiration < 0) return 'expired'
    if (daysUntilNoticeDeadline !== null && daysUntilNoticeDeadline < 0) return 'notice-passed'
    if (daysUntilExpiration <= 7) return 'critical'
    if (daysUntilExpiration <= 30) return 'urgent'
    if (daysUntilExpiration <= 60) return 'soon'
    return 'normal'
  }, [daysUntilExpiration, daysUntilNoticeDeadline])

  return (
    <Card className={cn(
      "overflow-hidden border-0 shadow-sm bg-white",
      urgencyLevel === 'critical' && "ring-2 ring-red-200",
      urgencyLevel === 'urgent' && "ring-2 ring-amber-200",
      className
    )}>
      {/* Top urgency bar */}
      {(urgencyLevel === 'critical' || urgencyLevel === 'urgent' || urgencyLevel === 'expired' || urgencyLevel === 'notice-passed') && (
        <div className={cn(
          "h-1",
          urgencyLevel === 'expired' || urgencyLevel === 'critical' ? "bg-red-500" :
          urgencyLevel === 'notice-passed' ? "bg-orange-500" : "bg-amber-500"
        )} />
      )}
      
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <RefreshCw className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                Renewal Workflow
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {contractTitle}
              </p>
            </div>
          </div>
          
          <Badge className={cn("text-xs border-0", statusConfig.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
        
        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {/* Days to expiration */}
          <div className={cn(
            "p-2.5 rounded-lg border",
            urgencyLevel === 'expired' && "bg-red-50 border-red-200",
            urgencyLevel === 'critical' && "bg-red-50 border-red-200",
            urgencyLevel === 'urgent' && "bg-amber-50 border-amber-200",
            urgencyLevel === 'soon' && "bg-amber-50/50 border-amber-100",
            urgencyLevel === 'normal' && "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Calendar className="h-3.5 w-3.5" />
              Expires
            </div>
            <p className={cn(
              "text-sm font-bold",
              daysUntilExpiration < 0 ? "text-red-600" :
              daysUntilExpiration <= 30 ? "text-amber-600" : "text-slate-900"
            )}>
              {daysUntilExpiration < 0 
                ? `${Math.abs(daysUntilExpiration)}d ago`
                : `${daysUntilExpiration}d`
              }
            </p>
          </div>
          
          {/* Notice deadline */}
          {renewalNoticeRequired && noticeDeadline && (
            <div className={cn(
              "p-2.5 rounded-lg border",
              daysUntilNoticeDeadline !== null && daysUntilNoticeDeadline < 0 
                ? "bg-orange-50 border-orange-200"
                : daysUntilNoticeDeadline !== null && daysUntilNoticeDeadline <= 7
                  ? "bg-amber-50 border-amber-200"
                  : "bg-slate-50 border-slate-100"
            )}>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Bell className="h-3.5 w-3.5" />
                Notice Due
              </div>
              <p className={cn(
                "text-sm font-bold",
                daysUntilNoticeDeadline !== null && daysUntilNoticeDeadline < 0 
                  ? "text-orange-600"
                  : "text-slate-900"
              )}>
                {daysUntilNoticeDeadline !== null && daysUntilNoticeDeadline < 0
                  ? 'Passed'
                  : `${daysUntilNoticeDeadline}d`
                }
              </p>
            </div>
          )}
          
          {/* Current value */}
          {currentValue !== undefined && (
            <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Current
              </div>
              <p className="text-sm font-bold text-slate-900">
                {formatCurrency(currentValue)}
              </p>
            </div>
          )}
          
          {/* Proposed value */}
          {proposedValue !== undefined && (
            <div className="p-2.5 rounded-lg border bg-violet-50 border-violet-200">
              <div className="flex items-center gap-1.5 text-xs text-violet-600 mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Proposed
              </div>
              <p className="text-sm font-bold text-violet-700">
                {formatCurrency(proposedValue)}
              </p>
            </div>
          )}
        </div>
        
        {/* Auto-renewal badge */}
        {autoRenewal && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">
              Auto-renewal enabled - will renew automatically
            </span>
          </div>
        )}
      </div>
      
      {/* Progress bar */}
      {renewalStatus !== 'not_started' && (
        <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">
              Workflow Progress
            </span>
            <span className="text-xs text-slate-500">
              {completedSteps} of {renewalSteps.length} steps
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      
      {/* Workflow steps (collapsible) */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 sm:p-5 h-auto rounded-none border-b border-slate-100 hover:bg-slate-50"
          >
            <span className="text-sm font-medium text-slate-700">
              Workflow Steps
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {completedSteps}/{renewalSteps.length}
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 sm:p-5 space-y-3">
            {renewalSteps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  step.status === 'completed' && "bg-emerald-50/50 border-emerald-100",
                  step.status === 'in_progress' && "bg-violet-50/50 border-violet-200 ring-2 ring-violet-100",
                  step.status === 'blocked' && "bg-red-50/50 border-red-200",
                  step.status === 'pending' && "bg-white border-slate-100",
                  step.status === 'skipped' && "bg-slate-50 border-slate-100 opacity-60"
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    step.status === 'completed' && "bg-emerald-100",
                    step.status === 'in_progress' && "bg-violet-100",
                    step.status === 'blocked' && "bg-red-100",
                    step.status === 'pending' && "bg-slate-100",
                    step.status === 'skipped' && "bg-slate-50"
                  )}>
                    <StepIcon status={step.status} />
                  </div>
                  {idx < renewalSteps.length - 1 && (
                    <div className={cn(
                      "w-0.5 h-6",
                      step.status === 'completed' ? "bg-emerald-200" : "bg-slate-200"
                    )} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      step.status === 'completed' && "text-emerald-700",
                      step.status === 'in_progress' && "text-violet-700",
                      step.status === 'blocked' && "text-red-700",
                      step.status === 'pending' && "text-slate-700",
                      step.status === 'skipped' && "text-slate-500"
                    )}>
                      {step.name}
                    </span>
                    {step.dueDate && step.status !== 'completed' && (
                      <span className="text-[10px] text-slate-400">
                        Due {new Date(step.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {step.description}
                    </p>
                  )}
                  {step.assignee && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Users className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-500">{step.assignee}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Actions */}
      <div className="p-4 sm:p-5 bg-slate-50/50 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {renewalStatus === 'not_started' && onStartRenewal && (
            <Button
              size="sm"
              onClick={onStartRenewal}
              className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-xs"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Start Renewal
            </Button>
          )}
          
          {renewalStatus === 'in_progress' && onPauseRenewal && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPauseRenewal}
              className="text-xs"
            >
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Pause
            </Button>
          )}
          
          {renewalStatus === 'in_progress' && onGenerateProposal && (
            <Button
              size="sm"
              variant="outline"
              onClick={onGenerateProposal}
              className="text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate Proposal
            </Button>
          )}
          
          {onScheduleMeeting && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onScheduleMeeting}
              className="text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Schedule Meeting
            </Button>
          )}
          
          {onSendReminder && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSendReminder}
              className="text-xs"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send Reminder
            </Button>
          )}
          
          {onViewDetails && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onViewDetails}
              className="text-xs text-slate-600 ml-auto"
            >
              View Details
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
        
        {/* Renewal history */}
        {renewalCount > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Renewed {renewalCount} time{renewalCount > 1 ? 's' : ''}
              {lastRenewalDate && (
                <> · Last renewed {new Date(lastRenewalDate).toLocaleDateString()}</>
              )}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
})

export default ContractRenewalWorkflowCard
