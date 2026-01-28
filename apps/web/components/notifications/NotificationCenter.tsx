/**
 * Notification Center
 * Comprehensive notification management with grouping and actions
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  FileText,
  TrendingUp,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info' | 'ai';
  category: 'contract' | 'system' | 'analysis' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    contractId?: string;
    contractName?: string;
    progress?: number;
  };
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | Notification['category']>('all');

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      return n.category === filter;
    });
  }, [notifications, filter]);

  const groupedByDate = useMemo(() => {
    const groups: { today: Notification[]; yesterday: Notification[]; earlier: Notification[] } = {
      today: [],
      yesterday: [],
      earlier: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    filteredNotifications.forEach(n => {
      const notifDate = new Date(n.timestamp);
      if (notifDate >= today) {
        groups.today.push(n);
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(n);
      } else {
        groups.earlier.push(n);
      }
    });

    return groups;
  }, [filteredNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'ai': return <Sparkles className="h-4 w-4 text-purple-500" />;
      default: return <Info className="h-4 w-4 text-violet-500" />;
    }
  };

  const getCategoryIcon = (category: Notification['category']) => {
    switch (category) {
      case 'contract': return FileText;
      case 'analysis': return Sparkles;
      case 'alert': return AlertCircle;
      default: return Info;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
                <p className="text-xs text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMarkAllAsRead}
                  className="text-xs"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 overflow-x-auto">
            {[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'contract', label: 'Contracts' },
              { value: 'analysis', label: 'AI Analysis' },
              { value: 'alert', label: 'Alerts' }
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={filter === value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(value as typeof filter)}
                className={cn(
                  'text-xs whitespace-nowrap',
                  filter === value && 'bg-violet-600 hover:bg-violet-700'
                )}
              >
                {label}
                {value === 'unread' && unreadCount > 0 && (
                  <Badge className="ml-1 h-4 px-1 text-[10px] bg-red-500">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <p className="font-medium text-gray-900 dark:text-gray-100">No notifications</p>
                <p className="text-sm text-gray-500 mt-1">
                  {filter === 'unread' 
                    ? "You've read all your notifications" 
                    : 'Check back later for updates'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {/* Today */}
                {groupedByDate.today.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                      Today
                    </p>
                    {groupedByDate.today.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        getIcon={getIcon}
                        formatTime={formatTime}
                        onMarkAsRead={onMarkAsRead}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}

                {/* Yesterday */}
                {groupedByDate.yesterday.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                      Yesterday
                    </p>
                    {groupedByDate.yesterday.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        getIcon={getIcon}
                        formatTime={formatTime}
                        onMarkAsRead={onMarkAsRead}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}

                {/* Earlier */}
                {groupedByDate.earlier.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                      Earlier
                    </p>
                    {groupedByDate.earlier.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        getIcon={getIcon}
                        formatTime={formatTime}
                        onMarkAsRead={onMarkAsRead}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500"
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function NotificationItem({
  notification,
  getIcon,
  formatTime,
  onMarkAsRead,
  onDelete
}: {
  notification: Notification;
  getIcon: (type: Notification['type']) => React.ReactNode;
  formatTime: (date: Date) => string;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={cn(
        'relative px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        !notification.read && 'bg-violet-50/50 dark:bg-violet-900/20'
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm',
              notification.read 
                ? 'text-gray-700 dark:text-gray-300' 
                : 'text-gray-900 dark:text-gray-100 font-medium'
            )}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="h-2 w-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatTime(notification.timestamp)}
            </span>
            {notification.actionUrl && (
              <a
                href={notification.actionUrl}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
              >
                {notification.actionLabel || 'View'}
                <ChevronRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Hover Actions */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-3 top-3 flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1"
          >
            {!notification.read && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="p-1.5 text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/50 rounded transition-colors"
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Notification Bell with dropdown preview
 */
export function NotificationBell({
  notifications,
  onClick
}: {
  notifications: Notification[];
  onClick: () => void;
}) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      {unreadCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
    </button>
  );
}

export default NotificationCenter;
