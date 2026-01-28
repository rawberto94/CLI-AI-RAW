'use client';

/**
 * Notification & Alert System
 * Centralized notifications, snackbars, and alerts
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Bell,
  ExternalLink,
  Clock,
  User,
  MessageSquare,
  Settings,
  FileText,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  icon?: React.ReactNode;
  timestamp?: Date;
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (title: string, options?: Partial<Notification>) => string;
  error: (title: string, options?: Partial<Notification>) => string;
  warning: (title: string, options?: Partial<Notification>) => string;
  info: (title: string, options?: Partial<Notification>) => string;
}

// ============================================
// Context
// ============================================

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// ============================================
// Provider
// ============================================

interface NotificationProviderProps {
  children: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications?: number;
}

export function NotificationProvider({
  children,
  position = 'top-right',
  maxNotifications = 5,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeNotification = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      dismissible: notification.dismissible ?? true,
      duration: notification.duration ?? 5000,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });

    if (newNotification.duration && newNotification.duration > 0) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
      timeoutsRef.current.set(id, timeout);
    }

    return id;
  }, [maxNotifications, removeNotification]);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setNotifications([]);
  }, []);

  const success = useCallback((title: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'success', title, ...options });
  }, [addNotification]);

  const error = useCallback((title: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'error', title, duration: 8000, ...options });
  }, [addNotification]);

  const warning = useCallback((title: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'warning', title, ...options });
  }, [addNotification]);

  const info = useCallback((title: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'info', title, ...options });
  }, [addNotification]);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  const isTop = position.startsWith('top');

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}

      {/* Notification Container */}
      <div className={cn('fixed z-50 flex flex-col gap-3 pointer-events-none', positionClasses[position])}>
        <AnimatePresence mode="sync">
          {notifications.map((notification, index) => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onDismiss={() => removeNotification(notification.id)}
              index={index}
              fromTop={isTop}
            />
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

// ============================================
// Notification Toast
// ============================================

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
  index: number;
  fromTop: boolean;
}

const typeIcons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-violet-500" />,
};

const typeStyles = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-violet-500',
};

function NotificationToast({ notification, onDismiss, index, fromTop }: NotificationToastProps) {
  const enterY = fromTop ? -20 : 20;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: enterY, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, x: 50 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'pointer-events-auto w-80 md:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 border-l-4 overflow-hidden',
        typeStyles[notification.type]
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {notification.icon || typeIcons[notification.type]}
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">
            {notification.title}
          </p>
          {notification.message && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {notification.message}
            </p>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-sm font-medium text-violet-500 hover:text-violet-600"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        
        {notification.dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {notification.duration && notification.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: notification.duration / 1000, ease: 'linear' }}
          style={{ transformOrigin: 'left' }}
          className={cn(
            'h-0.5',
            notification.type === 'success' && 'bg-green-500',
            notification.type === 'error' && 'bg-red-500',
            notification.type === 'warning' && 'bg-amber-500',
            notification.type === 'info' && 'bg-violet-500'
          )}
        />
      )}
    </motion.div>
  );
}

// ============================================
// Notification Center (Dropdown)
// ============================================

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
  type?: 'message' | 'alert' | 'update' | 'mention' | 'system';
  avatar?: string;
  link?: string;
}

interface NotificationCenterProps {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClear: (id: string) => void;
  onClearAll: () => void;
}

const notificationTypeIcons = {
  message: <MessageSquare className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  update: <Zap className="w-4 h-4" />,
  mention: <User className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  onClearAll,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-xs text-violet-500 hover:text-violet-600"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={onClearAll}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">
                      No notifications yet
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map(notification => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          'relative px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group',
                          !notification.read && 'bg-violet-50/50 dark:bg-violet-900/10'
                        )}
                        onClick={() => onMarkAsRead(notification.id)}
                      >
                        <div className="flex gap-3">
                          {/* Icon/Avatar */}
                          <div className={cn(
                            'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                            notification.type === 'message' && 'bg-violet-100 text-violet-500 dark:bg-violet-900/30',
                            notification.type === 'alert' && 'bg-amber-100 text-amber-500 dark:bg-amber-900/30',
                            notification.type === 'update' && 'bg-purple-100 text-purple-500 dark:bg-purple-900/30',
                            notification.type === 'mention' && 'bg-green-100 text-green-500 dark:bg-green-900/30',
                            notification.type === 'system' && 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                          )}>
                            {notification.avatar ? (
                              <img
                                src={notification.avatar}
                                alt=""
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              notificationTypeIcons[notification.type || 'system']
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">
                              {notification.title}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(notification.time)}
                            </p>
                          </div>

                          {/* Unread indicator */}
                          {!notification.read && (
                            <div className="flex-shrink-0 w-2 h-2 bg-violet-500 rounded-full mt-2" />
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClear(notification.id);
                          }}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                  <button className="w-full text-center text-sm text-violet-500 hover:text-violet-600 font-medium">
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Inline Alert
// ============================================

interface InlineAlertProps {
  type: NotificationType;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
}

const inlineAlertStyles = {
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200',
  info: 'bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-200',
};

export function InlineAlert({
  type,
  title,
  children,
  dismissible,
  onDismiss,
  action,
  icon,
  className,
}: InlineAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            'rounded-xl border p-4',
            inlineAlertStyles[type],
            className
          )}
        >
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {icon || typeIcons[type]}
            </div>
            
            <div className="flex-1">
              {title && (
                <h4 className="font-medium mb-1">{title}</h4>
              )}
              <div className="text-sm opacity-90">{children}</div>
              
              {action && (
                <button
                  onClick={action.onClick}
                  className="mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80"
                >
                  {action.label}
                </button>
              )}
            </div>
            
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default {
  NotificationProvider,
  useNotifications,
  NotificationCenter,
  InlineAlert,
};
