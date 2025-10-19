'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  X,
  ExternalLink,
  ChevronRight,
  Zap,
  TrendingUp,
  Shield,
  BarChart
} from 'lucide-react'

interface WhatsNewItem {
  id: string
  title: string
  description: string
  category: 'feature' | 'improvement' | 'update' | 'announcement'
  icon: string
  date: Date
  link?: string
  dismissed: boolean
}

interface WhatsNewWidgetProps {
  userId?: string
  compact?: boolean
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  zap: Zap,
  'trending-up': TrendingUp,
  shield: Shield,
  'bar-chart': BarChart
}

// Category colors
const categoryColors: Record<string, string> = {
  feature: 'bg-blue-100 text-blue-800',
  improvement: 'bg-green-100 text-green-800',
  update: 'bg-purple-100 text-purple-800',
  announcement: 'bg-orange-100 text-orange-800'
}

export function WhatsNewWidget({ userId, compact = false }: WhatsNewWidgetProps) {
  const [items, setItems] = useState<WhatsNewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadWhatsNew()
  }, [])

  const loadWhatsNew = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/whats-new')
      if (response.ok) {
        const { data } = await response.json()
        setItems(data || [])
      }
    } catch (error) {
      console.error('Failed to load what\'s new:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissItem = async (itemId: string) => {
    try {
      await fetch('/api/dashboard/whats-new/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      })

      setItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, dismissed: true } : item
        )
      )
    } catch (error) {
      console.error('Failed to dismiss item:', error)
    }
  }

  const activeItems = items.filter(item => !item.dismissed)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
            What's New
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeItems.length === 0) {
    return null
  }

  if (compact) {
    return (
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  {activeItems[0].title}
                </h3>
                <p className="text-sm text-gray-600">
                  {activeItems[0].description}
                </p>
                {activeItems.length > 1 && (
                  <p className="text-xs text-gray-500 mt-2">
                    +{activeItems.length - 1} more update{activeItems.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissItem(activeItems[0].id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const displayItems = expanded ? activeItems : activeItems.slice(0, 3)

  return (
    <Card className="border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardTitle className="text-lg flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-blue-600" />
          What's New
          {activeItems.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeItems.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {displayItems.map(item => {
            const Icon = iconMap[item.icon] || Sparkles
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{item.title}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={() => dismissItem(item.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={categoryColors[item.category]}
                    >
                      {item.category}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    {item.link && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => window.open(item.link, '_blank')}
                      >
                        Learn more
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {activeItems.length > 3 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>Show Less</>
              ) : (
                <>
                  Show {activeItems.length - 3} More
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default WhatsNewWidget
