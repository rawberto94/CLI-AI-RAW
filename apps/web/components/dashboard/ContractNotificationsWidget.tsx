'use client';

/**
 * Contract Notifications Widget
 * 
 * Real-time notifications for contract events, alerts, and updates.
 * Features priority levels, filtering, mark as read, and quick actions.
 */

import React, { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Users,
  MoreHorizontal,
  Trash2,
  Eye,
  ExternalLink,
  Filter,
  Settings,
  Volume2,
  VolumeX,
  Archive,
  RefreshCw,
} from 'lucide-react';

// ============ Types ============

export type NotificationType = 
  | 'expiring'
  | 'renewal'
  | 'approval'
  | 'risk'
  | 'compliance'
  | 'value'
  | 'mention'
  | 'comment'
  | 'update'
  | 'system';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ContractNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  contractId?: string;
  contractName?: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  criticalOnly: boolean;
  mutedTypes: NotificationType[];
}

interface ContractNotificationsWidgetProps {
  notifications: ContractNotification[];
  settings?: NotificationSettings;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onDelete?: (id: string) => void;
  onAction?: (notification: ContractNotification) => void;
  onSettingsChange?: (settings: NotificationSettings) => void;
  maxHeight?: number;
  showHeader?: boolean;
  className?: string;
}

// ============ Configuration ============

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; label: string }> = {
  expiring: { icon: Calendar, color: 'text-orange-500', label: 'Expiring Soon' },
  renewal: { icon: RefreshCw, color: 'text-violet-500', label: 'Renewal' },
  approval: { icon: Check, color: 'text-green-500', label: 'Approval' },
  risk: { icon: AlertTriangle, color: 'text-red-500', label: 'Risk Alert' },
  compliance: { icon: Shield, color: 'text-violet-500', label: 'Compliance' },
  value: { icon: DollarSign, color: 'text-violet-500', label: 'Value Change' },
  mention: { icon: Users, color: 'text-violet-500', label: 'Mention' },
  comment: { icon: FileText, color: 'text-slate-500', label: 'Comment' },
  update: { icon: Info, color: 'text-violet-400', label: 'Update' },
  system: { icon: Settings, color: 'text-gray-500', label: 'System' },
};

