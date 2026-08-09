'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { detailUi } from '@/app/contracts/[id]/components/detail-ui'

type ActivityEvent = {
  id: string
  title: string
  description?: string
  userName?: string
  timestamp: string
  type?: string
}

export function ActivityTab({ contractId }: { contractId: string }) {
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true)
      try {
        const [approvalRes, activityRes] = await Promise.all([
          fetch(`/api/approvals?contractId=${encodeURIComponent(contractId)}`),
          fetch(`/api/contracts/${encodeURIComponent(contractId)}/activity`),
        ])

        // Approval history reserved for future workflow UI
        if (approvalRes.ok) {
          await approvalRes.json().catch(() => null)
        }

        if (activityRes.ok) {
          const data = await activityRes.json()

          const rawActivities = Array.isArray(data?.activities) ? data.activities : []
          interface RawActivity {
            id?: unknown
            type?: unknown
            user?: unknown
            userName?: unknown
            action?: unknown
            title?: unknown
            details?: unknown
            description?: unknown
            timestamp?: unknown
          }
          const normalized = rawActivities
            .map((a: RawActivity): ActivityEvent | null => {
              if (!a) return null
              return {
                id: String(a.id ?? ''),
                type: typeof a.type === 'string' ? a.type : undefined,
                userName:
                  typeof a.user === 'string'
                    ? a.user
                    : typeof a.userName === 'string'
                      ? a.userName
                      : undefined,
                title: String(a.action ?? a.title ?? ''),
                description:
                  typeof a.details === 'string'
                    ? a.details
                    : typeof a.description === 'string'
                      ? a.description
                      : undefined,
                timestamp: String(a.timestamp ?? ''),
              }
            })
            .filter((a: ActivityEvent | null): a is ActivityEvent => a !== null)

          setActivities(normalized)
        } else {
          setActivities([])
        }
      } catch {
        setActivities([])
      } finally {
        setLoading(false)
      }
    }
    fetchActivity()
  }, [contractId])

  const formatTimeAgo = (date: Date) => {
    const time = new Date(date).getTime()
    if (isNaN(time)) return 'Unknown'
    const seconds = Math.floor((Date.now() - time) / 1000)
    if (seconds < 0) return 'Just now'
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-xl border border-slate-200/80 bg-white shadow-sm"
          />
        ))}
      </div>
    )
  }

  return (
    <Card className={detailUi.card}>
      <CardHeader className={detailUi.cardHeader}>
        <CardTitle className={detailUi.cardTitle}>
          <Activity className="h-4 w-4 text-violet-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className={detailUi.cardContent}>
        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  detailUi.tileRow,
                  'min-h-[60px] items-start justify-between gap-4 transition-colors hover:border-slate-200 hover:bg-white'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn(detailUi.fieldValue, 'font-normal')}>
                    <span className="font-semibold text-slate-900">{activity.userName || 'System'}</span>{' '}
                    <span className="text-slate-700">{activity.title}</span>
                  </p>
                  {activity.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500">
                      {activity.description}
                    </p>
                  ) : null}
                </div>
                <p className="inline-flex shrink-0 items-center gap-1 text-xs font-medium leading-4 text-slate-400">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(new Date(activity.timestamp))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <Activity className="mx-auto mb-2 h-5 w-5 text-slate-300" />
            <p className={detailUi.fieldEmpty}>No recent activity yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
