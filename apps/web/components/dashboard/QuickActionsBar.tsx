'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FilePlus,
  Search,
  Bell,
  BarChart,
  FileText,
  TrendingUp,
  DollarSign,
  Target,
  Presentation,
  FileCheck,
  Shield,
  AlertTriangle,
  Library,
  Calculator,
  PieChart,
  CreditCard,
  Settings,
  Plus,
  X
} from 'lucide-react'
import { QuickAction, UserRole, getQuickActionsForRole } from '@/lib/dashboard/default-layouts'
import { useRouter } from 'next/navigation'

interface QuickActionsBarProps {
  role: UserRole
  userId?: string
  compact?: boolean
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  'file-plus': FilePlus,
  search: Search,
  bell: Bell,
  'bar-chart': BarChart,
  'file-text': FileText,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  target: Target,
  presentation: Presentation,
  'file-check': FileCheck,
  shield: Shield,
  'alert-triangle': AlertTriangle,
  library: Library,
  calculator: Calculator,
  'pie-chart': PieChart,
  'credit-card': CreditCard,
  dashboard: BarChart
}

export function QuickActionsBar({ role, userId, compact = false }: QuickActionsBarProps) {
  const router = useRouter()
  const [actions, setActions] = useState<QuickAction[]>([])
  const [customizing, setCustomizing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadQuickActions()
  }, [role])

  const loadQuickActions = async () => {
    try {
      // Try to load custom actions from API
      const response = await fetch('/api/dashboard/quick-actions')
      if (response.ok) {
        const { data } = await response.json()
        setActions(data || getQuickActionsForRole(role))
      } else {
        // Fall back to default actions
        setActions(getQuickActionsForRole(role))
      }
    } catch (error) {
      console.error('Failed to load quick actions:', error)
      setActions(getQuickActionsForRole(role))
    }
  }

  const handleActionClick = async (action: QuickAction) => {
    // Track action usage
    try {
      await fetch('/api/dashboard/quick-actions/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: action.id,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Failed to track action:', error)
    }

    // Navigate or execute action
    if (action.action.startsWith('/')) {
      router.push(action.action)
    } else if (action.action.startsWith('http')) {
      window.open(action.action, '_blank')
    } else {
      // Handle custom action types
      console.log('Custom action:', action.action)
    }
  }

  const toggleActionVisibility = (actionId: string) => {
    setActions(prev =>
      prev.map(action =>
        action.id === actionId
          ? { ...action, visible: !action.visible }
          : action
      )
    )
  }

  const saveCustomActions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/quick-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions })
      })

      if (response.ok) {
        setCustomizing(false)
      }
    } catch (error) {
      console.error('Failed to save quick actions:', error)
    } finally {
      setLoading(false)
    }
  }

  const visibleActions = actions.filter(action => action.visible)

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visibleActions.map(action => {
          const Icon = iconMap[action.icon] || FileText
          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => handleActionClick(action)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {action.label}
              {action.badge && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 px-1 py-0 text-xs h-5 min-w-[20px]"
                >
                  {action.badge}
                </Badge>
              )}
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCustomizing(!customizing)}
        >
          <Settings className="w-4 h-4 mr-2" />
          {customizing ? 'Done' : 'Customize'}
        </Button>
      </CardHeader>
      <CardContent>
        {customizing ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Toggle actions to show or hide them from your quick actions bar
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {actions.map(action => {
                const Icon = iconMap[action.icon] || FileText
                return (
                  <div
                    key={action.id}
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      action.visible ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-600" />
                      <span className="font-medium">{action.label}</span>
                    </div>
                    <Button
                      variant={action.visible ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleActionVisibility(action.id)}
                    >
                      {action.visible ? 'Visible' : 'Hidden'}
                    </Button>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setCustomizing(false)
                  loadQuickActions()
                }}
              >
                Cancel
              </Button>
              <Button onClick={saveCustomActions} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {visibleActions.map(action => {
              const Icon = iconMap[action.icon] || FileText
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  className="relative h-auto flex-col items-start p-4 hover:bg-gray-50"
                  onClick={() => handleActionClick(action)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-blue-600" />
                    {action.badge && (
                      <Badge
                        variant="destructive"
                        className="px-1.5 py-0 text-xs h-5"
                      >
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-medium text-left">
                    {action.label}
                  </span>
                </Button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default QuickActionsBar
