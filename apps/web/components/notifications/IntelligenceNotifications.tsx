'use client'

import React, { useState, useEffect } from 'react'
import { Bell, X, AlertTriangle, CheckCircle, Info, TrendingUp, Clock, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Notification {
  id: string
  type: 'alert' | 'success' | 'info' | 'opportunity'
  title: string
  message: string
  timestamp: Date
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  actionUrl?: string
  metadata?: {
    contractId?: string
    riskScore?: number
    opportunityValue?: number
  }
}

export default function IntelligenceNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Simulate real-time notifications
  useEffect(() => {
    const generateNotification = (): Notification => {
      const types: Notification['type'][] = ['alert', 'success', 'info', 'opportunity']
      const priorities: Notification['priority'][] = ['low', 'medium', 'high', 'critical']
      
      const templates = {
        alert: [
          { title: 'High Risk Contract Detected', message: 'Contract ABC-2024-001 shows elevated risk indicators' },
          { title: 'Compliance Issue Found', message: 'Missing required clauses in supplier agreement' },
          { title: 'Deadline Approaching', message: 'Contract renewal due in 7 days' }
        ],
        success: [
          { title: 'Contract Processing Complete', message: 'Successfully analyzed 15 new contracts' },
          { title: 'Risk Mitigation Applied', message: 'Automated risk controls activated for high-value contract' },
          { title: 'Optimization Implemented', message: 'Cost savings of $45K identified and applied' }
        ],
        info: [
          { title: 'System Update', message: 'Intelligence engine updated with new risk models' },
          { title: 'Weekly Report Ready', message: 'Contract intelligence summary available for review' },
          { title: 'New Feature Available', message: 'Enhanced contract comparison tools now live' }
        ],
        opportunity: [
          { title: 'Cost Optimization Found', message: 'Potential savings of $125K identified in vendor contracts' },
          { title: 'Negotiation Leverage', message: 'Market analysis suggests favorable renegotiation terms' },
          { title: 'Performance Improvement', message: 'AI suggests contract terms optimization' }
        ]
      }

      const type = types[Math.floor(Math.random() * types.length)]
      const priority = priorities[Math.floor(Math.random() * priorities.length)]
      const template = templates[type][Math.floor(Math.random() * templates[type].length)]

      return {
        id: `notif-${Date.now()}-${Math.random()}`,
        type,
        priority,
        title: template.title,
        message: template.message,
        timestamp: new Date(),
        read: false,
        actionUrl: type === 'alert' ? '/contracts/enhanced-v2' : undefined,
        metadata: {
          contractId: `CTR-${Math.floor(Math.random() * 1000)}`,
          riskScore: type === 'alert' ? Math.floor(Math.random() * 40) + 60 : undefined,
          opportunityValue: type === 'opportunity' ? Math.floor(Math.random() * 200000) + 25000 : undefined
        }
      }
    }

    // Initial notifications
    const initialNotifications = Array.from({ length: 5 }, generateNotification)
    setNotifications(initialNotifications)

    // Simulate real-time updates
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance every 10 seconds
        const newNotification = generateNotification()
        setNotifications(prev => [newNotification, ...prev.slice(0, 19)]) // Keep last 20
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Update unread count
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'info': return <Info className="h-4 w-4 text-blue-500" />
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-purple-500" />
    }
  }

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
    return `${Math.floor(minutes / 1440)}d ago`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Intelligence Notifications</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount} unread notifications
          </p>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`border-0 border-b rounded-none cursor-pointer hover:bg-muted/50 transition-colors ${
                  !notification.read ? 'bg-blue-50/50' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {notification.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(notification.priority)}`}
                        >
                          {notification.priority}
                        </Badge>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(notification.timestamp)}
                        </div>
                        <div className="flex items-center gap-1">
                          {notification.actionUrl && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = notification.actionUrl!
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeNotification(notification.id)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {notification.metadata && (
                        <div className="mt-2 flex gap-2">
                          {notification.metadata.riskScore && (
                            <Badge variant="outline" className="text-xs">
                              Risk: {notification.metadata.riskScore}%
                            </Badge>
                          )}
                          {notification.metadata.opportunityValue && (
                            <Badge variant="outline" className="text-xs">
                              Value: ${notification.metadata.opportunityValue.toLocaleString()}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="border-t p-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => setIsOpen(false)}
            >
              View All Notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}