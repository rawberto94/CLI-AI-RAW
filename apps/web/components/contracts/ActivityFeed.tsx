'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Activity,
  FileEdit,
  MessageSquare,
  UserPlus,
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  Clock,
  User,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityItem {
  id: string
  type: 'upload' | 'edit' | 'comment' | 'approval' | 'rejection' | 'share' | 'download' | 'workflow' | 'metadata'
  user: string
  action: string
  details?: string
  timestamp: string
  metadata?: Record<string, any>
}

interface ActivityFeedProps {
  contractId: string
}

export function ActivityFeed({ contractId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  const loadActivities = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/contracts/${contractId}/activity`)
      if (!response.ok) throw new Error('Failed to load activity')
      const data = await response.json()
      setActivities(data.activities || [])
    } catch (error) {
      console.error('Failed to load activity:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityConfig = (type: string) => {
    switch (type) {
      case 'upload':
        return { icon: Upload, color: 'bg-blue-100 text-blue-700', gradient: 'from-blue-500 to-indigo-600' }
      case 'edit':
      case 'metadata':
        return { icon: FileEdit, color: 'bg-purple-100 text-purple-700', gradient: 'from-purple-500 to-pink-600' }
      case 'comment':
        return { icon: MessageSquare, color: 'bg-green-100 text-green-700', gradient: 'from-green-500 to-emerald-600' }
      case 'approval':
        return { icon: CheckCircle2, color: 'bg-green-100 text-green-700', gradient: 'from-green-500 to-emerald-600' }
      case 'rejection':
        return { icon: XCircle, color: 'bg-red-100 text-red-700', gradient: 'from-red-500 to-pink-600' }
      case 'share':
        return { icon: UserPlus, color: 'bg-orange-100 text-orange-700', gradient: 'from-orange-500 to-red-600' }
      case 'download':
        return { icon: Download, color: 'bg-gray-100 text-gray-700', gradient: 'from-gray-500 to-slate-600' }
      case 'workflow':
        return { icon: Sparkles, color: 'bg-indigo-100 text-indigo-700', gradient: 'from-indigo-500 to-purple-600' }
      default:
        return { icon: Activity, color: 'bg-gray-100 text-gray-700', gradient: 'from-gray-500 to-slate-600' }
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return then.toLocaleDateString()
  }

  if (loading) {
    return (
      <Card className="shadow-xl border-0">
        <CardContent className="p-8 text-center">
          <Activity className="h-8 w-8 animate-pulse text-blue-600 mx-auto" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-2xl border-0">
      <CardHeader className="border-b bg-gradient-to-br from-gray-50 to-slate-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Activity Feed
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-300">
            {activities.length} event{activities.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No activity yet</p>
            <p className="text-gray-500 text-sm mt-2">Actions on this contract will appear here</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-gray-200"></div>

            {/* Activity Items */}
            <div className="space-y-6">
              {activities.map((activity, index) => {
                const config = getActivityConfig(activity.type)
                const Icon = config.icon
                const initials = activity.user
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()

                return (
                  <div key={activity.id} className="relative flex items-start gap-4 group">
                    {/* Timeline Dot */}
                    <div className={cn(
                      'relative z-10 p-3 rounded-full shadow-lg bg-gradient-to-br',
                      config.gradient,
                      'group-hover:scale-110 transition-transform'
                    )}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-indigo-600">
                              <AvatarFallback className="text-white text-xs font-bold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm">
                                <span className="font-semibold text-gray-900">{activity.user}</span>
                                <span className="text-gray-600"> {activity.action}</span>
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeAgo(activity.timestamp)}
                              </p>
                            </div>
                          </div>
                          <Badge className={config.color}>
                            {activity.type}
                          </Badge>
                        </div>

                        {activity.details && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">{activity.details}</p>
                          </div>
                        )}

                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value)}
                              </Badge>
                            ))}
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
      </CardContent>
    </Card>
  )
}
