'use client';

/**
 * Reusable Empty State Components
 * Beautiful, informative empty states for various scenarios
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  RefreshCw,
  FolderOpen,
  Inbox,
  AlertCircle,
  Wifi,
  WifiOff,
  Clock,
  Plus,
  ArrowRight,
  Sparkles,
  FileSearch,
  Settings,
  Users,
  Bell,
  BarChart3,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type EmptyStateVariant = 
  | 'no-data'
  | 'no-results' 
  | 'no-contracts'
  | 'no-notifications'
  | 'no-team'
  | 'error'
  | 'offline'
  | 'loading-error'
  | 'permission'
  | 'coming-soon';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  compact?: boolean;
}

// ============================================================================
// Preset Configurations
// ============================================================================

const PRESETS: Record<EmptyStateVariant, Omit<EmptyStateProps, 'variant' | 'className' | 'compact'>> = {
  'no-data': {
    title: 'No data yet',
    description: 'Start by adding some data to see it appear here.',
    icon: Inbox,
  },
  'no-results': {
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
    icon: FileSearch,
  },
  'no-contracts': {
    title: 'No contracts yet',
    description: 'Upload your first contract to start extracting insights and managing your portfolio.',
    icon: FileText,
    primaryAction: {
      label: 'Upload Contract',
      href: '/upload',
      icon: Upload,
    },
  },
  'no-notifications': {
    title: 'All caught up!',
    description: 'You have no new notifications. We\'ll let you know when something needs your attention.',
    icon: Bell,
  },
  'no-team': {
    title: 'No team members',
    description: 'Invite colleagues to collaborate on contracts and share insights.',
    icon: Users,
    primaryAction: {
      label: 'Invite Team Member',
      href: '/team',
      icon: Plus,
    },
  },
  'error': {
    title: 'Something went wrong',
    description: 'We couldn\'t load the data. Please try again or contact support if the problem persists.',
    icon: AlertCircle,
  },
  'offline': {
    title: 'You\'re offline',
    description: 'Check your internet connection and try again.',
    icon: WifiOff,
  },
  'loading-error': {
    title: 'Failed to load',
    description: 'There was a problem loading this content. Please refresh the page.',
    icon: RefreshCw,
  },
  'permission': {
    title: 'Access restricted',
    description: 'You don\'t have permission to view this content. Contact your administrator for access.',
    icon: Settings,
  },
  'coming-soon': {
    title: 'Coming soon',
    description: 'We\'re working on this feature. Check back soon!',
    icon: Sparkles,
  },
};

// ============================================================================
// Component
// ============================================================================

export function EmptyState({
  variant = 'no-data',
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const preset = PRESETS[variant];
  const Icon = icon || preset.icon || Inbox;
  const finalTitle = title || preset.title;
  const finalDescription = description || preset.description;
  const finalPrimaryAction = primaryAction || preset.primaryAction;
  const finalSecondaryAction = secondaryAction || preset.secondaryAction;

  const iconColors: Record<EmptyStateVariant, string> = {
    'no-data': 'from-slate-400 to-slate-500',
    'no-results': 'from-amber-400 to-orange-500',
    'no-contracts': 'from-purple-400 to-purple-500',
    'no-notifications': 'from-violet-400 to-violet-500',
    'no-team': 'from-violet-400 to-purple-500',
    'error': 'from-red-400 to-rose-500',
    'offline': 'from-slate-400 to-slate-600',
    'loading-error': 'from-orange-400 to-red-500',
    'permission': 'from-violet-400 to-purple-500',
    'coming-soon': 'from-pink-400 to-rose-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, delay: 0.1 }}
        className={cn(
          'rounded-2xl bg-gradient-to-br p-4 mb-4 shadow-lg',
          iconColors[variant],
          compact ? 'p-3 mb-3' : 'p-4 mb-4'
        )}
      >
        <Icon className={cn('text-white', compact ? 'w-6 h-6' : 'w-8 h-8')} />
      </motion.div>

      {/* Title */}
      <h3 className={cn(
        'font-semibold text-slate-900 mb-2',
        compact ? 'text-base' : 'text-lg'
      )}>
        {finalTitle}
      </h3>

      {/* Description */}
      <p className={cn(
        'text-slate-500 max-w-sm mb-6',
        compact ? 'text-sm mb-4' : 'text-base mb-6'
      )}>
        {finalDescription}
      </p>

      {/* Actions */}
      {(finalPrimaryAction || finalSecondaryAction) && (
        <div className={cn(
          'flex items-center gap-3',
          compact ? 'flex-col sm:flex-row' : 'flex-row'
        )}>
          {finalPrimaryAction && (
            <Button
              asChild={!!finalPrimaryAction.href}
              onClick={finalPrimaryAction.onClick}
              className="gap-2 bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700"
            >
              {finalPrimaryAction.href ? (
                <Link href={finalPrimaryAction.href}>
                  {finalPrimaryAction.icon && <finalPrimaryAction.icon className="w-4 h-4" />}
                  {finalPrimaryAction.label}
                </Link>
              ) : (
                <>
                  {finalPrimaryAction.icon && <finalPrimaryAction.icon className="w-4 h-4" />}
                  {finalPrimaryAction.label}
                </>
              )}
            </Button>
          )}
          
          {finalSecondaryAction && (
            <Button
              variant="outline"
              asChild={!!finalSecondaryAction.href}
              onClick={finalSecondaryAction.onClick}
            >
              {finalSecondaryAction.href ? (
                <Link href={finalSecondaryAction.href}>
                  {finalSecondaryAction.label}
                </Link>
              ) : (
                finalSecondaryAction.label
              )}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Specialized Empty States
// ============================================================================

interface NoSearchResultsProps {
  query?: string;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  hasFilters?: boolean;
}

export function NoSearchResults({ 
  query, 
  onClearSearch, 
  onClearFilters,
  hasFilters = false 
}: NoSearchResultsProps) {
  return (
    <EmptyState
      variant="no-results"
      title={query ? `No results for "${query}"` : 'No results found'}
      description={
        hasFilters 
          ? 'Try adjusting your filters or search terms'
          : 'Try a different search term or check your spelling'
      }
      primaryAction={
        onClearSearch || onClearFilters
          ? {
              label: hasFilters ? 'Clear Filters' : 'Clear Search',
              onClick: hasFilters ? onClearFilters : onClearSearch,
              icon: hasFilters ? Filter : Search,
            }
          : undefined
      }
    />
  );
}

interface ErrorStateProps {
  error?: Error | string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ error, onRetry, compact }: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message;
  
  return (
    <EmptyState
      variant="error"
      description={errorMessage || 'An unexpected error occurred. Please try again.'}
      primaryAction={
        onRetry
          ? {
              label: 'Try Again',
              onClick: onRetry,
              icon: RefreshCw,
            }
          : undefined
      }
      compact={compact}
    />
  );
}

interface OfflineStateProps {
  onRetry?: () => void;
}

export function OfflineState({ onRetry }: OfflineStateProps) {
  return (
    <EmptyState
      variant="offline"
      primaryAction={
        onRetry
          ? {
              label: 'Retry',
              onClick: onRetry,
              icon: RefreshCw,
            }
          : undefined
      }
    />
  );
}

// ============================================================================
// Quick Empty State for inline use
// ============================================================================

interface InlineEmptyStateProps {
  message: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function InlineEmptyState({ message, icon: Icon = Inbox, action }: InlineEmptyStateProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
      <Icon className="w-5 h-5" />
      <span className="text-sm">{message}</span>
      {action && (
        <Button variant="link" size="sm" onClick={action.onClick} className="text-purple-600">
          {action.label}
        </Button>
      )}
    </div>
  );
}
