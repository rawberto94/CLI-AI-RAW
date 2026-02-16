'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  const [approvalHistory, setApprovalHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true)
      try {
        const [approvalRes, activityRes] = await Promise.all([
          fetch(`/api/approvals?contractId=${encodeURIComponent(contractId)}`),
          fetch(`/api/contracts/${encodeURIComponent(contractId)}/activity`),
        ])

        if (approvalRes.ok) {
          const data = await approvalRes.json()
          setApprovalHistory(data.data?.items || [])
        } else {
          setApprovalHistory([])
        }

        if (activityRes.ok) {
          const data = await activityRes.json()

          const rawActivities = Array.isArray(data?.activities) ? data.activities : []
          interface RawActivity {
            id?: unknown;
            type?: unknown;
            user?: unknown;
            userName?: unknown;
            action?: unknown;
            title?: unknown;
            details?: unknown;
            description?: unknown;
            timestamp?: unknown;
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
        setApprovalHistory([])
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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white border border-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Approval Workflow Status - Hidden for now, will be enabled in future */}
      {/* {approvalHistory.length > 0 && (...)} */}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{activity.userName || 'System'}</span>{' '}
                      <span className="text-slate-700">{activity.title}</span>
                    </p>
                    {activity.description ? (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{activity.description}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 ml-4">{formatTimeAgo(new Date(activity.timestamp))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No recent activity yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
