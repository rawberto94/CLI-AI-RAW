'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Activity,
  Upload,
  Edit3,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Share2,
  Download,
  FileEdit,
  GitBranch,
  Clock,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  type: string
  action: string
  details?: string
  metadata?: any
  userId: string
  userName: string
  timestamp: string
}

interface ContractActivityFeedProps {
  contractId: string
  maxHeight?: string
  showFilters?: boolean
}

const activityIcons: Record<string, any> = {
  upload: Upload,
  edit: Edit3,
  comment: MessageSquare,
  approval: CheckCircle2,
  rejection: XCircle,
  share: Share2,
  download: Download,
  metadata: FileEdit,
  workflow: GitBranch,
}

const activityColors: Record<string, string> = {
  upload: 'text-blue-600 bg-blue-50',
  edit: 'text-purple-600 bg-purple-50',
  comment: 'text-green-600 bg-green-50',
  approval: 'text-emerald-600 bg-emerald-50',
  rejection: 'text-red-600 bg-red-50',
  share: 'text-indigo-600 bg-indigo-50',
  download: 'text-gray-600 bg-gray-50',
  metadata: 'text-orange-600 bg-orange-50',
  workflow: 'text-cyan-600 bg-cyan-50',
}

export function ContractActivityFeed({
  contractId,
  maxHeight = '600px',
  showFilters = true,
}: ContractActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadActivities()
  }, [contractId, selectedFilter])

  const loadActivities = async () => {
    try {
      setLoading(true)
      const url = selectedFilter
        ? `/api/contracts/${contractId}/activity?type=${selectedFilter}`
        : `/api/contracts/${contractId}/activity`

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to load activities')
      
      const data = await response.json()
      setActivities(data.activities || [])
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (activityId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(activityId)) {
        newSet.delete(activityId)
      } else {
        newSet.add(activityId)
      }
      return newSet
    })
  }

  const getActivityIcon = (type: string) => {
    const Icon = activityIcons[type] || Activity
    return Icon
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const filterOptions = [
    { value: null, label: 'All Activity', count: activities.length },
    { value: 'comment', label: 'Comments', icon: MessageSquare },
    { value: 'approval', label: 'Approvals', icon: CheckCircle2 },
    { value: 'edit', label: 'Edits', icon: Edit3 },
    { value: 'workflow', label: 'Workflow', icon: GitBranch },
    { value: 'share', label: 'Sharing', icon: Share2 },
  ]

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Activity Feed</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">
                {activities.length} activities
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadActivities}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-4">
            {filterOptions.map((option) => {
              const Icon = option.icon
              return (
                <Button
                  key={option.value || 'all'}
                  variant={selectedFilter === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter(option.value)}
                  className={cn(
                    'text-xs',
                    selectedFilter === option.value &&
                      'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                  )}
                >
                  {Icon && <Icon className="h-3 w-3 mr-1" />}
                  {option.label}
                </Button>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea style={{ height: maxHeight }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">Loading activities...</p>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900">No activity yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Activity will appear here as actions are taken
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[52px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-indigo-200 to-purple-200" />

              {/* Activity items */}
              <div className="space-y-0">
                {activities.map((activity, index) => {
                  const Icon = getActivityIcon(activity.type)
                  const isExpanded = expandedItems.has(activity.id)
                  const hasDetails = activity.details || activity.metadata

                  return (
                    <div
                      key={activity.id}
                      className={cn(
                        'relative p-4 hover:bg-gray-50/50 transition-colors',
                        index !== activities.length - 1 && 'border-b border-gray-100'
                      )}
                    >
                      <div className="flex gap-4">
                        {/* Avatar & Icon */}
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                              {getInitials(activity.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              'absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white shadow-sm',
                              activityColors[activity.type] || 'text-gray-600 bg-gray-50'
                            )}
                          >
                            <Icon className="h-3 w-3" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-gray-900">
                                  {activity.userName}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {activity.action}
                                </span>
                              </div>

                              {/* Timestamp */}
                              <div className="flex items-center gap-1.5 mt-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(activity.timestamp), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Expand button */}
                            {hasDetails && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpanded(activity.id)}
                                className="h-7 w-7 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && hasDetails && (
                            <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                              {activity.details && (
                                <p className="text-sm text-gray-700 mb-2">
                                  {activity.details}
                                </p>
                              )}
                              {activity.metadata && (
                                <div className="space-y-1">
                                  {Object.entries(activity.metadata).map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <span className="font-medium text-gray-600">
                                        {key}:
                                      </span>
                                      <span className="text-gray-900">
                                        {typeof value === 'object'
                                          ? JSON.stringify(value)
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
