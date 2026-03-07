'use client';

/**
 * Timeline Component
 * Activity feeds and step timelines
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Circle,
  Clock,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type TimelineItemStatus = 'completed' | 'current' | 'upcoming' | 'error';

interface TimelineItemProps {
  title: string;
  description?: string;
  timestamp?: string;
  status?: TimelineItemStatus;
  icon?: LucideIcon;
  children?: React.ReactNode;
  isLast?: boolean;
}

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

interface ActivityItem {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  action: string;
  target?: string;
  timestamp: string;
  icon?: LucideIcon;
  iconColor?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  TimelineItemStatus,
  { icon: LucideIcon; colors: string; lineColor: string }
> = {
  completed: {
    icon: Check,
    colors: 'bg-violet-500 text-white',
    lineColor: 'bg-violet-500',
  },
  current: {
    icon: Circle,
    colors: 'bg-gradient-to-br from-violet-600 to-purple-600 text-white ring-4 ring-violet-100 dark:ring-violet-900/50',
    lineColor: 'bg-slate-200 dark:bg-slate-700',
  },
  upcoming: {
    icon: Circle,
    colors: 'bg-slate-200 dark:bg-slate-700 text-slate-400',
    lineColor: 'bg-slate-200 dark:bg-slate-700',
  },
  error: {
    icon: AlertCircle,
    colors: 'bg-red-500 text-white',
    lineColor: 'bg-red-200',
  },
};

// ============================================================================
// Timeline Container
// ============================================================================

export function Timeline({ children, className }: TimelineProps) {
  const items = React.Children.toArray(children);

  return (
    <div className={cn('space-y-0', className)}>
      {items.map((child, index) => {
        if (React.isValidElement<TimelineItemProps>(child)) {
          return React.cloneElement(child, {
            isLast: index === items.length - 1,
          });
        }
        return child;
      })}
    </div>
  );
}

// ============================================================================
// Timeline Item
// ============================================================================

export function TimelineItem({
  title,
  description,
  timestamp,
  status = 'upcoming',
  icon,
  children,
  isLast = false,
}: TimelineItemProps) {
  const config = statusConfig[status];
  const Icon = icon || config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative flex gap-4"
    >
      {/* Line */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-[15px] top-8 bottom-0 w-0.5',
            config.lineColor
          )}
        />
      )}

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          config.colors
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-8', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4
              className={cn(
                'font-medium',
                status === 'upcoming' ? 'text-slate-400' : 'text-slate-900'
              )}
            >
              {title}
            </h4>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {timestamp && (
            <time className="text-sm text-slate-400 flex-shrink-0 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timestamp}
            </time>
          )}
        </div>

        {children && <div className="mt-3">{children}</div>}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Activity Feed
// ============================================================================

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-3"
          >
            {/* Avatar or Icon */}
            {item.user.avatar ? (
              <img
                src={item.user.avatar}
                alt={item.user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  item.iconColor || 'bg-slate-100'
                )}
              >
                {Icon ? (
                  <Icon className="w-4 h-4 text-slate-500" />
                ) : (
                  <span className="text-sm font-medium text-slate-600">
                    {item.user.name.charAt(0)}
                  </span>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{item.user.name}</span>
                {' '}
                {item.action}
                {item.target && (
                  <>
                    {' '}
                    <span className="font-medium text-slate-900">{item.target}</span>
                  </>
                )}
              </p>
              <time className="text-xs text-slate-400">{item.timestamp}</time>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Horizontal Timeline
// ============================================================================

interface HorizontalTimelineItem {
  label: string;
  date?: string;
  status: TimelineItemStatus;
}

interface HorizontalTimelineProps {
  items: HorizontalTimelineItem[];
  className?: string;
}

export function HorizontalTimeline({ items, className }: HorizontalTimelineProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Line */}
      <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200" />

      {/* Items */}
      <div className="relative flex justify-between">
        {items.map((item, index) => {
          const config = statusConfig[item.status];
          const Icon = config.icon;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  'relative z-10 w-8 h-8 rounded-full flex items-center justify-center',
                  config.colors
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={cn(
                  'mt-2 text-sm font-medium text-center',
                  item.status === 'upcoming' ? 'text-slate-400' : 'text-slate-900'
                )}
              >
                {item.label}
              </span>
              {item.date && (
                <span className="text-xs text-slate-400">{item.date}</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
