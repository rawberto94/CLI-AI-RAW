'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Inbox,
  Search,
  FileX,
  WifiOff,
  AlertCircle,
  Lock,
  Clock,
  CheckCircle2,
  Folder,
  Users,
  Settings,
  Upload,
  Plus,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type EmptyStateType =
  | 'no-data'
  | 'no-results'
  | 'no-access'
  | 'error'
  | 'offline'
  | 'success'
  | 'pending'
  | 'empty-folder'
  | 'no-team'
  | 'no-settings'
  | 'upload'
  | 'custom';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

// ============================================================================
// Config
// ============================================================================

const emptyStateConfig: Record<Exclude<EmptyStateType, 'custom'>, {
  icon: React.ReactNode;
  title: string;
  description: string;
}> = {
  'no-data': {
    icon: <Inbox className="w-12 h-12" />,
    title: 'No data yet',
    description: 'Get started by creating your first item.',
  },
  'no-results': {
    icon: <Search className="w-12 h-12" />,
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
  },
  'no-access': {
    icon: <Lock className="w-12 h-12" />,
    title: 'Access denied',
    description: 'You don\'t have permission to view this content. Contact your administrator for access.',
  },
  'error': {
    icon: <AlertCircle className="w-12 h-12" />,
    title: 'Something went wrong',
    description: 'We encountered an error while loading this content. Please try again.',
  },
  'offline': {
    icon: <WifiOff className="w-12 h-12" />,
    title: 'You\'re offline',
    description: 'Check your internet connection and try again.',
  },
  'success': {
    icon: <CheckCircle2 className="w-12 h-12" />,
    title: 'All done!',
    description: 'You\'ve completed all your tasks. Take a break!',
  },
  'pending': {
    icon: <Clock className="w-12 h-12" />,
    title: 'Coming soon',
    description: 'This feature is under development and will be available shortly.',
  },
  'empty-folder': {
    icon: <Folder className="w-12 h-12" />,
    title: 'This folder is empty',
    description: 'Upload files or create subfolders to get started.',
  },
  'no-team': {
    icon: <Users className="w-12 h-12" />,
    title: 'No team members',
    description: 'Invite team members to collaborate on this project.',
  },
  'no-settings': {
    icon: <Settings className="w-12 h-12" />,
    title: 'No settings configured',
    description: 'Configure your preferences to get started.',
  },
  'upload': {
    icon: <Upload className="w-12 h-12" />,
    title: 'Upload files',
    description: 'Drag and drop files here or click to browse.',
  },
};

// ============================================================================
// Empty State Component
// ============================================================================

