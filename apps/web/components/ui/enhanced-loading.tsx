'use client';

/**
 * Enhanced Loading States & Skeleton Components
 * Beautiful loading indicators and skeleton screens
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================
// Enhanced Skeleton Base
// ============================================

interface EnhancedSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'shimmer' | 'pulse' | 'wave';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

export function EnhancedSkeleton({
  variant = 'shimmer',
  rounded = 'md',
  className,
  ...props
}: EnhancedSkeletonProps) {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700';

  if (variant === 'pulse') {
    return (
      <div
        className={cn(baseClasses, roundedClasses[rounded], 'animate-pulse', className)}
        {...props}
      />
    );
  }

  if (variant === 'shimmer') {
    return (
      <div
        className={cn(
          'relative overflow-hidden',
          baseClasses,
          roundedClasses[rounded],
          className
        )}
        {...props}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <div
        className={cn(
          'relative overflow-hidden',
          baseClasses,
          roundedClasses[rounded],
          className
        )}
        {...props}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, roundedClasses[rounded], className)}
      {...props}
    />
  );
}

// ============================================
// Text Skeleton
// ============================================

interface TextSkeletonProps {
  lines?: number;
  lastLineWidth?: string;
  spacing?: 'tight' | 'normal' | 'loose';
  variant?: EnhancedSkeletonProps['variant'];
}

export function TextSkeleton({
  lines = 3,
  lastLineWidth = '60%',
  spacing = 'normal',
  variant = 'shimmer',
}: TextSkeletonProps) {
  const spacingClasses = {
    tight: 'space-y-1.5',
    normal: 'space-y-2.5',
    loose: 'space-y-4',
  };

  return (
    <div className={spacingClasses[spacing]}>
      {Array.from({ length: lines }).map((_, index) => (
        <EnhancedSkeleton
          key={index}
          variant={variant}
          className={cn('h-4', index === lines - 1 ? '' : 'w-full')}
          style={index === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

// ============================================
// Avatar Skeleton
// ============================================

interface AvatarSkeletonProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withName?: boolean;
  withSubtitle?: boolean;
  variant?: EnhancedSkeletonProps['variant'];
}

const avatarSizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export function AvatarSkeleton({
  size = 'md',
  withName = false,
  withSubtitle = false,
  variant = 'shimmer',
}: AvatarSkeletonProps) {
  return (
    <div className="flex items-center gap-3">
      <EnhancedSkeleton className={cn(avatarSizes[size])} rounded="full" variant={variant} />
      {(withName || withSubtitle) && (
        <div className="space-y-1.5">
          {withName && <EnhancedSkeleton className="h-4 w-24" variant={variant} />}
          {withSubtitle && <EnhancedSkeleton className="h-3 w-16" variant={variant} />}
        </div>
      )}
    </div>
  );
}

// ============================================
// Card Skeleton
// ============================================

interface CardSkeletonProps {
  variant?: 'simple' | 'media' | 'list-item' | 'stats' | 'profile';
  withImage?: boolean;
  imagePosition?: 'top' | 'left';
  skeletonVariant?: EnhancedSkeletonProps['variant'];
}

export function CardSkeleton({
  variant = 'simple',
  withImage = false,
  imagePosition = 'top',
  skeletonVariant = 'shimmer',
}: CardSkeletonProps) {
  if (variant === 'stats') {
    return (
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <EnhancedSkeleton className="h-4 w-20 mb-4" variant={skeletonVariant} />
        <EnhancedSkeleton className="h-8 w-32 mb-2" variant={skeletonVariant} />
        <EnhancedSkeleton className="h-3 w-16" variant={skeletonVariant} />
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center">
        <div className="flex justify-center mb-4">
          <EnhancedSkeleton className="w-20 h-20" rounded="full" variant={skeletonVariant} />
        </div>
        <EnhancedSkeleton className="h-5 w-32 mx-auto mb-2" variant={skeletonVariant} />
        <EnhancedSkeleton className="h-4 w-24 mx-auto mb-4" variant={skeletonVariant} />
        <div className="flex justify-center gap-2">
          <EnhancedSkeleton className="h-9 w-24" rounded="lg" variant={skeletonVariant} />
          <EnhancedSkeleton className="h-9 w-24" rounded="lg" variant={skeletonVariant} />
        </div>
      </div>
    );
  }

  if (variant === 'list-item') {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <EnhancedSkeleton className="w-12 h-12 flex-shrink-0" rounded="lg" variant={skeletonVariant} />
        <div className="flex-1 space-y-2">
          <EnhancedSkeleton className="h-4 w-3/4" variant={skeletonVariant} />
          <EnhancedSkeleton className="h-3 w-1/2" variant={skeletonVariant} />
        </div>
        <EnhancedSkeleton className="w-8 h-8" rounded="lg" variant={skeletonVariant} />
      </div>
    );
  }

  if (variant === 'media' || withImage) {
    if (imagePosition === 'left') {
      return (
        <div className="flex gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <EnhancedSkeleton className="w-24 h-24 flex-shrink-0" rounded="lg" variant={skeletonVariant} />
          <div className="flex-1 space-y-3">
            <EnhancedSkeleton className="h-5 w-3/4" variant={skeletonVariant} />
            <TextSkeleton lines={2} variant={skeletonVariant} />
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <EnhancedSkeleton className="w-full h-48" rounded="none" variant={skeletonVariant} />
        <div className="p-4 space-y-3">
          <EnhancedSkeleton className="h-5 w-3/4" variant={skeletonVariant} />
          <TextSkeleton lines={2} variant={skeletonVariant} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-4">
      <div className="flex items-center gap-3">
        <EnhancedSkeleton className="w-10 h-10" rounded="lg" variant={skeletonVariant} />
        <div className="space-y-1.5">
          <EnhancedSkeleton className="h-4 w-24" variant={skeletonVariant} />
          <EnhancedSkeleton className="h-3 w-16" variant={skeletonVariant} />
        </div>
      </div>
      <TextSkeleton lines={3} variant={skeletonVariant} />
    </div>
  );
}

// ============================================
// Table Skeleton
// ============================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  withHeader?: boolean;
  variant?: EnhancedSkeletonProps['variant'];
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  withHeader = true,
  variant = 'shimmer',
}: TableSkeletonProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {withHeader && (
        <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          {Array.from({ length: columns }).map((_, index) => (
            <EnhancedSkeleton key={index} className="h-4 flex-1" variant={variant} />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex gap-4 p-4',
            rowIndex < rows - 1 && 'border-b border-slate-100 dark:border-slate-800'
          )}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <EnhancedSkeleton
              key={colIndex}
              className={cn('h-4 flex-1', colIndex === 0 && 'max-w-[200px]')}
              variant={variant}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Dashboard Skeleton
// ============================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <EnhancedSkeleton className="h-8 w-48" />
          <EnhancedSkeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <EnhancedSkeleton className="h-10 w-10" rounded="lg" />
          <EnhancedSkeleton className="h-10 w-32" rounded="lg" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} variant="stats" />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <EnhancedSkeleton className="h-64 w-full" rounded="xl" />
          <CardSkeleton variant="simple" />
        </div>
        <div className="space-y-4">
          <CardSkeleton variant="profile" />
          <CardSkeleton variant="list-item" />
          <CardSkeleton variant="list-item" />
          <CardSkeleton variant="list-item" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Animated Spinner
// ============================================

interface AnimatedSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'default' | 'primary' | 'white' | 'success';
  label?: string;
}

const spinnerSizes = {
  xs: 'w-3 h-3 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
  xl: 'w-12 h-12 border-3',
};

const spinnerColors = {
  default: 'border-slate-200 dark:border-slate-700 border-t-slate-600 dark:border-t-slate-300',
  primary: 'border-violet-200 border-t-violet-600',
  white: 'border-white/30 border-t-white',
  success: 'border-violet-200 border-t-violet-600',
};

export function AnimatedSpinner({ size = 'md', color = 'default', label }: AnimatedSpinnerProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.75, ease: 'linear' }}
        className={cn('rounded-full', spinnerSizes[size], spinnerColors[color])}
      />
      {label && (
        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      )}
    </div>
  );
}

// ============================================
// Bouncing Dots
// ============================================

interface BouncingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

export function BouncingDots({ size = 'md', color = 'bg-violet-500' }: BouncingDotsProps) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn('rounded-full', dotSizes[size], color)}
          animate={{ y: [0, -8, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.6,
            delay: index * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Animated Progress Bar
// ============================================

interface AnimatedProgressBarProps {
  progress?: number;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'danger' | 'gradient';
  showValue?: boolean;
  label?: string;
}

const progressSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const progressColors = {
  default: 'bg-violet-500',
  success: 'bg-violet-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  gradient: 'bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500',
};

export function AnimatedProgressBar({
  progress = 0,
  indeterminate = false,
  size = 'md',
  color = 'default',
  showValue = false,
  label,
}: AnimatedProgressBarProps) {
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
          {showValue && !indeterminate && (
            <span className="text-sm text-slate-500 dark:text-slate-400">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700',
          progressSizes[size]
        )}
      >
        {indeterminate ? (
          <motion.div
            className={cn('h-full rounded-full', progressColors[color])}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{ width: '30%' }}
          />
        ) : (
          <motion.div
            className={cn('h-full rounded-full', progressColors[color])}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Overlay Loader
// ============================================

interface OverlayLoaderProps {
  message?: string;
  variant?: 'spinner' | 'dots' | 'progress';
  progress?: number;
  blur?: boolean;
}

export function OverlayLoader({
  message = 'Loading...',
  variant = 'spinner',
  progress = 0,
  blur = true,
}: OverlayLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-50 rounded-[inherit]',
        blur && 'backdrop-blur-sm'
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {variant === 'spinner' && <AnimatedSpinner size="lg" color="primary" />}
        {variant === 'dots' && <BouncingDots size="lg" />}
        {variant === 'progress' && (
          <div className="w-48">
            <AnimatedProgressBar progress={progress} size="md" color="gradient" showValue />
          </div>
        )}
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-slate-600 dark:text-slate-400 font-medium"
        >
          {message}
        </motion.p>
      </div>
    </motion.div>
  );
}

// ============================================
// Typing Indicator
// ============================================

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md w-fit">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            repeat: Infinity,
            duration: 0.8,
            delay: index * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default {
  EnhancedSkeleton,
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  AnimatedSpinner,
  BouncingDots,
  AnimatedProgressBar,
  OverlayLoader,
  TypingIndicator,
};
