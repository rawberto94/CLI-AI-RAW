'use client';

import React, { memo, useMemo, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Edit,
  Check,
  X,
  User,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  ArrowRight,
  Eye,
  Download,
  Send,
  Trash2,
  RefreshCw,
  Link,
  Tag,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  MoreHorizontal,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'uploaded'
  | 'downloaded'
  | 'viewed'
  | 'approved'
  | 'rejected'
  | 'commented'
  | 'assigned'
  | 'unassigned'
  | 'tagged'
  | 'linked'
  | 'sent'
  | 'received'
  | 'synced'
  | 'status_changed'
  | 'reminder'
  | 'deadline'
  | 'custom';

export interface ActivityUser {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date;
  user?: ActivityUser;
  metadata?: Record<string, any>;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  children?: ReactNode;
  actions?: {
    label: string;
    onClick: () => void;
  }[];
}

export interface ActivityGroup {
  date: string;
  activities: ActivityItem[];
}

// ============================================================================
// Activity Type Configuration
// ============================================================================

const activityTypeConfig: Record<
  ActivityType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  created: {
    icon: FileText,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Created',
  },
  updated: {
    icon: Edit,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Updated',
  },
  deleted: {
    icon: Trash2,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Deleted',
  },
  uploaded: {
    icon: Upload,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Uploaded',
  },
  downloaded: {
    icon: Download,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Downloaded',
  },
  viewed: {
    icon: Eye,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    label: 'Viewed',
  },
  approved: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Approved',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Rejected',
  },
  commented: {
    icon: MessageSquare,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Commented',
  },
  assigned: {
    icon: User,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Assigned',
  },
  unassigned: {
    icon: User,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    label: 'Unassigned',
  },
  tagged: {
    icon: Tag,
    color: 'text-pink-500',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    label: 'Tagged',
  },
  linked: {
    icon: Link,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Linked',
  },
  sent: {
    icon: Send,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Sent',
  },
  received: {
    icon: Download,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Received',
  },
  synced: {
    icon: RefreshCw,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Synced',
  },
  status_changed: {
    icon: ArrowRight,
    color: 'text-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Status Changed',
  },
  reminder: {
    icon: Clock,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Reminder',
  },
  deadline: {
    icon: Calendar,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Deadline',
  },
  custom: {
    icon: Info,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    label: 'Activity',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const formatDate = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (activityDate.getTime() === today.getTime()) return 'Today';
  if (activityDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const groupActivitiesByDate = (activities: ActivityItem[]): ActivityGroup[] => {
  const groups: Record<string, ActivityItem[]> = {};

  activities.forEach((activity) => {
    const dateKey = formatDate(activity.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
  });

  return Object.entries(groups).map(([date, activities]) => ({
    date,
    activities: activities.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    ),
  }));
};

// ============================================================================
// Single Activity Item Component
// ============================================================================

interface ActivityItemProps {
  activity: ActivityItem;
  isLast?: boolean;
  showLine?: boolean;
  compact?: boolean;
  onActivityClick?: (activity: ActivityItem) => void;
}

const ActivityItemComponent = memo(function ActivityItemComponent({
  activity,
  isLast = false,
  showLine = true,
  compact = false,
  onActivityClick,
}: ActivityItemProps) {
  const [showActions, setShowActions] = useState(false);
  const config = activityTypeConfig[activity.type] || activityTypeConfig.custom;
  const IconComponent = activity.icon || config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative flex gap-4 ${compact ? 'py-2' : 'py-4'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Timeline line */}
      {showLine && !isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
      )}

      {/* Icon */}
      <div
        className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          activity.color ? '' : config.bgColor
        }`}
        style={activity.color ? { backgroundColor: activity.color + '20' } : undefined}
      >
        <IconComponent
          className={`w-5 h-5 ${activity.color || config.color}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p
              className={`font-medium text-zinc-900 dark:text-white ${
                compact ? 'text-sm' : ''
              } ${onActivityClick ? 'cursor-pointer hover:text-violet-600 dark:hover:text-violet-400' : ''}`}
              onClick={() => onActivityClick?.(activity)}
            >
              {activity.title}
            </p>

            {/* Description */}
            {activity.description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                {activity.description}
              </p>
            )}

            {/* User and time */}
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {activity.user && (
                <>
                  <div className="flex items-center gap-1.5">
                    {activity.user.avatar ? (
                      <img
                        src={activity.user.avatar}
                        alt={activity.user.name}
                        className="w-4 h-4 rounded-full"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-medium">
                        {activity.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{activity.user.name}</span>
                  </div>
                  <span>•</span>
                </>
              )}
              <span title={activity.timestamp.toLocaleString()}>
                {formatTimeAgo(activity.timestamp)}
              </span>
            </div>

            {/* Custom children content */}
            {activity.children && (
              <div className="mt-3">{activity.children}</div>
            )}
          </div>

          {/* Actions */}
          {activity.actions && activity.actions.length > 0 && (
            <AnimatePresence>
              {showActions && (
                <motion.div key="actions"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1"
                >
                  {activity.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Activity Timeline Component
// ============================================================================

interface ActivityTimelineProps {
  activities: ActivityItem[];
  groupByDate?: boolean;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  maxItems?: number;
  onActivityClick?: (activity: ActivityItem) => void;
  filterTypes?: ActivityType[];
  className?: string;
}

export const ActivityTimeline = memo(function ActivityTimeline({
  activities,
  groupByDate = true,
  showLoadMore = false,
  onLoadMore,
  loading = false,
  emptyMessage = 'No activity yet',
  compact = false,
  maxItems,
  onActivityClick,
  filterTypes,
  className = '',
}: ActivityTimelineProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<ActivityType | null>(null);

  // Filter and limit activities
  const filteredActivities = useMemo(() => {
    let result = activities;

    if (selectedFilter) {
      result = result.filter((a) => a.type === selectedFilter);
    }

    if (maxItems) {
      result = result.slice(0, maxItems);
    }

    return result;
  }, [activities, selectedFilter, maxItems]);

  // Group by date if enabled
  const groupedActivities = useMemo(() => {
    if (!groupByDate) return null;
    return groupActivitiesByDate(filteredActivities);
  }, [filteredActivities, groupByDate]);

  const toggleGroup = useCallback((date: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  if (filteredActivities.length === 0 && !loading) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Clock className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filter */}
      {filterTypes && filterTypes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-none">
          <Filter className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <button
            onClick={() => setSelectedFilter(null)}
            className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              !selectedFilter
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          {filterTypes.map((type) => {
            const config = activityTypeConfig[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedFilter(type)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedFilter === type
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <config.icon className="w-3.5 h-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Grouped Timeline */}
      {groupByDate && groupedActivities ? (
        <div className="space-y-6">
          {groupedActivities.map((group, groupIndex) => {
            const isCollapsed = expandedGroups.has(group.date);
            const visibleActivities = isCollapsed
              ? group.activities.slice(0, 3)
              : group.activities;

            return (
              <div key={group.date}>
                {/* Date Header */}
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm py-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {group.date}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {group.activities.length} activities
                    </span>
                    {group.activities.length > 3 && (
                      <button
                        onClick={() => toggleGroup(group.date)}
                        className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        {isCollapsed ? (
                          <>
                            Show all <ChevronDown className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Show less <ChevronUp className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Activities */}
                <div className="pl-2">
                  {visibleActivities.map((activity, index) => (
                    <ActivityItemComponent
                      key={activity.id}
                      activity={activity}
                      isLast={index === visibleActivities.length - 1}
                      compact={compact}
                      onActivityClick={onActivityClick}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Timeline */
        <div className="pl-2">
          {filteredActivities.map((activity, index) => (
            <ActivityItemComponent
              key={activity.id}
              activity={activity}
              isLast={index === filteredActivities.length - 1}
              compact={compact}
              onActivityClick={onActivityClick}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {showLoadMore && onLoadMore && (
        <div className="mt-6 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load more activity
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Compact Activity List (for sidebar/widgets)
// ============================================================================

interface ActivityListProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
  onViewAll?: () => void;
  onActivityClick?: (activity: ActivityItem) => void;
  className?: string;
}

export const ActivityList = memo(function ActivityList({
  activities,
  title = 'Recent Activity',
  maxItems = 5,
  onViewAll,
  onActivityClick,
  className = '',
}: ActivityListProps) {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
        {onViewAll && activities.length > maxItems && (
          <button
            onClick={onViewAll}
            className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
          >
            View all
          </button>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {displayedActivities.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No recent activity
          </div>
        ) : (
          displayedActivities.map((activity) => {
            const config =
              activityTypeConfig[activity.type] || activityTypeConfig.custom;
            const IconComponent = activity.icon || config.icon;

            return (
              <div
                key={activity.id}
                onClick={() => onActivityClick?.(activity)}
                className={`flex items-start gap-3 px-4 py-3 ${
                  onActivityClick
                    ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    : ''
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}
                >
                  <IconComponent className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Activity Badge (for inline display)
// ============================================================================

interface ActivityBadgeProps {
  type: ActivityType;
  label?: string;
  className?: string;
}

export const ActivityBadge = memo(function ActivityBadge({
  type,
  label,
  className = '',
}: ActivityBadgeProps) {
  const config = activityTypeConfig[type] || activityTypeConfig.custom;
  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
    >
      <IconComponent className="w-3 h-3" />
      {label || config.label}
    </span>
  );
});
