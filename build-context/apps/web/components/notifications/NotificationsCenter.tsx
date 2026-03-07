/**
 * Notifications Center
 * Real-time notification management with preferences
 */

'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Settings,
  Trash2,
  Clock,
  FileText,
  AlertTriangle,
  Info,
  AlertCircle,
  X,
  Filter,
  Volume2,
  VolumeX,
  Mail,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type NotificationType = 'info' | 'success' | 'warning' | 'error';
type NotificationCategory = 'contract' | 'system' | 'ai' | 'deadline' | 'collaboration';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  frequency: 'instant' | 'hourly' | 'daily';
}

// Demo notifications
const demoNotifications: Notification[] = [
  {
    id: '1',
    title: 'Contract Processing Complete',
    message: 'Master Service Agreement v2 has been processed with 98% accuracy.',
    type: 'success',
    category: 'ai',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    actionUrl: '/contracts/msa-v2',
    actionLabel: 'View Contract',
  },
  {
    id: '2',
    title: 'Contract Expiring Soon',
    message: 'Vendor Agreement with Acme Corp expires in 15 days.',
    type: 'warning',
    category: 'deadline',
    read: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    actionUrl: '/contracts/vendor-acme',
    actionLabel: 'Review',
    metadata: { daysUntilExpiry: 15 },
  },
  {
    id: '3',
    title: 'High Risk Clause Detected',
    message: 'Automatic renewal clause found in NDA with TechCorp.',
    type: 'error',
    category: 'ai',
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    actionUrl: '/contracts/nda-techcorp',
    actionLabel: 'Review Risk',
  },
  {
    id: '4',
    title: 'Team Comment',
    message: 'Sarah added a comment on Supply Agreement draft.',
    type: 'info',
    category: 'collaboration',
    read: true,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    actionUrl: '/contracts/supply-agreement',
    actionLabel: 'View Comment',
  },
  {
    id: '5',
    title: 'System Maintenance',
    message: 'Scheduled maintenance on Sunday 2:00 AM - 4:00 AM UTC.',
    type: 'info',
    category: 'system',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '6',
    title: 'Bulk Import Complete',
    message: '45 contracts imported successfully from external database.',
    type: 'success',
    category: 'contract',
    read: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    actionUrl: '/contracts',
    actionLabel: 'View Contracts',
  },
];

const defaultPreferences: NotificationPreferences = {
  emailEnabled: true,
  pushEnabled: true,
  soundEnabled: true,
  categories: {
    contract: true,
    system: true,
    ai: true,
    deadline: true,
    collaboration: true,
  },
  frequency: 'instant',
};

const typeIcons: Record<NotificationType, React.ElementType> = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: AlertCircle,
};

const typeColors: Record<NotificationType, string> = {
  info: 'text-violet-500 bg-violet-50',
  success: 'text-green-500 bg-green-50',
  warning: 'text-yellow-500 bg-yellow-50',
  error: 'text-red-500 bg-red-50',
};

const categoryLabels: Record<NotificationCategory, string> = {
  contract: 'Contracts',
  system: 'System',
  ai: 'AI Processing',
  deadline: 'Deadlines',
  collaboration: 'Collaboration',
};

interface NotificationsCenterProps {
  className?: string;
}

export const NotificationsCenter = memo(function NotificationsCenter({
  className,
}: NotificationsCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(demoNotifications);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notification deleted');
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    toast.success('All notifications cleared');
  }, []);

  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
    toast.success('Preferences updated');
  }, []);

  const toggleCategory = useCallback((category: NotificationCategory) => {
    setPreferences(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: !prev.categories[category],
      },
    }));
  }, []);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('relative', className)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="end">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSettings(true);
                    setIsOpen(false);
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs h-6">
                    Unread {unreadCount > 0 && `(${unreadCount})`}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as NotificationCategory | 'all')}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No notifications</p>
              </div>
            ) : (
              filteredNotifications.map(notification => {
                const Icon = typeIcons[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer',
                      !notification.read && 'bg-violet-50/30'
                    )}
                    onClick={() => {
                      markAsRead(notification.id);
                      if (notification.actionUrl) {
                        // In production, navigate to actionUrl
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                        typeColors[notification.type]
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-sm',
                            !notification.read && 'font-semibold'
                          )}>
                            {notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {categoryLabels[notification.category]}
                          </Badge>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                        {notification.actionUrl && notification.actionLabel && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 mt-2 text-violet-600"
                          >
                            {notification.actionLabel} →
                          </Button>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-slate-500"
                onClick={clearAll}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear all notifications
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent className="sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Notification Settings</SheetTitle>
            <SheetDescription>
              Customize how and when you receive notifications
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Delivery Methods */}
            <div>
              <h4 className="text-sm font-medium mb-4">Delivery Methods</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <Label htmlFor="email">Email notifications</Label>
                  </div>
                  <Switch
                    id="email"
                    checked={preferences.emailEnabled}
                    onCheckedChange={(checked) =>
                      updatePreferences({ emailEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-500" />
                    <Label htmlFor="push">Push notifications</Label>
                  </div>
                  <Switch
                    id="push"
                    checked={preferences.pushEnabled}
                    onCheckedChange={(checked) =>
                      updatePreferences({ pushEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {preferences.soundEnabled ? (
                      <Volume2 className="h-4 w-4 text-slate-500" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-slate-500" />
                    )}
                    <Label htmlFor="sound">Sound alerts</Label>
                  </div>
                  <Switch
                    id="sound"
                    checked={preferences.soundEnabled}
                    onCheckedChange={(checked) =>
                      updatePreferences({ soundEnabled: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div>
              <h4 className="text-sm font-medium mb-4">Digest Frequency</h4>
              <Select
                value={preferences.frequency}
                onValueChange={(v) =>
                  updatePreferences({ frequency: v as NotificationPreferences['frequency'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="hourly">Hourly Digest</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-2">
                {preferences.frequency === 'instant'
                  ? 'Receive notifications immediately'
                  : preferences.frequency === 'hourly'
                  ? 'Receive a summary email every hour'
                  : 'Receive a summary email once daily'
                }
              </p>
            </div>

            {/* Categories */}
            <div>
              <h4 className="text-sm font-medium mb-4">Categories</h4>
              <div className="space-y-3">
                {(Object.entries(categoryLabels) as [NotificationCategory, string][]).map(
                  ([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={`cat-${key}`}>{label}</Label>
                      <Switch
                        id={`cat-${key}`}
                        checked={preferences.categories[key]}
                        onCheckedChange={() => toggleCategory(key)}
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});

export default NotificationsCenter;
