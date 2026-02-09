'use client';

import React, { memo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Upload,
  Search,
  FolderOpen,
  Users,
  BarChart3,
  Settings,
  Bell,
  MessageSquare,
  Calendar,
  Shield,
  Zap,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Link,
  CloudOff,
  WifiOff,
  Lock,
  RefreshCw,
  HelpCircle,
  Inbox,
  Filter,
  Eye,
  Trash2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type EmptyStateType =
  | 'no-data'
  | 'no-results'
  | 'no-access'
  | 'error'
  | 'offline'
  | 'empty-folder'
  | 'no-notifications'
  | 'no-messages'
  | 'no-activity'
  | 'no-contracts'
  | 'no-team'
  | 'no-analytics'
  | 'coming-soon'
  | 'maintenance'
  | 'custom';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ComponentType<{ className?: string }>;
}

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

// ============================================================================
// Type Configurations
// ============================================================================

const typeConfigs: Record<
  EmptyStateType,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    gradient: string;
  }
> = {
  'no-data': {
    icon: Inbox,
    title: 'No data yet',
    description: 'Get started by adding your first item.',
    gradient: 'from-violet-500 to-purple-500',
  },
  'no-results': {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
    gradient: 'from-amber-500 to-orange-500',
  },
  'no-access': {
    icon: Lock,
    title: 'Access restricted',
    description: "You don't have permission to view this content.",
    gradient: 'from-red-500 to-pink-500',
  },
  error: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'An error occurred. Please try again.',
    gradient: 'from-red-500 to-rose-500',
  },
  offline: {
    icon: WifiOff,
    title: "You're offline",
    description: 'Check your internet connection and try again.',
    gradient: 'from-zinc-500 to-slate-500',
  },
  'empty-folder': {
    icon: FolderOpen,
    title: 'This folder is empty',
    description: 'Upload files or create subfolders to get started.',
    gradient: 'from-violet-500 to-purple-500',
  },
  'no-notifications': {
    icon: Bell,
    title: 'No notifications',
    description: "You're all caught up! Check back later.",
    gradient: 'from-violet-500 to-violet-500',
  },
  'no-messages': {
    icon: MessageSquare,
    title: 'No messages',
    description: 'Start a conversation or wait for incoming messages.',
    gradient: 'from-violet-500 to-purple-500',
  },
  'no-activity': {
    icon: Clock,
    title: 'No recent activity',
    description: 'Activity will appear here once actions are taken.',
    gradient: 'from-slate-500 to-zinc-500',
  },
  'no-contracts': {
    icon: FileText,
    title: 'No contracts yet',
    description: 'Upload your first contract to start analyzing.',
    gradient: 'from-violet-500 to-violet-500',
  },
  'no-team': {
    icon: Users,
    title: 'No team members',
    description: 'Invite colleagues to collaborate on contracts.',
    gradient: 'from-violet-500 to-purple-500',
  },
  'no-analytics': {
    icon: BarChart3,
    title: 'No analytics data',
    description: 'Analytics will appear once you have active contracts.',
    gradient: 'from-violet-500 to-purple-500',
  },
  'coming-soon': {
    icon: Zap,
    title: 'Coming soon',
    description: "We're working on this feature. Stay tuned!",
    gradient: 'from-amber-500 to-yellow-500',
  },
  maintenance: {
    icon: Settings,
    title: 'Under maintenance',
    description: "We're performing scheduled maintenance. Please check back soon.",
    gradient: 'from-orange-500 to-red-500',
  },
  custom: {
    icon: HelpCircle,
    title: 'Empty state',
    description: 'No content to display.',
    gradient: 'from-zinc-500 to-slate-500',
  },
};

// ============================================================================
// Size Classes
// ============================================================================

