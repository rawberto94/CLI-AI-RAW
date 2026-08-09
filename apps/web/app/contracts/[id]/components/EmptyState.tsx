'use client'

import React, { memo, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileText as _FileText,
  MessageSquare,
  Clock,
  Link2,
  Search,
  FileQuestion,
} from 'lucide-react'
import { detailUi } from './detail-ui'

type EmptyStateType = 'notes' | 'related' | 'timeline' | 'search' | 'general'

interface EmptyStateProps {
  type?: EmptyStateType
  title?: string
  description?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const defaultConfig: Record<EmptyStateType, { title: string; description: string; icon: ReactNode }> = {
  notes: {
    title: 'No notes yet',
    description: 'Add notes to track important information about this contract.',
    icon: <MessageSquare className="h-6 w-6" />,
  },
  related: {
    title: 'No related contracts',
    description: 'Related contracts will appear here based on parties, category, or terms.',
    icon: <Link2 className="h-6 w-6" />,
  },
  timeline: {
    title: 'No timeline events',
    description: 'Contract lifecycle events will appear as they occur.',
    icon: <Clock className="h-6 w-6" />,
  },
  search: {
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
    icon: <Search className="h-6 w-6" />,
  },
  general: {
    title: 'Nothing here',
    description: 'No data available at this time.',
    icon: <FileQuestion className="h-6 w-6" />,
  },
}

export const EmptyState = memo(function EmptyState({
  type = 'general',
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const config = defaultConfig[type]
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center",
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm"
      >
        {icon || config.icon}
      </motion.div>
      
      <h3 className={cn(detailUi.fieldValue, 'mb-1 text-slate-700')}>
        {title || config.title}
      </h3>
      <p className={cn(detailUi.fieldEmpty, 'max-w-[240px] not-italic text-slate-500')}>
        {description || config.description}
      </p>
      
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className={cn(detailUi.headerBtn, 'mt-4')}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  )
})
