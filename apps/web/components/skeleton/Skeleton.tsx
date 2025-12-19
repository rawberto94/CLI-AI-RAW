'use client';

/**
 * Loading Skeleton Components
 * 
 * Provides consistent loading states with:
 * - Base skeleton with shimmer effect
 * - Preset patterns (card, list, table, avatar, text)
 * - Customizable dimensions and shapes
 * - Accessibility support
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Base Skeleton
// ============================================================================

export interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Shape of the skeleton */
  shape?: 'rectangle' | 'circle' | 'rounded';
  /** Custom class */
  className?: string;
  /** Whether to animate */
  animate?: boolean;
}

export function Skeleton({
  width,
  height = '1rem',
  shape = 'rounded',
  className,
  animate = true,
}: SkeletonProps) {
  const shapeClasses = {
    rectangle: 'rounded-none',
    circle: 'rounded-full',
    rounded: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        'bg-slate-200 dark:bg-slate-700',
        shapeClasses[shape],
        animate && 'animate-pulse',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      role="status"
      aria-label="Loading..."
    />
  );
}

// ============================================================================
// Shimmer Skeleton (alternative animation)
// ============================================================================

export function ShimmerSkeleton({
  width,
  height = '1rem',
  shape = 'rounded',
  className,
}: Omit<SkeletonProps, 'animate'>) {
  const shapeClasses = {
    rectangle: 'rounded-none',
    circle: 'rounded-full',
    rounded: 'rounded-lg',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-200 dark:bg-slate-700',
        shapeClasses[shape],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      role="status"
      aria-label="Loading..."
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ translateX: ['−100%', '100%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

// ============================================================================
// Text Skeleton
// ============================================================================

export interface TextSkeletonProps {
  /** Number of lines */
  lines?: number;
  /** Whether last line is shorter */
  lastLineShort?: boolean;
  /** Spacing between lines */
  spacing?: 'sm' | 'md' | 'lg';
  /** Line height variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const textSizes = {
  sm: 'h-3',
  md: 'h-4',
  lg: 'h-5',
};

const textSpacing = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-3',
};

export function TextSkeleton({
  lines = 3,
  lastLineShort = true,
  spacing = 'md',
  size = 'md',
  className,
}: TextSkeletonProps) {
  return (
    <div className={cn('flex flex-col', textSpacing[spacing], className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height="auto"
          className={cn(
            textSizes[size],
            lastLineShort && index === lines - 1 && 'w-3/4'
          )}
          width={lastLineShort && index === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Avatar Skeleton
// ============================================================================

export interface AvatarSkeletonProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export function AvatarSkeleton({ size = 'md', className }: AvatarSkeletonProps) {
  return (
    <Skeleton
      shape="circle"
      className={cn(avatarSizes[size], className)}
    />
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

export interface CardSkeletonProps {
  /** Show image placeholder */
  showImage?: boolean;
  /** Image height */
  imageHeight?: string | number;
  /** Number of text lines */
  lines?: number;
  /** Show footer actions */
  showFooter?: boolean;
  className?: string;
}

export function CardSkeleton({
  showImage = true,
  imageHeight = 160,
  lines = 3,
  showFooter = true,
  className,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white overflow-hidden',
        className
      )}
    >
      {showImage && (
        <Skeleton
          shape="rectangle"
          height={imageHeight}
          width="100%"
        />
      )}
      <div className="p-4 space-y-4">
        {/* Title */}
        <Skeleton height={24} width="70%" />
        
        {/* Description */}
        <TextSkeleton lines={lines} />

        {/* Footer */}
        {showFooter && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <AvatarSkeleton size="sm" />
              <Skeleton height={14} width={80} />
            </div>
            <Skeleton height={32} width={80} className="rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// List Item Skeleton
// ============================================================================

export interface ListItemSkeletonProps {
  /** Show avatar */
  showAvatar?: boolean;
  /** Show action button */
  showAction?: boolean;
  /** Number of text lines */
  lines?: number;
  className?: string;
}

export function ListItemSkeleton({
  showAvatar = true,
  showAction = true,
  lines = 2,
  className,
}: ListItemSkeletonProps) {
  return (
    <div className={cn('flex items-center gap-4 p-4', className)}>
      {showAvatar && <AvatarSkeleton size="md" />}
      <div className="flex-1 min-w-0">
        <Skeleton height={18} width="60%" className="mb-2" />
        {lines > 1 && <Skeleton height={14} width="40%" />}
      </div>
      {showAction && <Skeleton height={32} width={80} className="rounded-lg" />}
    </div>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

export interface TableSkeletonProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show header */
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200 overflow-hidden', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-4 p-4 bg-slate-50 border-b border-slate-200">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              height={14}
              width={i === 0 ? '20%' : '15%'}
            />
          ))}
        </div>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex items-center gap-4 p-4',
            rowIndex < rows - 1 && 'border-b border-slate-100'
          )}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              height={16}
              width={colIndex === 0 ? '25%' : `${15 + Math.random() * 10}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Stats Skeleton
// ============================================================================

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-slate-200 bg-white"
        >
          <Skeleton height={14} width="50%" className="mb-3" />
          <Skeleton height={32} width="70%" className="mb-2" />
          <Skeleton height={12} width="40%" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Page Skeleton
// ============================================================================

export function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton shape="circle" height={48} width={48} />
          <div>
            <Skeleton height={28} width={200} className="mb-2" />
            <Skeleton height={16} width={300} />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton height={40} width={100} className="rounded-lg" />
          <Skeleton height={40} width={100} className="rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <StatsSkeleton />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TableSkeleton rows={6} />
        </div>
        <div className="space-y-4">
          <CardSkeleton showImage={false} lines={4} />
          <CardSkeleton showImage={false} lines={3} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Form Skeleton
// ============================================================================

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton height={14} width="30%" className="mb-2" />
          <Skeleton height={40} width="100%" className="rounded-lg" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton height={40} width={100} className="rounded-lg" />
        <Skeleton height={40} width={120} className="rounded-lg" />
      </div>
    </div>
  );
}

export default Skeleton;
