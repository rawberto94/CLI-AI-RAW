'use client';

/**
 * Loading Skeleton Components
 * Consistent loading states across the application
 * 
 * @example
 * import { Skeleton, CardSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
 * 
 * if (isLoading) return <CardSkeleton />;
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Base Skeleton
// ============================================================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation type */
  animation?: 'pulse' | 'shimmer' | 'none';
  /** Border radius */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({
  className,
  animation = 'pulse',
  rounded = 'md',
  ...props
}: SkeletonProps) {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'skeleton-shimmer',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-gray-200',
        roundedClasses[rounded],
        animationClasses[animation],
        className
      )}
      {...props}
    />
  );
}

// ============================================================================
// Text Skeleton
// ============================================================================

interface TextSkeletonProps extends Omit<SkeletonProps, 'children'> {
  /** Number of lines */
  lines?: number;
  /** Width of last line (percentage) */
  lastLineWidth?: number;
}

export function TextSkeleton({
  lines = 3,
  lastLineWidth = 60,
  className,
  ...props
}: TextSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{
            width: i === lines - 1 ? `${lastLineWidth}%` : '100%',
          }}
          {...props}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

interface CardSkeletonProps {
  /** Show header */
  showHeader?: boolean;
  /** Show image/media */
  showMedia?: boolean;
  /** Number of content lines */
  contentLines?: number;
  /** Show footer */
  showFooter?: boolean;
  className?: string;
}

export function CardSkeleton({
  showHeader = true,
  showMedia = false,
  contentLines = 3,
  showFooter = true,
  className,
}: CardSkeletonProps) {
  return (
    <div className={cn('bg-white rounded-lg border p-4 space-y-4', className)}>
      {showMedia && (
        <Skeleton className="h-48 w-full" rounded="lg" />
      )}
      
      {showHeader && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" rounded="full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      )}
      
      <TextSkeleton lines={contentLines} lastLineWidth={70} />
      
      {showFooter && (
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

interface TableSkeletonProps {
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
    <div className={cn('w-full', className)}>
      {showHeader && (
        <div className="flex gap-4 p-4 bg-gray-50 rounded-t-lg border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-4 flex-1"
              style={{ maxWidth: i === 0 ? '30%' : '20%' }}
            />
          ))}
        </div>
      )}
      
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 p-4 items-center">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className="h-4 flex-1"
                style={{
                  maxWidth: colIndex === 0 ? '30%' : '20%',
                  width: `${70 + Math.random() * 30}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

interface ListSkeletonProps {
  /** Number of items */
  items?: number;
  /** Show avatar/icon */
  showAvatar?: boolean;
  /** Show description */
  showDescription?: boolean;
  /** Show action */
  showAction?: boolean;
  className?: string;
}

export function ListSkeleton({
  items = 5,
  showAvatar = true,
  showDescription = true,
  showAction = false,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn('divide-y', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          {showAvatar && (
            <Skeleton className="h-10 w-10 flex-shrink-0" rounded="full" />
          )}
          
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            {showDescription && (
              <Skeleton className="h-3 w-1/2" />
            )}
          </div>
          
          {showAction && (
            <Skeleton className="h-8 w-16 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Form Skeleton
// ============================================================================

interface FormSkeletonProps {
  /** Number of fields */
  fields?: number;
  /** Show submit button */
  showSubmit?: boolean;
  className?: string;
}

export function FormSkeleton({
  fields = 4,
  showSubmit = true,
  className,
}: FormSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      
      {showSubmit && (
        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Grid Skeleton
// ============================================================================

interface GridSkeletonProps {
  /** Number of items */
  items?: number;
  /** Number of columns */
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Card variant */
  cardVariant?: 'simple' | 'media' | 'full';
  className?: string;
}

export function GridSkeleton({
  items = 6,
  columns = 3,
  cardVariant = 'simple',
  className,
}: GridSkeletonProps) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', colClasses[columns], className)}>
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton
          key={i}
          showMedia={cardVariant === 'media' || cardVariant === 'full'}
          showHeader={cardVariant === 'full'}
          showFooter={cardVariant !== 'simple'}
          contentLines={cardVariant === 'simple' ? 2 : 3}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Stat Skeleton
// ============================================================================

interface StatSkeletonProps {
  className?: string;
}

export function StatSkeleton({ className }: StatSkeletonProps) {
  return (
    <div className={cn('p-4 bg-white rounded-lg border', className)}>
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-8 w-24 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// Dashboard Skeleton
// ============================================================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats */}
      <StatGridSkeleton count={4} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="bg-white rounded-lg border p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-40" />
        </div>
        <TableSkeleton rows={5} columns={5} showHeader={true} />
      </div>
    </div>
  );
}

// ============================================================================
// Page Skeleton
// ============================================================================

interface PageSkeletonProps {
  /** Show breadcrumb */
  showBreadcrumb?: boolean;
  /** Show sidebar */
  showSidebar?: boolean;
  /** Content type */
  contentType?: 'form' | 'table' | 'grid' | 'detail';
}

export function PageSkeleton({
  showBreadcrumb = true,
  showSidebar = false,
  contentType = 'table',
}: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-48 hidden md:block" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" rounded="full" />
            <Skeleton className="h-10 w-10" rounded="full" />
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-64 bg-white border-r p-4 hidden lg:block">
            <ListSkeleton items={8} showAvatar={false} showDescription={false} />
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Breadcrumb */}
          {showBreadcrumb && (
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
          )}

          {/* Page Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg border">
            {contentType === 'form' && (
              <div className="p-6">
                <FormSkeleton fields={5} />
              </div>
            )}
            
            {contentType === 'table' && (
              <TableSkeleton rows={10} columns={5} />
            )}
            
            {contentType === 'grid' && (
              <div className="p-6">
                <GridSkeleton items={9} columns={3} cardVariant="media" />
              </div>
            )}
            
            {contentType === 'detail' && (
              <div className="p-6 space-y-6">
                <div className="flex gap-6">
                  <Skeleton className="h-32 w-32 flex-shrink-0" rounded="lg" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-8 w-2/3" />
                    <TextSkeleton lines={3} />
                    <div className="flex gap-3">
                      <Skeleton className="h-6 w-20" rounded="full" />
                      <Skeleton className="h-6 w-24" rounded="full" />
                    </div>
                  </div>
                </div>
                <div className="border-t pt-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <TextSkeleton lines={5} />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Contract-specific Skeletons
// ============================================================================

export function ContractCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-20" rounded="full" />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export function ContractListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ContractCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ContractDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border p-6">
        <TextSkeleton lines={8} />
      </div>
    </div>
  );
}

// ============================================================================
// Shimmer Animation CSS (add to global styles)
// ============================================================================

/*
Add this to your global CSS:

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #e5e7eb 0%,
    #f3f4f6 50%,
    #e5e7eb 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
*/

// ============================================================================
// Exports
// ============================================================================

export default Skeleton;
