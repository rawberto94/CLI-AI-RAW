'use client'

import React from 'react'
import { AlertCircle, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { bg: string; text: string; icon: React.ElementType; label: string; animate?: boolean }
  > = {
    completed: {
      bg: 'bg-violet-50 border-violet-200',
      text: 'text-violet-700',
      icon: CheckCircle2,
      label: 'Completed',
    },
    processing: {
      bg: 'bg-violet-50 border-violet-200',
      text: 'text-violet-700',
      icon: Loader2,
      label: 'Processing',
      animate: true,
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
      label: 'Error',
    },
    failed: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
      label: 'Failed',
    },
    uploaded: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      icon: Clock,
      label: 'Pending',
    },
  }

  const statusConfig = config[status.toLowerCase()] || {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-700',
    icon: FileText,
    label: status,
  }

  const Icon = statusConfig.icon
  const shouldAnimate = 'animate' in statusConfig && statusConfig.animate

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium border', statusConfig.bg, statusConfig.text)}>
      <Icon className={cn('h-3 w-3', shouldAnimate && 'animate-spin')} />
      {statusConfig.label}
    </Badge>
  )
}
