'use client';

/**
 * Notification Center Component
 * In-app notification bell with dropdown for viewing and managing notifications
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck,
  Trash2,
  Settings,
  FileText,
  MessageSquare,
  AlertCircle,
  Users,
  Clock,
  type LucideIcon 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'message' | 'mention' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  avatar?: string;
  link?: string;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }[];
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

// ============================================================================
// Context
// ============================================================================

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface NotificationProviderProps {
  children: ReactNode;
  initialNotifications?: Notification[];
  maxNotifications?: number;
}

export function NotificationProvider({
  children,
  initialNotifications = [],
  maxNotifications = 50,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });
  }, [maxNotifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================================================
// Notification Bell Button
// ============================================================================

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <div className={cn('relative', className)} data-tour="notifications">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-xl transition-all duration-200',
          isOpen ? 'bg-violet-100 text-violet-700' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
        )}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="w-5 h-5" />
        
        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={cn(
                'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center',
                'bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-bold rounded-full px-1 shadow-sm shadow-rose-500/40'
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

// ============================================================================
// Notification Dropdown
// ============================================================================

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter((n) => !n.read);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={onClose}
          />
          
          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-violet-500/10 border border-slate-200/60 dark:border-slate-700/60 z-50 overflow-hidden backdrop-blur-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">{unreadCount} unread</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={markAllAsRead}
                  className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded-lg transition-all"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={clearAll}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex p-2 gap-1 border-b border-slate-100 dark:border-slate-800">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-sm rounded-lg transition-all capitalize',
                    filter === f
                      ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 font-semibold'
                      : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-violet-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No notifications</p>
                  <p className="text-xs text-slate-400 mt-1">You&apos;re all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
              <button className="w-full text-center text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-semibold transition-colors">
                View all notifications
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Notification Item
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
}

function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead, removeNotification } = useNotifications();

  const typeIcons: Record<NotificationType, LucideIcon> = {
    info: Bell,
    success: Check,
    warning: AlertCircle,
    error: AlertCircle,
    message: MessageSquare,
    mention: Users,
    system: Settings,
  };

  const typeColors: Record<NotificationType, string> = {
    info: 'bg-violet-100 text-violet-600',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-amber-100 text-amber-600',
    error: 'bg-red-100 text-red-600',
    message: 'bg-violet-100 text-violet-600',
    mention: 'bg-violet-100 text-violet-600',
    system: 'bg-slate-100 text-slate-600',
  };

  const Icon = typeIcons[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        'flex gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group cursor-pointer',
        !notification.read && 'bg-violet-50/50 dark:bg-violet-950/20'
      )}
      onClick={() => markAsRead(notification.id)}
    >
      {/* Icon or Avatar */}
      <div className="flex-shrink-0">
        {notification.avatar ? (
          <img
            src={notification.avatar}
            alt=""
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', typeColors[notification.type])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', notification.read ? 'text-slate-700' : 'text-slate-900 font-medium')}>
            {notification.title}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">
          {notification.message}
        </p>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
          </span>

          {/* Unread indicator */}
          {!notification.read && (
            <span className="w-2 h-2 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full shadow-sm shadow-violet-500/50" />
          )}
        </div>

        {/* Actions */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {notification.actions.map((action, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                  action.variant === 'primary'
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-md hover:shadow-violet-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Demo Notifications Hook
// ============================================================================

export function useDemoNotifications() {
  const { addNotification } = useNotifications();

  const addDemoNotifications = useCallback(() => {
    addNotification({
      type: 'success',
      title: 'Contract approved',
      message: 'The contract "Service Agreement Q4" has been approved by John Smith.',
    });

    setTimeout(() => {
      addNotification({
        type: 'mention',
        title: 'You were mentioned',
        message: 'Sarah mentioned you in a comment on "Master Services Agreement".',
        actions: [
          { label: 'View', onClick: () => {}, variant: 'primary' },
          { label: 'Dismiss', onClick: () => {} },
        ],
      });
    }, 1000);

    setTimeout(() => {
      addNotification({
        type: 'warning',
        title: 'Contract expiring soon',
        message: '3 contracts are expiring within the next 30 days. Review them now.',
      });
    }, 2000);
  }, [addNotification]);

  return { addDemoNotifications };
}
