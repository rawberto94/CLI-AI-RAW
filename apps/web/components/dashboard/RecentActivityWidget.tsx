'use client'

/**
 * Recent Activity Widget
 * 
 * Displays recent activity across the contract portfolio.
 * Shows actions, changes, and events in a timeline format.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  Activity,
  FileText,
  Upload,
  Edit,
  Trash2,
  Eye,
  Download,
  Share2,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Bell,
  RefreshCw,
  ChevronRight,
  Filter,
  MoreHorizontal,
  MessageSquare,
  GitBranch,
  Calendar,
  DollarSign,
  Shield,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============ TYPES ============

export type ActivityType = 
  | 'contract_created'
  | 'contract_updated'
  | 'contract_viewed'
  | 'contract_deleted'
  | 'version_created'
  | 'version_reverted'
  | 'document_uploaded'
  | 'document_downloaded'
  | 'approval_requested'
  | 'approval_completed'
  | 'approval_rejected'
  | 'comment_added'
  | 'shared'
  | 'reminder_set'
  | 'status_changed'
  | 'value_updated'
  | 'ai_analysis'
  | 'risk_detected'

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  description?: string
  timestamp: Date
  user: {
    id: string
    name: string
    email?: string
    avatar?: string
  }
  contract?: {
    id: string
    name: string
  }
  metadata?: Record<string, unknown>
  isNew?: boolean
}

interface RecentActivityWidgetProps {
  activities?: ActivityItem[]
  maxItems?: number
  showFilters?: boolean
  showViewAll?: boolean
  onRefresh?: () => void
  isLoading?: boolean
  className?: string
  variant?: 'card' | 'sidebar' | 'compact'
}

// ============ ACTIVITY CONFIG ============

const ACTIVITY_CONFIG: Record<ActivityType, {
  icon: React.ElementType
  color: string
  bgColor: string
}> = {
  contract_created: { icon: FileText, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  contract_updated: { icon: Edit, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  contract_viewed: { icon: Eye, color: 'text-slate-500', bgColor: 'bg-slate-50' },
  contract_deleted: { icon: Trash2, color: 'text-red-500', bgColor: 'bg-red-50' },
  version_created: { icon: GitBranch, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  version_reverted: { icon: RefreshCw, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  document_uploaded: { icon: Upload, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  document_downloaded: { icon: Download, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  approval_requested: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  approval_completed: { icon: CheckCircle2, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  approval_rejected: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50' },
  comment_added: { icon: MessageSquare, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  shared: { icon: Share2, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  reminder_set: { icon: Bell, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  status_changed: { icon: Activity, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  value_updated: { icon: DollarSign, color: 'text-green-500', bgColor: 'bg-green-50' },
  ai_analysis: { icon: Sparkles, color: 'text-pink-500', bgColor: 'bg-pink-50' },
  risk_detected: { icon: Shield, color: 'text-red-500', bgColor: 'bg-red-50' },
}

// ============ HELPER FUNCTIONS ============

const getActivityConfig = (type: ActivityType) => {
  return ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.contract_viewed
}

const formatActivityTime = (date: Date) => {
  return formatDistanceToNow(date, { addSuffix: true })
}

const getUserInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ============ SUB-COMPONENTS ============

interface ActivityItemRowProps {
  activity: ActivityItem
  variant: 'card' | 'sidebar' | 'compact'
  showContract?: boolean
}

function ActivityItemRow({ activity, variant, showContract = true }: ActivityItemRowProps) {
  const config = getActivityConfig(activity.type)
  const Icon = config.icon
  
  const isCompact = variant === 'compact'
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative flex gap-3",
        isCompact ? "py-2" : "py-3",
        "hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors"
      )}
    >
      {/* New indicator */}
      {activity.isNew && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-500" />
      )}
      
      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 rounded-lg flex items-center justify-center",
        config.bgColor,
        isCompact ? "w-8 h-8" : "w-10 h-10"
      )}>
        <Icon className={cn(config.color, isCompact ? "h-4 w-4" : "h-5 w-5")} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn(
              "font-medium text-slate-900 truncate",
              isCompact ? "text-xs" : "text-sm"
            )}>
              {activity.title}
            </p>
            {!isCompact && activity.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {activity.description}
              </p>
            )}
          </div>
          
          {/* Time */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  "flex-shrink-0 text-slate-400 whitespace-nowrap",
                  isCompact ? "text-[10px]" : "text-xs"
                )}>
                  {formatActivityTime(activity.timestamp)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {activity.timestamp.toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* User and contract info */}
        <div className={cn(
          "flex items-center gap-2 text-slate-500",
          isCompact ? "mt-0.5" : "mt-1"
        )}>
          <div className="flex items-center gap-1">
            <Avatar className={isCompact ? "h-4 w-4" : "h-5 w-5"}>
              <AvatarImage src={activity.user.avatar} />
              <AvatarFallback className={cn(
                "bg-slate-100 text-slate-600",
                isCompact ? "text-[8px]" : "text-[10px]"
              )}>
                {getUserInitials(activity.user.name)}
              </AvatarFallback>
            </Avatar>
            <span className={isCompact ? "text-[10px]" : "text-xs"}>
              {activity.user.name}
            </span>
          </div>
          
          {showContract && activity.contract && (
            <>
              <span className="text-slate-300">•</span>
              <Link
                href={`/contracts/${activity.contract.id}`}
                className={cn(
                  "hover:text-violet-600 hover:underline truncate max-w-[120px]",
                  isCompact ? "text-[10px]" : "text-xs"
                )}
              >
                {activity.contract.name}
              </Link>
            </>
          )}
        </div>
      </div>
      
      {/* Hover action */}
      {activity.contract && (
        <Link
          href={`/contracts/${activity.contract.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center"
        >
          <ArrowUpRight className="h-4 w-4 text-slate-400 hover:text-violet-500" />
        </Link>
      )}
    </motion.div>
  )
}

// ============ FILTER TYPES ============

type FilterType = 'all' | 'contracts' | 'approvals' | 'versions' | 'ai'

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: 'All Activity' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'versions', label: 'Versions' },
  { value: 'ai', label: 'AI Insights' },
]

const filterActivities = (activities: ActivityItem[], filter: FilterType): ActivityItem[] => {
  if (filter === 'all') return activities
  
  const typeMap: Record<FilterType, ActivityType[]> = {
    all: [],
    contracts: ['contract_created', 'contract_updated', 'contract_deleted', 'document_uploaded'],
    approvals: ['approval_requested', 'approval_completed', 'approval_rejected'],
    versions: ['version_created', 'version_reverted'],
    ai: ['ai_analysis', 'risk_detected'],
  }
  
  return activities.filter(a => typeMap[filter].includes(a.type))
}

// ============ MAIN COMPONENT ============

export function RecentActivityWidget({
  activities = [],
  maxItems = 10,
  showFilters = true,
  showViewAll = true,
  onRefresh,
  isLoading = false,
  className,
  variant = 'card',
}: RecentActivityWidgetProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  
  const filteredActivities = filterActivities(activities, filter).slice(0, maxItems)
  const hasNewItems = activities.some(a => a.isNew)
  
  // Sidebar variant
  if (variant === 'sidebar') {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
            {hasNewItems && (
              <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            )}
          </h3>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          )}
        </div>
        
        <ScrollArea className="flex-1 px-4">
          <div className="py-2 space-y-1">
            {filteredActivities.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No recent activity
              </p>
            ) : (
              filteredActivities.map(activity => (
                <ActivityItemRow
                  key={activity.id}
                  activity={activity}
                  variant="sidebar"
                />
              ))
            )}
          </div>
        </ScrollArea>
        
        {showViewAll && (
          <div className="px-4 py-3 border-t">
            <Link href="/audit-logs">
              <Button variant="ghost" className="w-full justify-between text-sm">
                View all activity
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    )
  }
  
  // Card variant (default)
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 bg-violet-100 rounded-lg">
              <Activity className="h-4 w-4 text-violet-600" />
            </div>
            Recent Activity
            {hasNewItems && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                New
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {showFilters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Filter className="h-4 w-4 mr-1" />
                    {FILTER_OPTIONS.find(f => f.value === filter)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {FILTER_OPTIONS.map(option => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setFilter(option.value)}
                      className={filter === option.value ? 'bg-slate-100' : ''}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-1">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No recent activity</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredActivities.map(activity => (
                <ActivityItemRow
                  key={activity.id}
                  activity={activity}
                  variant="card"
                />
              ))}
            </AnimatePresence>
          )}
        </div>
        
        {showViewAll && filteredActivities.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Link href="/audit-logs">
              <Button variant="ghost" className="w-full justify-center text-sm">
                View all activity
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default RecentActivityWidget
