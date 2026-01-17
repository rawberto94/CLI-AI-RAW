'use client';

/**
 * Notification Center Component
 * 
 * Displays and manages benchmark-related notifications
 */

import React, { useState, useEffect } from 'react';
import { Bell, X, Check, TrendingUp, TrendingDown, AlertCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Notification {
  id: string;
  type: 'MARKET_SHIFT' | 'BEST_RATE_CHANGE' | 'BENCHMARK_UPDATED' | 'OPPORTUNITY_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data: any;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationCenterProps {
  tenantId: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationCenter({ tenantId, onNotificationClick }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tenantId]);

  useEffect(() => {
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    fetchUnreadCount();

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rate-cards/notifications?tenantId=${tenantId}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          readAt: n.readAt ? new Date(n.readAt) : undefined,
        })));
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Error fetching notifications
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`/api/rate-cards/notifications?tenantId=${tenantId}&unreadOnly=true&limit=1`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Error fetching unread count
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/rate-cards/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action: 'markAsRead' }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, readAt: new Date() } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Error marking notification as read
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/rate-cards/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, action: 'markAllAsRead' }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch {
      // Error marking all as read
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'MARKET_SHIFT':
        return notification.data?.changePercentage > 0 ? (
          <TrendingUp className="h-5 w-5 text-red-500" />
        ) : (
          <TrendingDown className="h-5 w-5 text-green-500" />
        );
      case 'BEST_RATE_CHANGE':
        return <TrendingDown className="h-5 w-5 text-green-500" />;
      case 'OPPORTUNITY_DETECTED':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-l-red-500 bg-red-50';
      case 'HIGH':
        return 'border-l-orange-500 bg-orange-50';
      case 'MEDIUM':
        return 'border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div 
            className="absolute right-0 mt-2 w-full max-w-[24rem] sm:w-96 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50 max-h-[600px] flex flex-col"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notifications"
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                >
                  <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" role="status" aria-label="Loading notifications" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-slate-400">
                  <Bell className="h-12 w-12 mb-2 opacity-50" aria-hidden="true" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors border-l-4 ${
                        !notification.readAt ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                      } ${getSeverityColor(notification.severity)}`}
                      onClick={() => {
                        if (!notification.readAt) {
                          markAsRead(notification.id);
                        }
                        onNotificationClick?.(notification);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm text-gray-900">
                              {notification.title}
                            </h4>
                            {!notification.readAt && (
                              <span className="flex-shrink-0 h-2 w-2 bg-blue-500 rounded-full" />
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                            </span>
                            
                            {notification.data?.changePercentage !== undefined && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-white border border-gray-200">
                                {notification.data.changePercentage > 0 ? '+' : ''}
                                {notification.data.changePercentage.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to full notifications page
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationCenter;