const priorityConfig: Record<NotificationPriority, { color: string; bgColor: string; label: string }> = {
  critical: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Critical' },
  high: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'High' },
  medium: { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Medium' },
  low: { color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-900/30', label: 'Low' },
};

// ============ Sub-components ============

const NotificationItem = memo(function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onAction,
}: {
  notification: ContractNotification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAction?: (notification: ContractNotification) => void;
}) {
  const config = typeConfig[notification.type];
  const priorityStyle = priorityConfig[notification.priority];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        group relative p-3 rounded-lg border transition-all duration-200
        ${notification.read 
          ? 'bg-background/50 border-border/50' 
          : `${priorityStyle.bgColor} border-${priorityStyle.color.replace('text-', '')}/20`
        }
        hover:shadow-md
      `}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
          ${notification.read ? 'bg-muted' : `bg-white/80 dark:bg-black/20`}
        `}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-medium truncate ${notification.read ? 'text-muted-foreground' : ''}`}>
                {notification.title}
              </h4>
              <p className={`text-xs mt-0.5 line-clamp-2 ${notification.read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                {notification.message}
              </p>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {!notification.read && onMarkRead && (
                  <DropdownMenuItem onClick={() => onMarkRead(notification.id)}>
                    <Check className="h-3.5 w-3.5 mr-2" />
                    Mark as read
                  </DropdownMenuItem>
                )}
                {notification.actionUrl && (
                  <DropdownMenuItem onClick={() => onAction?.(notification)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    {notification.actionLabel || 'View'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(notification.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2">
            {notification.contractName && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                <FileText className="h-3 w-3 mr-1" />
                {notification.contractName}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {/* Quick action button */}
      {notification.actionUrl && !notification.read && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-2 bottom-2 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onAction?.(notification)}
        >
          {notification.actionLabel || 'View'}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      )}
    </motion.div>
  );
});

const NotificationStats = memo(function NotificationStats({
  notifications,
}: {
  notifications: ContractNotification[];
}) {
  const stats = useMemo(() => {
    const unread = notifications.filter(n => !n.read).length;
    const critical = notifications.filter(n => n.priority === 'critical' && !n.read).length;
    const high = notifications.filter(n => n.priority === 'high' && !n.read).length;
    return { unread, critical, high };
  }, [notifications]);

  if (stats.unread === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">
        {stats.unread} unread
      </Badge>
      {stats.critical > 0 && (
        <Badge variant="destructive" className="text-xs">
          {stats.critical} critical
        </Badge>
      )}
      {stats.high > 0 && (
        <Badge className="text-xs bg-orange-500">
          {stats.high} high
        </Badge>
      )}
    </div>
  );
});

const FilterDropdown = memo(function FilterDropdown({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: NotificationType | 'all' | 'unread';
  onFilterChange: (filter: NotificationType | 'all' | 'unread') => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Filter className="h-3.5 w-3.5 mr-1" />
          {activeFilter === 'all' ? 'All' : activeFilter === 'unread' ? 'Unread' : typeConfig[activeFilter]?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onFilterChange('all')}>
          All notifications
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onFilterChange('unread')}>
          Unread only
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {Object.entries(typeConfig).map(([type, config]) => (
          <DropdownMenuItem key={type} onClick={() => onFilterChange(type as NotificationType)}>
            <config.icon className={`h-3.5 w-3.5 mr-2 ${config.color}`} />
            {config.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ============ Main Component ============

export function ContractNotificationsWidget({
  notifications,
  settings = { soundEnabled: true, criticalOnly: false, mutedTypes: [] },
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onAction,
  onSettingsChange,
  maxHeight = 400,
  showHeader = true,
  className = '',
}: ContractNotificationsWidgetProps) {
  const [filter, setFilter] = useState<NotificationType | 'all' | 'unread'>('all');

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply type filter
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (filter !== 'all') {
      filtered = filtered.filter(n => n.type === filter);
    }

    // Apply settings filters
    if (settings.criticalOnly) {
      filtered = filtered.filter(n => n.priority === 'critical');
    }
    filtered = filtered.filter(n => !settings.mutedTypes.includes(n.type));

    // Sort by timestamp (newest first) and priority
    return filtered.sort((a, b) => {
      // Unread first
      if (a.read !== b.read) return a.read ? 1 : -1;
      // Then by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Then by time
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [notifications, filter, settings]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <TooltipProvider>
      <Card className={`overflow-hidden ${className}`}>
        {showHeader && (
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="relative">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center text-[8px] text-primary-foreground font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                Notifications
              </CardTitle>
              
              <div className="flex items-center gap-1">
                <NotificationStats notifications={notifications} />
                
                <FilterDropdown activeFilter={filter} onFilterChange={setFilter} />
                
                {unreadCount > 0 && onMarkAllRead && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={onMarkAllRead}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark all as read</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2"
                      onClick={() => onSettingsChange?.({
                        ...settings,
                        soundEnabled: !settings.soundEnabled
                      })}
                    >
                      {settings.soundEnabled ? (
                        <Volume2 className="h-3.5 w-3.5" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {settings.soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
        )}

        <CardContent className="p-3">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <BellOff className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {filter === 'unread' 
                  ? "You're all caught up!" 
                  : "No notifications to display"}
              </p>
            </div>
          ) : (
            <ScrollArea style={{ maxHeight }}>
              <div className="space-y-2 pr-2">
                <AnimatePresence mode="popLayout">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={onMarkRead}
                      onDelete={onDelete}
                      onAction={onAction}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ============ Memo Export ============

const MemoizedContractNotificationsWidget = memo(ContractNotificationsWidget);
export { MemoizedContractNotificationsWidget };
