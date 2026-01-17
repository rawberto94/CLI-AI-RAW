'use client';

/**
 * Enhanced Notification Center
 * Full-featured notification system with categories, actions, and real-time updates
 */

import React, { useState, useCallback, useMemo, memo, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  X,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Filter,
  Search,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Users,
  Zap,
  MoreHorizontal,
  ChevronRight,
  ExternalLink,
  Archive,
  Star,
  StarOff,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'contract' | 'deadline' | 'approval' | 'system' | 'team' | 'billing';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  starred?: boolean;
  archived?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface NotificationSettings {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
}

// ============================================================================
// Context
// ============================================================================

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  toggleStar: (id: string) => void;
  archiveNotification: (id: string) => void;
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  desktopEnabled: false,
  categories: {
    contract: true,
    deadline: true,
    approval: true,
    system: true,
    team: true,
    billing: true,
  },
};

interface NotificationProviderProps {
  children: React.ReactNode;
  initialNotifications?: Notification[];
}

export function NotificationProvider({ children, initialNotifications = [] }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('notification-settings');
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // Failed to load notification settings - use defaults
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read && !n.archived).length,
    [notifications]
  );

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Play sound if enabled
    if (settings.soundEnabled) {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    }

    // Show desktop notification if enabled
    if (settings.desktopEnabled && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192.png',
      });
    }
  }, [settings]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const toggleStar = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, starred: !n.starred } : n))
    );
  }, []);

  const archiveNotification = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, archived: true, read: true } : n))
    );
  }, []);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      localStorage.setItem('notification-settings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        toggleStar,
        archiveNotification,
        settings,
        updateSettings,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const typeIcons: Record<NotificationType, React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const typeColors: Record<NotificationType, string> = {
  info: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  success: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  error: 'text-red-600 bg-red-100 dark:bg-red-900/30',
};

const categoryIcons: Record<NotificationCategory, React.ElementType> = {
  contract: FileText,
  deadline: Calendar,
  approval: CheckCheck,
  system: Zap,
  team: Users,
  billing: DollarSign,
};

const priorityColors: Record<NotificationPriority, string> = {
  low: 'border-l-slate-300',
  medium: 'border-l-blue-400',
  high: 'border-l-amber-400',
  urgent: 'border-l-red-500',
};

// ============================================================================
// Notification Item
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
}

