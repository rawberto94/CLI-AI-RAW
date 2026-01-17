'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  X, 
  Clock, 
  MessageSquare, 
  FileText, 
  Users, 
  AlertCircle, 
  ChevronRight,
  Trash2,
  Settings,
  Filter,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/contexts/websocket-context';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterProps {
  maxHeight?: string;
  onClose?: () => void;
  className?: string;
}

const notificationTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  APPROVAL_REQUEST: { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  APPROVAL_COMPLETED: { icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
  COMMENT_MENTION: { icon: MessageSquare, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  COMMENT_REPLY: { icon: MessageSquare, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  CONTRACT_DEADLINE: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  CONTRACT_UPDATE: { icon: FileText, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  WORKFLOW_STEP: { icon: Users, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  SHARE_INVITE: { icon: Users, color: 'text-pink-600', bgColor: 'bg-pink-100' },
  SYSTEM: { icon: AlertCircle, color: 'text-slate-600', bgColor: 'bg-slate-100' },
};

export function NotificationCenter({ maxHeight = '400px', onClose, className }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showSettings, setShowSettings] = useState(false);
  
  const wsContext = useWebSocket();

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?unread=' + (filter === 'unread'));
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time notifications via WebSocket
  useEffect(() => {
    if (!wsContext?.onEvent) return;
    
    const unsubscribe = wsContext.onEvent((event: unknown) => {
      const typedEvent = event as { type?: string; data?: Notification };
      if (typedEvent.type === 'notification' && typedEvent.data) {
        setNotifications(prev => [typedEvent.data!, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => unsubscribe?.();
  }, [wsContext]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Error handled silently
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Error handled silently
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });
      
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch {
      // Error handled silently
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <div className={cn('bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-500" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-3">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize',
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((notification) => {
              const config = notificationTypeConfig[notification.type] ?? notificationTypeConfig.SYSTEM;
              if (!config) return null;
              const Icon = config.icon;

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  layout
                  className={cn(
                    'px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group',
                    !notification.isRead && 'bg-blue-50/50'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg flex-shrink-0', config.bgColor)}>
                      <Icon className={cn('w-4 h-4', config.color)} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className={cn(
                          'text-sm font-medium truncate',
                          notification.isRead ? 'text-slate-700' : 'text-slate-900'
                        )}>
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-500 line-clamp-2 mb-1">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-500" />
                          </button>
                          {notification.link && (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {filteredNotifications.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
          <button 
            className="w-full text-center text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
            onClick={() => window.location.href = '/notifications'}
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}

// Bell icon with badge for use in nav/header
export function NotificationBell({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsContext = useWebSocket();
  const onEvent = wsContext?.onEvent;

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const response = await fetch('/api/notifications?unread=true');
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      } catch {
        // Error handled silently
      }
    };

    fetchUnread();
    // Poll every 30 seconds as fallback when WebSocket is not available
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time notification updates via WebSocket
  useEffect(() => {
    if (!onEvent) return;
    
    const unsubscribe = onEvent((event: unknown) => {
      const typedEvent = event as { type?: string };
      if (typedEvent.type === 'notification') {
        // Increment unread count when new notification arrives
        setUnreadCount(prev => prev + 1);
      } else if (typedEvent.type === 'notification_read') {
        // Decrement when a notification is marked as read
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else if (typedEvent.type === 'notifications_cleared') {
        // Reset count when all are cleared
        setUnreadCount(0);
      }
    });

    return () => unsubscribe?.();
  }, [onEvent]);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-2 w-96 z-50"
            >
              <NotificationCenter onClose={() => setIsOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;
