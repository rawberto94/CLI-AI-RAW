/**
 * Intelligence Notifications Component
 * Real-time notification bell with dropdown for the topbar
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  X, 
  Clock, 
  MessageSquare, 
  FileText, 
  AlertCircle,
  ChevronRight,
  Loader2,
  Settings,
  Sparkles,
  Calendar,
  DollarSign,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/contexts/websocket-context';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

const notificationTypeConfig: Record<string, { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string 
}> = {
  CONTRACT_UPLOADED: { icon: FileText, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  CONTRACT_ANALYZED: { icon: Sparkles, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  APPROVAL_REQUEST: { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  APPROVAL_COMPLETED: { icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
  RENEWAL_REMINDER: { icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  COMMENT_MENTION: { icon: MessageSquare, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  BUDGET_ALERT: { icon: DollarSign, color: 'text-rose-600', bgColor: 'bg-rose-100' },
  TEAM_INVITE: { icon: Users, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  SYSTEM: { icon: AlertCircle, color: 'text-slate-600', bgColor: 'bg-slate-100' },
};

export function IntelligenceNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsContext = useWebSocket();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time notifications via WebSocket
  useEffect(() => {
    if (!wsContext?.onEvent) return;
    
    const unsubscribe = wsContext.onEvent((event: unknown) => {
      const typedEvent = event as { type?: string; data?: Notification };
      if (typedEvent.type === 'notification' && typedEvent.data) {
        setNotifications(prev => [typedEvent.data!, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => unsubscribe?.();
  }, [wsContext]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
    setIsOpen(false);
  };

  const getConfig = (type: string) => {
    return notificationTypeConfig[type] ?? notificationTypeConfig['SYSTEM']!;
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          isOpen 
            ? "bg-slate-100 dark:bg-slate-800" 
            : "hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        
        {/* Unread Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span key="unread-count"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <Link
                  href="/settings/notifications"
                  className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Notification settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Bell className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((notification) => {
                    const config = getConfig(notification.type);
                    const Icon = config.icon;
                    
                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                          notification.isRead
                            ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            : "bg-violet-50/50 dark:bg-violet-900/10 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                          config.bgColor
                        )}>
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm truncate",
                              notification.isRead
                                ? "text-slate-700 dark:text-slate-300"
                                : "text-slate-900 dark:text-white font-medium"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {notification.link && (
                          <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/notifications"
                  className="flex items-center justify-center gap-1 px-4 py-3 text-sm text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default IntelligenceNotifications;