const sizeClasses = {
  sm: {
    container: 'py-8',
    icon: 'w-12 h-12',
    iconWrapper: 'w-16 h-16',
    title: 'text-lg',
    description: 'text-sm',
  },
  md: {
    container: 'py-12',
    icon: 'w-16 h-16',
    iconWrapper: 'w-24 h-24',
    title: 'text-xl',
    description: 'text-base',
  },
  lg: {
    container: 'py-16',
    icon: 'w-20 h-20',
    iconWrapper: 'w-32 h-32',
    title: 'text-2xl',
    description: 'text-lg',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const EmptyState = memo(function EmptyState({
  type = 'no-data',
  title,
  description,
  icon,
  illustration,
  primaryAction,
  secondaryAction,
  children,
  className = '',
  size = 'md',
  animate = true,
}: EmptyStateProps) {
  const config = typeConfigs[type];
  const sizes = sizeClasses[size];
  const IconComponent = icon || config.icon;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const Wrapper = animate ? motion.div : 'div';
  const Item = animate ? motion.div : 'div';

  return (
    <Wrapper
      className={`flex flex-col items-center justify-center text-center ${sizes.container} ${className}`}
      {...(animate ? { variants: containerVariants, initial: 'hidden', animate: 'visible' } : {})}
    >
      {/* Illustration or Icon */}
      <Item {...(animate ? { variants: itemVariants } : {})}>
        {illustration || (
          <div
            className={`relative ${sizes.iconWrapper} rounded-3xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg mb-6`}
          >
            <IconComponent className={`${sizes.icon} text-white`} />
            {/* Decorative elements */}
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-white/20 backdrop-blur-sm" />
          </div>
        )}
      </Item>

      {/* Title */}
      <Item {...(animate ? { variants: itemVariants } : {})}>
        <h3 className={`font-bold text-zinc-900 dark:text-white mb-2 ${sizes.title}`}>
          {title || config.title}
        </h3>
      </Item>

      {/* Description */}
      <Item {...(animate ? { variants: itemVariants } : {})}>
        <p
          className={`text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6 ${sizes.description}`}
        >
          {description || config.description}
        </p>
      </Item>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <Item
          className="flex flex-wrap items-center justify-center gap-3"
          {...(animate ? { variants: itemVariants } : {})}
        >
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                primaryAction.variant === 'outline'
                  ? 'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  : primaryAction.variant === 'secondary'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  : `bg-gradient-to-r ${config.gradient} text-white shadow-lg hover:shadow-xl hover:scale-105`
              }`}
            >
              {primaryAction.icon && <primaryAction.icon className="w-4 h-4" />}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              {secondaryAction.icon && <secondaryAction.icon className="w-4 h-4" />}
              {secondaryAction.label}
            </button>
          )}
        </Item>
      )}

      {/* Custom children */}
      {children && (
        <Item className="mt-6" {...(animate ? { variants: itemVariants } : {})}>
          {children}
        </Item>
      )}
    </Wrapper>
  );
});

// ============================================================================
// Preset Empty States
// ============================================================================

interface PresetEmptyStateProps {
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

export const NoContractsEmpty = memo(function NoContractsEmpty({
  onAction,
  actionLabel = 'Upload Contract',
  className,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      type="no-contracts"
      primaryAction={
        onAction
          ? {
              label: actionLabel,
              onClick: onAction,
              icon: Upload,
            }
          : undefined
      }
      secondaryAction={{
        label: 'Learn more',
        onClick: () => {},
        icon: HelpCircle,
      }}
      className={className}
    />
  );
});

export const NoSearchResultsEmpty = memo(function NoSearchResultsEmpty({
  onAction,
  actionLabel = 'Clear filters',
  className,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      type="no-results"
      primaryAction={
        onAction
          ? {
              label: actionLabel,
              onClick: onAction,
              icon: RefreshCw,
              variant: 'secondary',
            }
          : undefined
      }
      className={className}
    />
  );
});

export const OfflineEmpty = memo(function OfflineEmpty({
  onAction,
  actionLabel = 'Retry',
  className,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      type="offline"
      primaryAction={
        onAction
          ? {
              label: actionLabel,
              onClick: onAction,
              icon: RefreshCw,
            }
          : undefined
      }
      className={className}
    />
  );
});

export const ErrorEmpty = memo(function ErrorEmpty({
  onAction,
  actionLabel = 'Try again',
  className,
}: PresetEmptyStateProps & { message?: string }) {
  return (
    <EmptyState
      type="error"
      primaryAction={
        onAction
          ? {
              label: actionLabel,
              onClick: onAction,
              icon: RefreshCw,
            }
          : undefined
      }
      secondaryAction={{
        label: 'Report issue',
        onClick: () => {},
        icon: AlertCircle,
      }}
      className={className}
    />
  );
});

export const NoAccessEmpty = memo(function NoAccessEmpty({
  onAction,
  actionLabel = 'Request access',
  className,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      type="no-access"
      primaryAction={
        onAction
          ? {
              label: actionLabel,
              onClick: onAction,
              icon: Lock,
            }
          : undefined
      }
      className={className}
    />
  );
});

export const ComingSoonEmpty = memo(function ComingSoonEmpty({
  className,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      type="coming-soon"
      className={className}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-amber-700 dark:text-amber-400 text-sm">
        <Zap className="w-4 h-4" />
        Feature in development
      </div>
    </EmptyState>
  );
});

// ============================================================================
// Inline Empty State (smaller, for cards/sections)
// ============================================================================

interface InlineEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const InlineEmptyState = memo(function InlineEmptyState({
  icon: Icon = Inbox,
  message,
  action,
  className = '',
}: InlineEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
});

// ============================================================================
// Table Empty Row
// ============================================================================

interface TableEmptyRowProps {
  colSpan: number;
  message?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const TableEmptyRow = memo(function TableEmptyRow({
  colSpan,
  message = 'No data available',
  icon: Icon = Inbox,
}: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
        </div>
      </td>
    </tr>
  );
});
