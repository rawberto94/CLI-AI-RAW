'use client';

import React, { memo, ReactNode } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// Base Skeleton Component
// ============================================================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
  variant?: 'default' | 'shimmer' | 'pulse';
}

export const Skeleton = memo(function Skeleton({
  className = '',
  animate = true,
  variant = 'shimmer',
  ...props
}: SkeletonProps) {
  const baseClasses = 'rounded bg-zinc-200 dark:bg-zinc-700';

  if (!animate) {
    return <div className={`${baseClasses} ${className}`} {...props} />;
  }

  if (variant === 'pulse') {
    return <div className={`${baseClasses} animate-pulse ${className}`} {...props} />;
  }

  // Shimmer variant
  return (
    <div className={`relative overflow-hidden ${baseClasses} ${className}`} {...props}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ translateX: ['0%', '200%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
});

// ============================================================================
// Text Skeleton
// ============================================================================

interface TextSkeletonProps {
  lines?: number;
  widths?: (string | number)[];
  className?: string;
  lineHeight?: string;
  spacing?: string;
}

export const TextSkeleton = memo(function TextSkeleton({
  lines = 3,
  widths,
  className = '',
  lineHeight = 'h-4',
  spacing = 'space-y-2',
}: TextSkeletonProps) {
  const defaultWidths = ['100%', '85%', '70%', '90%', '60%'];

  return (
    <div className={`${spacing} ${className}`}>
      {Array.from({ length: lines }).map((_, index) => {
        const width = widths?.[index] || defaultWidths[index % defaultWidths.length];
        return (
          <Skeleton
            key={index}
            className={lineHeight}
            style={{ width: typeof width === 'number' ? `${width}%` : width }}
          />
        );
      })}
    </div>
  );
});

// ============================================================================
// Card Skeleton
// ============================================================================

interface CardSkeletonProps {
  showImage?: boolean;
  showAvatar?: boolean;
  showActions?: boolean;
  imageHeight?: string;
  className?: string;
}

export const CardSkeleton = memo(function CardSkeleton({
  showImage = false,
  showAvatar = false,
  showActions = false,
  imageHeight = 'h-40',
  className = '',
}: CardSkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden ${className}`}
    >
      {/* Image */}
      {showImage && <Skeleton className={`${imageHeight} rounded-none`} />}

      <div className="p-4">
        {/* Header with avatar */}
        {showAvatar && (
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        )}

        {/* Title */}
        <Skeleton className="h-5 w-3/4 mb-2" />

        {/* Description */}
        <TextSkeleton lines={2} className="mb-4" />

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Table Row Skeleton
// ============================================================================

interface TableRowSkeletonProps {
  columns: number;
  rows?: number;
  showCheckbox?: boolean;
  showActions?: boolean;
  className?: string;
}

export const TableRowSkeleton = memo(function TableRowSkeleton({
  columns,
  rows = 5,
  showCheckbox = false,
  showActions = false,
  className = '',
}: TableRowSkeletonProps) {
  const totalColumns = columns + (showCheckbox ? 1 : 0) + (showActions ? 1 : 0);

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`border-b border-zinc-100 dark:border-zinc-800 ${className}`}
        >
          {showCheckbox && (
            <td className="px-4 py-3">
              <Skeleton className="w-4 h-4 rounded" />
            </td>
          )}
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <Skeleton
                className="h-4"
                style={{ width: `${50 + Math.random() * 50}%` }}
              />
            </td>
          ))}
          {showActions && (
            <td className="px-4 py-3">
              <Skeleton className="w-8 h-8 rounded-lg ml-auto" />
            </td>
          )}
        </tr>
      ))}
    </>
  );
});

// ============================================================================
// List Item Skeleton
// ============================================================================

interface ListItemSkeletonProps {
  count?: number;
  showAvatar?: boolean;
  showIcon?: boolean;
  showMeta?: boolean;
  className?: string;
}

export const ListItemSkeleton = memo(function ListItemSkeleton({
  count = 5,
  showAvatar = false,
  showIcon = false,
  showMeta = false,
  className = '',
}: ListItemSkeletonProps) {
  return (
    <div className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          {(showAvatar || showIcon) && (
            <Skeleton
              className={`flex-shrink-0 ${
                showAvatar ? 'w-10 h-10 rounded-full' : 'w-10 h-10 rounded-xl'
              }`}
            />
          )}
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {showMeta && (
            <div className="flex-shrink-0 text-right">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Dashboard Stats Skeleton
// ============================================================================

interface StatsSkeletonProps {
  count?: number;
  className?: string;
}

export const StatsSkeleton = memo(function StatsSkeleton({
  count = 4,
  className = '',
}: StatsSkeletonProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-12 h-5 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Chart Skeleton
// ============================================================================

interface ChartSkeletonProps {
  type?: 'bar' | 'line' | 'pie' | 'area';
  className?: string;
}

export const ChartSkeleton = memo(function ChartSkeleton({
  type = 'bar',
  className = '',
}: ChartSkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Chart Area */}
      {type === 'bar' && (
        <div className="flex items-end justify-between gap-3 h-48">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton
              key={index}
              className="flex-1 rounded-t-lg"
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      )}

      {type === 'line' && (
        <div className="relative h-48">
          <Skeleton className="absolute bottom-0 left-0 right-0 h-1 rounded-full" />
          <Skeleton className="absolute bottom-0 left-0 h-full w-1 rounded-full" />
          <motion.div
            className="absolute bottom-8 left-4 right-4 h-32"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <svg viewBox="0 0 100 50" className="w-full h-full">
              <path
                d="M0,40 Q25,20 50,30 T100,10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-zinc-200 dark:text-zinc-700"
              />
            </svg>
          </motion.div>
        </div>
      )}

      {type === 'pie' && (
        <div className="flex items-center justify-center h-48">
          <Skeleton className="w-40 h-40 rounded-full" />
        </div>
      )}

      {type === 'area' && (
        <div className="relative h-48 overflow-hidden rounded-lg">
          <Skeleton className="absolute inset-0" />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// Page Skeleton Layouts
// ============================================================================

export const DashboardPageSkeleton = memo(function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Stats */}
      <StatsSkeleton />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton type="bar" />
        <ChartSkeleton type="line" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <Skeleton className="h-5 w-40" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableRowSkeleton columns={5} rows={5} />
          </tbody>
        </table>
      </div>
    </div>
  );
});

export const ListPageSkeleton = memo(function ListPageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} showAvatar showActions />
        ))}
      </div>
    </div>
  );
});

export const DetailPageSkeleton = memo(function DetailPageSkeleton() {
  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <TextSkeleton lines={5} className="mb-6" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <TextSkeleton lines={8} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <Skeleton className="h-5 w-24 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <Skeleton className="h-5 w-32 mb-4" />
            <ListItemSkeleton count={3} showAvatar />
          </div>
        </div>
      </div>
    </div>
  );
});

export const FormPageSkeleton = memo(function FormPageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Form fields */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}

        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
});
