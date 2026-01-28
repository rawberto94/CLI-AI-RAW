'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Clock,
  DollarSign,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ============================================================================
// LEAN COMPONENT: Simple approval card with one-click actions
// - No modals, dialogs, or complex state
// - Uses quick API for instant actions
// - 100 lines vs 1,664 lines
// ============================================================================

interface ApprovalItem {
  id: string
  contractId: string
  contractName: string
  value?: number | null
  currentStep: string
  status: string
  createdAt: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

interface QuickApprovalCardProps {
  item: ApprovalItem
  onAction?: () => void
}

export function QuickApprovalCard({ item, onAction }: QuickApprovalCardProps) {
  const [loading, setLoading] = React.useState<string | null>(null)

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(action)
    try {
      const res = await fetch('/api/approvals/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: item.contractId, action }),
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        onAction?.()
      } else {
        toast.error(data.error || 'Action failed')
      }
    } catch (err) {
      toast.error('Failed to process action')
    } finally {
      setLoading(null)
    }
  }

  const priorityColors = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
    >
      <Card className="bg-white/80 backdrop-blur border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="p-2.5 bg-gradient-to-br from-purple-100 to-purple-100 rounded-xl shrink-0">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 truncate">{item.contractName}</h3>
                {item.priority && (
                  <Badge variant="outline" className={cn('text-xs', priorityColors[item.priority])}>
                    {item.priority}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {item.currentStep}
                </span>
                {item.value && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${item.value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/contracts/${item.contractId}`}>
                <Button variant="ghost" size="sm" className="gap-1 text-slate-500 hover:text-purple-600">
                  <ExternalLink className="h-4 w-4" />
                  View
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('reject')}
                disabled={loading !== null}
                className="gap-1 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
              >
                {loading === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction('approve')}
                disabled={loading !== null}
                className="gap-1 bg-gradient-to-r from-violet-600 to-violet-600 hover:from-violet-700 hover:to-violet-700"
              >
                {loading === 'approve' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Simple list component
interface QuickApprovalListProps {
  items: ApprovalItem[]
  onRefresh?: () => void
  loading?: boolean
}

export function QuickApprovalList({ items, onRefresh, loading }: QuickApprovalListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">All caught up!</h3>
        <p className="text-slate-500">No pending approvals</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <QuickApprovalCard key={item.id} item={item} onAction={onRefresh} />
      ))}
    </div>
  )
}