const NotificationItem = memo(({
  notification,
  onMarkAsRead,
  onDelete,
  onToggleStar,
  onArchive,
}: NotificationItemProps) => {
  const [showActions, setShowActions] = useState(false);
  const TypeIcon = typeIcons[notification.type];
  const CategoryIcon = categoryIcons[notification.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        "relative group p-4 border-l-4 transition-colors",
        priorityColors[notification.priority],
        notification.read
          ? "bg-white dark:bg-slate-900"
          : "bg-indigo-50/50 dark:bg-indigo-900/10"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn("p-2 rounded-lg shrink-0", typeColors[notification.type])}>
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  "text-sm font-medium truncate",
                  notification.read
                    ? "text-slate-700 dark:text-slate-300"
                    : "text-slate-900 dark:text-slate-100"
                )}>
                  {notification.title}
                </h4>
                {notification.starred && (
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                {notification.message}
              </p>
            </div>

            {/* Timestamp & unread indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500">
                {formatRelativeTime(new Date(notification.timestamp))}
              </span>
              {!notification.read && (
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <CategoryIcon className="h-3 w-3" />
                {notification.category}
              </span>
              {notification.priority === 'urgent' && (
                <span className="text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                  Urgent
                </span>
              )}
            </div>

            {notification.actionUrl && (
              <a
                href={notification.actionUrl}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                {notification.actionLabel || 'View'}
                <ChevronRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute right-2 top-2 flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1"
            >
              {!notification.read && (
                <button
                  onClick={onMarkAsRead}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Mark as read"
                >
                  <Eye className="h-4 w-4 text-slate-500" />
                </button>
              )}
              <button
                onClick={onToggleStar}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                title={notification.starred ? 'Unstar' : 'Star'}
              >
                {notification.starred ? (
                  <StarOff className="h-4 w-4 text-amber-500" />
                ) : (
                  <Star className="h-4 w-4 text-slate-500" />
                )}
              </button>
              <button
                onClick={onArchive}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Archive"
              >
                <Archive className="h-4 w-4 text-slate-500" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

NotificationItem.displayName = 'NotificationItem';

// ============================================================================
// Settings Panel
// ============================================================================

interface SettingsPanelProps {
  settings: NotificationSettings;
  onUpdate: (settings: Partial<NotificationSettings>) => void;
  onClose: () => void;
}

const SettingsPanel = memo(({ settings, onUpdate, onClose }: SettingsPanelProps) => {
  const requestDesktopPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onUpdate({ desktopEnabled: true });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute inset-0 bg-white dark:bg-slate-900 z-10"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Settings</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Sound */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.soundEnabled ? (
              <Volume2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <VolumeX className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sound</p>
              <p className="text-xs text-slate-500">Play sound for new notifications</p>
            </div>
          </div>
          <button
            onClick={() => onUpdate({ soundEnabled: !settings.soundEnabled })}
            className={cn(
              "w-10 h-6 rounded-full transition-colors relative",
              settings.soundEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
            )}
          >
            <span className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
              settings.soundEnabled && "translate-x-4"
            )} />
          </button>
        </div>

        {/* Desktop notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Desktop</p>
              <p className="text-xs text-slate-500">Show desktop notifications</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!settings.desktopEnabled) {
                requestDesktopPermission();
              } else {
                onUpdate({ desktopEnabled: false });
              }
            }}
            className={cn(
              "w-10 h-6 rounded-full transition-colors relative",
              settings.desktopEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
            )}
          >
            <span className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
              settings.desktopEnabled && "translate-x-4"
            )} />
          </button>
        </div>

        {/* Categories */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Categories
          </p>
          {(Object.keys(settings.categories) as NotificationCategory[]).map((category) => {
            const Icon = categoryIcons[category];
            return (
              <div key={category} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                    {category}
                  </span>
                </div>
                <button
                  onClick={() => onUpdate({
                    categories: { ...settings.categories, [category]: !settings.categories[category] }
                  })}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative",
                    settings.categories[category] ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                    settings.categories[category] && "translate-x-4"
                  )} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
});

SettingsPanel.displayName = 'SettingsPanel';

// ============================================================================
// Notification Center
// ============================================================================

type TabFilter = 'all' | 'unread' | 'starred' | 'archived';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'right' | 'left';
  className?: string;
}

export const NotificationCenter = memo(({
  isOpen,
  onClose,
  position = 'right',
  className,
}: NotificationCenterProps) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    toggleStar,
    archiveNotification,
    settings,
    updateSettings,
  } = useNotifications();

  const [tab, setTab] = useState<TabFilter>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Tab filter
      if (tab === 'unread' && n.read) return false;
      if (tab === 'starred' && !n.starred) return false;
      if (tab === 'archived' && !n.archived) return false;
      if (tab !== 'archived' && n.archived) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [notifications, tab, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: position === 'right' ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: position === 'right' ? 20 : -20 }}
        className={cn(
          "fixed top-16 w-[420px] max-h-[calc(100vh-80px)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col",
          position === 'right' ? 'right-4' : 'left-4',
          className
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Notifications</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium text-white bg-indigo-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4 text-slate-500" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Settings"
              >
                <Settings className="h-4 w-4 text-slate-500" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Close"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(['all', 'unread', 'starred', 'archived'] as TabFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                  tab === t
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {t}
                {t === 'unread' && unreadCount > 0 && (
                  <span className="ml-1">({unreadCount})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <SettingsPanel
              settings={settings}
              onUpdate={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>

        {/* Notification List */}
        {!showSettings && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 px-4"
                >
                  <BellOff className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">
                    {searchQuery ? 'No notifications found' : 'No notifications'}
                  </p>
                </motion.div>
              ) : (
                filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={() => markAsRead(notification.id)}
                    onDelete={() => deleteNotification(notification.id)}
                    onToggleStar={() => toggleStar(notification.id)}
                    onArchive={() => archiveNotification(notification.id)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        {!showSettings && notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <button
              onClick={clearAll}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear all notifications
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

NotificationCenter.displayName = 'NotificationCenter';

// ============================================================================
// Notification Bell (Trigger)
// ============================================================================

interface NotificationBellProps {
  onClick: () => void;
  className?: string;
}

export const NotificationBell = memo(({ onClick, className }: NotificationBellProps) => {
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
        className
      )}
    >
      <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
});

NotificationBell.displayName = 'NotificationBell';

export default NotificationCenter;