export function EmptyState({
  type = 'no-data',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
  size = 'md',
  animated = true,
}: EmptyStateProps) {
  const config = type !== 'custom' ? emptyStateConfig[type] : null;

  const displayIcon = icon || config?.icon;
  const displayTitle = title || config?.title || 'No content';
  const displayDescription = description || config?.description;

  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-20',
  };

  const iconSizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const Wrapper = animated ? motion.div : 'div';
  const wrapperProps = animated
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4 },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex flex-col items-center justify-center text-center ${sizeClasses[size]} ${className}`}
    >
      {/* Animated Icon Container */}
      {displayIcon && (
        <motion.div
          initial={animated ? { scale: 0.8, opacity: 0 } : false}
          animate={animated ? { scale: 1, opacity: 1 } : false}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className={`
            mb-4 p-4 rounded-full
            bg-gray-100 dark:bg-gray-800
            text-gray-400 dark:text-gray-500
            ${iconSizes[size]}
          `}
        >
          <div className={`${iconSizes[size]}`}>{displayIcon}</div>
        </motion.div>
      )}

      {/* Title */}
      <motion.h3
        initial={animated ? { opacity: 0, y: 10 } : false}
        animate={animated ? { opacity: 1, y: 0 } : false}
        transition={{ delay: 0.2 }}
        className={`
          font-semibold text-gray-900 dark:text-white
          ${size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg'}
        `}
      >
        {displayTitle}
      </motion.h3>

      {/* Description */}
      {displayDescription && (
        <motion.p
          initial={animated ? { opacity: 0, y: 10 } : false}
          animate={animated ? { opacity: 1, y: 0 } : false}
          transition={{ delay: 0.3 }}
          className={`
            mt-2 text-gray-500 dark:text-gray-400 max-w-md
            ${size === 'sm' ? 'text-sm' : 'text-base'}
          `}
        >
          {displayDescription}
        </motion.p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <motion.div
          initial={animated ? { opacity: 0, y: 10 } : false}
          animate={animated ? { opacity: 1, y: 0 } : false}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 mt-6"
        >
          {action && (
            <button
              onClick={action.onClick}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${action.variant === 'secondary'
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
            >
              {secondaryAction.label}
            </button>
          )}
        </motion.div>
      )}
    </Wrapper>
  );
}

// ============================================================================
// Specific Empty States
// ============================================================================

interface SpecificEmptyStateProps {
  onAction?: () => void;
  className?: string;
}

export function NoResultsState({ onAction, className }: SpecificEmptyStateProps) {
  return (
    <EmptyState
      type="no-results"
      className={className}
      action={onAction ? { label: 'Clear filters', onClick: onAction, variant: 'secondary' } : undefined}
    />
  );
}

export function ErrorState({ onAction, className }: SpecificEmptyStateProps) {
  return (
    <EmptyState
      type="error"
      className={className}
      action={onAction ? { label: 'Try again', onClick: onAction } : undefined}
      icon={
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
        >
          <AlertCircle className="w-12 h-12" />
        </motion.div>
      }
    />
  );
}

export function OfflineState({ onAction, className }: SpecificEmptyStateProps) {
  return (
    <EmptyState
      type="offline"
      className={className}
      action={onAction ? { label: 'Retry', onClick: onAction } : undefined}
    />
  );
}

export function AccessDeniedState({ onAction, className }: SpecificEmptyStateProps) {
  return (
    <EmptyState
      type="no-access"
      className={className}
      action={onAction ? { label: 'Request access', onClick: onAction } : undefined}
    />
  );
}

export function UploadState({ onAction, className }: SpecificEmptyStateProps) {
  return (
    <EmptyState
      type="upload"
      className={className}
      action={onAction ? { label: 'Browse files', onClick: onAction } : undefined}
      icon={
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Upload className="w-12 h-12" />
        </motion.div>
      }
    />
  );
}

// ============================================================================
// First-Time User State
// ============================================================================

interface FirstTimeStateProps {
  feature: string;
  steps?: string[];
  onGetStarted: () => void;
  className?: string;
}

export function FirstTimeState({
  feature,
  steps = [],
  onGetStarted,
  className = '',
}: FirstTimeStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        bg-gradient-to-br from-blue-50 to-indigo-50 
        dark:from-blue-950/30 dark:to-indigo-950/30
        rounded-2xl p-8 text-center ${className}
      `}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4"
      >
        <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </motion.div>

      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome to {feature}!
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
        Let&apos;s get you set up. It only takes a minute.
      </p>

      {steps.length > 0 && (
        <div className="flex flex-col gap-2 mb-6 max-w-sm mx-auto text-left">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{step}</span>
            </motion.div>
          ))}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onGetStarted}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 transition-colors"
      >
        Get Started
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
// Maintenance State
// ============================================================================

interface MaintenanceStateProps {
  estimatedTime?: string;
  className?: string;
}

export function MaintenanceState({ estimatedTime, className = '' }: MaintenanceStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center text-center py-20 ${className}`}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="mb-6"
      >
        <Settings className="w-16 h-16 text-orange-500" />
      </motion.div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Under Maintenance
      </h2>
      <p className="text-gray-600 dark:text-gray-300 max-w-md mb-4">
        We&apos;re making some improvements. This won&apos;t take long.
      </p>
      {estimatedTime && (
        <p className="text-sm text-gray-500">
          Estimated time: {estimatedTime}
        </p>
      )}

      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-8 flex items-center gap-2 text-sm text-gray-500"
      >
        <RefreshCw className="w-4 h-4" />
        <span>This page will auto-refresh when ready</span>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Illustration Empty State
// ============================================================================

interface IllustratedEmptyStateProps {
  illustration: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function IllustratedEmptyState({
  illustration,
  title,
  description,
  action,
  className = '',
}: IllustratedEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center text-center py-16 ${className}`}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        {illustration}
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold text-gray-900 dark:text-white mb-2"
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-600 dark:text-gray-300 max-w-md mb-6"
      >
        {description}
      </motion.p>

      {action && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
