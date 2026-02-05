'use client'

import React, { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { format, differenceInDays, isFuture, isPast, isToday } from 'date-fns'
import {
  FileSignature,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight as _ArrowRight,
} from 'lucide-react'

interface TimelineEvent {
  key: string
  label: string
  date: Date | null
  icon: React.ReactNode
  color: string
  status: 'completed' | 'current' | 'upcoming' | 'warning' | 'missed'
}

interface ContractTimelineProps {
  signatureDate?: string | null
  startDate?: string | null
  endDate?: string | null
  terminationDate?: string | null
  noticeDeadline?: string | null // Calculated from end date - notice period
  className?: string
}

export const ContractTimeline = memo(function ContractTimeline({
  signatureDate,
  startDate,
  endDate,
  terminationDate,
  noticeDeadline,
  className,
}: ContractTimelineProps) {
  const events = useMemo<TimelineEvent[]>(() => {
    const items: TimelineEvent[] = []
    const now = new Date()
    
    // Signature
    if (signatureDate) {
      const date = new Date(signatureDate)
      items.push({
        key: 'signature',
        label: 'Contract Signed',
        date,
        icon: <FileSignature className="h-4 w-4" />,
        color: 'blue',
        status: isPast(date) ? 'completed' : 'upcoming',
      })
    }
    
    // Start Date
    if (startDate) {
      const date = new Date(startDate)
      items.push({
        key: 'start',
        label: 'Effective Date',
        date,
        icon: <PlayCircle className="h-4 w-4" />,
        color: 'violet',
        status: isPast(date) ? 'completed' : isToday(date) ? 'current' : 'upcoming',
      })
    }
    
    // Notice Deadline
    if (noticeDeadline) {
      const date = new Date(noticeDeadline)
      const daysUntil = differenceInDays(date, now)
      items.push({
        key: 'notice',
        label: 'Notice Deadline',
        date,
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'amber',
        status: isPast(date) ? 'missed' : daysUntil <= 30 ? 'warning' : 'upcoming',
      })
    }
    
    // End Date / Termination
    const finalDate = terminationDate || endDate
    if (finalDate) {
      const date = new Date(finalDate)
      const daysUntil = differenceInDays(date, now)
      items.push({
        key: 'end',
        label: terminationDate ? 'Early Termination' : 'Contract End',
        date,
        icon: terminationDate ? <AlertTriangle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />,
        color: terminationDate ? 'red' : isPast(date) ? 'slate' : daysUntil <= 30 ? 'red' : daysUntil <= 90 ? 'amber' : 'slate',
        status: isPast(date) ? 'completed' : daysUntil <= 30 ? 'warning' : 'upcoming',
      })
    }
    
    return items.sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.getTime() - b.date.getTime()
    })
  }, [signatureDate, startDate, endDate, terminationDate, noticeDeadline])
  
  if (events.length === 0) {
    return null
  }
  
  // Find current position
  const now = new Date()
  const completedCount = events.filter(e => e.date && isPast(e.date) && !isToday(e.date)).length
  const progressPercent = events.length > 1 
    ? Math.min(100, (completedCount / (events.length - 1)) * 100)
    : 0
  
  return (
    <Card className={cn("border-slate-200", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Clock className="h-4 w-4 text-purple-500" />
          Contract Lifecycle
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200">
            <motion.div
              className="w-full bg-gradient-to-b from-violet-500 to-purple-500 rounded-full"
              initial={{ height: 0 }}
              animate={{ height: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          
          {/* Events */}
          <div className="space-y-4">
            {events.map((event, idx) => {
              const colorMap: Record<string, string> = {
                blue: 'bg-violet-100 text-violet-600 border-violet-200',
                emerald: 'bg-violet-100 text-violet-600 border-violet-200',
                amber: 'bg-amber-100 text-amber-600 border-amber-200',
                red: 'bg-red-100 text-red-600 border-red-200',
                slate: 'bg-slate-100 text-slate-600 border-slate-200',
              }
              
              const statusIcon = {
                completed: <CheckCircle2 className="h-3 w-3 text-violet-500" />,
                current: <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />,
                upcoming: <div className="w-2 h-2 bg-slate-300 rounded-full" />,
                warning: <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />,
                missed: <AlertTriangle className="h-3 w-3 text-red-500" />,
              }
              
              const daysInfo = event.date 
                ? isFuture(event.date)
                  ? `in ${differenceInDays(event.date, now)} days`
                  : isPast(event.date) && !isToday(event.date)
                    ? `${Math.abs(differenceInDays(event.date, now))} days ago`
                    : 'today'
                : null
              
              return (
                <motion.div
                  key={event.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative flex items-start gap-4 pl-10"
                >
                  {/* Icon */}
                  <div className={cn(
                    "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border",
                    colorMap[event.color]
                  )}>
                    {event.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800">{event.label}</span>
                      {statusIcon[event.status]}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600">
                        {event.date ? format(event.date, 'MMM d, yyyy') : '—'}
                      </span>
                      {daysInfo && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded",
                          event.status === 'warning' || event.status === 'missed'
                            ? 'bg-amber-100 text-amber-700'
                            : event.status === 'completed'
                              ? 'bg-violet-50 text-violet-600'
                              : 'bg-slate-100 text-slate-500'
                        )}>
                          {daysInfo}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
