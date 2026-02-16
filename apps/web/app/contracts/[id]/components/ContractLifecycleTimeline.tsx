'use client'

import React, { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileText,
  Upload,
  Edit3,
  FileSignature,
  Eye,
  MessageSquare,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Sparkles,
  User,
  Mail,
  GitBranch,
  Archive,
  Shield,
  Target,
  Calendar,
  Bell,
  Lock,
  Unlock,
  Tag,
  Folder,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TimelineEvent {
  id: string
  type: 
    | 'created' 
    | 'uploaded' 
    | 'edited' 
    | 'signed'
    | 'signature_requested'
    | 'viewed'
    | 'commented'
    | 'downloaded'
    | 'shared'
    | 'approved'
    | 'rejected'
    | 'renewal_started'
    | 'ai_analyzed'
    | 'status_changed'
    | 'archived'
    | 'restored'
    | 'version_created'
    | 'risk_updated'
    | 'obligation_added'
    | 'reminder_set'
    | 'locked'
    | 'unlocked'
    | 'tagged'
    | 'categorized'
    | 'expired'
  title: string
  description?: string
  timestamp: Date | string
  user?: {
    name: string
    email?: string
    avatar?: string
  }
  metadata?: Record<string, unknown>
}

interface ContractLifecycleTimelineProps {
  events: TimelineEvent[]
  maxEvents?: number
  showLoadMore?: boolean
  onLoadMore?: () => void
  isLoading?: boolean
  className?: string
}

const EventIcon = ({ type }: { type: TimelineEvent['type'] }) => {
  const iconClass = "h-4 w-4"
  
  switch (type) {
    case 'created':
    case 'uploaded':
      return <Upload className={iconClass} />
    case 'edited':
    case 'version_created':
      return <Edit3 className={iconClass} />
    case 'signed':
      return <FileSignature className={iconClass} />
    case 'signature_requested':
      return <Mail className={iconClass} />
    case 'viewed':
      return <Eye className={iconClass} />
    case 'commented':
      return <MessageSquare className={iconClass} />
    case 'downloaded':
      return <Download className={iconClass} />
    case 'shared':
      return <Share2 className={iconClass} />
    case 'approved':
      return <CheckCircle2 className={iconClass} />
    case 'rejected':
      return <AlertTriangle className={iconClass} />
    case 'renewal_started':
      return <RefreshCw className={iconClass} />
    case 'ai_analyzed':
      return <Sparkles className={iconClass} />
    case 'status_changed':
      return <GitBranch className={iconClass} />
    case 'archived':
      return <Archive className={iconClass} />
    case 'restored':
      return <RefreshCw className={iconClass} />
    case 'risk_updated':
      return <Shield className={iconClass} />
    case 'obligation_added':
      return <Target className={iconClass} />
    case 'reminder_set':
      return <Bell className={iconClass} />
    case 'locked':
      return <Lock className={iconClass} />
    case 'unlocked':
      return <Unlock className={iconClass} />
    case 'tagged':
      return <Tag className={iconClass} />
    case 'categorized':
      return <Folder className={iconClass} />
    case 'expired':
      return <Calendar className={iconClass} />
    default:
      return <FileText className={iconClass} />
  }
}

const getEventStyle = (type: TimelineEvent['type']) => {
  switch (type) {
    case 'signed':
    case 'approved':
      return {
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        dotColor: 'bg-emerald-500',
        lineColor: 'border-emerald-200',
      }
    case 'rejected':
    case 'expired':
      return {
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        dotColor: 'bg-red-500',
        lineColor: 'border-red-200',
      }
    case 'signature_requested':
    case 'reminder_set':
      return {
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        dotColor: 'bg-amber-500',
        lineColor: 'border-amber-200',
      }
    case 'ai_analyzed':
      return {
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        dotColor: 'bg-violet-500',
        lineColor: 'border-violet-200',
      }
    case 'commented':
    case 'shared':
      return {
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        dotColor: 'bg-violet-500',
        lineColor: 'border-violet-200',
      }
    case 'archived':
    case 'locked':
      return {
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-600',
        dotColor: 'bg-slate-500',
        lineColor: 'border-slate-200',
      }
    default:
      return {
        iconBg: 'bg-slate-50',
        iconColor: 'text-slate-500',
        dotColor: 'bg-slate-400',
        lineColor: 'border-slate-100',
      }
  }
}

const formatTimeAgo = (date: Date | string) => {
  const now = new Date()
  const eventDate = new Date(date)
  const diffMs = now.getTime() - eventDate.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return eventDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: eventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

const TimelineEventCard = memo(function TimelineEventCard({
  event,
  isFirst,
  isLast,
}: {
  event: TimelineEvent
  isFirst: boolean
  isLast: boolean
}) {
  const style = getEventStyle(event.type)
  const eventDate = new Date(event.timestamp)
  
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div 
          className={cn(
            "absolute left-[19px] top-10 bottom-0 w-px border-l-2 border-dashed",
            style.lineColor
          )} 
        />
      )}
      
      {/* Icon */}
      <div className={cn(
        "relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        style.iconBg
      )}>
        <div className={style.iconColor}>
          <EventIcon type={event.type} />
        </div>
        {/* Pulse dot for recent events */}
        {isFirst && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse",
            style.dotColor
          )} />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-slate-900">
              {event.title}
            </h4>
            {event.description && (
              <p className="text-xs text-slate-500 mt-0.5">
                {event.description}
              </p>
            )}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-slate-400 flex-shrink-0 cursor-help">
                  {formatTimeAgo(event.timestamp)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{eventDate.toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* User info */}
        {event.user && (
          <div className="flex items-center gap-2 mt-2">
            {event.user.avatar ? (
              
              <img 
                src={event.user.avatar} 
                alt={event.user.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="h-3 w-3 text-slate-500" />
              </div>
            )}
            <span className="text-xs text-slate-600">{event.user.name}</span>
          </div>
        )}
        
        {/* Metadata badges */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {event.metadata.status && (
              <Badge variant="secondary" className="text-[10px]">
                {String(event.metadata.status)}
              </Badge>
            )}
            {event.metadata.version && (
              <Badge variant="outline" className="text-[10px]">
                v{String(event.metadata.version)}
              </Badge>
            )}
            {event.metadata.signatory && (
              <Badge variant="outline" className="text-[10px]">
                <FileSignature className="h-2.5 w-2.5 mr-1" />
                {String(event.metadata.signatory)}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export const ContractLifecycleTimeline = memo(function ContractLifecycleTimeline({
  events,
  maxEvents = 10,
  showLoadMore = false,
  onLoadMore,
  isLoading = false,
  className,
}: ContractLifecycleTimelineProps) {
  
  // Sort events by timestamp (newest first)
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxEvents)
  }, [events, maxEvents])
  
  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: TimelineEvent[] } = {}
    
    sortedEvents.forEach(event => {
      const date = new Date(event.timestamp)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      let key: string
      if (date.toDateString() === today.toDateString()) {
        key = 'Today'
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday'
      } else {
        key = date.toLocaleDateString(undefined, { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        })
      }
      
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })
    
    return groups
  }, [sortedEvents])

  if (events.length === 0) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="text-center py-8">
          <div className="p-3 rounded-full bg-slate-100 inline-flex mb-3">
            <Clock className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">No activity yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Contract activity will appear here
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Activity Timeline
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
      
      <div className="p-4">
        {Object.entries(groupedEvents).map(([dateKey, dateEvents], groupIdx) => (
          <div key={dateKey} className={cn(groupIdx > 0 && "mt-6")}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                {dateKey}
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            
            {/* Events for this date */}
            <div className="space-y-0">
              {dateEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <TimelineEventCard
                    event={event}
                    isFirst={groupIdx === 0 && idx === 0}
                    isLast={idx === dateEvents.length - 1 && groupIdx === Object.keys(groupedEvents).length - 1}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Load more */}
        {showLoadMore && events.length > maxEvents && (
          <div className="text-center mt-4 pt-4 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-xs text-violet-600 hover:text-violet-700"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More ({events.length - maxEvents} remaining)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
})

export default ContractLifecycleTimeline
