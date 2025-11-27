/**
 * Enhanced Empty States Component
 * Contextual empty states with helpful actions
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Upload,
  Search,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  Plus,
  Filter,
  WifiOff,
  Database,
  Inbox,
  TrendingUp,
  CreditCard,
  Users,
  Clock,
  Sparkles
} from 'lucide-react';

interface EmptyStateProps {
  type?: 'contracts' | 'search' | 'upload' | 'analytics' | 'rate-cards' | 'notifications' | 'error' | 'offline' | 'filtered' | 'custom';
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const emptyStateConfigs = {
  contracts: {
    icon: FileText,
    title: 'No contracts yet',
    description: 'Get started by uploading your first contract for AI-powered analysis.',
    actionLabel: 'Upload Contract',
    gradient: 'from-blue-500 to-indigo-500'
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search terms or filters to find what you\'re looking for.',
    actionLabel: 'Clear Search',
    gradient: 'from-purple-500 to-pink-500'
  },
  upload: {
    icon: Upload,
    title: 'Upload your contracts',
    description: 'Drag and drop files here, or click to browse. We support PDF, DOCX, and more.',
    actionLabel: 'Browse Files',
    gradient: 'from-emerald-500 to-teal-500'
  },
  analytics: {
    icon: TrendingUp,
    title: 'No analytics data',
    description: 'Upload and analyze contracts to see insights and trends.',
    actionLabel: 'Go to Upload',
    gradient: 'from-amber-500 to-orange-500'
  },
  'rate-cards': {
    icon: CreditCard,
    title: 'No rate cards found',
    description: 'Create rate cards to benchmark pricing across your contracts.',
    actionLabel: 'Create Rate Card',
    gradient: 'from-cyan-500 to-blue-500'
  },
  notifications: {
    icon: Inbox,
    title: 'All caught up!',
    description: 'You have no new notifications at this time.',
    actionLabel: 'View History',
    gradient: 'from-green-500 to-emerald-500'
  },
  error: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'We encountered an error. Please try again or contact support if the issue persists.',
    actionLabel: 'Try Again',
    gradient: 'from-red-500 to-rose-500'
  },
  offline: {
    icon: WifiOff,
    title: 'You\'re offline',
    description: 'Check your internet connection and try again.',
    actionLabel: 'Retry',
    gradient: 'from-gray-500 to-slate-500'
  },
  filtered: {
    icon: Filter,
    title: 'No matching results',
    description: 'No items match your current filters. Try adjusting or clearing them.',
    actionLabel: 'Clear Filters',
    gradient: 'from-violet-500 to-purple-500'
  },
  custom: {
    icon: FolderOpen,
    title: 'Nothing here yet',
    description: 'This section is empty. Add items to get started.',
    actionLabel: 'Get Started',
    gradient: 'from-blue-500 to-indigo-500'
  }
};

export function EmptyState({
  type = 'custom',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className
}: EmptyStateProps) {
  const config = emptyStateConfigs[type];
  const Icon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const gradient = config.gradient;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {/* Animated Icon */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ 
          duration: 0.3,
          delay: 0.1,
          type: 'spring',
          stiffness: 200
        }}
        className="relative mb-6"
      >
        {/* Background glow */}
        <div className={cn(
          'absolute inset-0 blur-2xl opacity-20 bg-gradient-to-r rounded-full',
          gradient
        )} />
        
        {/* Icon container */}
        <div className={cn(
          'relative h-20 w-20 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg',
          gradient
        )}>
          <Icon className="h-10 w-10 text-white" />
        </div>

        {/* Decorative elements */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute -inset-4 rounded-3xl border-2 border-gray-200 dark:border-gray-700 opacity-30"
        />
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2"
      >
        {displayTitle}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-500 dark:text-gray-400 max-w-sm mb-6"
      >
        {displayDescription}
      </motion.p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3"
        >
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              className="text-gray-500"
            >
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Compact Empty State for inline use
 */
export function CompactEmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  className
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg',
      className
    )}>
      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
