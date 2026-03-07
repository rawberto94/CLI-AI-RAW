import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Enhanced Skeleton component with shimmer effect (P3: Performance)
 */
export function Skeleton({ 
  className = '', 
  shimmer = true,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <div
      className={cn(
        'rounded bg-gray-200 dark:bg-gray-700',
        shimmer && 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]',
        !shimmer && 'animate-pulse',
        className
      )}
      {...props}
    />
  );
}

/**
 * Table skeleton with realistic structure
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-gray-100 dark:border-gray-800">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton 
              key={j} 
              className={cn('h-4 flex-1', j === 0 && 'max-w-[200px]')} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Enhanced card skeleton with icon and details
 */
export function CardSkeleton({ hasIcon = true }: { hasIcon?: boolean }) {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        {hasIcon && <Skeleton className="h-8 w-8 rounded-full" />}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/**
 * KPI Card skeleton for dashboard
 */
export function KPICardSkeleton() {
  return (
    <div className="border rounded-xl p-5 bg-white dark:bg-gray-800/50 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * Full dashboard skeleton with realistic layout
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome banner skeleton */}
      <div className="rounded-xl p-6 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-4 bg-white dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border rounded-xl p-5 bg-white dark:bg-gray-800/50 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-xl p-5 bg-white dark:bg-gray-800/50 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Contract list skeleton
 */
export function ContractListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      {/* Table */}
      <TableSkeleton rows={count} columns={5} />
    </div>
  );
}

/**
 * Contract detail skeleton
 */
export function ContractDetailSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CardSkeleton />
          <div className="border rounded-lg p-4 space-y-4">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <CardSkeleton hasIcon={false} />
          <CardSkeleton hasIcon={false} />
        </div>
      </div>
    </div>
  );
}

/**
 * Chat skeleton for AI interface
 */
export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-in fade-in duration-300">
      {/* Messages */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div 
          key={i} 
          className={cn(
            'flex gap-3',
            i % 2 === 0 ? 'justify-start' : 'justify-end'
          )}
        >
          {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
          <div className={cn(
            'space-y-2 max-w-[70%]',
            i % 2 === 0 ? '' : 'items-end'
          )}>
            <Skeleton className={cn('h-16 rounded-xl', i % 2 === 0 ? 'w-64' : 'w-48')} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Analytics skeleton
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-5 bg-white dark:bg-gray-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
