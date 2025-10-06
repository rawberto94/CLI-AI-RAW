'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, X, MessageSquare, Share2, TrendingUp } from 'lucide-react'
import { NotificationService, type Notification } from '@/lib/negotiation-prep/notification-service'
import { Button } from '@/components/ui/button'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const loadNotifications = () => {
      const userNotifications = NotificationService.getUserNotifications(userId)
      setNotifications(userNotifications)
      setUnreadCount(NotificationService.getUnreadCount(userId))
    }

    loadNotifications()

    const unsubscribe = NotificationService.subscribe(userId, loadNotifications)
    return unsubscribe
  }, [userId])

  const handleMarkAsRead = (notificationId: string) => {
    NotificationService.markAsRead(notificationId)
  }

  const handleMarkAllAsRead = () => {
    NotificationService.markAllAsRead(userId)
  }

  const handleDelete = (notificationId: string) => {
    NotificationService.deleteNotification(notificationId)
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'comment':
      case 'mention':
        return <MessageSquare className="w-4 h-4" />
      case 'share':
        return <Share2 className="w-4 h-4" />
      case 'outcome':
        return <TrendingUp className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Notification Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button
                    onClick={handleMarkAllAsRead}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Mark all as read
                  </Button>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={handleMarkAsRead}
                        onDelete={handleDelete}
                        getIcon={getIcon}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  getIcon: (type: Notification['type']) => React.ReactElement
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  getIcon
}: NotificationItemProps) {
  const [showActions, setShowActions] = useState(false)

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div
      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
        !notification.read ? 'bg-blue-50' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => {
        if (!notification.read) {
          onMarkAsRead(notification.id)
        }
        if (notification.link) {
          window.location.href = notification.link
        }
      }}
    >
      <div className="flex gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          notification.read ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'
        }`}>
          {getIcon(notification.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {notification.title}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {notification.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatTime(notification.createdAt)}
              </p>
            </div>

            {showActions && (
              <div className="flex gap-1">
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onMarkAsRead(notification.id)
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(notification.id)
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Delete"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}
          </div>
        </div>

        {!notification.read && (
          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
        )}
      </div>
    </div>
  )
}
